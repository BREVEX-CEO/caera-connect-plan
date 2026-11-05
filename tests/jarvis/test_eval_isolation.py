"""Actual root-to-user canary: evaluation programs must not inherit server keys."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("live_eval", Path(__file__).with_name("live_eval.py"))
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)


class OracleIsolation(unittest.TestCase):
    @unittest.skipUnless(sys.platform == "linux", "E1 isolation runs on Linux")
    def test_oracle_privilege_drop_does_not_carry_the_server_environment(self):
        import pwd
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = '''
import json, os, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import live_eval
result = live_eval.run_as_user([sys.executable, '-c',
    "import json, os; from pathlib import Path; Path('identity.json').write_text(json.dumps({'uid': os.geteuid(), 'serverCredentialPresent': 'SUPABASE_SERVICE_ROLE_KEY' in os.environ}))"], Path(sys.argv[2]))
raise SystemExit(result.returncode)
'''
            environment = {"PATH": os.environ["PATH"], "OCADE_EVAL_USER": pwd.getpwuid(os.geteuid()).pw_name,
                           "SUPABASE_SERVICE_ROLE_KEY": "synthetic-canary-not-a-real-credential"}
            result = subprocess.run(["sudo", "--preserve-env=PATH,OCADE_EVAL_USER,SUPABASE_SERVICE_ROLE_KEY",
                "--", sys.executable, "-c", source, str(evaluation.ROOT / "tests/jarvis"), str(root)],
                env=environment, capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, "synthetic privilege-drop probe failed")
            identity = json.loads((root / "identity.json").read_text())
            self.assertEqual(identity["uid"], os.geteuid(), "the probe must actually leave root")
            self.assertFalse(identity["serverCredentialPresent"], "the oracle inherited a server credential canary")

