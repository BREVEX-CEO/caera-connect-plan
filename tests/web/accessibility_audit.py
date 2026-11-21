"""Accessibility audit of a running OCADE site (plan 14B.4A, G.1; RELIABILITY-07; UX-15/UX-27).

For every same-origin page reachable from the start routes, signed out or with a synthetic
session (as surface_audit.py), in one browser engine:

1. axe-core's WCAG 2.0/2.1/2.2 A and AA rules: any serious or critical violation fails.
2. Reflow at 200% zoom (WCAG 1.4.10, a 683 CSS-pixel-wide viewport for a 1366 screen): the page
   must not scroll sideways.
3. Keyboard: Tab reaches at least one control, every focused control is on screen and shows a
   visible focus indicator (outline or ring), and focus never gets stuck on one element.

It reports facts; it does not certify conformance (a person with assistive technology still has
to use the product, plan 14B.4A user studies). Run only against a disposable local or staging
origin.

    python3 tests/web/accessibility_audit.py http://127.0.0.1:8787 [session.json storage-key]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import surface_audit

AXE = Path(__file__).resolve().parents[2] / "node_modules" / "axe-core" / "axe.min.js"
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
FAILING = {"serious", "critical"}
TABS = 40

FOCUS_VISIBLE = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const box = el.getBoundingClientRect();
  // What a focus indicator can change: the control or one of its three nearest ancestors
  // (a ring on the composer around a bare textarea counts), compared focused and unfocused.
  const chain = [el, el.parentElement, el.parentElement?.parentElement,
                 el.parentElement?.parentElement?.parentElement].filter(Boolean);
  const look = () => chain.map(node => { const s = getComputedStyle(node);
    return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|'); }).join('/');
  const focused = look();
  el.blur();
  const unfocused = look();
  el.focus({preventScroll: true});
  return {tag: el.tagName, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
          onScreen: box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0
            && box.top < innerHeight && box.left < innerWidth,
          ring: focused !== unfocused, key: el.outerHTML.slice(0, 200)};
}"""


def links(page, origin: str) -> list[str]:
    found = page.eval_on_selector_all("a[href]", "els => els.map(e => e.getAttribute('href'))")
    out = []
    for href in found:
        url = urljoin(page.url, href)
        parts = urlsplit(url)
        if f"{parts.scheme}://{parts.netloc}" == origin and not parts.path.startswith("/api/"):
            out.append(origin + parts.path)
    return out


def audit_page(page, url: str) -> list[str]:
    problems = []
    response = page.goto(url, wait_until="networkidle")
    if response and not (response.headers.get("content-type") or "").startswith("text/html"):
        return []  # a plain-text or file download (e.g. a licence text) is not a page
    page.add_script_tag(path=str(AXE))
    result = page.evaluate("tags => axe.run(document, {runOnly: {type: 'tag', values: tags}})", TAGS)
    for violation in result["violations"]:
        if violation["impact"] in FAILING:
            targets = [", ".join(node["target"]) for node in violation["nodes"][:3]]
            problems.append(f"axe {violation['impact']} {violation['id']}: {violation['help']} at {targets}")
    # Keyboard traversal from the top of the page.
    page.mouse.click(1, 1)
    seen, stuck = [], 0
    for _ in range(TABS):
        page.keyboard.press("Tab")
        focus = page.evaluate(FOCUS_VISIBLE)
        if focus is None:
            continue
        if seen and focus["key"] == seen[-1]:
            stuck += 1
            if stuck >= 3:
                # The end of the tab order (some engines keep focus on the last control) unless
                # Shift+Tab cannot leave it either: that is a keyboard trap (WCAG 2.1.2).
                page.keyboard.press("Shift+Tab")
                back = page.evaluate(FOCUS_VISIBLE)
                if back is None or back["key"] == focus["key"]:
                    problems.append(f"keyboard trap on {focus['tag']} {focus['label']!r}")
                break
            continue
        stuck = 0
        seen.append(focus["key"])
        if not focus["onScreen"]:
            problems.append(f"focused control off screen: {focus['tag']} {focus['label']!r}")
        if not focus["ring"]:
            problems.append(f"no visible focus indicator: {focus['tag']} {focus['label']!r}")
    if not seen:
        problems.append("Tab reaches no control")
    return problems


OPENERS = "button[aria-haspopup], button[aria-expanded='false'], summary"


