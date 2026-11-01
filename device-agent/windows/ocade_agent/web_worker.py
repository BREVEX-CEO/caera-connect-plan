"""`web_automation`: authorized websites through Playwright (plan.md §25.5, P11).

One OCADE browser profile in the companion's own folder — never the person's
Chrome profile, cookies or passwords. Microsoft Edge is used where installed,
else Playwright's Chromium (or `OCADE_BROWSER_EXECUTABLE`). The window is
visible, so a person signs in, passes a CAPTCHA or confirms MFA themselves;
JARVIS reports `needsSignIn` and never types a password.

THE SITE IS FIXED WHEN A PAGE OPENS. Each page id is bound, inside this worker,
to the https host it was opened for; the `site` a caller sends must equal that
binding and the page must still be on it, so neither a redirect, a link, a
popup, an iframe nor a forged `page` object can carry JARVIS to a site the
person did not allow. Loopback, private, link-local and reserved addresses are
refused (at open by DNS, and for every request by literal address) unless the
device owner set `OCADE_ALLOW_PRIVATE_WEB=1` for an isolated test machine.
Clicks and uploads can change things outside the computer, so they are
external effects the person confirms before they reach here.
"""

from __future__ import annotations

import asyncio
import functools
import ipaddress
import json
import re
import os
import secrets
import socket
from pathlib import Path
from urllib.parse import urlparse

from mcp.server.mcpserver import MCPServer

from .sandbox import Refused, output_path, preview_jpeg, resolve, write_atomically

app = MCPServer("ocade-web")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
PROFILE = Path(os.environ.get("OCADE_AGENT_HOME") or Path.home() / ".ocade-agent") / "browser-profile"
PRIVATE_ALLOWED = os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1"
TEXT_LIMIT = 8_000
EVIDENCE_LIMIT = 15_000  # leaves room for popups beside an observation
_browser: dict = {}
_pages: dict[str, dict] = {}  # id -> {"page": Page, "site": host fixed at open}

# Inputs, buttons and links the planner may name, each with a selector Playwright can find again.
# Selectors carry this observation's token: one from an older read no longer matches anything
# (refused as selector_not_found) instead of silently naming whatever now has that number.
# A label that repeats on the page ("Download" in every row) also carries its row's text.
# File inputs are listed even when a web app hides them.
_CONTROLS = """(token) => {
  document.querySelectorAll('[data-ocade]').forEach(e => e.removeAttribute('data-ocade'));
  const flat = s => (s || '').replace(/\\s+/g, ' ').trim();
  const listed = [...document.querySelectorAll('a[href],button,input,select,textarea,[contenteditable]:not([contenteditable=false]),[role=button],[role=menuitem],[role=tab],[role=textbox],[role=spinbutton],[role=slider],iframe')]
    .filter(e => e.offsetParent !== null || e.type === 'file').slice(0, 80);
  const labels = listed.map(e => flat(e.labels?.[0]?.innerText || e.getAttribute('aria-label') || e.title || e.innerText || e.value).slice(0, 80));
  const seen = {};
  labels.forEach(l => { seen[l] = (seen[l] || 0) + 1; });
  return listed.map((e, i) => {
    e.setAttribute('data-ocade', `${token}-${i}`);
    const row = seen[labels[i]] > 1 ? e.closest('tr,li,[role=row]') : null;
    return {
      tag: e.tagName.toLowerCase(), type: e.type || '', name: (e.name || '').slice(0, 40),
      label: labels[i],
      selector: `[data-ocade="${token}-${i}"]`,
      ...(row ? { row: flat(row.innerText).slice(0, 120) } : {}),
      // Where a link goes, so it can be opened as seen (same site: path only, to stay small).
      ...(e.tagName === 'A' && /^https?:/.test(e.href)
        ? { href: (e.origin === location.origin ? e.pathname + e.search : e.href).slice(0, 160) } : {}),
    };
  });
}"""


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def _private_address(text: str) -> bool:
    try:
        address = ipaddress.ip_address(text)
    except ValueError:
        return False
    return not address.is_global


