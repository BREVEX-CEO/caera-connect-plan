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
import shutil
import socket
from contextlib import asynccontextmanager
from email.parser import BytesHeaderParser
from mimetypes import guess_type
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
MAX_BUFFERED_UPLOAD = 16 * 1024 * 1024


async def _close_browser() -> None:
    """One cleanup owner for server shutdown and partially failed startup."""
    context = _browser.pop("context", None)
    playwright = _browser.pop("playwright", None)
    closed = _browser.pop("closed", False)
    _pages.clear()
    _redirects.clear()
    # The MCP transport bounds process shutdown and contains the whole tree.
    # EOF/cancellation must still give Chromium and its driver a chance to close.
    with anyio.CancelScope(shield=True):
        try:
            if context is not None and not closed:
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
_OPEN_ROOTS = """const roots = [document];
  let examined = 0;
  for (let i = 0; i < roots.length && roots.length < 64 && examined < 20000; i++) {
    const walk = document.createTreeWalker(roots[i], NodeFilter.SHOW_ELEMENT);
    while (roots.length < 64 && examined++ < 20000 && walk.nextNode()) {
      if (walk.currentNode.shadowRoot) roots.push(walk.currentNode.shadowRoot);
    }
  }
  const all = selector => roots.flatMap(root => [...root.querySelectorAll(selector)]);"""

_TABLES = """() => {
  /*OPEN_ROOTS*/
  const visible = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const cell = (c) => (c.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
  return all('table').filter(visible).slice(0, 3).map((table) => {
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
}""".replace("/*OPEN_ROOTS*/", _OPEN_ROOTS)

_CONTROLS = """(token) => {
  /*OPEN_ROOTS*/
  all('[data-ocade]').forEach(e => e.removeAttribute('data-ocade'));
  const flat = s => (s || '').replace(/\\s+/g, ' ').trim();
  const listed = all('a[href],button,input,select,textarea,[contenteditable]:not([contenteditable=false]),[role=button],[role=menuitem],[role=tab],[role=textbox],[role=spinbutton],[role=slider],iframe')
    .filter(e => e.offsetParent !== null || e.type === 'file').slice(0, 80);
  const labels = listed.map(e => {
    const buttonText = e.type === 'submit' || e.type === 'button' ? e.value : '';
    return flat(e.labels?.[0]?.innerText || e.getAttribute('aria-label') || e.title || e.innerText || buttonText).slice(0, 80);
  });
  const seen = {};
  labels.forEach(l => { seen[l] = (seen[l] || 0) + 1; });
  const facts = listed.map((e, i) => {
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
  return { facts, nodes: listed };
}""".replace("/*OPEN_ROOTS*/", _OPEN_ROOTS)

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


def _origin(url: str) -> tuple[str, str, int] | None:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or parsed.username is not None or parsed.password is not None:
            return None
        host = (parsed.hostname or "").encode("idna").decode("ascii").lower()
        port = parsed.port if parsed.port is not None else (443 if parsed.scheme == "https" else 80)
        return (parsed.scheme, host, port) if host and port else None
    except ValueError:
        return None


def _host(url: str) -> str:
    origin = _origin(url)
    return origin[1] if origin else ""


def _private_address(text: str) -> bool:
    try:
        address = ipaddress.ip_address(text)
    except ValueError:
        return False
    address = getattr(address, "ipv4_mapped", None) or address
    return not address.is_global or address.is_multicast or address.is_reserved


def _allowed_url(url: str) -> bool:
    origin = _origin(url)
    if origin is None:
        return False
    if PRIVATE_ALLOWED:
        return True
    scheme, host, port = origin
    name = host.rstrip(".")
    return (scheme == "https" and port == 443 and name != "localhost"
            and not name.endswith(".localhost") and not _private_address(host))


def _public_by_dns(host: str) -> bool:
    if PRIVATE_ALLOWED:
        return True
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, 443)}
    except OSError:
        return False
    return bool(addresses) and not any(_private_address(a.split("%")[0]) for a in addresses)


async def _page_origin(page) -> tuple[str, str, int] | None:
    """Find the exact origin bound to the page or its popup opener."""
    for entry in _pages.values():
        if entry["page"] is page:
            return entry["origin"]
    try:
        opener = await page.opener()
    except Exception:
        return None
    return next((entry["origin"] for entry in _pages.values() if entry["page"] is opener), None)


