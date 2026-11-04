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
import ipaddress
import json
import re
import os
import secrets
import socket
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urljoin, urlparse

import anyio
from mcp.server.mcpserver import MCPServer

from .sandbox import Refused, guarded as _refusals, mark_effect, output_path, preview_jpeg, resolve, write_atomically

WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
PROFILE = Path(os.environ.get("OCADE_AGENT_HOME") or Path.home() / ".ocade-agent") / "browser-profile"
PRIVATE_ALLOWED = os.environ.get("OCADE_ALLOW_PRIVATE_WEB") == "1"
TEXT_LIMIT = 8_000
EVIDENCE_LIMIT = 15_000  # leaves room for popups beside an observation
_browser: dict = {}
_pages: dict[str, dict] = {}  # id -> {"page": Page, "site": host fixed at open}
_redirects: dict = {}  # Page -> the next hop of a stopped redirect, followed only after it is checked
MAX_HOPS = 10


async def _close_browser() -> None:
    """One cleanup owner for server shutdown and partially failed startup."""
    context = _browser.pop("context", None)
    playwright = _browser.pop("playwright", None)
    _pages.clear()
    # The MCP transport bounds process shutdown and contains the whole tree.
    # EOF/cancellation must still give Chromium and its driver a chance to close.
    with anyio.CancelScope(shield=True):
        try:
            if context is not None:
                await context.close()
        finally:
            if playwright is not None:
                await playwright.stop()


@asynccontextmanager
async def _lifespan(_server):
    try:
        yield
    finally:
        await _close_browser()


app = MCPServer("ocade-web", lifespan=_lifespan)

