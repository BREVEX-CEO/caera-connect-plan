"""`web_automation`: authorized websites through Playwright (plan.md §25.5, P11).

One OCADE browser profile in the companion's own folder — never the person's
Chrome profile, cookies or passwords. Microsoft Edge is used where installed,
else Playwright's Chromium. The window is visible, so a person signs in, passes
a CAPTCHA or confirms MFA themselves; JARVIS never does.

Every page JARVIS opens gets an id and is bound to the site it was opened for:
an action on a page whose current host is no longer that site is refused, so a
redirect or a link cannot carry JARVIS to a website the person did not allow.
Clicks may submit forms, so `web.click` is an external effect that waits for
the person's confirmation on the server before it ever reaches here.

STATUS: CODED, UNTESTED.
"""

from __future__ import annotations

import functools
import os
import secrets
from pathlib import Path
from urllib.parse import urlparse

from mcp.server.mcpserver import MCPServer

from .sandbox import Refused, output_path, write_atomically

app = MCPServer("ocade-web")
WORKSPACE = os.environ.get("OCADE_WORKSPACE", "")
PROFILE = Path(os.environ.get("OCADE_AGENT_HOME") or Path.home() / ".ocade-agent") / "browser-profile"
TEXT_LIMIT = 8_000
_browser: dict = {}
_pages: dict = {}

# Inputs, buttons and links the planner may name, each with a selector Playwright can find again.
_CONTROLS = """() => [...document.querySelectorAll('a[href],button,input,select,textarea,[role=button]')]
  .filter(e => e.offsetParent !== null).slice(0, 60).map(e => ({
    tag: e.tagName.toLowerCase(), type: e.type || '', name: e.name || '',
    label: (e.labels?.[0]?.innerText || e.getAttribute('aria-label') || e.innerText || e.value || '').trim().slice(0, 80),
    selector: e.id ? '#' + CSS.escape(e.id) : e.name ? `${e.tagName.toLowerCase()}[name="${e.name}"]`
      : `text=${(e.innerText || '').trim().slice(0, 60)}`,
  }))"""


async def _context():
    if "context" not in _browser:
        from playwright.async_api import async_playwright

        playwright = await async_playwright().start()
        PROFILE.mkdir(parents=True, exist_ok=True)
        options = {"user_data_dir": str(PROFILE), "headless": False, "accept_downloads": True}
        try:
            context = await playwright.chromium.launch_persistent_context(channel="msedge", **options)
        except Exception:
            context = await playwright.chromium.launch_persistent_context(**options)
        _browser.update(playwright=playwright, context=context)
    return _browser["context"]


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def _page(page: dict):
    """The page with this id, still on the site it was opened for."""
    current = _pages.get(page["id"])
    if current is None or current.is_closed():
        raise Refused("page_gone")
    if _host(current.url) != page["site"]:
        raise Refused("page_left_site")
    return current


async def _observe(current, page_id: str, site: str) -> dict:
    text = await current.inner_text("body", timeout=10_000)
    return {
        "page": {"id": page_id, "site": site},
        "url": current.url[:500],
        "title": (await current.title())[:200],
        "text": text[:TEXT_LIMIT],
        "controls": await current.evaluate(_CONTROLS),
    }


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
    """Open an https page on an allowed site in the OCADE browser."""
    site = _host(url)
    current = await (await _context()).new_page()
    await current.goto(url, wait_until="domcontentloaded", timeout=45_000)
    if _host(current.url) != site:
        await current.close()
        raise Refused("redirected_off_site")
    page_id = secrets.token_hex(6)
    _pages[page_id] = current
    return await _observe(current, page_id, site)


@app.tool()
@_refusals
async def web_read(page: dict) -> dict:
    """Read the page as it is now: title, visible text and controls."""
    return await _observe(_page(page), page["id"], page["site"])


@app.tool()
@_refusals
async def web_fill(page: dict, selector: str, value: str) -> dict:
    """Type a value into one field, then read the field back."""
    current = _page(page)
    field = current.locator(selector)
    if await field.count() != 1:
        raise Refused("selector_not_unique")
    if (await field.get_attribute("type") or "").lower() == "password":
        raise Refused("password_field")  # credentials are the person's to type
    await field.fill(value, timeout=10_000)
    return {"matches": await field.input_value() == value}


@app.tool()
@_refusals
async def web_click(page: dict, selector: str) -> dict:
    """Click one control (confirmed by the person), then observe where the page is."""
    current = _page(page)
    target = current.locator(selector)
    if await target.count() != 1:
        raise Refused("selector_not_unique")
    await target.click(timeout=10_000)
    await current.wait_for_load_state("domcontentloaded", timeout=30_000)
    if _host(current.url) != page["site"]:
        return {"left_site": True, "url": current.url[:500]}
    return await _observe(current, page["id"], page["site"])


@app.tool()
@_refusals
async def web_download(page: dict, selector: str, output: str) -> dict:
    """Click a download link and save the file under OCADE output."""
    current = _page(page)
    target = output_path(WORKSPACE, output)
    link = current.locator(selector)
    if await link.count() != 1:
        raise Refused("selector_not_unique")
    async with current.expect_download(timeout=60_000) as pending:
        await link.click()
    download = await pending.value
    staged = Path(await download.path())

    def produce(temporary: Path) -> None:
        temporary.write_bytes(staged.read_bytes())

    digest = write_atomically(target, produce)
    return {"sha256": digest, "bytes": target.stat().st_size, "suggested": download.suggested_filename[:200]}


if __name__ == "__main__":
    app.run("stdio")