@asynccontextmanager
async def _browser_interaction(entry: dict, *, starting: bool = False):
    if "interactionOrigin" in _browser:
        raise Refused("browser_busy")
    origin = entry["origin"]
    current_origin = _origin(entry["page"].url)
    if current_origin != origin and not (starting and entry["page"].url == "about:blank"):
        raise Refused("page_left_site")
    _browser["interactionOrigin"] = origin
    _browser["interactionPage"] = entry["page"]
    try:
        yield
    finally:
        _browser.pop("interactionOrigin", None)
        _browser.pop("interactionPage", None)


def _multipart_body(body: bytes | None, content_type: str, length: str, attachment: dict | None) -> bytes | None:
    if body is None or len(body) > MAX_BUFFERED_UPLOAD * 2:
        return None
    if attachment is None:
        return body if length.isdecimal() and str(len(body)) == length else None
    message = BytesHeaderParser().parsebytes(b"Content-Type: " + content_type.encode("ascii", "ignore"))
    boundary = message.get_boundary()
    if not boundary or not re.fullmatch(r"[A-Za-z0-9'()+_,./:=?-]{1,70}", boundary):
        return None
    marker = b"--" + boundary.encode("ascii")
    parts = body.split(marker)
    if len(parts) < 3 or parts[0] or parts[-1] not in (b"--", b"--\r\n"):
        return None
    file_part = None
    for index, part in enumerate(parts[1:-1], 1):
        header, separator, value = part.partition(b"\r\n\r\n")
        if not separator or not header.startswith(b"\r\n") or len(header) > 8192 or not value.endswith(b"\r\n"):
            return None
        fields = BytesHeaderParser().parsebytes(header[2:])
        if fields.get_content_disposition() != "form-data":
            return None
        name = fields.get_filename()
        if name is None:
            continue
        if (file_part is not None or name != attachment["name"]
                or fields.get_param("name", header="content-disposition") != attachment["field"]):
            return None
        file_part = index
        expected = attachment["bytes"]
        if value == b"\r\n":
            # Chromium can expose the serialized headers but omit the file entry itself.
            parts[index] = header + separator + expected + b"\r\n"
        elif value[:-2] != expected:
            return None
    if file_part is None:
        return None
    if marker in attachment["bytes"]:
        return None
    restored = marker.join(parts)
    return restored if not length or length == str(len(restored)) else None


async def _guard(route) -> None:
    request = route.request
    url = request.url
    if url.startswith(("data:", "blob:", "about:")):
        return await route.continue_()
    if not _allowed_url(url) or not await anyio.to_thread.run_sync(_public_by_dns, _host(url)):
        return await route.abort("blockedbyclient")
    try:
        frame = request.frame
    except Exception:
        frame = None  # a popup's first navigation, before its frame exists
    top_navigation = request.is_navigation_request() and (frame is None or frame.parent_frame is None)
    writes = request.method not in ("GET", "HEAD", "OPTIONS")
    if not top_navigation and not writes:
        return await route.continue_()
    page = frame.page if frame is not None else None
    origin = await _page_origin(page) if page is not None else None
    if origin is None:
        origin = _browser.get("interactionOrigin")
        if origin is None and (page is not None or not _pages):
            return await route.continue_()  # an unbound tab outside a controlled interaction
    if origin is None or _origin(url) != origin:
        return await route.abort("blockedbyclient")
    options = {"max_redirects": 0}
    if writes:
        headers = await request.all_headers()
        content_type = headers.get("content-type", "")
        if content_type.lower().startswith("multipart/"):
            entry = next((entry for entry in _pages.values() if entry["page"] is page), None)
            attachment = entry.get("attachment") if entry is not None else None
            if attachment is not None and (
                request.method != "POST" or attachment["url"] != url
                or page is not _browser.get("interactionPage")
            ):
                return await route.abort("blockedbyclient")
            body = _multipart_body(
                request.post_data_buffer, content_type, headers.get("content-length", ""), attachment,
            )
            if body is None:
                return await route.abort("blockedbyclient")
            options["post_data"] = body
            if attachment is not None:
                entry.pop("attachment", None)
    try:
        response = await route.fetch(**options)
    except Exception:
        return await route.abort("failed")
    location = response.headers.get("location")
    if 300 <= response.status < 400 and location:
        can_follow_as_get = not writes or response.status == 303 or (
            request.method == "POST" and response.status in (301, 302)
        )
        if not top_navigation or page is None or not can_follow_as_get:
            return await route.abort("blockedbyclient")
        _redirects[page] = urljoin(url, location)
        return await route.fulfill(status=204)  # the next hop is checked by _follow
    await route.fulfill(response=response)


