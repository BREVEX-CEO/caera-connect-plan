"""REPO-51: a step that did not happen says why, in words for the person (loopback local stack only).

A synthetic account gets a paired computer and a task whose one step was refused with `file_changed`
(seeded into the disposable database as a companion would leave it). The task panel must show the
step as refused or failed and, under it, the sentence for that refusal; a step with a code that has no
sentence shows none.

    OCADE_LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \\
      python3 tests/web/failure_reason.py http://127.0.0.1:8787 session.json sb-127-auth-token [shot.png]
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import surface_audit


def sql(statement: str) -> str:
    url = os.environ["OCADE_LOCAL_DB_URL"]
    if urlsplit(url).hostname not in ("127.0.0.1", "localhost"):
        raise SystemExit("refused: seeds a task straight into the database; loopback stacks only")
    return subprocess.run(["psql", url, "-Atqc", statement], check=True, capture_output=True,
                          text=True).stdout.strip()


def action(key: str) -> dict:
    return {"v": 1, "key": key, "operation": "fs.read_text", "capability": "files", "risk": "read",
            "arguments": {"path": "notes.txt"}, "deadlineUtc": "2099-01-01T00:00:00.000Z"}


def receipt(code: str) -> dict:
    return {"status": "not_applied", "maybeChanged": False, "observedAtUtc": "2026-11-27T00:00:00.000Z",
            "errorCode": code, "evidence": {"executionDisposition": "refused"}}


def main(base: str, session: str, storage_key: str, shot: str | None = None) -> int:
    origin = surface_audit.site_origin(base)
    user = json.loads(Path(session).read_text(encoding="utf-8"))["user"]["id"]
    pre = "SET session_replication_role = replica; "
    device = sql(pre + "INSERT INTO public.jarvis_devices (user_id, name, platform, last_seen_at) "
                 f"VALUES ('{user}', 'Test computer', 'windows', now()) RETURNING id").splitlines()[-1]
    conversation = sql("INSERT INTO public.ocade_conversations (user_id, title, surface) "
                       f"VALUES ('{user}', 'Reason check', 'jarvis') RETURNING id").splitlines()[-1]
    task = sql(pre + "INSERT INTO public.jarvis_tasks (user_id, conversation_id, device_id, title, status) "
               f"VALUES ('{user}', '{conversation}', '{device}', 'Reason check', 'blocked') RETURNING id").splitlines()[-1]
    for key, summary, code in (("k1", "Read the file", "file_changed"), ("k2", "Read it again", "some_new_code")):
        sql(pre + "INSERT INTO public.jarvis_activity (user_id, task_id, device_id, summary, action, confirmed, "
            f"status, result, completed_at) VALUES ('{user}', '{task}', '{device}', '{summary}', "
            f"'{json.dumps(action(key))}'::jsonb, true, 'failed', '{json.dumps(receipt(code))}'::jsonb, now())")
    login = surface_audit.session_script(origin, storage_key, Path(session).read_text(encoding="utf-8"))
    with sync_playwright() as playwright:
        browser = surface_audit.launch_audit_browser(playwright, "chromium")
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        page.add_init_script(login)
        page.goto(f"{origin}/ocade-jarvis?c={conversation}", wait_until="networkidle")
        steps = page.get_by_role("list", name="Task actions")
        expect(steps).to_be_visible(timeout=15_000)
        expect(steps).to_contain_text("The file changed after JARVIS read it, so JARVIS did not overwrite it.")
        text = steps.inner_text()
        if text.count("did not overwrite") != 1 or "some_new_code" in text:
            print("unexpected reasons:", text)
            return 1
        if shot:
            page.screenshot(path=shot)
        browser.close()
    print("PASS: the refused step names its reason; the unknown code shows none")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:5]))
