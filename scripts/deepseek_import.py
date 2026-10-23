#!/usr/bin/env python3
"""Inspect a DeepSeek Harness source ZIP without executing untrusted code.

Extraction is an explicit, separate operation into an ignored quarantine directory.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import tempfile
import zipfile

REPO = Path(__file__).resolve().parents[1]
INBOX = REPO / 'external' / 'deepseek-harness'
DEFAULT_ARCHIVE = INBOX / 'incoming' / 'deepseek-harness.zip'
DEFAULT_DESTINATION = INBOX / 'unpacked'
MAX_FILES = 30000
MAX_TOTAL_BYTES = 500 * 1024 * 1024
MAX_SINGLE_BYTES = 150 * 1024 * 1024
REQUIRED = {'README.md', 'LICENSE', 'SAFETY.md', 'THIRD_PARTY_NOTICES.md', 'package.json'}
PINNED_COMMIT = '687f282e8625c6b8d11ff58211a90524be2e4317'


def inspect(archive: Path):
    if not archive.is_file():
        raise ValueError(f'ZIP not found: {archive}')
    digest = hashlib.sha256()
    with archive.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        if not members or len(members) > MAX_FILES:
            raise ValueError('Archive is empty or exceeds the entry-count limit')
        roots, normalized, total = set(), set(), 0
        for member in members:
            raw = member.filename
            path = PurePosixPath(raw)
            if (not raw or raw.startswith('/') or '\\' in raw or '\x00' in raw
                    or ':' in raw or any(segment in ('', '.', '..') for segment in raw.rstrip('/').split('/'))
                    or (member.external_attr >> 16 and stat.S_ISLNK(member.external_attr >> 16))):
                raise ValueError(f'Unsafe ZIP entry: {raw!r}')
            if '.git' in path.parts:
                raise ValueError('Archive contains Git metadata')
            roots.add(path.parts[0])
            key = '/'.join(path.parts).casefold()
            if key in normalized:
                raise ValueError(f'Duplicate/case-colliding archive entry: {raw!r}')
            normalized.add(key)
            if not member.is_dir():
                total += member.file_size
                if member.file_size > MAX_SINGLE_BYTES or total > MAX_TOTAL_BYTES:
                    raise ValueError('Archive exceeds uncompressed size limits')
        if len(roots) != 1 or not next(iter(roots)).startswith('deepseek-harness-'):
            raise ValueError('ZIP must contain one official deepseek-harness-* root')
        root = next(iter(roots))
        actual = {str(PurePosixPath(m.filename).relative_to(root)) for m in members if not m.is_dir()}
        if not REQUIRED.issubset(actual):
            raise ValueError('Missing official README, LICENSE, SAFETY, notices or package manifest')
        package = json.loads(bundle.read(root + '/package.json'))
        license_text = bundle.read(root + '/LICENSE').decode('utf-8', errors='replace')
        if package.get('name') != '@deepseek-ai/dsh-root' or 'MIT License' not in license_text:
            raise ValueError('Unexpected project identity or license')
        return members, {'sha256': digest.hexdigest(), 'root': root,
                         'entries': len(members), 'files': len(actual), 'uncompressed_bytes': total,
                         'pinned_root_name': root == f'deepseek-harness-{PINNED_COMMIT}'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument('--extract', action='store_true', help='Explicitly unpack into ignored quarantine')
    parser.add_argument('--destination', type=Path, default=DEFAULT_DESTINATION)
    args = parser.parse_args()
    try:
        members, summary = inspect(args.archive)
        print(json.dumps(summary, indent=2))
        if args.extract:
            if not summary['pinned_root_name']:
                raise ValueError('Use the pinned-commit ZIP linked in external/deepseek-harness/README.md')
            target = args.destination.resolve()
            allowed_parent = INBOX.resolve()
            if target == allowed_parent or allowed_parent not in target.parents:
                raise ValueError('Extraction destination must be inside external/deepseek-harness/')
            if target.exists() or target.is_symlink():
                raise ValueError('Destination already exists: will not overwrite')
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='.extract-', dir=target.parent) as scratch:
                with zipfile.ZipFile(args.archive) as bundle:
                    for entry in members:
                        if entry.is_dir():
                            continue
                        relative = PurePosixPath(entry.filename).relative_to(summary['root'])
                        destination = Path(scratch, *relative.parts)
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        with bundle.open(entry) as source, destination.open('xb') as out:
                            shutil.copyfileobj(source, out, length=1024 * 1024)
                os.replace(scratch, target)
            print(f'Extracted without running code: {target}')
    except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        parser.exit(1, f'Import refused: {error}\n')


if __name__ == '__main__':
    main()
