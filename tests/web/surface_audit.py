"""Customer-surface audit of the public website (plan.md 146-147, 156, 159-160).

Crawls same-origin pages reachable from the landing page in a selected browser and fails on:
a non-200 page or broken same-site link, a console error or uncaught page error, a page
without exactly one <h1>, a missing <html lang>, an image without alt text, or a button/link
without an accessible name. Each browser is exercised at desktop and mobile sizes.

It also inventories every visible control (route, kind, accessible name; `--inventory` writes
it as JSON) and, signed out on the desktop size, presses each distinct button once on a fresh
load of its page (an option already chosen is not pressed): a button that changes nothing (no navigation, no change to the page, no
request, no dialog, no new window) is a dead control and fails the audit.

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
  controls: [...document.querySelectorAll(
      'a[href],button,[role=button],[role=menuitem],[role=tab],[role=switch],[role=checkbox],'
      + 'input:not([type=hidden]),select,textarea')]
    .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
    .map(e => ({
      kind: e.matches('input[type=file]') ? 'file upload' : e.getAttribute('role')
        || (e.tagName === 'INPUT' ? 'input:' + (e.type || 'text') : e.tagName.toLowerCase()),
      name: (e.getAttribute('aria-label') || e.innerText || e.title || e.placeholder || e.name || '')
        .trim().replace(/\s+/g, ' ').slice(0, 80),
      disabled: e.matches(':disabled') || e.getAttribute('aria-disabled') === 'true',
      // The option already chosen: pressing it again rightly changes nothing.
      selected: ['aria-pressed', 'aria-selected', 'aria-checked']
        .some(attribute => e.getAttribute(attribute) === 'true') || e.hasAttribute('aria-current'),
    })),
})"""

# Watches one press: any DOM change, request or URL change after it counts as an effect.
WATCH = r"""() => {
  window.__ocadeEffects = 0;
  new MutationObserver(records => { window.__ocadeEffects += records.length; })
    .observe(document, {subtree: true, childList: true, attributes: true, characterData: true});
}"""


def dead_buttons(browser, url: str, names: list[str]) -> list[str]:
    """The named buttons on this page that change nothing when pressed (160)."""
    dead = []
    for name in names:
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        effects = []
        page.on("request", lambda _request: effects.append("request"))
        page.on("dialog", lambda dialog: (effects.append("dialog"), dialog.dismiss()))
        page.on("popup", lambda popup: (effects.append("popup"), popup.close()))
        try:
            page.goto(url, wait_until="networkidle")
            control = page.get_by_role("button", name=name, exact=True).first
            if not control.is_visible() or not control.is_enabled():
                continue
            page.evaluate(WATCH)
            effects.clear()
            before = page.url
            control.click(timeout=5_000)
            page.wait_for_timeout(600)
            changed = page.url != before or effects or page.evaluate("window.__ocadeEffects") > 0
            if not changed:
                dead.append(name)
        except Exception as error:
            dead.append(f"{name} ({type(error).__name__})")
        finally:
            page.close()
    return dead


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
    # Polled with evaluate: wait_for_function evaluates a string, which the site's CSP blocks in Firefox.
    for _ in range(60):
        if page.evaluate("() => Boolean(navigator.serviceWorker?.controller)"):
            break
        page.wait_for_timeout(250)
    else:
        raise AssertionError("service_worker_not_controlling")
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
         engine: str = "chromium", pwa: bool = False, inventory: Path | None = None) -> int:
    origin = site_origin(base)
    if bool(session) != bool(storage_key):
        raise ValueError("provide both the synthetic session file and its storage key")
    if session and os.environ.get("OCADE_AUDIT_SESSION_ORIGIN") != origin:
        raise ValueError("set the exact disposable audit origin before loading a synthetic session")
    login = session_script(origin, storage_key, Path(session).read_text(encoding="utf-8")) if session else None
    problems: list[str] = []
    controls: dict[str, list[dict]] = {}
    pressed: set[str] = set()
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
            page.on("console", lambda message: errors.append(f"console error: {message.text[:160]}")
                    if message.type == "error" else None)
            page.on("pageerror", lambda error: errors.append(f"uncaught page error: {str(error)[:160]}"))
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
                path = urlsplit(url).path
                if path not in controls:
                    controls[path] = [dict(t) for t in {tuple(c.items()) for c in facts["controls"]}]
                if name == "desktop" and not login:
                    # Each distinct button once, where it first appears (headers repeat on every page).
                    fresh = sorted({c["name"] for c in facts["controls"]
                                    if c["kind"] == "button" and c["name"] and not c["disabled"] and not c["selected"]} - pressed)
                    pressed.update(fresh)
                    problems += [f"{where}: the button '{dead}' does nothing"
                                 for dead in dead_buttons(browser, url, fresh)]
                queue.extend(target for link in facts["links"] if (target := route_url(url, link)))
            if pwa and engine == "firefox":
                # Playwright's offline emulation does not reach a Firefox service worker's own
                # requests, so "offline" pages still come from the network; Chromium and WebKit
                # measure the offline shell.
                print(f"[{engine}/{name}] offline shell: not measurable in Firefox under Playwright")
            elif pwa:
                try:
                    audit_offline(page, origin)
                except Exception as error:
                    reason = str(error) if isinstance(error, AssertionError) else type(error).__name__
                    problems.append(f"[{engine}/{name}] offline shell: {reason}")
            print(f"[{engine}/{name}] audited {len(seen)} pages")
            page.close()
        browser.close()
    if inventory:
        inventory.write_text(json.dumps({"engine": engine, "routes": controls}, indent=1, sort_keys=True))
    print(f"[{engine}] {sum(len(c) for c in controls.values())} controls on {len(controls)} routes")
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
    parser.add_argument("--inventory", type=Path, default=None)
    sys.exit(main(**vars(parser.parse_args())))