async def _follow(current, origin: tuple[str, str, int], before: str) -> None:
    """Follow a stopped redirect hop by hop, each one checked against the page's site."""
    for _hop in range(MAX_HOPS):
        if current not in _redirects:
            return
        location = _redirects.pop(current)
        if not urlparse(location).fragment and urlparse(before).fragment:
            location += "#" + urlparse(before).fragment
        if _origin(location) != origin or not _allowed_url(location):
            raise Refused("redirected_off_site")
        before = location
        try:
            await current.goto(location, wait_until="domcontentloaded", timeout=45_000)
        except Exception:
            if current not in _redirects:
                raise Refused("navigation_failed")
    raise Refused("too_many_redirects")


async def _context():
    if _browser.get("closed"):
        await _close_browser()
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
            options = {"user_data_dir": str(PROFILE), "headless": False,
                       "accept_downloads": True, "service_workers": "block"}
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

            def closed() -> None:
                if _browser.get("context") is context:
                    _browser["closed"] = True
                    _pages.clear()
                    _redirects.clear()

            context.on("close", closed)
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
    if _origin(entry["page"].url) != entry["origin"]:
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
    if _origin(content.url) != entry["origin"]:
        raise Refused("frame_off_site")
    return content


async def _one(entry: dict, scope, selector: str):
    """Resolve a live element under this tab's observation lease."""
    observed = re.fullmatch(r'\[data-ocade="([0-9a-f]+)-\d+"\]', selector)
    if observed and (observed.group(1) != entry.get("token") or scope is not entry["page"]):
        raise Refused("stale_selector")
    if observed:
        handle = entry.get("controls", {}).get(selector)
        try:
            connected = handle is not None and await handle.evaluate("(element) => element.isConnected")
        except Exception:
            connected = False
        if not connected:
            raise Refused("stale_selector")
        # Return the element captured during inspection. A replacement with copied
        # attributes can never redirect this action.
        return handle
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
    if _origin(current.url) != entry["origin"]:
        raise Refused("page_left_site")
    text = await current.inner_text("body", timeout=10_000)
    token = secrets.token_hex(8)
    snapshot = await current.evaluate_handle(_CONTROLS, token)
    facts = await snapshot.get_property("facts")
    nodes = await snapshot.get_property("nodes")
    try:
        controls = await facts.json_value()
        handles = await nodes.get_properties()
    finally:
        await facts.dispose()
        await nodes.dispose()
        await snapshot.dispose()
    for handle in entry.get("controls", {}).values():
        await handle.dispose()
    entry["token"] = token
    entry["controls"] = {
        control["selector"]: handles[str(index)].as_element()
        for index, control in enumerate(controls)
        if str(index) in handles and handles[str(index)].as_element() is not None
    }
    observed = {
        "page": {"id": page_id, "site": entry["site"]},
        **({"url": current.url} if len(current.url) <= 2000 else {"urlOmitted": "too_long"}),
        "title": (await current.title())[:200],
        "controls": [control for control in controls if control["selector"] in entry["controls"]],
        "tables": await current.evaluate(_TABLES),
        "text": text[:TEXT_LIMIT],
        # A sign-in or challenge is the person's to complete in the OCADE browser window.
        "needsSignIn": await current.locator("input[type=password]:visible").count() > 0,
    }
    waiting = await current.evaluate(_WAITING)
    if waiting:
        observed["permissionPrompts"] = waiting  # the person allows or blocks these in the window
    popups = await _collect_popups(entry)
    if popups:
        observed["popups"] = popups
    # The other tabs OCADE has open (popups included): switching is acting with that page id.
    others = [(other_id, e) for other_id, e in _pages.items()
              if other_id != page_id and not e["page"].is_closed() and _origin(e["page"].url) == e["origin"]]
    if others:
        observed["otherTabs"] = [{"page": {"id": other_id, "site": e["site"]}, "title": (await e["page"].title())[:80]}
                                 for other_id, e in others[-10:]]
    # The gateway refuses evidence over 16 KB: give up page text first, then the last controls.
    excess = len(json.dumps(observed)) - EVIDENCE_LIMIT
    if excess > 0:
        observed["text"] = observed["text"][: max(0, len(observed["text"]) - excess)]
    while len(json.dumps(observed)) > EVIDENCE_LIMIT and observed["controls"]:
        observed["controls"].pop()
    while len(json.dumps(observed)) > EVIDENCE_LIMIT and any(t["rows"] for t in observed["tables"]):
        max(observed["tables"], key=lambda t: len(t["rows"]))["rows"].pop()  # say how many there were
    if _origin(current.url) != entry["origin"]:
        raise Refused("page_left_site")
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