def _allowed_url(url: str) -> bool:
    """https on the default port to a public address (or anything, on an owner-flagged test machine)."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if PRIVATE_ALLOWED:
        return parsed.scheme in ("https", "http") and bool(host)
    if parsed.scheme != "https" or parsed.port not in (None, 443) or not host:
        return False
    return host != "localhost" and not host.endswith(".localhost") and not _private_address(host)


def _public_by_dns(host: str) -> bool:
    if PRIVATE_ALLOWED:
        return True
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, 443)}
    except OSError:
        return False
    return bool(addresses) and not any(_private_address(a.split("%")[0]) for a in addresses)


async def _guard(route) -> None:
    # Every request, including scripts and frames: no loopback or private literal addresses.
    url = route.request.url
    if url.startswith(("data:", "blob:", "about:")) or _allowed_url(url):
        await route.continue_()
    else:
        await route.abort("blockedbyclient")


async def _context():
    if "context" not in _browser:
        from playwright.async_api import async_playwright

        playwright = await async_playwright().start()
        PROFILE.mkdir(parents=True, exist_ok=True)
        options = {"user_data_dir": str(PROFILE), "headless": False, "accept_downloads": True}
        executable = os.environ.get("OCADE_BROWSER_EXECUTABLE")
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
        if proxy:
            options["proxy"] = {"server": proxy, "bypass": os.environ.get("NO_PROXY", "")}
        if executable:
            context = await playwright.chromium.launch_persistent_context(executable_path=executable, **options)
        else:
            try:
                context = await playwright.chromium.launch_persistent_context(channel="msedge", **options)
            except Exception:
                context = await playwright.chromium.launch_persistent_context(**options)
        await context.route("**/*", _guard)
        _browser.update(playwright=playwright, context=context)
    return _browser["context"]


def _bound(page: dict) -> dict:
    """The page entry for this id, still on the site it was bound to at open."""
    entry = _pages.get(page["id"])
    if entry is None or entry["page"].is_closed():
        raise Refused("page_gone")
    if page["site"] != entry["site"]:
        raise Refused("site_mismatch")
    if _host(entry["page"].url) != entry["site"]:
        raise Refused("page_left_site")
    return entry


async def _scope(entry: dict, frame: str | None):
    """The page, or one iframe in it that is on the same bound site."""
    current = entry["page"]
    if not frame:
        return current
    handle = await current.query_selector(frame)
    content = await handle.content_frame() if handle else None
    if content is None:
        raise Refused("frame_not_found")
    if _host(content.url) != entry["site"]:
        raise Refused("frame_off_site")
    return content


async def _one(scope, selector: str):
    """Exactly one element; web apps render late, so wait (bounded) for it to exist first."""
    observed = re.match(r'\[data-ocade="([0-9a-f]+)-\d+"\]$', selector)
    if observed and observed.group(1) not in {entry.get("token") for entry in _pages.values()}:
        raise Refused("stale_selector")  # from an older observation: read the page again
    target = scope.locator(selector)
    try:
        await target.first.wait_for(state="attached", timeout=20_000)
    except Exception:
        raise Refused("selector_not_found")
    if await target.count() != 1:
        raise Refused("selector_not_unique")
    return target


async def _observe(page_id: str) -> dict:
    entry = _pages[page_id]
    current = entry["page"]
    text = await current.inner_text("body", timeout=10_000)
    token = entry["token"] = secrets.token_hex(3)
    observed = {
        "page": {"id": page_id, "site": entry["site"]},
        "url": current.url[:500],
        "title": (await current.title())[:200],
        "controls": await current.evaluate(_CONTROLS, token),
        "text": text[:TEXT_LIMIT],
        # A sign-in or challenge is the person's to complete in the OCADE browser window.
        "needsSignIn": await current.locator("input[type=password]:visible").count() > 0,
    }
    # The gateway refuses evidence over 16 KB: give up page text first, then the last controls.
    excess = len(json.dumps(observed)) - EVIDENCE_LIMIT
    if excess > 0:
        observed["text"] = observed["text"][: max(0, len(observed["text"]) - excess)]
    while len(json.dumps(observed)) > EVIDENCE_LIMIT and observed["controls"]:
        observed["controls"].pop()
    return observed


async def _capture(current) -> bytes:
    """What the page shows, once it has painted: capturing a page before its first frame
    (a window that just opened) fails with "Unable to capture screenshot"."""
    try:
        painted = current.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        await asyncio.wait_for(painted, 5)  # a hidden page never paints
    except Exception:
        pass  # the capture below reports honestly either way
    return await current.screenshot(full_page=False)


def _bind(new_page, site: str) -> str:
    page_id = secrets.token_hex(6)
    _pages[page_id] = {"page": new_page, "site": site}
    return page_id


def _refusals(fn):
    @functools.wraps(fn)
    async def wrapped(**kwargs):
        try:
            return await fn(**kwargs)
        except Refused as refusal:
            return {"refused": refusal.code}

    return wrapped


@app.tool()
@_refusals
async def web_open(url: str) -> dict:
    """Open a page on an allowed site in the OCADE browser; the page is bound to that site."""
    site = _host(url)
    if not _allowed_url(url) or not _public_by_dns(site):
        raise Refused("site_not_public")
    try:
        context = await _context()
    except Exception:
        raise Refused("browser_unavailable")  # no display, or the browser cannot start here: retrying will not help
    current = await context.new_page()
    try:
        await current.goto(url, wait_until="domcontentloaded", timeout=45_000)
    except Exception:
        await current.close()
        raise Refused("navigation_failed")
    if _host(current.url) != site:
        await current.close()
        raise Refused("redirected_off_site")
    return await _observe(_bind(current, site))


@app.tool()
@_refusals
async def web_read(page: dict) -> dict:
    """Read the page as it is now: title, visible text, controls and whether it asks for a sign-in."""
    _bound(page)
    return await _observe(page["id"])


@app.tool()
@_refusals
async def web_fill(page: dict, selector: str, value: str, frame: str | None = None) -> dict:
    """Type a value into one field (optionally inside a same-site iframe), then read it back."""
    field = await _one(await _scope(_bound(page), frame), selector)
    if (await field.get_attribute("type") or "").lower() == "password":
        raise Refused("password_field")  # credentials are the person's to type
    if await field.evaluate("e => e.isContentEditable"):
        # A web app's own text widget listens for real keystrokes, not a set value.
        if any(ord(ch) < 32 for ch in value):
            raise Refused("control_characters")  # Enter or Tab could submit or move on
        await field.focus()
        await field.page.keyboard.press("ControlOrMeta+A")
        await field.page.keyboard.type(value)
    else:
        await field.fill(value, timeout=10_000)
    await field.evaluate("e => e.blur()")  # as a person moving on: the widget commits its value
    # Read back from a form field or an editable element (a web app's own text widget).
    shown = await field.evaluate("e => 'value' in e ? e.value : e.innerText")
    return {"matches": shown.strip() == value.strip()}


@app.tool()
@_refusals
async def web_select(page: dict, selector: str, option: str, frame: str | None = None) -> dict:
    """Choose one option (by its visible label) in a dropdown, then read the choice back."""
    field = await _one(await _scope(_bound(page), frame), selector)
    await field.select_option(label=option, timeout=10_000)
    chosen = await field.evaluate("e => e.options[e.selectedIndex]?.text ?? ''")
    return {"matches": chosen == option}


@app.tool()
@_refusals
async def web_click(page: dict, selector: str, frame: str | None = None) -> dict:
    """Click one control (confirmed by the person); bind a same-site popup, close any other."""
    entry = _bound(page)
    target = await _one(await _scope(entry, frame), selector)
    context = await _context()
    opened_now: list = []

    def collect(new_page) -> None:
        opened_now.append(new_page)

    context.on("page", collect)
    await target.click(timeout=10_000)
    current = entry["page"]
    try:
        await current.wait_for_load_state("domcontentloaded", timeout=30_000)
        # ponytail: fixed 0.5 s window for a popup to appear; a slower one is seen by the next read.
        await current.wait_for_timeout(500)
    except Exception:
        pass  # observed below either way
    context.remove_listener("page", collect)
    popups = []
    for opened in opened_now:
        try:
            await opened.wait_for_load_state("domcontentloaded", timeout=15_000)
        except Exception:
            pass
        if _host(opened.url) == entry["site"]:
            popups.append(_bind(opened, entry["site"]))
        else:
            await opened.close()
            popups.append("closed_off_site")
    if _host(current.url) != entry["site"]:
        return {"leftSite": True, "url": current.url[:500], "popups": popups}
    # What the page now looks like travels as a preview, so a canvas app's change is seen.
    from io import BytesIO

    from PIL import Image

    with Image.open(BytesIO(await _capture(current))) as shot:
        preview = preview_jpeg(shot, 30_000)  # leaves room for the page beside it in one receipt
    return await _observe(page["id"]) | {"popups": popups, "preview": preview}


@app.tool()
@_refusals
async def web_upload(page: dict, selector: str, path: str) -> dict:
    """Attach one workspace file to a file input (confirmed by the person: it leaves the computer)."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    field = await _one(_bound(page)["page"], selector)
    if (await field.get_attribute("type") or "").lower() != "file":
        raise Refused("not_a_file_input")
    # Web apps often read the file on `change` and then clear the input, so the names are
    # taken by a listener that runs first, not read back afterwards.
    await field.evaluate(
        "e => e.addEventListener('change', () => { e.dataset.ocadeAttached = JSON.stringify([...e.files].map(f => f.name)) }, {once: true, capture: true})"
    )
    await field.set_input_files(str(source))
    names = json.loads(await field.evaluate("e => e.dataset.ocadeAttached || '[]'"))
    return {"attached": names, "matches": names == [source.name]}