# Inputs, buttons and links the planner may name, each with a selector Playwright can find again.
# Selectors carry this observation's token: one from an older read no longer matches anything
# (refused as selector_not_found) instead of silently naming whatever now has that number.
# A label that repeats on the page ("Download" in every row) also carries its row's text.
# File inputs are listed even when a web app hides them.
# Visible tables as rows of cells with their headers and each row's first link: a dense table
# read as flat text loses which value belongs to which row (eval r1c, D9).
_TABLES = """() => {
  const visible = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const cell = (c) => (c.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
  return [...document.querySelectorAll('table')].filter(visible).slice(0, 3).map((table) => {
    const rows = [...table.rows].filter(visible);
    const head = rows.length && [...rows[0].cells].every((c) => c.tagName === 'TH') ? rows.shift() : null;
    const headers = head ? [...head.cells].map(cell).slice(0, 8)
      : [...table.querySelectorAll('thead th')].map(cell).slice(0, 8);
    return {
      caption: table.caption ? cell(table.caption) : null,
      headers,
      rows: rows.slice(0, 25).map((row) => {
        const link = row.querySelector('a[href]');
        return { cells: [...row.cells].slice(0, 8).map(cell), ...(link ? { link: link.href.slice(0, 300) } : {}) };
      }),
      totalRows: rows.length,
    };
  });
}"""

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
      // Preserve exact addresses, including SPA fragments; omit oversize values rather than inventing prefixes.
      ...(e.tagName === 'A' && /^https?:/.test(e.href)
        ? ((e.origin === location.origin ? e.pathname + e.search + e.hash : e.href).length <= 2000
          ? { href: e.origin === location.origin ? e.pathname + e.search + e.hash : e.href }
          : { hrefOmitted: 'too_long' }) : {}),
    };
  });
}"""

# A site's permission request (notifications, location, camera, microphone, clipboard) opens a
# browser prompt the page cannot show and the planner cannot see, and the page waits on it.
# Every frame records which permissions it asked for; an observation lists those the browser
# still holds at "prompt". OCADE never answers one: allowing is the person's choice in the
# OCADE browser window (req 142, 143).
_ASKED = """(() => {
  const asked = window.__ocadeAsked = new Set();
  const wrap = (owner, method, names) => {
    const original = owner && owner[method];
    if (typeof original !== 'function') return;
    owner[method] = function (...args) {
      const wanted = typeof names === 'function' ? names(...args) : names;
      wanted.forEach((n) => asked.add(n));
      return original.apply(this, args);
    };
  };
  wrap(window.Notification, 'requestPermission', ['notifications']);
  wrap(navigator.geolocation, 'getCurrentPosition', ['geolocation']);
  wrap(navigator.geolocation, 'watchPosition', ['geolocation']);
  wrap(navigator.mediaDevices, 'getUserMedia', (c = {}) => [c.video && 'camera', c.audio && 'microphone'].filter(Boolean));
  wrap(navigator.clipboard, 'readText', ['clipboard-read']);
  wrap(navigator.clipboard, 'read', ['clipboard-read']);
})()"""

_WAITING = """async () => {
  const waiting = [];
  for (const name of window.__ocadeAsked || []) {
    try {
      if ((await navigator.permissions.query({ name })).state === 'prompt') waiting.push(name);
    } catch { waiting.push(name); }
  }
  return waiting;
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


async def _site_of(page) -> str | None:
    """The host a page is bound to, or its bound opener's for a popup; None for the person's own tabs."""
    for candidate in (page, await page.opener()):
        for entry in _pages.values():
            if candidate is not None and entry["page"] is candidate:
                return entry["site"]
    return None


async def _guard(route) -> None:
    # Every request, including scripts and frames: no loopback or private literal addresses.
    request = route.request
    url = request.url
    if url.startswith(("data:", "blob:", "about:")):
        return await route.continue_()
    if not _allowed_url(url):
        return await route.abort("blockedbyclient")
    if not request.is_navigation_request():
        return await route.continue_()
    if request.method != "GET":
        # A confirmed form submission: Chromium does not expose upload bodies to interception,
        # so it is sent by the browser itself and its landing site is checked afterwards.
        return await route.continue_()
    try:
        frame = request.frame
    except Exception:
        frame = None  # a popup's first navigation, before its frame exists
    if frame is not None and frame.parent_frame is not None:
        return await route.continue_()  # an iframe loads like any other subresource
    page = frame.page if frame is not None else None
    if page is not None:
        site = await _site_of(page)
        if site is None:
            return await route.continue_()  # the person's own tab
    elif not _pages:
        return await route.continue_()
    else:
        # Fail closed: only a site JARVIS already has open, and no redirect it could not follow.
        site = _host(url) if _host(url) in {entry["site"] for entry in _pages.values()} else None
    # A bound page (or its popup) navigates only on its site. The browser follows redirect hops
    # without asking this handler, so a hop is stopped here and followed by `_follow` once checked.
    # Resolved again right before the request: a site whose name now points somewhere private is refused.
    if _host(url) != site or not await anyio.to_thread.run_sync(_public_by_dns, site):
        return await route.abort("blockedbyclient")
    try:
        response = await route.fetch(max_redirects=0)
    except Exception:
        return await route.abort("failed")
    location = response.headers.get("location")
    if 300 <= response.status < 400 and location:
        if page is None:
            return await route.abort("blockedbyclient")
        _redirects[page] = urljoin(url, location)
        return await route.fulfill(status=204)  # No Content: the page stays put, nothing is committed
    await route.fulfill(response=response)


async def _follow(current, site: str, before: str) -> None:
    """Follow a stopped redirect hop by hop, each one checked against the page's site."""
    for _hop in range(MAX_HOPS):
        if current not in _redirects:
            return
        location = _redirects.pop(current)
        if not urlparse(location).fragment and urlparse(before).fragment:
            location += "#" + urlparse(before).fragment
        if _host(location) != site or not _allowed_url(location):
            raise Refused("redirected_off_site")
        before = location
        try:
            await current.goto(location, wait_until="domcontentloaded", timeout=45_000)
        except Exception:
            if current not in _redirects:
                raise Refused("navigation_failed")
    raise Refused("too_many_redirects")


async def _context():
    if "context" not in _browser:
        executable = os.environ.get("OCADE_BROWSER_EXECUTABLE")
        if executable and not Path(executable).is_file():
            raise Refused("browser_unavailable")
        from playwright.async_api import async_playwright

        # A launch that fails leaves at most the companion's own browser profile behind: no page
        # was requested from any site, so nothing the person or a site sees can have changed.
        playwright = await async_playwright().start()
        _browser["playwright"] = playwright
        try:
            PROFILE.mkdir(parents=True, exist_ok=True)
            options = {"user_data_dir": str(PROFILE), "headless": False, "accept_downloads": True}
            if PRIVATE_ALLOWED:
                # A checked navigation is fulfilled without a remote address, so Chromium would hold
                # its loopback subresources for a local-network prompt; loopback is already allowed here.
                options["args"] = ["--disable-features=LocalNetworkAccessChecks"]
            proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
            if proxy:
                options["proxy"] = {"server": proxy, "bypass": os.environ.get("NO_PROXY", "")}
            if executable:
                context = await playwright.chromium.launch_persistent_context(executable_path=executable, **options)
            else:
                context = None
                # Edge ships with Windows; then an installed Chrome; then Playwright's own Chromium.
                for channel in ("msedge", "chrome", None):
                    try:
                        context = await playwright.chromium.launch_persistent_context(
                            **({"channel": channel} if channel else {}), **options)
                        break
                    except Exception:
                        if channel is None:
                            raise
            _browser["context"] = context
            await context.route("**/*", _guard)
            await context.add_init_script(_ASKED)
        except BaseException:
            await _close_browser()
            raise
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
        **({"url": current.url} if len(current.url) <= 2000 else {"urlOmitted": "too_long"}),
        "title": (await current.title())[:200],
        "controls": await current.evaluate(_CONTROLS, token),
        "tables": await current.evaluate(_TABLES),
        "text": text[:TEXT_LIMIT],
        # A sign-in or challenge is the person's to complete in the OCADE browser window.
        "needsSignIn": await current.locator("input[type=password]:visible").count() > 0,
    }
    waiting = await current.evaluate(_WAITING)
    if waiting:
        observed["permissionPrompts"] = waiting  # the person allows or blocks these in the window
    # The gateway refuses evidence over 16 KB: give up page text first, then the last controls.
    excess = len(json.dumps(observed)) - EVIDENCE_LIMIT
    if excess > 0:
        observed["text"] = observed["text"][: max(0, len(observed["text"]) - excess)]
    while len(json.dumps(observed)) > EVIDENCE_LIMIT and observed["controls"]:
        observed["controls"].pop()
    while len(json.dumps(observed)) > EVIDENCE_LIMIT and any(t["rows"] for t in observed["tables"]):
        max(observed["tables"], key=lambda t: len(t["rows"]))["rows"].pop()  # say how many there were
    return observed


