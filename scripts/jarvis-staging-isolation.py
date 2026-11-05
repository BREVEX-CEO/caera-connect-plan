"""Protected staging smoke: record identity and presence flags, never credentials."""
import importlib.util
import json
import os
import pwd
import secrets
import sys
from pathlib import Path

if os.geteuid() != 0 or os.environ.get("SUPABASE_URL") != "https://auyapercxxptziyngycx.supabase.co":
    raise SystemExit("REFUSED: an isolated root staging step is required")
if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
    raise SystemExit("REFUSED: staging server credential missing")

source = Path(__file__).resolve().parents[1] / "tests/jarvis/live_eval.py"
spec = importlib.util.spec_from_file_location("live_eval", source)
evaluation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluation)
expected_uid = pwd.getpwnam(evaluation.USER).pw_uid
if expected_uid == 0:
    raise SystemExit("REFUSED: companion identity cannot be root")
os.environ["OCADE_SERVER_SECRET_CANARY"] = secrets.token_hex(32)
child = '''
import json, os
print(json.dumps({"uid": os.geteuid(), "serviceCredentialPresent": "SUPABASE_SERVICE_ROLE_KEY" in os.environ,
                  "serverCanaryPresent": "OCADE_SERVER_SECRET_CANARY" in os.environ}))
'''
result = evaluation.run_as_user([sys.executable, "-c", child], Path("/tmp"), timeout=15)
if result.returncode != 0:
    raise SystemExit("Staging isolation child failed; no child output is disclosed")
identity = json.loads(result.stdout)
if identity["uid"] != expected_uid or identity["serviceCredentialPresent"] or identity["serverCanaryPresent"]:
    raise SystemExit("REFUSED: staging server environment crossed the privilege boundary")
report = {"serverUid": os.geteuid(), "child": identity, "stagingProject": "auyapercxxptziyngycx"}
Path(sys.argv[1]).write_text(json.dumps(report, indent=2) + "\n")
print("OCADE_STAGING_ISOLATION:" + json.dumps(report))
