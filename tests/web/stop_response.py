"""How fast STOP answers on screen, and where keyboard focus goes afterwards (plan 14B.4A item 1,
UX-06/UX-25/UX-28/UX-34). Loopback local Supabase stack only.

A synthetic account gets one paired computer and one running task (seeded straight into the
disposable database, as a companion would leave it). Five times: the task is set running, the page
opens, STOP is pressed, and the time until the task panel says "Stopped" is measured; focus must
stay on the task panel rather than fall back to the top of the page. Fails when any run is slower
than 1 s or loses focus.

    OCADE_LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \\
      python3 tests/web/stop_response.py http://127.0.0.1:8787 session.json sb-127-auth-token
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

RUNS = 5
LIMIT_MS = 1000


def sql(statement: str) -> str:
    url = os.environ["OCADE_LOCAL_DB_URL"]
    if urlsplit(url).hostname not in ("127.0.0.1", "localhost"):
        raise SystemExit("refused: seeds a task straight into the database; loopback stacks only")
    return subprocess.run(["psql", url, "-Atqc", statement], check=True, capture_output=True,
                          text=True).stdout.strip()


def main(base: str, session: str, storage_key: str) -> int:
    origin = surface_audit.site_origin(base)
    user = json.loads(Path(session).read_text(encoding="utf-8"))["user"]["id"]
    device = sql("SET session_replication_role = replica; INSERT INTO public.jarvis_devices "
                 f"(user_id, name, platform, last_seen_at) VALUES ('{user}', 'Test computer', 'windows', now()) "
                 "RETURNING id").splitlines()[-1]
    conversation = sql("INSERT INTO public.ocade_conversations (user_id, title, surface) "
                       f"VALUES ('{user}', 'STOP check', 'jarvis') RETURNING id").splitlines()[-1]
    task = sql("SET session_replication_role = replica; INSERT INTO public.jarvis_tasks "
               f"(user_id, conversation_id, device_id, title, status) VALUES ('{user}', '{conversation}', "
               f"'{device}', 'STOP check', 'running') RETURNING id").splitlines()[-1]
    login = surface_audit.session_script(origin, storage_key, Path(session).read_text(encoding="utf-8"))
    runs = []
    with sync_playwright() as playwright:
        browser = surface_audit.launch_audit_browser(playwright, "chromium")
        for _ in range(RUNS):
            sql("SET session_replication_role = replica; UPDATE public.jarvis_tasks "
                f"SET status = 'running', finished_at = NULL WHERE id = '{task}'")
            page = browser.new_page(viewport={"width": 1366, "height": 900})
            page.add_init_script(login)
            page.goto(f"{origin}/ocade-jarvis?c={conversation}", wait_until="networkidle")
            stop = page.get_by_role("button", name="STOP", exact=True)
            expect(stop).to_be_visible(timeout=10_000)
            status = page.get_by_role("region", name="JARVIS task").get_by_role("status").first
            started = page.evaluate("performance.now()")
            stop.click()
            expect(status).to_have_text("Stopped", timeout=10_000)
            runs.append({"ms": round(page.evaluate("performance.now()") - started),
                         "focusOnTask": page.evaluate(
                             "document.activeElement?.getAttribute('aria-label') === 'JARVIS task'")})
            page.close()
        browser.close()
    failed = [run for run in runs if run["ms"] > LIMIT_MS or not run["focusOnTask"]]
    print(json.dumps({"runs": runs, "limitMs": LIMIT_MS, "failed": len(failed)}))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
