"""Native Windows process quiescence, independent of a worker's success message."""
import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(sys.platform == "win32", "needs Windows process handles")
class ProcessQuiescence(unittest.TestCase):
    def test_live_profile_owner_must_exit_before_cleanup(self):
        script = Path(__file__).resolve().parents[1] / "packaging" / "check_frozen.py"
        spec = importlib.util.spec_from_file_location("ocade_frozen_qualification", script)
        qualification = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(qualification)
        with tempfile.TemporaryDirectory(prefix="ocade-frozen-") as temporary:
            profile = Path(temporary) / "agent-home" / "browser-profile"
            profile.mkdir(parents=True)
            held = profile / "owned-session"
            child = subprocess.Popen(
                [sys.executable, "-c",
                 "import sys; f=open(sys.argv[1], 'wb'); f.write(b'owned'); f.flush(); print('ready', flush=True); sys.stdin.readline(); f.close()",
                 str(held)],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            handles = []
            try:
                self.assertEqual(child.stdout.readline().strip(), "ready")
                handles = qualification.profile_processes(profile)
                self.assertIn(child.pid, [pid for pid, _ in handles])
                with self.assertRaises(TimeoutError):
                    qualification.wait_for_process_exit(handles, seconds=0.02)
                with self.assertRaises(PermissionError):
                    held.unlink()
                child.stdin.write("close\n")
                child.stdin.flush()
                self.assertEqual(child.wait(timeout=5), 0)
                qualification.wait_for_process_exit(handles, seconds=2)
                held.unlink()
                self.assertFalse(held.exists())
            finally:
                if child.poll() is None:
                    child.kill()
                    child.wait(timeout=5)
                qualification.close_process_handles(handles)
                for stream in (child.stdin, child.stdout, child.stderr):
                    stream.close()
