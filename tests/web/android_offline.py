"""Android offline browser harness (OWN-093, plan 8.11 row 93, Part 14B.2).

Runs the Pixel 5 emulation in Chromium against the built site, lets the service worker take
control, then drops the network and checks that: the web manifest is installable-shaped,
a cold reload of the JARVIS shell still renders offline, a private route falls back to
"OCADE Local Mode", and the network returning restores the page. The real airplane-mode run on
a physical phone is a later owner step; this harness is the emulated gate before it.

    python tests/web/android_offline.py http://127.0.0.1:8787
"""

import argparse
import os
import sys

from playwright.sync_api import sync_playwright

from surface_audit import audit_offline, site_origin


def run(base: str) -> list[str]:
    origin = site_origin(base)
    problems: list[str] = []
    with sync_playwright() as playwright:
        executable = os.environ.get("OCADE_BROWSER_EXECUTABLE")
        browser = playwright.chromium.launch(**({"executable_path": executable} if executable else {}))
        context = browser.new_context(**playwright.devices["Pixel 5"])
        page = context.new_page()
        try:
            audit_offline(page, origin)
            # audit_offline restores the network; now prove a reload while offline keeps the shell.
            page.goto(origin + "/ocade-jarvis", wait_until="domcontentloaded")
            context.set_offline(True)
            try:
                page.reload(wait_until="domcontentloaded")
                if page.title() == "OCADE Local Mode" or not page.locator("body").inner_text().strip():
                    problems.append("offline reload of the JARVIS shell is empty or the wrong page")
            finally:
                context.set_offline(False)
            page.reload(wait_until="domcontentloaded")
            if page.title() == "OCADE Local Mode":
                problems.append("the page stayed in Local Mode after the network returned")
        except Exception as error:  # noqa: BLE001 - reported as one problem line
            reason = str(error) if isinstance(error, AssertionError) else f"{type(error).__name__}: {str(error)[:120]}"
            problems.append(reason)
        finally:
            browser.close()
    return problems


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    problems = run(parser.parse_args().url)
    for problem in problems:
        print(f"android offline: {problem}")
    print("android offline: " + ("FAIL" if problems else "ok (Pixel 5 emulation, Chromium)"))
    sys.exit(1 if problems else 0)
