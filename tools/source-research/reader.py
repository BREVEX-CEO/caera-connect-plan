#!/usr/bin/env python3
"""Sequential immutable source research. Python standard library + Git only."""
import argparse
import codecs
import contextlib
import io
import hashlib
import json
import os
import re
from pathlib import Path
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
import zlib

LIMIT = 1200
STATE = '.source-research'


def encode(value):
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(',', ':'))


def pack(value):
    return b'Z'+zlib.compress(encode(value).encode(), level=6)


def load(value):
    return json.loads(zlib.decompress(value[1:]) if isinstance(value,bytes) and value.startswith(b'Z') else value)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    p = subprocess.run(['git', '-C', str(root), *args], capture_output=True,
                       env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GIT_NO_LAZY_FETCH':'1'})
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout


def tree(root):
    out = {}
    for item in git(root, 'ls-tree', '-rz', '--full-tree', 'HEAD').split(b'\0'):
        if item:
            metadata, path = item.split(b'\t', 1)
            out[os.fsdecode(path)] = metadata.decode().split()
    return out


def blocks(path):
    if path.is_symlink():
        yield os.fsencode(os.readlink(path))
    else:
        with path.open('rb') as source:
            while block := source.read(1024 * 1024):
                yield block


def fingerprint(path):
    st=path.lstat()
    return [st.st_dev,st.st_ino,st.st_size,st.st_mtime_ns,st.st_ctime_ns]


def inspect(path, source=None):
    """Hash ALL bytes; decode without normalizing newline terminators or BOM."""
    initial_fingerprint=fingerprint(path) if source is None else None
    h = hashlib.sha256()
    size = chars = lines = 0
    last = ''
    encoding, decoder, problem = None, None, None
    prefix = b''
    for block in (source if source is not None else blocks(path)):
        h.update(block)
        size += len(block)
        if decoder is None and problem is None:
            prefix = block[:1024]
            for bom, name in ((codecs.BOM_UTF32_LE, 'utf-32-le'), (codecs.BOM_UTF32_BE, 'utf-32-be'),
                              (codecs.BOM_UTF16_LE, 'utf-16-le'), (codecs.BOM_UTF16_BE, 'utf-16-be')):
                if block.startswith(bom):
                    encoding = name
                    break
            else:
                encoding = 'utf-8'
            decoder = codecs.getincrementaldecoder(encoding)(errors='strict')
        if not problem:
            try:
                text = decoder.decode(block)
                if re.search(r'[\x00-\x08\x0e-\x1f]', text):
                    problem = 'binary_or_unsupported_format'
                chars += len(text)
                lines += text.count('\n')
                if text:
                    last = text[-1]
            except UnicodeError:
                problem = 'unsupported_text_encoding'
    if decoder and not problem:
        try:
            tail = decoder.decode(b'', final=True)
            chars += len(tail)
            lines += tail.count('\n')
            if tail:
                last = tail[-1]
        except UnicodeError:
            problem = 'unsupported_text_encoding'
    if not size:
        encoding = 'utf-8'
    if prefix.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
        problem = 'unmaterialized_lfs_pointer'
    final_fingerprint=fingerprint(path) if source is None else None
    if initial_fingerprint!=final_fingerprint:
        problem='source_changed_during_scan'
    return dict(fingerprint=final_fingerprint,
                size=size, sha256=h.hexdigest(), encoding=None if problem else encoding,
                characters=None if problem else chars,
                lines=None if problem else lines + int(bool(chars) and last != '\n'), exception=problem)


def slice_text(path, encoding, start, length, byte_start=None):
    if path.is_symlink():
        return os.fsencode(os.readlink(path)).decode(encoding)[start:start + length]
    with path.open('rb') as raw:
        if byte_start is not None:
            raw.seek(byte_start)
            start=0
        with io.TextIOWrapper(raw,encoding=encoding,newline='') as stream:
            while start:
                value = stream.read(min(start, 1024 * 1024))
                if not value:
                    raise RuntimeError('Unexpected EOF before section')
                start -= len(value)
            return stream.read(length)


def parts(text, line, column):
    result = []
    start = 0
    while start < len(text):
        end = text.find('\n', start)
        end = len(text) if end < 0 else end + 1
        value = text[start:end]
        result.append(dict(line=line, column=column, text=value))
        if value.endswith('\n'):
            line, column = line + 1, 0
        else:
            column += len(value)
        start = end
    return result, line, column


SCHEMA = '''
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE repositories(path TEXT PRIMARY KEY,pin TEXT,tree TEXT,entries TEXT);
CREATE TABLE directories(path TEXT PRIMARY KEY);
CREATE TABLE files(path TEXT PRIMARY KEY,data TEXT NOT NULL,readable INTEGER NOT NULL,total INTEGER,complete INTEGER NOT NULL DEFAULT 0);
CREATE INDEX incomplete_files ON files(readable,complete,path);
CREATE TABLE sections(id INTEGER PRIMARY KEY,path TEXT NOT NULL REFERENCES files(path),
 start INTEGER NOT NULL,end INTEGER NOT NULL,line INTEGER NOT NULL,col INTEGER NOT NULL,
 end_line INTEGER NOT NULL,end_col INTEGER NOT NULL,payload TEXT NOT NULL,token TEXT NOT NULL,
 delivered INTEGER NOT NULL DEFAULT 0,acknowledged INTEGER NOT NULL DEFAULT 0,
 UNIQUE(path,start),CHECK(end>=start),CHECK(acknowledged<=delivered));
CREATE TABLE events(id INTEGER PRIMARY KEY,at REAL NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,
 previous TEXT NOT NULL,hash TEXT NOT NULL);
CREATE TABLE findings(id INTEGER PRIMARY KEY,section INTEGER REFERENCES sections(id),text TEXT NOT NULL);
CREATE TABLE decisions(id INTEGER PRIMARY KEY,action TEXT,evidence TEXT,rationale TEXT);
'''


class Reader:
    def __init__(self, root, state=None):
        self.root = Path(root).resolve()
        self.state = Path(state).resolve() if state else self.root / STATE
        self.path = self.state / 'coverage.sqlite3'

    def connect(self):
        db = sqlite3.connect(self.path, timeout=60)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA synchronous=FULL')
        return db

    @staticmethod
    def event(db, kind, data):
        prior = db.execute('SELECT hash FROM events ORDER BY id DESC LIMIT 1').fetchone()
        prior = prior[0] if prior else '0' * 64
        now, data = time.time(), encode(data)
        db.execute('INSERT INTO events(at,kind,data,previous,hash) VALUES(?,?,?,?,?)',
                   (now, kind, data, prior, sha(encode([now, kind, data, prior]).encode())))

    @staticmethod
    def manifest(db):
        h = hashlib.sha256()
        for key,value in db.execute("SELECT key,value FROM meta WHERE key IN ('root','limit','inventory_summary') ORDER BY key"):
            h.update(encode([key,value]).encode()+b'\n')
        for table in ('repositories', 'directories', 'files'):
            query = 'SELECT path,data,readable,total FROM files ORDER BY path' if table=='files' else f'SELECT * FROM {table} ORDER BY path'
            for row in db.execute(query):
                for value in row:
                    raw = value if isinstance(value,bytes) else encode(value).encode()
                    h.update(str(len(raw)).encode()+b':'+raw)
                h.update(b'\n')
        return h.hexdigest()

    def key(self, path):
        # JSON keys preserve even non-UTF8 Git filenames using surrogate escapes.
        return encode(str(path.relative_to(self.root)))

    def add_file(self, db, path, data):
        db.execute('INSERT OR REPLACE INTO files(path,data,readable,total) VALUES(?,?,?,?)',
                   (self.key(path),pack(data),int(bool(data.get('encoding') and not data.get('exception'))),data.get('characters')))

    def capacity(self):
        queue, count, repositories = [self.root], 0, 0
        while queue:
            repo=queue.pop(0)
            entries=tree(repo)
            repositories += 1
            count += sum(v[1]=='blob' for v in entries.values())
            for name, values in entries.items():
                if values[1]=='commit' and (repo/name/'.git').exists():
                    queue.append(repo/name)
        # Conservative metadata floor only; delivery receipts and source hydration
        # need additional capacity. Nothing is omitted to fit the budget.
        required=count*1024 + 64*1024**2
        free=shutil.disk_usage(self.state if self.state.exists() else self.root).free
        return dict(repositories=repositories,tracked_file_entries=count,free_bytes=free,
                    minimum_inventory_bytes=required,sufficient=free>=required)

    def initialize(self):
        if self.path.exists():
            raise RuntimeError('Snapshot exists. Resume next; never erase prior coverage.')
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = self.state / 'building.sqlite3'
        if temporary.exists():
            raise RuntimeError('Interrupted inventory exists. Preserve/rename building.sqlite3 before retrying init.')
        db = sqlite3.connect(temporary)
        db.executescript(SCHEMA)
        db.execute('INSERT INTO meta VALUES(?,?)', ('root', str(self.root)))
        db.execute('INSERT INTO meta VALUES(?,?)', ('limit', str(LIMIT)))
        repositories, queue = [], [self.root]
        while queue:
            repo = queue.pop(0)
            entries = tree(repo)
            db.execute('INSERT INTO repositories VALUES(?,?,?,?)',
                       (self.key(repo), git(repo, 'rev-parse', 'HEAD').decode().strip(),
                        git(repo, 'rev-parse', 'HEAD^{tree}').decode().strip(), pack(entries)))
            repositories.append((repo, entries))
            for name, (mode, kind, oid) in entries.items():
                path = repo / name
                if kind == 'commit':
                    if (path / '.git').exists():
                        actual = git(path, 'rev-parse', 'HEAD').decode().strip()
                        if actual == oid:
                            queue.append(path)
                        else:
                            self.add_file(db, path, dict(kind='gitlink', git_oid=oid, exception='pin_mismatch: ' + actual))
                    else:
                        self.add_file(db, path, dict(kind='gitlink', git_oid=oid, exception='uninitialized_or_inaccessible_submodule'))
                elif not path.exists() and not path.is_symlink():
                    self.add_file(db, path, dict(kind='missing', mode=mode, git_oid=oid, exception='tracked_file_missing'))
        def walk_error(error):
            self.add_file(db, Path(error.filename), dict(kind='directory', exception='inaccessible_directory: ' + str(error)))
        for folder, directories, filenames in os.walk(self.root, followlinks=False, onerror=walk_error):
            parent = Path(folder)
            directories[:] = sorted(d for d in directories if d != '.git' and (parent / d) != self.state)
            for name in list(directories):
                path = parent / name
                if path.is_symlink():
                    directories.remove(name)
                    filenames.append(name)
                else:
                    db.execute('INSERT INTO directories VALUES(?)', (self.key(path),))
            for name in sorted(filenames):
                if name == '.git':
                    continue
                path = parent / name
                if db.execute('SELECT 1 FROM files WHERE path=?', (self.key(path),)).fetchone():
                    continue
                try:
                    kind = 'symlink' if path.is_symlink() else 'file'
                    if not path.is_file() and kind != 'symlink':
                        self.add_file(db, path, dict(kind='special', exception='unsupported_filesystem_node'))
                    else:
                        self.add_file(db, path, dict(kind=kind, **inspect(path)))
                except (OSError, UnicodeError) as ex:
                    self.add_file(db, path, dict(kind='file', exception='inaccessible_file: ' + str(ex)))
        for repo, entries in repositories:
            small_blobs = self.small_blobs(repo, entries)
            for name, (mode, kind, oid) in entries.items():
                if kind == 'commit':
                    continue
                key = self.key(repo / name)
                row = db.execute('SELECT data FROM files WHERE path=?', (key,)).fetchone()
                data = load(row[0])
                data.update(mode=mode, git_oid=oid, repository=str(repo.relative_to(self.root)))
                if data.get('exception') == 'tracked_file_missing':
                    try:
                        with self.git_stream(repo, oid) as stream:
                            measured = inspect(repo/name, iter(lambda: stream.read(1024*1024), b''))
                        data.update(measured, storage='git_blob', materialization_exception='tracked_file_missing')
                    except (OSError, RuntimeError) as error:
                        data['exception'] = 'missing_worktree_and_unavailable_git_blob: ' + str(error)
                if data.get('sha256'):
                    blob = small_blobs.get(oid, b'')
                    if blob.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
                        fields = dict(line.split(b' ', 1) for line in blob.splitlines() if b' ' in line)
                        data['lfs_oid'] = fields.get(b'oid', b'').decode().removeprefix('sha256:')
                        if data['sha256'] != data['lfs_oid'] or data['size'] != int(fields[b'size']):
                            data.update(exception='unmaterialized_or_changed_lfs_payload', encoding=None)
                    if 'lfs_oid' not in data and data.get('storage') != 'git_blob' and self.git_hash(repo / name) != oid:
                        data['exception'] = 'worktree_differs_from_git_blob'
                db.execute('UPDATE files SET data=?,readable=?,total=? WHERE path=?',
                           (pack(data),int(bool(data.get('encoding') and not data.get('exception'))),data.get('characters'),key))
        db.execute('INSERT INTO meta VALUES(?,?)', ('inventory_summary',encode(self.inventory_summary(db))))
        db.execute('INSERT INTO meta VALUES(?,?)', ('inventory_sha256', self.manifest(db)))
        self.event(db, 'snapshot', {'root': str(self.root), 'limit': LIMIT})
        db.commit()
        db.close()
        os.replace(temporary, self.path)
        self.path.chmod(0o600)
        return self.status()

    @staticmethod
    @contextlib.contextmanager
    def git_stream(repo, oid):
        env = {**os.environ, 'GIT_NO_LAZY_FETCH': '1', 'GIT_TERMINAL_PROMPT': '0'}
        process = subprocess.Popen(['git','-C',str(repo),'cat-file','blob',oid],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        try:
            yield process.stdout
            process.stdout.close()
            error = process.stderr.read()
            if process.wait():
                raise RuntimeError(error.decode('utf-8', 'replace'))
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait()
            process.stdout.close()
            process.stderr.close()

    def read_text(self, path, data, start, length, byte_start=None):
        if data.get('storage') != 'git_blob':
            return slice_text(self.root/path, data['encoding'], start, length, byte_start)
        # A bounded read may close the pipe early (Git can exit with SIGPIPE).
        process = subprocess.Popen(['git','-C',str(self.root/data['repository']),
                                    'cat-file','blob',data['git_oid']], stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, env={**os.environ,'GIT_NO_LAZY_FETCH':'1'})
        try:
            with io.TextIOWrapper(process.stdout, encoding=data['encoding'], newline='') as stream:
                while start:
                    block = stream.read(min(start,1024*1024))
                    if not block:
                        raise RuntimeError('Git blob truncated')
                    start -= len(block)
                return stream.read(length)
        finally:
            if process.poll() is None:
                process.terminate()
            process.wait()
            process.stdout.close()
            process.stderr.close()

    @staticmethod
    def small_blobs(repo, entries):
        ids = sorted({v[2] for v in entries.values() if v[1] == 'blob'})
        if not ids:
            return {}
        def batch(option, values):
            p = subprocess.run(['git', '-C', str(repo), 'cat-file', option],
                               input=('\n'.join(values)+'\n').encode(), capture_output=True,
                               env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GIT_NO_LAZY_FETCH':'1'})
            if p.returncode:
                raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
            return p.stdout
        checks = batch('--batch-check', ids)
        small = []
        for record in checks.splitlines():
            fields=record.decode().split()
            if len(fields)!=3:
                continue  # The per-file Git stream records missing-object errors.
            oid, kind, size = fields
            if kind == 'blob' and int(size) < 1024:
                small.append(oid)
        if not small:
            return {}
        raw, offset, out = batch('--batch', small), 0, {}
        for expected in small:
            end = raw.index(b'\n', offset)
            oid, kind, size = raw[offset:end].decode().split()
            size = int(size)
            if oid != expected or kind != 'blob':
                raise RuntimeError('Git batch output mismatch')
            out[oid] = raw[end+1:end+1+size]
            offset = end+size+2
        return out

    @staticmethod
    def git_hash(path):
        size = len(os.fsencode(os.readlink(path))) if path.is_symlink() else path.stat().st_size
        h = hashlib.sha1(b'blob ' + str(size).encode() + b'\0')
        for block in blocks(path):
            h.update(block)
        return h.hexdigest()

    def unchanged(self, path, data, full=False):
        if not full:
            if data.get('storage')=='git_blob':
                git(self.root/data['repository'],'cat-file','-e',data['git_oid'])
                return
            if fingerprint(self.root/path)==data.get('fingerprint'):
                return
        if data.get('storage') == 'git_blob':
            with self.git_stream(self.root/data['repository'], data['git_oid']) as source:
                actual = inspect(self.root/path, iter(lambda: source.read(1024*1024), b''))
        else:
            actual = inspect(self.root / path)
        if actual['sha256'] != data.get('sha256') or actual['size'] != data.get('size'):
            raise RuntimeError('CHANGED SOURCE: ' + path + '; preserve old snapshot and findings')

    @staticmethod
    def envelope(section):
        return dict(section=section['id'], payload=json.loads(section['payload']),
                    receipt=dict(payload_utf8_bytes=len(section['payload'].encode()),
                                 payload_sha256=sha(section['payload'].encode()), token=section['token']))

    def next(self):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for row in db.execute('SELECT * FROM files WHERE readable=1 AND complete=0 ORDER BY path LIMIT 1'):
                data = load(row['data'])
                section = db.execute('SELECT * FROM sections WHERE path=? AND acknowledged=0 ORDER BY start LIMIT 1', (row['path'],)).fetchone()
                if section:
                    self.unchanged(json.loads(row['path']), data)
                    self.event(db, 'replay', {'section': section['id']})
                    return self.envelope(section)
                prior = db.execute('SELECT * FROM sections WHERE path=? ORDER BY start DESC LIMIT 1', (row['path'],)).fetchone()
                start = prior['end'] if prior else 0
                if prior and start >= data['characters']:
                    continue
                path = json.loads(row['path'])
                self.unchanged(path, data)
                byte_start=json.loads(prior['payload'])['end_byte'] if prior else 0
                text = self.read_text(path, data, start, LIMIT, byte_start)
                if len(text) != min(LIMIT, data['characters'] - start):
                    raise RuntimeError('Source truncated or changed while reading')
                line, col = (prior['end_line'], prior['end_col']) if prior else (1, 0)
                segments, end_line, end_col = parts(text, line, col)
                payload = dict(path=path, source_sha256=data['sha256'], encoding=data['encoding'], file_characters=data['characters'],
                               start_character=start, end_character=start + len(text),
                               start_byte=byte_start,end_byte=byte_start+len(text.encode(data['encoding'])),
                               start_line=line, start_column=col, end_line=end_line, end_column=end_col,
                               parts=segments, empty_file=not data['characters'])
                while len(encode(payload).encode()) > 8192:
                    if len(text)<=1:
                        raise RuntimeError('Source path metadata exceeds bounded output capacity: '+path)
                    text = text[:max(1, len(text)//2)]
                    segments, end_line, end_col = parts(text, line, col)
                    payload.update(end_character=start+len(text),end_byte=byte_start+len(text.encode(data['encoding'])), end_line=end_line, end_column=end_col, parts=segments)
                cursor = db.execute('''INSERT INTO sections(path,start,end,line,col,end_line,end_col,payload,token)
                                       VALUES(?,?,?,?,?,?,?,?,?)''',
                                    (row['path'], start, start + len(text), line, col, end_line, end_col,
                                     encode(payload), secrets.token_hex(24)))
                section = db.execute('SELECT * FROM sections WHERE id=?', (cursor.lastrowid,)).fetchone()
                self.event(db, 'offer', {'section': section['id'], 'sha256': sha(section['payload'].encode())})
                return self.envelope(section)
        return dict(message='No further readable sections. Exceptions still block completion.', status=self.status())

    def confirm(self, section_id, token, checksum, acknowledge=False, note=None, received=None):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            section = db.execute('SELECT * FROM sections WHERE id=?', (section_id,)).fetchone()
            if not section or token != section['token'] or checksum != sha(section['payload'].encode()):
                raise RuntimeError('Incomplete/incorrect receipt; coverage not advanced')
            first = db.execute('SELECT id FROM sections WHERE acknowledged=0 ORDER BY path,start LIMIT 1').fetchone()
            if not first or first[0] != section_id:
                raise RuntimeError('Duplicate/out-of-order confirmation rejected')
            data = load(db.execute('SELECT data FROM files WHERE path=?', (section['path'],)).fetchone()[0])
            self.unchanged(json.loads(section['path']), data)
            if acknowledge:
                if not section['delivered'] or not note or not note.strip():
                    raise RuntimeError('Prior delivery and explicit processing acknowledgment required')
                db.execute('UPDATE sections SET acknowledged=1 WHERE id=?', (section_id,))
                if section['end']==data['characters']:
                    db.execute('UPDATE files SET complete=1 WHERE path=?',(section['path'],))
                db.execute('INSERT INTO findings(section,text) VALUES(?,?)', (section_id, note))
                self.event(db, 'acknowledge', {'section': section_id, 'note': note})
            else:
                if received != self.envelope(section):
                    raise RuntimeError('Complete received JSON must match offered content; truncated/altered output rejected')
                if section['delivered']:
                    raise RuntimeError('Duplicate delivery receipt rejected; replay is not new coverage')
                db.execute('UPDATE sections SET delivered=1 WHERE id=?', (section_id,))
                self.event(db, 'delivery', {'section': section_id, 'sha256': checksum})
        return self.status()

    @staticmethod
    def inventory_summary(db):
        result=dict(repositories=db.execute('SELECT COUNT(*) FROM repositories').fetchone()[0],
                    directories=db.execute('SELECT COUNT(*) FROM directories').fetchone()[0],
                    files=0,readable_files=0,readable_lines=0,readable_characters=0,unresolved_exceptions=0)
        for row in db.execute('SELECT data FROM files'):
            data=load(row[0])
            result['files']+=1
            result['unresolved_exceptions']+=int(bool(data.get('exception') or data.get('materialization_exception')))
            if data.get('encoding') and not data.get('exception'):
                result['readable_files']+=1
                result['readable_lines']+=data['lines']
                result['readable_characters']+=data['characters']
        return result

    def status(self):
        with self.connect() as db:
            result=load(db.execute("SELECT value FROM meta WHERE key='inventory_summary'").fetchone()[0])
            total=result['readable_characters']
            delivered=db.execute('SELECT COALESCE(SUM(end-start),0) FROM sections WHERE delivered=1').fetchone()[0]
            ack=db.execute('SELECT COALESCE(SUM(end-start),0) FROM sections WHERE acknowledged=1').fetchone()[0]
            complete_files=db.execute("SELECT COUNT(DISTINCT path) FROM sections WHERE acknowledged=1 AND end=json_extract(payload,'$.file_characters')").fetchone()[0]
            return dict(**result,delivered_characters=delivered,acknowledged_characters=ack,
                        delivery_percent=100*delivered/total if total else None,
                        acknowledged_percent=100*ack/total if total else None,
                        fully_acknowledged_files=complete_files,
                        ledger_complete=not result['unresolved_exceptions'] and complete_files==result['readable_files'] and ack==total,
                        comprehension='not measured')

    def verify(self):
        errors = []
        with self.connect() as db:
            if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
                errors.append('SQLite integrity failure')
            if self.manifest(db) != db.execute("SELECT value FROM meta WHERE key='inventory_sha256'").fetchone()[0]:
                errors.append('Manifest changed')
            if self.inventory_summary(db)!=load(db.execute("SELECT value FROM meta WHERE key='inventory_summary'").fetchone()[0]):
                errors.append('Inventory summary differs from file records')
            previous, deliveries, acknowledgments = '0' * 64, set(), set()
            offer_hashes, delivery_hashes = {}, {}
            for event in db.execute('SELECT * FROM events ORDER BY id'):
                expected = sha(encode([event['at'], event['kind'], event['data'], previous]).encode())
                if event['previous'] != previous or event['hash'] != expected:
                    errors.append('Event chain broken at ' + str(event['id']))
                previous = event['hash']
                try:
                    data = json.loads(event['data'])
                except ValueError:
                    errors.append('Malformed audit event: '+str(event['id']))
                    continue
                if event['kind'] in ('offer','import_offer','delivery','acknowledge') and (not isinstance(data,dict) or not isinstance(data.get('section'),int)):
                    errors.append('Malformed coverage event: '+str(event['id']))
                    continue
                if event['kind'] in ('offer','import_offer'):
                    offer_hashes[data['section']]=data.get('sha256')
                if event['kind']=='delivery':
                    delivery_hashes[data['section']]=data.get('sha256')
                target = deliveries if event['kind'] == 'delivery' else acknowledgments if event['kind'] == 'acknowledge' else None
                if target is not None:
                    if data['section'] in target:
                        errors.append('Duplicate coverage event')
                    target.add(data['section'])
            for repo in db.execute('SELECT * FROM repositories ORDER BY path'):
                path = self.root / json.loads(repo['path'])
                try:
                    if tree(path) != load(repo['entries']) or git(path, 'rev-parse', 'HEAD').decode().strip() != repo['pin']:
                        errors.append('Git tree/pin changed: ' + str(path))
                except (OSError, RuntimeError) as ex:
                    errors.append(str(ex))
            for row in db.execute('SELECT * FROM files ORDER BY path'):
                path, data = json.loads(row['path']), load(row['data'])
                if data.get('sha256'):
                    try:
                        self.unchanged(path, data, full=True)
                        if data.get('git_oid') and not data.get('lfs_oid') and data.get('storage') != 'git_blob' and self.git_hash(self.root / path) != data['git_oid']:
                            errors.append('Git blob mismatch: ' + path)
                    except (OSError, RuntimeError) as ex:
                        errors.append(str(ex))
                offset, line, col, byte_offset = 0, 1, 0, 0
                for section in db.execute('SELECT * FROM sections WHERE path=? ORDER BY start,id', (row['path'],)):
                    if section['start'] != offset or (section['line'], section['col']) != (line, col):
                        errors.append('Gap/overlap/line coordinate mismatch: ' + path)
                    payload = json.loads(section['payload'])
                    checksum=sha(section['payload'].encode())
                    if offer_hashes.get(section['id'])!=checksum or (section['delivered'] and delivery_hashes.get(section['id'])!=checksum):
                        errors.append('Offered/delivered checksum differs from section: '+path)
                    text = ''.join(p['text'] for p in payload['parts'])
                    actual_parts, end_line, end_col = parts(text, line, col)
                    if len(text) != section['end']-section['start'] or actual_parts != payload['parts']:
                        errors.append('Truncated/incorrect section: ' + path)
                    if (end_line, end_col) != (section['end_line'], section['end_col']):
                        errors.append('Incorrect end coordinates: ' + path)
                    if payload.get('file_characters') != data.get('characters') or payload['source_sha256'] != data.get('sha256') or payload['start_character'] != section['start'] or payload['end_character'] != section['end']:
                        errors.append('Section identity mismatch: ' + path)
                    if data.get('encoding'):
                        if payload.get('start_byte')!=byte_offset or payload.get('end_byte')!=byte_offset+len(text.encode(data['encoding'])):
                            errors.append('Incorrect byte coordinates: '+path)
                        try:
                            if text != self.read_text(path, data, section['start'], section['end']-section['start'],byte_offset):
                                errors.append('Section differs from original: ' + path)
                        except (OSError, UnicodeError, RuntimeError) as ex:
                            errors.append(str(ex))
                    if bool(section['delivered']) != (section['id'] in deliveries) or bool(section['acknowledged']) != (section['id'] in acknowledgments):
                        errors.append('Coverage differs from receipt events: ' + path)
                    offset, line, col = section['end'], end_line, end_col
                    if data.get('encoding'):
                        byte_offset+=len(text.encode(data['encoding']))
                acknowledged_end=db.execute('SELECT 1 FROM sections WHERE path=? AND acknowledged=1 AND end=?',(row['path'],data.get('characters'))).fetchone()
                if bool(row['complete'])!=bool(acknowledged_end):
                    errors.append('File completion flag differs from acknowledged EOF: '+path)
                if acknowledged_end and byte_offset!=data.get('size'):
                    errors.append('Acknowledged bytes do not reach original EOF: '+path)
                if data.get('characters') is not None and offset > data['characters']:
                    errors.append('Coverage past EOF: ' + path)
            ids = {row[0] for row in db.execute('SELECT id FROM sections')}
            if (deliveries | acknowledgments) - ids:
                errors.append('Coverage event references missing section')
            known = {load(row[0]) for row in db.execute('SELECT path FROM files')}
            known_directories={json.loads(row[0]) for row in db.execute('SELECT path FROM directories')}
            seen_directories=set()
            for folder, directories, filenames in os.walk(self.root, followlinks=False,onerror=lambda error:errors.append('Inaccessible directory: '+str(error))):
                parent = Path(folder)
                directories[:] = [d for d in directories if d != '.git' and (parent/d) != self.state]
                for name in list(directories):
                    if (parent/name).is_symlink():
                        directories.remove(name)
                        filenames.append(name)
                    else:
                        directory=str((parent/name).relative_to(self.root))
                        seen_directories.add(directory)
                        if directory not in known_directories:
                            errors.append('New uninventoried directory: '+directory)
                for name in filenames:
                    if name != '.git' and str((parent/name).relative_to(self.root)) not in known:
                        errors.append('New uninventoried file: ' + str(parent/name))
            for directory in known_directories-seen_directories:
                errors.append('Inventoried directory missing: '+directory)
        coverage = self.status()
        return dict(integrity='PASS' if not errors else 'FAIL', errors=errors, coverage=coverage,
                    complete=not errors and coverage['ledger_complete'])

    def refresh(self):
        # Archive, never reset, previous snapshots and findings. Identical source
        # hashes retain their original explicit acknowledgments and section IDs.
        archive = self.state/'archive'
        archive.mkdir(exist_ok=True)
        old_path = archive/('snapshot-'+str(time.time_ns())+'.sqlite3')
        os.replace(self.path, old_path)
        try:
            self.initialize()
        except BaseException:
            if self.path.exists():
                self.path.unlink()
            os.replace(old_path, self.path)
            raise
        old = sqlite3.connect(old_path)
        old.row_factory = sqlite3.Row
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            for section in old.execute('SELECT * FROM sections ORDER BY id'):
                before = load(old.execute('SELECT data FROM files WHERE path=?',(section['path'],)).fetchone()[0])
                current = db.execute('SELECT data FROM files WHERE path=?',(section['path'],)).fetchone()
                if not current:
                    continue
                after = load(current[0])
                if any(before.get(k)!=after.get(k) for k in ('sha256','encoding','characters')) or after.get('exception'):
                    continue
                values = tuple(section)
                db.execute('INSERT INTO sections VALUES('+','.join('?' for _ in values)+')',values)
                self.event(db,'import_offer',dict(section=section['id'],archive=str(old_path),sha256=sha(section['payload'].encode())))
                if section['delivered']:
                    self.event(db,'delivery',dict(section=section['id'],sha256=sha(section['payload'].encode()),imported_from=str(old_path)))
                if section['acknowledged']:
                    self.event(db,'acknowledge',dict(section=section['id'],imported_from=str(old_path)))
                    if section['end']==after['characters']:
                        db.execute('UPDATE files SET complete=1 WHERE path=?',(section['path'],))
                for finding in old.execute('SELECT section,text FROM findings WHERE section=?',(section['id'],)):
                    db.execute('INSERT INTO findings(section,text) VALUES(?,?)',tuple(finding))
            self.event(db,'refresh',dict(archive=str(old_path),archive_sha256=sha(old_path.read_bytes())))
        old.close()
        return self.status()

    def exceptions(self, offset=0, limit=20):
        with self.connect() as db:
            rows=[]
            for row in db.execute('SELECT * FROM files ORDER BY path'):
                data=load(row['data'])
                if data.get('exception') or data.get('materialization_exception'):
                    rows.append(dict(path=json.loads(row['path']),**data))
            return dict(total=len(rows),offset=offset,exceptions=rows[offset:offset+limit],next_offset=offset+limit if offset+limit<len(rows) else None)

    def export(self, target):
        target = Path(target)
        target.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            for table in ('meta', 'repositories', 'directories', 'files', 'sections', 'events', 'findings', 'decisions'):
                with (target/(table+'.jsonl')).open('w', encoding='utf-8') as out:
                    for row in db.execute(f'SELECT * FROM {table}'):
                        record=dict(row)
                        for key,value in record.items():
                            if isinstance(value,bytes):
                                record[key]=load(value)
                        if 'path' in record:
                            record['path']=json.loads(record['path'])
                        out.write(encode(record)+'\n')
        return self.status()

    def decide(self, action, evidence, rationale):
        proof = self.verify()
        if not proof['complete']:
            raise RuntimeError('Decisions blocked: integrity, delivery, acknowledgment and exceptions must all be complete')
        with self.connect() as db:
            for section_id in evidence:
                row = db.execute('SELECT acknowledged FROM sections WHERE id=?', (section_id,)).fetchone()
                if not row or not row[0]:
                    raise RuntimeError('Evidence must reference acknowledged sections')
            if not evidence or not rationale.strip():
                raise RuntimeError('Evidence and rationale required')
            db.execute('INSERT INTO decisions VALUES(NULL,?,?,?)', (action, encode(evidence), rationale))
            self.event(db, 'decision', dict(action=action, evidence=evidence, rationale=rationale))
        return dict(recorded=action, application_logic_modified=False)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument('--state', type=Path)
    sub = p.add_subparsers(dest='command', required=True)
    for name in ('init', 'next', 'session', 'status', 'verify', 'refresh', 'capacity'):
        sub.add_parser(name)
    for name in ('deliver', 'ack'):
        s = sub.add_parser(name)
        s.add_argument('section', type=int)
        s.add_argument('token')
        s.add_argument('sha256')
        if name == 'ack':
            s.add_argument('--note', required=True)
        else:
            s.add_argument('--received', required=True, help='File containing the complete JSON actually received; - for stdin')
    s = sub.add_parser('exceptions')
    s.add_argument('--offset',type=int,default=0)
    s.add_argument('--limit',type=int,default=20)
    s = sub.add_parser('export')
    s.add_argument('directory', type=Path)
    s = sub.add_parser('decision')
    s.add_argument('action', choices=['ADD','REPLACE','MERGE','REMOVE','IMPROVE','KEEP'])
    s.add_argument('--evidence', required=True, type=int, nargs='+')
    s.add_argument('--rationale', required=True)
    args = p.parse_args()
    reader = Reader(args.root, args.state)
    if args.command == 'capacity':
        result = reader.capacity()
    elif args.command == 'session':
        if not reader.path.exists():
            capacity=reader.capacity()
            if not capacity['sufficient']:
                raise RuntimeError('Insufficient inventory capacity: '+encode(capacity))
            reader.initialize()
        result = reader.next()
    elif args.command == 'init':
        capacity=reader.capacity()
        if not capacity['sufficient']:
            raise RuntimeError('Insufficient inventory capacity: '+encode(capacity))
        result = reader.initialize()
    elif args.command == 'next':
        result = reader.next()
    elif args.command in ('deliver','ack'):
        received = None
        if args.command == 'deliver':
            received = json.loads(sys.stdin.read() if args.received == '-' else Path(args.received).read_text())
        result = reader.confirm(args.section, args.token, args.sha256, args.command == 'ack', getattr(args, 'note', None), received)
    elif args.command == 'refresh':
        result = reader.refresh()
    elif args.command == 'exceptions':
        result = reader.exceptions(args.offset,args.limit)
    elif args.command == 'status':
        result = reader.status()
    elif args.command == 'verify':
        result = reader.verify()
    elif args.command == 'export':
        result = reader.export(args.directory)
    else:
        result = reader.decide(args.action, args.evidence, args.rationale)
    print(encode(result), flush=True)
    return int(args.command == 'verify' and result['integrity'] != 'PASS')


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print(encode(dict(error='Interrupted. No acknowledgment advanced; preserve building.sqlite3 if inventory was running.')),file=sys.stderr)
        raise SystemExit(130)
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as error:
        print(encode(dict(error=str(error), coverage_advanced=False)), file=sys.stderr)
        raise SystemExit(1)
