import codecs
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[2] / 'tools/source-research/reader.py'
spec = importlib.util.spec_from_file_location('source_reader', MODULE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)/'source'
        self.root.mkdir()
        self.git('init','-q')
        self.git('config','user.name','Test')
        self.git('config','user.email','test@example.com')

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git','-C',str(self.root),*args], stderr=subprocess.DEVNULL)

    def start(self, files):
        for name, value in files.items():
            path = self.root/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(value)
        self.git('add','.')
        self.git('commit','-qm','fixture')
        r = m.Reader(self.root)
        r.initialize()
        return r

    def deliver(self, r, e):
        return r.confirm(e['section'],e['receipt']['token'],e['receipt']['payload_sha256'],received=e)

    def ack(self, r, e):
        return r.confirm(e['section'],e['receipt']['token'],e['receipt']['payload_sha256'],True,'TEST ACTOR: processed fixture section')

    def test_resume_delivery_is_not_acknowledgment(self):
        r = self.start({'a':'first\nsecond\n'.encode()})
        e = r.next()
        self.assertEqual(r.status()['delivered_characters'],0)
        self.assertEqual(e, m.Reader(self.root).next())
        self.deliver(r,e)
        self.assertEqual(r.status()['acknowledged_characters'],0)
        self.assertEqual(e,m.Reader(self.root).next())
        self.ack(r,e)
        self.assertTrue(r.status()['ledger_complete'])
        self.assertEqual(r.verify()['integrity'],'PASS')
        self.assertEqual(r.decide('KEEP',[e['section']],'Verified fixture'),{'recorded':'KEEP','application_logic_modified':False})

    def test_large_unicode_long_lines_crlf_and_eof(self):
        text = '\ufeffα😀\r\n' + '长'*9000 + '\n' + 'x\n'*2000 + 'unterminated'
        r = self.start({'长 name.txt':text.encode('utf-8')})
        reconstructed, offset = '',0
        while not r.status()['ledger_complete']:
            e = r.next()
            self.assertLess(len(m.encode(e).encode()),10000)
            p=e['payload']
            self.assertEqual(p['start_character'],offset)
            segment=''.join(part['text'] for part in p['parts'])
            self.assertEqual(text[offset:p['end_character']],segment)
            reconstructed += segment
            offset=p['end_character']
            self.deliver(r,e)
            self.ack(r,e)
        self.assertEqual(reconstructed,text)
        self.assertEqual(r.status()['readable_lines'],2003)
        self.assertEqual(r.verify()['integrity'],'PASS')

    def test_empty_and_utf16_files(self):
        r = self.start({'a-empty':b'', 'b-utf16':codecs.BOM_UTF16_LE+'Hi\r\n𝄞'.encode('utf-16-le')})
        e = r.next()
        self.assertTrue(e['payload']['empty_file'])
        self.deliver(r,e)
        self.ack(r,e)
        e=r.next()
        self.assertEqual(''.join(p['text'] for p in e['payload']['parts']),'\ufeffHi\r\n𝄞')
        self.deliver(r,e)
        self.ack(r,e)
        self.assertTrue(r.status()['ledger_complete'])

    def test_missing_duplicate_and_truncated_receipts(self):
        r=self.start({'a':b'a\nb\nc\n'})
        e=r.next()
        altered=json.loads(json.dumps(e))
        altered['payload']['parts'].pop(1)
        for received in (None, altered, {'section':e['section']}):
            with self.assertRaises(RuntimeError):
                r.confirm(e['section'],e['receipt']['token'],e['receipt']['payload_sha256'],received=received)
        with self.assertRaises(RuntimeError):
            self.ack(r,e)
        self.assertEqual(r.status()['delivered_characters'],0)
        self.deliver(r,e)
        with self.assertRaises(RuntimeError):
            self.deliver(r,e)
        self.ack(r,e)
        with self.assertRaises(RuntimeError):
            self.ack(r,e)
        self.assertEqual(r.verify()['integrity'],'PASS')

    def test_changed_files_invalidate_delivery(self):
        r=self.start({'a':b'original\n'})
        e=r.next()
        (self.root/'a').write_text('changed\n')
        with self.assertRaises(RuntimeError):
            self.deliver(r,e)
        self.assertEqual(r.verify()['integrity'],'FAIL')
        self.assertFalse(r.status()['ledger_complete'])

    def test_manifest_event_and_section_corruption(self):
        r=self.start({'a':b'a\nb\nc\n'})
        e=r.next()
        self.deliver(r,e)
        self.ack(r,e)
        with r.connect() as db:
            db.execute('UPDATE sections SET start=1')
            db.execute("UPDATE events SET data='{}' WHERE kind='offer'")
        proof=r.verify()
        self.assertEqual(proof['integrity'],'FAIL')
        self.assertTrue(any('Gap/overlap' in err for err in proof['errors']))
        self.assertTrue(any('Event chain' in err for err in proof['errors']))
        with self.assertRaises(RuntimeError):
            r.decide('REMOVE',[e['section']],'invalid')

    def test_binary_lfs_missing_and_untracked_are_accounted(self):
        r=self.start({'a':b'hello\n','b':b'\0\xff\x01',
                      'c':b'version https://git-lfs.github.com/spec/v1\noid sha256:'+b'a'*64+b'\nsize 99\n'})
        self.assertEqual(r.status()['unresolved_exceptions'],2)
        e=r.next()
        self.deliver(r,e)
        self.ack(r,e)
        self.assertFalse(r.status()['ledger_complete'])
        with self.assertRaises(RuntimeError):
            r.decide('ADD',[e['section']],'premature')
        (self.root/'.hidden-generated').write_text('new\n')
        self.assertEqual(r.verify()['integrity'],'FAIL')

    def test_missing_tracked_file(self):
        (self.root/'a').write_text('a\n')
        self.git('add','.')
        self.git('commit','-qm','fixture')
        (self.root/'a').unlink()
        r=m.Reader(self.root)
        r.initialize()
        self.assertEqual(r.status()['unresolved_exceptions'],1)
        self.assertFalse(r.status()['ledger_complete'])

    def test_nested_submodule_pin_and_symlink(self):
        child=Path(self.temp.name)/'child'
        child.mkdir()
        subprocess.run(['git','init','-q',str(child)],check=True)
        subprocess.run(['git','-C',str(child),'config','user.name','Test'],check=True)
        subprocess.run(['git','-C',str(child),'config','user.email','test@example.com'],check=True)
        (child/'hidden').mkdir()
        (child/'hidden/.file').write_text('nested\n')
        subprocess.run(['git','-C',str(child),'add','.'],check=True)
        subprocess.run(['git','-C',str(child),'commit','-qm','child'],check=True)
        self.git('-c','protocol.file.allow=always','submodule','add','-q',str(child),'nested')
        (self.root/'link').symlink_to('nested/hidden/.file')
        self.git('add','.')
        self.git('commit','-qm','parent')
        r=m.Reader(self.root)
        r.initialize()
        self.assertEqual(r.status()['repositories'],2)
        self.assertEqual(r.verify()['integrity'],'PASS')
        with r.connect() as db:
            paths=[json.loads(row[0]) for row in db.execute('SELECT path FROM files')]
        self.assertIn('nested/hidden/.file',paths)
        self.assertIn('link',paths)

    def test_refresh_preserves_findings_and_restarts_changed_file(self):
        r=self.start({'b':b'old\n','c':b'unchanged\n'})
        for _ in range(2):
            e=r.next()
            self.deliver(r,e)
            self.ack(r,e)
        (self.root/'b').write_text('new\n')
        self.git('add','b')
        self.git('commit','-qm','changed source')
        r.refresh()
        self.assertEqual(r.next()['payload']['path'],'b')
        self.assertEqual(r.status()['fully_acknowledged_files'],1)
        e=r.next()
        self.deliver(r,e)
        self.ack(r,e)
        self.assertTrue(r.verify()['complete'])
        self.assertEqual(len(list((r.state/'archive').glob('*.sqlite3'))),1)
        with r.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM findings').fetchone()[0],2)

    def test_sparse_missing_file_is_read_from_exact_git_blob(self):
        (self.root/'a').write_text('original blob\n')
        self.git('add','.')
        self.git('commit','-qm','fixture')
        (self.root/'a').unlink()
        r=m.Reader(self.root)
        r.initialize()
        e=r.next()
        self.assertEqual(''.join(p['text'] for p in e['payload']['parts']),'original blob\n')
        self.deliver(r,e)
        self.ack(r,e)
        self.assertFalse(r.verify()['complete'])
        self.assertEqual(r.status()['unresolved_exceptions'],1)
        (self.root/'a').write_text('original blob\n')
        r.refresh()
        self.assertTrue(r.verify()['complete'])

    def test_new_hidden_ignored_and_symlink_to_state_are_inventoried(self):
        (self.root/'.gitignore').write_text('generated\n')
        (self.root/'a').write_text('source\n')
        self.git('add','.')
        self.git('commit','-qm','fixture')
        (self.root/'generated').write_text('generated data\n')
        (self.root/'.secret-hidden').write_text('hidden text\n')
        (self.root/'state-link').symlink_to('.source-research',target_is_directory=True)
        (self.root/'empty-original').mkdir()
        r=m.Reader(self.root)
        r.initialize()
        with r.connect() as db:
            paths={json.loads(row[0]) for row in db.execute('SELECT path FROM files')}
        self.assertTrue({'generated','.secret-hidden','state-link'} <= paths)
        self.assertEqual(r.verify()['integrity'],'PASS')
        (self.root/'empty-new').mkdir()
        self.assertEqual(r.verify()['integrity'],'FAIL')
        (self.root/'empty-new').rmdir()
        (self.root/'empty-original').rmdir()
        self.assertEqual(r.verify()['integrity'],'FAIL')

    def test_atomic_ack_rollback_on_event_failure(self):
        r=self.start({'a':b'test\n'})
        e=r.next()
        self.deliver(r,e)
        def crash(*args):
            raise RuntimeError('simulated interruption before commit')
        r.event=crash
        with self.assertRaises(RuntimeError):
            self.ack(r,e)
        resumed=m.Reader(self.root)
        self.assertEqual(resumed.status()['acknowledged_characters'],0)
        self.assertEqual(e,resumed.next())
        self.ack(resumed,e)
        self.assertTrue(resumed.status()['ledger_complete'])


if __name__ == '__main__':
    unittest.main()