def opened_views(page, url: str) -> list[str]:
    """axe on what the page's dialogs, menus and disclosures show when opened (Settings, the
    account menu, Skills…), one at a time, closed again with Escape."""
    problems = []
    named = re.compile(r"^(Settings|Skills|Scheduled|Files|Conversations|Open Devices|Expand)$")

    def openers():
        return [page.locator(OPENERS).nth(i) for i in range(page.locator(OPENERS).count())] + [
            page.get_by_role("button", name=named).nth(i)
            for i in range(page.get_by_role("button", name=named).count())]

    for index in range(min(len(openers()), 16)):
        page.goto(url, wait_until="networkidle")
        found = openers()
        if index >= len(found):
            break
        opener = found[index]
        try:
            if not opener.is_visible():
                continue
            name = (opener.get_attribute("aria-label") or opener.inner_text() or "").strip()[:40]
            opener.click(timeout=3000)
            page.wait_for_timeout(300)
        except Exception:  # noqa: BLE001, S112 - a control that cannot be pressed is the surface audit's finding
            continue
        page.add_script_tag(path=str(AXE))
        result = page.evaluate("tags => axe.run(document, {runOnly: {type: 'tag', values: tags}})", TAGS)
        for violation in result["violations"]:
            if violation["impact"] in FAILING:
                targets = [", ".join(node["target"]) for node in violation["nodes"][:3]]
                problems.append(f"after opening {name!r}: axe {violation['impact']} {violation['id']}: "
                                f"{violation['help']} at {targets}")
        page.keyboard.press("Escape")
    return problems


def reflow(page, url: str) -> list[str]:
    page.set_viewport_size({"width": 683, "height": 450})
    response = page.goto(url, wait_until="networkidle")
    if response and not (response.headers.get("content-type") or "").startswith("text/html"):
        page.set_viewport_size({"width": 1366, "height": 900})
        return []
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    page.set_viewport_size({"width": 1366, "height": 900})
    return [f"scrolls sideways by {overflow}px at 200% zoom"] if overflow > 1 else []


def jarvis_mobile_navigation(page, url: str) -> None:
    page.set_viewport_size({"width": 320, "height": 740})
    try:
        page.goto(url, wait_until="networkidle")
        opener = page.get_by_role("button", name="Open navigation")
        opener.focus()
        opener.press("Enter")
        drawer = page.get_by_role("dialog", name="JARVIS navigation")
        expect(drawer.get_by_role("button", name="Close navigation")).to_be_focused()
        for key in ("Shift+Tab", *["Tab"] * 12):
            page.keyboard.press(key)
            assert drawer.evaluate("el => el.contains(document.activeElement)"), "navigation leaked focus"
        drawer.get_by_role("button", name="Scheduled").click()
        expect(drawer.get_by_role("heading", name="Scheduled")).to_be_visible()
        assert drawer.evaluate("el => el.scrollWidth <= el.clientWidth"), "navigation overflows at 320px"
        page.keyboard.press("Escape")
        expect(drawer).to_have_count(0)
        expect(opener).to_be_focused()
    finally:
        page.set_viewport_size({"width": 1366, "height": 900})


def main(base: str, session: str | None, storage_key: str | None, engine: str) -> int:
    origin = surface_audit.site_origin(base)
    if session and os.environ.get("OCADE_AUDIT_SESSION_ORIGIN") != origin:
        raise ValueError("set the exact disposable audit origin before loading a synthetic session")
    login = surface_audit.session_script(origin, storage_key, Path(session).read_text(encoding="utf-8")) \
        if session else None
    report: dict[str, list[str]] = {}
    with sync_playwright() as playwright:
        browser = surface_audit.launch_audit_browser(playwright, engine)
        # axe is injected into the page, which the site's own CSP rightly refuses; only the audit bypasses it.
        page = browser.new_page(viewport={"width": 1366, "height": 900}, bypass_csp=True)
        if login:
            page.add_init_script(login)
        queue = [origin + path for path in ("/", "/library", "/ocade-jarvis")]
        seen: set[str] = set()
        while queue and len(seen) < 80:
            url = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)
            try:
                problems = audit_page(page, url)
                queue.extend(link for link in links(page, origin) if link not in seen)
                problems += opened_views(page, url)
                problems += reflow(page, url)
                if urlsplit(url).path == "/ocade-jarvis":
                    try:
                        jarvis_mobile_navigation(page, url)
                    except AssertionError as error:
                        problems.append(f"mobile JARVIS navigation: {str(error)[:200]}")
            except Exception as error:  # noqa: BLE001 - a page that cannot be audited is a finding
                problems = [f"could not audit: {str(error)[:200]}"]
            report[urlsplit(url).path] = problems
        browser.close()
    failed = {path: problems for path, problems in report.items() if problems}
    print(json.dumps({"engine": engine, "signedIn": bool(login), "pages": len(report),
                      "pagesWithProblems": len(failed), "problems": failed}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base")
    parser.add_argument("session", nargs="?")
    parser.add_argument("storage_key", nargs="?")
    parser.add_argument("--engine", choices=surface_audit.ENGINES, default="chromium")
    sys.exit(main(**vars(parser.parse_args())))
