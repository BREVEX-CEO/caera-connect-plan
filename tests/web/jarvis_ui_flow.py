"""Website-driven JARVIS run (plan.md 148-152; owner: website -> Gemini -> pairing -> gateway ->
MCP -> real PC action -> verified result). Test-only; staging + a synthetic account only.

A real Chromium signs in as a new synthetic staging account, pairs this computer's companion
through Settings > Devices with the code the companion prints, turns on access, sends one
request on the JARVIS page, reads and allows each exact step it is asked to confirm, and waits
for the outcome. A hidden oracle (from live_eval) then checks the real result on disk.

    python tests/web/jarvis_ui_flow.py http://127.0.0.1:8787 <publishable key> <task name> <seed>

The site must be served with server credentials from a root-only .dev.vars; the companion runs
as an unprivileged user with an allow-listed environment and never sees them.
"""

import json
import os
import random
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests" / "jarvis"))
import live_eval  # noqa: E402

USER = live_eval.USER
SAFE = ("PATH", "LANG", "DISPLAY", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "OCADE_BROWSER_EXECUTABLE")


def companion(home: Path, *args: str) -> subprocess.CompletedProcess:
    env = {k: os.environ[k] for k in SAFE if k in os.environ} | {"HOME": str(home), "OCADE_AGENT_HOME": str(home),
                                                                  "PYTHONPATH": str(ROOT / "device-agent/windows")}
    return subprocess.run(["runuser", "-u", USER, "--", sys.executable, "-m", "ocade_agent", *args],
                          cwd=ROOT / "device-agent/windows", env=env, capture_output=True, text=True, timeout=600)


def main(base: str, publishable: str, task: str, seed: int) -> int:
    started = time.monotonic()
    ws, home = Path(f"/tmp/ocade-ui/{seed}/{task}"), Path(f"/tmp/ocade-ui/{seed}/home")
    shutil.rmtree(ws.parent, ignore_errors=True)
    ws.mkdir(parents=True)
    home.mkdir()
    request, grants, oracle = live_eval.GENERATORS[task](ws, random.Random(f"ui:{seed}:{task}"))
    subprocess.run(["chown", "-R", USER, str(ws.parent)], check=True)
    email = f"ocade-ui-{seed}-{int(time.time())}@example.com"
    session = subprocess.run(["node", "--input-type=module", "-e",
                              (ROOT / "tests/web/session.mjs").read_text().replace(
                                  "@supabase/supabase-js", str(ROOT / "node_modules/@supabase/supabase-js/dist/index.mjs")),
                              email, publishable], capture_output=True, text=True, check=True).stdout
    storage_key = f"sb-{urlparse(os.environ['SUPABASE_URL']).hostname.split('.')[0]}-auth-token"

    enrolled = companion(home, "enroll", "--server", base, "--workspace", str(ws), "--name", "UI flow test")
    code = enrolled.stdout.split("Pairing code: ")[1][:16]
    allowed, steps = [], []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get("OCADE_BROWSER_EXECUTABLE"))
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        page.add_init_script(f"localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session)})")
        page.goto(base + "/", wait_until="networkidle")
        page.get_by_text(email).first.click()
        page.get_by_role("menuitem", name="Settings").click()
        page.get_by_role("button", name="Devices").click()
        page.get_by_label("Pairing code").fill(code)
        page.get_by_role("button", name="Pair").click()
        device = page.get_by_role("region", name="UI flow test")
        device.wait_for(timeout=30_000)
        labels = {"files": "Files in its JARVIS folder", "computer_control": "run commands you confirm",
                  "browser": "Use allowed websites"}
        for grant in ["files", *grants]:
            if grant in labels:
                box = device.get_by_label(labels[grant], exact=False)
                if not box.is_checked():
                    box.click()  # the box shows the server's answer, not the click
                    for _ in range(40):
                        if box.is_checked():
                            break
                        page.wait_for_timeout(250)
                    else:
                        toasts = page.locator("[data-sonner-toast]").all_inner_texts()
                        raise AssertionError(f"grant {grant} was not saved: {toasts}")
        page.keyboard.press("Escape")
        page.goto(base + "/ocade-jarvis", wait_until="networkidle")
        page.get_by_label("Message JARVIS").fill(request)
        page.keyboard.press("Enter")

        running = threading.Event()
        running.set()

        def work() -> None:  # the companion, as a person's computer would keep it running
            while running.is_set():
                companion(home, "run", "--until-idle")
                time.sleep(1)

        threading.Thread(target=work, daemon=True).start()
        outcome = "timeout"
        deadline = time.monotonic() + 900
        while time.monotonic() < deadline:
            page.wait_for_timeout(2000)
            for agree in page.get_by_role("button", name="Agree").all():
                agree.click()  # the person's online-intelligence consent, asked at first send
            for allow in page.get_by_role("button", name="Allow this step").all():
                effect = allow.locator("xpath=ancestor::li[1]").locator("pre").inner_text()
                allowed.append(effect[:300])
                allow.click()
            text = page.inner_text("main")
            if "checked independently" in text or "Not finished" in text or "stopped" in text.lower():
                outcome = text
                break
        running.clear()
        steps = page.locator("main li").all_inner_texts()
        page.screenshot(path=str(ws.parent / "final.png"), full_page=True)
        browser.close()
    ok, detail = oracle(ws)
    report = {"task": task, "seed": seed, "pass": ok, "detail": detail[:300], "allowedEffects": allowed,
              "steps": [s[:200] for s in steps][:40], "outcome": outcome[-400:],
              "wallSeconds": round(time.monotonic() - started, 1)}
    print(json.dumps(report, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])))