def _bind(new_page, site: str, origin: tuple[str, str, int] | None = None) -> str:
    page_id = secrets.token_hex(6)
    entry = {"page": new_page, "site": site, "origin": origin or ("https", site, 443),
             "pendingPopups": [], "popupArrived": asyncio.Event()}
    _pages[page_id] = entry

    def opened(popup) -> None:
        entry["pendingPopups"].append(popup)
        entry["popupArrived"].set()

    new_page.on("popup", opened)
    return page_id


async def _collect_popups(entry: dict) -> list[str]:
    pending, entry["pendingPopups"] = entry["pendingPopups"], []
    entry["popupArrived"].clear()
    results = []
    for popup in pending:
        try:
            await popup.wait_for_load_state("domcontentloaded", timeout=5000)
            await _follow(popup, entry["origin"], popup.url)
        except Exception:
            pass
        _redirects.pop(popup, None)
        if not popup.is_closed() and _origin(popup.url) == entry["origin"]:
            results.append(_bind(popup, entry["site"], entry["origin"]))
        else:
            if not popup.is_closed():
                await popup.close()
            results.append("closed_off_site")
    return results[-10:]


@app.tool()
@_refusals
async def web_open(url: str) -> dict:
    """Open a page on an allowed site in the OCADE browser; the page is bound to that site."""
    origin = _origin(url)
    if origin is None or not _allowed_url(url) or not _public_by_dns(origin[1]):
        raise Refused("site_not_public")
    site = origin[1]
    for attempt in range(2):
        try:
            context = await _context()
            current = await context.new_page()
            break
        except Exception:
            if attempt or not _browser.get("closed"):
                raise Refused("browser_unavailable") from None
    # Bind before any site request, including the first navigation.
    page_id = _bind(current, site, origin)
    try:
        async with _browser_interaction(_pages[page_id], starting=True):
            try:
                await current.goto(url, wait_until="domcontentloaded", timeout=45_000)
            except Exception:
                if current not in _redirects:
                    raise Refused("navigation_failed")
            await _follow(current, origin, url)
            if _origin(current.url) != origin:
                raise Refused("redirected_off_site")
    except BaseException:
        _pages.pop(page_id, None)
        _redirects.pop(current, None)
        if not current.is_closed():
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
    entry = _bound(page)
    field = await _one(entry, await _scope(entry, frame), selector)
    if (await field.get_attribute("type") or "").lower() == "password":
        raise Refused("password_field")  # credentials are the person's to type
    async with _browser_interaction(entry):
        if await field.evaluate("e => e.isContentEditable"):
            # The widget listens for keystrokes. Keep both operations bound to this exact field.
            if any(ord(ch) < 32 for ch in value):
                raise Refused("control_characters")
            mark_effect()
            await field.press("ControlOrMeta+A")
            await field.type(value)
        else:
            mark_effect()
            await field.fill(value, timeout=10_000)
        await field.evaluate("e => e.blur()")
        shown = await field.evaluate("e => 'value' in e ? e.value : e.innerText")
    return {"matches": shown.strip() == value.strip()}


@app.tool()
@_refusals
async def web_select(page: dict, selector: str, option: str, frame: str | None = None) -> dict:
    """Choose one option (by its visible label) in a dropdown, then read the choice back."""
    entry = _bound(page)
    field = await _one(entry, await _scope(entry, frame), selector)
    async with _browser_interaction(entry):
        mark_effect()
        await field.select_option(label=option, timeout=10_000)
        chosen = await field.evaluate("e => e.options[e.selectedIndex]?.text ?? ''")
    return {"matches": chosen == option}