@app.tool()
@_refusals
async def web_download(page: dict, selector: str, output: str) -> dict:
    """Click a download link and save the file under OCADE output."""
    current = _bound(page)["page"]
    target = output_path(WORKSPACE, output)
    link = await _one(current, selector)
    async with current.expect_download(timeout=60_000) as pending:
        await link.click()
    download = await pending.value
    staged = Path(await download.path())
    digest = write_atomically(target, lambda temporary: temporary.write_bytes(staged.read_bytes()))
    with open(target, "rb") as stream:
        head = stream.read(8)
    return {
        "sha256": digest,
        "bytes": target.stat().st_size,
        "suggested": download.suggested_filename[:200],
        "magic": head.hex(),
    }


@app.tool()
@_refusals
async def web_screenshot(page: dict, output: str) -> dict:
    """Save what the page shows as a PNG under OCADE output."""
    current = _bound(page)["page"]
    target = output_path(WORKSPACE, output)
    image = await _capture(current)
    return {"sha256": write_atomically(target, lambda temporary: temporary.write_bytes(image)), "bytes": len(image)}


@app.tool()
@_refusals
async def web_close(page: dict) -> dict:
    """Close a page JARVIS opened, wherever it ended up."""
    entry = _pages.pop(page["id"], None)
    if entry is None:
        raise Refused("page_gone")
    await entry["page"].close()
    return {"closed": True}


if __name__ == "__main__":
    app.run("stdio")