async def _capture(current) -> bytes:
    """What the page shows, once it has painted: capturing a page before its first frame
    (a window that just opened) fails with "Unable to capture screenshot". One more try
    after raising the tab covers a window the display has not mapped yet; then it fails."""
    for attempt in (1, 2):
        try:
            painted = current.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            await asyncio.wait_for(painted, 5)  # a hidden page never paints
        except Exception:
            pass  # the capture below reports honestly either way
        try:
            return await current.screenshot(full_page=False)
        except Exception:
            if attempt == 2:
                raise
            await current.bring_to_front()
            await asyncio.sleep(0.5)


def _bind(new_page, site: str) -> str:
    page_id = secrets.token_hex(6)
    _pages[page_id] = {"page": new_page, "site": site}
    return page_id


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
    # Opening is a GET on the bound site; an observed open is still reported as possibly
    # changing something (gateway), while a refused one never reached another host.
    current = await context.new_page()
    page_id = _bind(current, site)  # bound before the first request, so its navigation is checked
    try:
        try:
            await current.goto(url, wait_until="domcontentloaded", timeout=45_000)
        except Exception:
            if current not in _redirects:
                raise Refused("navigation_failed")
        await _follow(current, site, url)
        if _host(current.url) != site:
            raise Refused("redirected_off_site")
    except BaseException:
        _pages.pop(page_id, None)
        _redirects.pop(current, None)
        await current.close()
        raise
    return await _observe(page_id)


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
        mark_effect()
        await field.focus()
        await field.page.keyboard.press("ControlOrMeta+A")
        await field.page.keyboard.type(value)
    else:
        mark_effect()
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
    mark_effect()
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
    current = entry["page"]
    choosers: list = []
    # A control that opens the computer's file picker: no dialog appears (it would wait for a
    # person); the planner is told to choose the file with web.upload instead.
    def chosen(chooser) -> None:
        choosers.append(chooser)

    current.on("filechooser", chosen)
    try:
        mark_effect()
        await target.click(timeout=10_000)
        try:
            await current.wait_for_load_state("domcontentloaded", timeout=30_000)
            # ponytail: fixed 0.5 s window for a popup to appear; a slower one is seen by the next read.
            await current.wait_for_timeout(500)
        except Exception:
            pass  # observed below either way
    finally:
        context.remove_listener("page", collect)
        current.remove_listener("filechooser", chosen)
    await _follow(current, entry["site"], current.url)
    popups = []
    for opened in opened_now:
        try:
            await opened.wait_for_load_state("domcontentloaded", timeout=15_000)
            await _follow(opened, entry["site"], opened.url)
        except Exception:
            pass
        _redirects.pop(opened, None)
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
    for chooser in choosers:  # close the picker unanswered, as a person pressing Cancel would
        try:
            await chooser.set_files([])
        except Exception:
            pass
    picker = {"filePicker": "opened: choose the file with web.upload on that input"} if choosers else {}
    return await _observe(page["id"]) | {"popups": popups, "preview": preview} | picker


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
    mark_effect()
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
        mark_effect()  # the request may take effect even if publication later refuses
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
    mark_effect()
    _redirects.pop(entry["page"], None)
    await entry["page"].close()
    return {"closed": True}


if __name__ == "__main__":
    app.run("stdio")
