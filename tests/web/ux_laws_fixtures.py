"""Negative controls for the UX-law measurements: bad fixtures must be flagged, good ones clean.

Needs only a local browser (no site):  python3 tests/web/ux_laws_fixtures.py [--engine E]
Set OCADE_BROWSER_EXECUTABLE to use a specific Chromium build.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import surface_audit
import ux_laws_audit

GOOD = """<main><h1>Fixture</h1>
<form><label for="e">Email</label><input id="e" type="email" autocomplete="email">
<input id="x" aria-invalid="true" aria-describedby="why" aria-label="Code"><span id="why">Use six digits.</span>
<fieldset><legend>Plan</legend><input type="radio" name="p" aria-label="A"><input type="radio" name="p" aria-label="B"></fieldset>
<button>Save</button><button>Save</button><progress aria-label="Upload" value="3" max="10"></progress>
<progress aria-label="Working"></progress><a href="https://fixture.test/a">Home</a><a href="https://fixture.test/a">Home</a></form></main>"""

BAD = {
    "UX-13": '<main><h1>F</h1><label for="a" style="display:block">Email</label><div style="height:300px"></div><input id="a" type="email" autocomplete="email"></main>',
    "UX-12": '<main><h1>F</h1><form><input type="radio" name="p" aria-label="A"><input type="radio" name="p" aria-label="B"></form></main>',
    "UX-15": '<main><h1>F</h1><button>Save</button><button style="font-weight:700;background:#c00;color:#fff">Save</button></main>',
    "UX-15 link": '<main><h1>F</h1><a href="https://fixture.test/a">Settings</a><a href="https://fixture.test/b">Settings</a></main>',
    "UX-03": "<main><h1>F</h1>" + "".join(f'<button>Item {n}</button>' for n in range(14)) + "</main>",
    "UX-09": '<main><h1>F</h1><progress value="-5" max="10"></progress></main>',
}


def measure(page, html: str) -> list[str]:
    page.set_content('<!doctype html><html lang="en"><title>x</title>' + html)
    return page.evaluate(ux_laws_audit.MEASURE, ux_laws_audit.measure_args(False))


def main(engine: str) -> int:
    failed = []
    with sync_playwright() as playwright:
        browser = surface_audit.launch_audit_browser(playwright, engine)
        page = browser.new_page()
        clean = [p for p in measure(page, GOOD) if not p.startswith(("UX-11", "UX-07"))]
        if clean:
            failed.append(f"good fixture flagged: {clean}")
        for law, html in BAD.items():
            if not any(p.startswith(law.split()[0]) for p in measure(page, html)):
                failed.append(f"{law} negative control was not flagged")
        browser.close()
    print("\n".join(failed) or "all UX-law negative controls behave")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", choices=surface_audit.ENGINES, default="chromium")
    sys.exit(main(**vars(parser.parse_args())))
