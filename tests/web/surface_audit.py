"""Customer-surface audit of the public website (plan.md 146-147, 156, 159-160).

Crawls same-origin pages reachable from the landing page in a selected browser and fails on:
a non-200 page or broken same-site link, a console error or uncaught page error, a page
without exactly one <h1>, a missing <html lang>, an image without alt text, or a button/link
without an accessible name. Each browser is exercised at desktop and mobile sizes.

    python tests/web/surface_audit.py http://127.0.0.1:8787 [session.json storage-key] --engine webkit

With a session file (a synthetic test account's Supabase session) the browser starts signed
in, and the signed-in destinations are audited too.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

from playwright.sync_api import sync_playwright

ACCESSIBILITY = r"""() => ({
  h1: document.querySelectorAll('h1').length,
  lang: document.documentElement.lang,
  noAlt: [...document.images].filter(i => !i.hasAttribute('alt')).map(i => i.src).slice(0, 5),
  unnamed: [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea')]
    .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
    .filter(e => {
      const references = (e.getAttribute('aria-labelledby') || '').trim().split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
      return !(e.innerText?.trim() || e.getAttribute('aria-label')?.trim() || references.length
        || e.title || [...(e.labels || [])].some(label => label.textContent.trim())
        || (e.matches('input[type=button],input[type=submit],input[type=reset]') && e.value)
        || e.querySelector('img[alt]:not([alt=""]),svg[aria-label],title'));
    }).map(e => e.tagName.toLowerCase()).slice(0, 5),
  links: [...document.querySelectorAll('a[href]')].map(a => a.href),
})"""


ENGINES = ("chromium", "firefox", "webkit")


def browser_profiles(playwright, engine: str) -> list[tuple[str, dict]]:
    desktop = ("desktop", {"viewport": {"width": 1366, "height": 900}})
    if engine == "webkit":
        return [desktop, ("ios-emulation", playwright.devices["iPhone 13"])]
    if engine == "chromium":
        return [desktop, ("android-emulation", playwright.devices["Pixel 5"])]
    return [desktop, ("phone-viewport", {"viewport": {"width": 390, "height": 844}, "has_touch": True})]


def launch_audit_browser(playwright, engine: str):
    executable = os.environ.get("OCADE_BROWSER_EXECUTABLE") if engine == "chromium" else None
    return getattr(playwright, engine).launch(**({"executable_path": executable} if executable else {}))


def site_origin(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname or parts.username is not None:
        raise ValueError("audit URL must be an HTTP(S) origin without credentials")
    host = "[" + parts.hostname + "]" if ":" in parts.hostname else parts.hostname.encode("idna").decode("ascii")
    default_port = 443 if parts.scheme == "https" else 80
    return f"{parts.scheme}://{host}" + (f":{parts.port}" if parts.port and parts.port != default_port else "")


def route_url(base: str, link: str) -> str | None:
    try:
        url = urlsplit(urljoin(base, link))
        if site_origin(url.geturl()) != site_origin(base):
            return None
    except ValueError:
        return None
    return urlunsplit((url.scheme, url.netloc, url.path or "/", url.query, ""))


def session_script(origin: str, key: str, session: str) -> str:
    return f"""
      if (window.top === window && location.origin === {json.dumps(origin)}
          && !sessionStorage.getItem("ocade-audit-session-injected")) {{
        localStorage.setItem({json.dumps(key)}, {json.dumps(session)});
        sessionStorage.setItem("ocade-audit-session-injected", "1");
      }}
    """


def audit_offline(page, origin: str) -> None:
    manifest = page.request.get(origin + "/manifest.webmanifest")
    if not manifest.ok:
        raise AssertionError("manifest_unavailable")
    metadata = manifest.json()
    if metadata.get("start_url") != "/ocade-jarvis" or metadata.get("display") != "standalone":
        raise AssertionError("manifest_launch_contract")
    page.goto(origin + "/ocade-jarvis", wait_until="domcontentloaded")
    page.wait_for_function("Boolean(navigator.serviceWorker?.controller)", timeout=15_000)
    page.context.set_offline(True)
    try:
        response = page.goto(origin + "/library", wait_until="domcontentloaded")
        if not response or response.status != 200 or page.title() != "OCADE Local Mode":
            raise AssertionError("private_route_offline_fallback")
        response = page.goto(origin + "/ocade-jarvis", wait_until="domcontentloaded")
        if not response or response.status != 200 or page.title() == "OCADE Local Mode":
            raise AssertionError("jarvis_offline_shell")
    finally:
        page.context.set_offline(False)


# JavaScript a first visit to the landing page downloads, decoded (159): 853,462 bytes measured
# on 7 November 2026, plus headroom. Raising it is a decision, not a side effect of an import.
FIRST_VISIT_SCRIPT_BUDGET = int(os.environ.get("OCADE_FIRST_VISIT_SCRIPT_BUDGET", "0")) or 950_000


def first_visit_script_bytes(browser, origin: str) -> int:
    """Decoded bytes of every script a fresh visitor's landing page loads (nothing cached)."""
    context = browser.new_context()
    sizes: list[int] = []

    def counted(response) -> None:
        if response.request.resource_type == "script":
            try:
                sizes.append(len(response.body()))
            except Exception:
                pass

    try:
        page = context.new_page()
        page.on("response", counted)
        page.goto(origin + "/", wait_until="networkidle")
        return sum(sizes)
    finally:
        context.close()


def main(base: str, session: str | None = None, storage_key: str | None = None,
         engine: str = "chromium", pwa: bool = False) -> int:
    origin = site_origin(base)
    if bool(session) != bool(storage_key):
        raise ValueError("provide both the synthetic session file and its storage key")
    if session and os.environ.get("OCADE_AUDIT_SESSION_ORIGIN") != origin:
        raise ValueError("set the exact disposable audit origin before loading a synthetic session")
    login = session_script(origin, storage_key, Path(session).read_text(encoding="utf-8")) if session else None
    problems: list[str] = []
    with sync_playwright() as playwright:
        browser = launch_audit_browser(playwright, engine)
        if not login:
            scripts = first_visit_script_bytes(browser, origin)
            print(json.dumps({"engine": engine, "firstVisitScriptBytes": scripts, "budget": FIRST_VISIT_SCRIPT_BUDGET}))
            if scripts > FIRST_VISIT_SCRIPT_BUDGET:
                problems.append(f"[{engine}] the landing page loads {scripts} bytes of script, over {FIRST_VISIT_SCRIPT_BUDGET}")
        for name, options in browser_profiles(playwright, engine):
            page = browser.new_page(**options)
            if login:
                page.add_init_script(login)
            errors: list[str] = []
            page.on("console", lambda message: errors.append("console error") if message.type == "error" else None)
            page.on("pageerror", lambda _error: errors.append("uncaught page error"))
            queue = [origin + path for path in ("/", "/library", "/ocade-jarvis")]
            seen: set[str] = set()
            while queue:
                url = queue.pop(0)
                if url in seen:
                    continue
                if len(seen) >= 512:
                    problems.append(f"[{engine}/{name}] route limit reached")
                    break
                seen.add(url)
                errors.clear()
                where = f"[{engine}/{name}] {urlsplit(url).path}"
                try:
                    response = page.goto(url, wait_until="networkidle")
                    status = response.status if response else 0
                    if status != 200:
                        problems.append(f"{where}: HTTP {status}")
                        continue
                    if site_origin(page.url) != origin:
                        problems.append(f"{where}: redirected off the audit origin")
                        continue
                    facts = page.evaluate(ACCESSIBILITY)
                except Exception as error:
                    problems.append(f"{where}: {type(error).__name__}")
                    continue
                if facts["h1"] != 1:
                    problems.append(f"{where}: {facts['h1']} <h1> elements")
                if not facts["lang"]:
                    problems.append(f"{where}: <html> has no lang")
                problems += [f"{where}: image without alt" for _ in facts["noAlt"]]
                problems += [f"{where}: {tag} without an accessible name" for tag in facts["unnamed"]]
                problems += [f"{where}: {error}" for error in errors]
                queue.extend(target for link in facts["links"] if (target := route_url(url, link)))
            if pwa:
                try:
                    audit_offline(page, origin)
                except Exception as error:
                    reason = str(error) if isinstance(error, AssertionError) else type(error).__name__
                    problems.append(f"[{engine}/{name}] offline shell: {reason}")
            print(f"[{engine}/{name}] audited {len(seen)} pages")
            page.close()
        browser.close()
    for problem in problems:
        print(problem)
    return int(bool(problems))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base")
    parser.add_argument("session", nargs="?")
    parser.add_argument("storage_key", nargs="?")
    parser.add_argument("--engine", choices=ENGINES, default="chromium")
    parser.add_argument("--pwa", action="store_true")
    sys.exit(main(**vars(parser.parse_args())))
