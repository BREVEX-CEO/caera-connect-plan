"""AUTH-07: after one account signs out and another signs in on the same tab, nothing cached for
the first account renders, not even for a frame.

On a disposable local Supabase stack (never staging or production): two synthetic accounts with
passwords, each with one Chat conversation whose title is a unique marker. In one browser tab,
without reloading: account A signs in and its conversation shows (positive control); A signs out
from the account menu; B signs in through the sign-in form. A MutationObserver installed before
the page loads records every moment A's marker is in the page. The test fails if A's marker is in
the page at any moment after B pressed Sign in, or if B's own marker never shows.

    SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... \\
      python3 tests/web/account_switch.py http://127.0.0.1:8787
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import surface_audit

WATCH = """marker => {
  window.__seen = [];
  const look = () => { if (document.body && document.body.innerText.includes(marker)) window.__seen.push(performance.now()); };
  new MutationObserver(look).observe(document, {subtree: true, childList: true, characterData: true});
}"""


def admin(path: str, body: dict) -> dict:
    url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    if urlsplit(url).hostname not in ("127.0.0.1", "localhost"):
        raise SystemExit("refused: this test creates accounts and runs only against a local stack")
    request = urllib.request.Request(url + path, data=json.dumps(body).encode(), method="POST", headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "Prefer": "return=representation"})
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - loopback only
        return json.loads(response.read() or b"{}")


def account(marker: str) -> tuple[str, str]:
    email, password = f"switch-{uuid.uuid4().hex[:10]}@example.test", uuid.uuid4().hex
    user = admin("/auth/v1/admin/users", {"email": email, "password": password, "email_confirm": True})
    admin("/rest/v1/ocade_conversations", {"user_id": user["id"], "title": marker, "surface": "chat"})
    return email, password


def sign_in(page, base: str, email: str, password: str) -> None:
    page.get_by_role("link", name="Sign in").first.click()
    page.get_by_role("button", name="Use a password instead").click()
    page.get_by_label("Email").fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign in", exact=True).click()


def main(base: str, engine: str) -> int:
    origin = surface_audit.site_origin(base)
    marker_a, marker_b = f"A-private-{uuid.uuid4().hex[:8]}", f"B-own-{uuid.uuid4().hex[:8]}"
    first, second = account(marker_a), account(marker_b)
    with sync_playwright() as playwright:
        browser = surface_audit.launch_audit_browser(playwright, engine)
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        page.add_init_script(f"({WATCH})({json.dumps(marker_a)})")
        page.goto(origin + "/", wait_until="networkidle")
        sign_in(page, origin, *first)
        expect(page.get_by_text(marker_a).first).to_be_visible(timeout=15000)
        page.locator("button[aria-haspopup='menu']").first.click()
        page.get_by_role("menuitem", name="Sign out").click()
        expect(page.get_by_text(marker_a)).to_have_count(0, timeout=10000)
        switched = page.evaluate("performance.now()")
        sign_in(page, origin, *second)
        expect(page.get_by_text(marker_b).first).to_be_visible(timeout=15000)
        page.wait_for_timeout(2000)
        leaked = [t for t in page.evaluate("window.__seen") if t > switched]
        browser.close()
    result = {"engine": engine, "firstShown": True, "secondShown": True, "framesWithFirstAfterSwitch": len(leaked)}
    print(json.dumps(result))
    return 1 if leaked else 0


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base")
    parser.add_argument("--engine", choices=surface_audit.ENGINES, default="chromium")
    sys.exit(main(**vars(parser.parse_args())))
