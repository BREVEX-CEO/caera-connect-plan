"""Problem Radar and Outcome Autopilot in a real browser against a disposable local stack.

Signs in a synthetic account (session from tests/web/session.mjs), adds obligations, checks the
Radar's findings and dismissal, runs axe (WCAG 2.2 AA serious/critical) and a sideways-scroll
check on desktop and phone, then creates and edits a schedule with a stop condition. Use a fresh
synthetic account per run. Never run against production.

    python3 tests/web/radar_autopilot_flow.py http://127.0.0.1:8787 session.json sb-127-auth-token
"""

import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

AXE = Path(__file__).resolve().parents[2] / "node_modules" / "axe-core" / "axe.min.js"
WCAG = "{runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}"


def serious(page) -> list:
    result = page.evaluate(f"axe.run(document, {WCAG})")
    return [(v["id"], len(v["nodes"])) for v in result["violations"] if v["impact"] in ("serious", "critical")]


def main(base: str, session_file: str, key: str) -> int:
    session = Path(session_file).read_text(encoding="utf-8")
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("OCADE_BROWSER_EXECUTABLE"))
        for name, viewport in [("desktop", {"width": 1366, "height": 900}), ("phone", {"width": 390, "height": 844})]:
            # axe is injected as a script, which the site's CSP rightly refuses; bypass it here only.
            context = browser.new_context(viewport=viewport, bypass_csp=True)
            context.add_init_script(f"localStorage.setItem({json.dumps(key)}, {json.dumps(session)});")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.goto(base + "/ocade-jarvis")
            page.wait_for_load_state("networkidle")
            if name == "phone":
                page.get_by_role("button", name="Open navigation").click()
            page.get_by_role("button", name="LifeOS").first.click()
            expect(page.get_by_role("heading", name="Problem Radar")).to_be_visible(timeout=15000)
            if name == "desktop":
                for title, due in [("Pay council tax", "2026-11-01"), ("Visa renewal", "2027-03-01"), ("visa renewal", "2027-04-01")]:
                    page.get_by_role("button", name="Add obligation").click()
                    page.get_by_label("Obligation", exact=True).fill(title)
                    page.get_by_label("Due date (optional)").fill(due)
                    page.get_by_role("button", name="Save obligation").click()
                    expect(page.get_by_text("Obligation saved.")).to_be_visible()
            expect(page.get_by_text("Needs attention · LifeOS")).to_be_visible(timeout=10000)
            expect(page.get_by_text("Recorded 2 times with different dates: 2027-03-01, 2027-04-01.")).to_be_visible()
            page.get_by_text("more worth a look").click()
            page.add_script_tag(path=str(AXE))
            found = serious(page)
            sideways = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            print(f"{name}: axe serious/critical {found}, sideways scroll {sideways}")
            assert not found and not sideways
            if name == "desktop":
                page.get_by_role("button", name="Dismiss").first.click()
                expect(page.get_by_role("button", name="Show 1 dismissed")).to_be_visible()
                page.get_by_role("button", name="Scheduled").first.click()
                page.get_by_role("button", name="New schedule").click()
                page.get_by_label("What should JARVIS do, or remind you about?").fill("Chase unpaid invoices")
                page.get_by_label("Repeat").select_option("weekly")
                page.get_by_label("Stop").select_option("count")
                page.get_by_label("Number of runs").fill("3")
                page.get_by_role("button", name="Schedule", exact=True).click()
                expect(page.get_by_text("stops after 3 runs (0 done)")).to_be_visible(timeout=10000)
                page.get_by_role("button", name="Edit Chase unpaid invoices").click()
                expect(page.get_by_label("Number of runs")).to_have_value("3")
                page.get_by_label("Stop").select_option("date")
                page.get_by_label("Last day", exact=False).fill("2027-01-31")
                found = serious(page)
                print(f"schedule form: axe serious/critical {found}")
                assert not found
                page.get_by_role("button", name="Save changes").click()
                expect(page.get_by_text(re.compile(r"ends (Jan 31, 2027|31 Jan 2027)"))).to_be_visible(timeout=10000)
            context.close()
        browser.close()
    print("console errors:", errors[:10])
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
