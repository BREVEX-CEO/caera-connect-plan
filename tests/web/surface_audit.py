"""Customer-surface audit of the public website (plan.md 146-147, 156, 159-160).

Crawls every same-site page reachable from the landing page in a real Chromium and fails on:
a non-200 page or broken same-site link, a console error or uncaught page error, a page
without exactly one <h1>, a missing <html lang>, an image without alt text, or a button/link
without an accessible name. Desktop and phone viewports.

    python tests/web/surface_audit.py http://127.0.0.1:8787 [session.json storage-key]

With a session file (a synthetic test account's Supabase session) the browser starts signed
in, and the signed-in destinations are audited too.
"""

import json
import os
import sys
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright

ACCESSIBILITY = """() => ({
  h1: document.querySelectorAll('h1').length,
  lang: document.documentElement.lang,
  noAlt: [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.src).slice(0, 5),
  unnamed: [...document.querySelectorAll('a[href],button')].filter(e => e.offsetParent !== null
      && !(e.innerText.trim() || e.getAttribute('aria-label') || e.title || e.querySelector('img[alt]:not([alt=""]),svg[aria-label],title')))
    .map(e => e.outerHTML.slice(0, 120)).slice(0, 5),
  links: [...document.querySelectorAll('a[href]')].map(a => a.href),
})"""


def main(base: str, session: str | None = None, storage_key: str | None = None) -> int:
    origin = urlparse(base).netloc
    problems: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get("OCADE_BROWSER_EXECUTABLE"))
        for name, viewport in (("desktop", {"width": 1366, "height": 900}), ("phone", {"width": 390, "height": 844})):
            page = browser.new_page(viewport=viewport)
            if session:
                page.add_init_script(f"localStorage.setItem({json.dumps(storage_key)}, {json.dumps(open(session).read())})")
            errors: list[str] = []
            page.on("console", lambda m: errors.append(f"console {m.type}: {m.text[:160]}") if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(f"page error: {str(e)[:160]}"))
            queue, seen = [base.rstrip("/") + path for path in ("/", "/library", "/ocade-jarvis")], set()
            while queue:
                url = queue.pop(0).split("#")[0]
                if url in seen or urlparse(url).netloc != origin:
                    continue
                seen.add(url)
                errors.clear()
                response = page.goto(url, wait_until="networkidle")
                status = response.status if response else 0
                where = f"[{name}] {urlparse(url).path}"
                if status != 200:
                    problems.append(f"{where}: HTTP {status}")
                    continue
                facts = page.evaluate(ACCESSIBILITY)
                if facts["h1"] != 1:
                    problems.append(f"{where}: {facts['h1']} <h1> elements")
                if not facts["lang"]:
                    problems.append(f"{where}: <html> has no lang")
                problems += [f"{where}: image without alt {src}" for src in facts["noAlt"]]
                problems += [f"{where}: control without an accessible name {html}" for html in facts["unnamed"]]
                problems += [f"{where}: {error}" for error in errors]
                queue += [urljoin(url, link) for link in facts["links"] if urlparse(urljoin(url, link)).netloc == origin]
            print(f"[{name}] audited {len(seen)} pages")
            page.close()
        browser.close()
    for problem in problems:
        print(problem)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