@app.tool()
@_refusals
async def web_click(page: dict, selector: str, frame: str | None = None) -> dict:
    """Click one control (confirmed by the person); bind a same-site popup, close any other."""
    entry = _bound(page)
    target = await _one(entry, await _scope(entry, frame), selector)
    current = entry["page"]
    expects_popup = await target.evaluate("(element) => element.target === '_blank'")
    choosers: list = []
    chooser_arrived = asyncio.Event()

    def chosen(chooser) -> None:
        choosers.append(chooser)
        chooser_arrived.set()

    current.on("filechooser", chosen)
    try:
        async with _browser_interaction(entry):
            mark_effect()
            await target.click(timeout=10_000)
            if not choosers:
                with anyio.move_on_after(0.25):
                    await chooser_arrived.wait()
            if expects_popup and not entry["pendingPopups"]:
                with anyio.move_on_after(5):
                    await entry["popupArrived"].wait()
    finally:
        current.remove_listener("filechooser", chosen)
        for chooser in choosers:
            try:
                await chooser.set_files([])
            except Exception:
                pass
    await _follow(current, entry["origin"], current.url)
    if _origin(current.url) != entry["origin"]:
        return {"leftSite": True, "url": current.url[:500], "popups": await _collect_popups(entry)}
    # What the page now looks like travels as a preview, so a canvas app's change is seen.
    from io import BytesIO

    from PIL import Image

    with Image.open(BytesIO(await _capture(current))) as shot:
        preview = preview_jpeg(shot, 30_000)  # leaves room for the page beside it in one receipt
    picker = {"filePicker": "opened: choose the file with web.upload on that input"} if choosers else {}
    observed = await _observe(page["id"])
    return {"popups": []} | observed | {"preview": preview} | picker


@app.tool()
@_refusals
async def web_upload(page: dict, selector: str, path: str) -> dict:
    """Attach one workspace file to a file input (confirmed by the person: it leaves the computer)."""
    source = resolve(WORKSPACE, path)
    if not source.is_file():
        raise Refused("not_a_file")
    entry = _bound(page)
    field = await _one(entry, entry["page"], selector)
    if (await field.get_attribute("type") or "").lower() != "file":
        raise Refused("not_a_file_input")
    # Web apps often read the file on `change` and then clear the input, so the names are
    # taken by a listener that runs first, not read back afterwards.
    await field.evaluate(
        "e => e.addEventListener('change', () => { e.dataset.ocadeAttached = JSON.stringify([...e.files].map(f => f.name)) }, {once: true, capture: true})"
    )
    form = await field.evaluate("""e => e.form && e.name && e.form.method === 'post'
        && e.form.enctype === 'multipart/form-data' ? {url: e.form.action, field: e.name} : null""")
    async with _browser_interaction(entry):
        entry.pop("attachment", None)
        upload = str(source)
        if form and _origin(form["url"]) == entry["origin"]:
            with source.open("rb") as stream:
                data = stream.read(MAX_BUFFERED_UPLOAD + 1)
            if len(data) <= MAX_BUFFERED_UPLOAD:
                entry["attachment"] = {**form, "name": source.name, "bytes": data}
                upload = {"name": source.name, "mimeType": guess_type(source.name)[0] or "application/octet-stream",
                          "buffer": data}
        mark_effect()
        try:
            await field.set_input_files(upload)
            names = json.loads(await field.evaluate("e => e.dataset.ocadeAttached || '[]'"))
            if names != [source.name]:
                entry.pop("attachment", None)
        except Exception:
            entry.pop("attachment", None)
            raise
    return {"attached": names, "matches": names == [source.name]}


@app.tool()
@_refusals
async def web_download(page: dict, selector: str, output: str) -> dict:
    """Click a download link and save the file under OCADE output."""
    entry = _bound(page)
    current = entry["page"]
    target = output_path(WORKSPACE, output)
    link = await _one(entry, current, selector)
    async with _browser_interaction(entry):
        async with current.expect_download(timeout=60_000) as pending:
            mark_effect()  # the request may take effect even if publication later refuses
            await link.click()
        download = await pending.value
    if not download.url.startswith("data:") and _origin(download.url.removeprefix("blob:")) != entry["origin"]:
        await download.cancel()
        raise Refused("download_off_origin")
    staged = Path(await download.path())
    digest = write_atomically(target, lambda temporary: shutil.copyfile(staged, temporary))
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
    _bound(page)  # a concurrent navigation must not publish a capture of another origin
    return {"sha256": write_atomically(target, lambda temporary: temporary.write_bytes(image)), "bytes": len(image)}


@app.tool()
@_refusals
async def web_close(page: dict) -> dict:
    """Close a page JARVIS opened, wherever it ended up."""
    entry = _pages.get(page["id"])
    if entry is None or entry["page"].is_closed():
        raise Refused("page_gone")
    if page["site"] != entry["site"]:
        raise Refused("site_mismatch")
    _pages.pop(page["id"])
    mark_effect()
    _redirects.pop(entry["page"], None)
    await entry["page"].close()
    return {"closed": True}


if __name__ == "__main__":
    app.run("stdio")
