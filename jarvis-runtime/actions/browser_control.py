
from __future__ import annotations

import asyncio
import json
import re
import os
import platform
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

from playwright.async_api import (
    async_playwright,
    BrowserContext,
    Page,
    Playwright,
    TimeoutError as PlaywrightTimeout,
)
_OS = platform.system()   # "Windows" | "Darwin" | "Linux"

def _normalize_url(url: str) -> str:
    """
    Bare words like "instagram" → "https://instagram.com"
    Domains like "instagram.com" → "https://instagram.com"
    Full URLs pass through unchanged.
    """
    url = url.strip()
    if not url:
        return "about:blank"
    if "://" in url:
        return url
    # No dot at all → assume .com  (e.g. "instagram" → "instagram.com")
    if "." not in url:
        url = url + ".com"
    return "https://" + url


def _find_exe_windows(prog_name: str) -> Optional[str]:
    try:
        import winreg
        paths_to_try = [
            rf"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{prog_name}.exe",
            rf"SOFTWARE\Clients\StartMenuInternet\{prog_name}\shell\open\command",
        ]
        for key_path in paths_to_try:
            for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
                try:
                    k   = winreg.OpenKey(hive, key_path)
                    val = winreg.QueryValue(k, None)
                    winreg.CloseKey(k)
                    exe = val.strip().strip('"').split('"')[0].split(" --")[0].strip()
                    if exe and Path(exe).exists():
                        return exe
                except Exception:
                    continue
    except Exception:
        pass
    return None


def _detect_default_browser() -> str:
    try:
        if _OS == "Windows":
            import winreg
            k = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\Shell\Associations"
                r"\UrlAssociations\http\UserChoice",
            )
            prog_id = winreg.QueryValueEx(k, "ProgId")[0].lower()
            winreg.CloseKey(k)
            for kw in ("edge", "firefox", "opera", "brave", "vivaldi", "chrome"):
                if kw in prog_id:
                    return kw
        elif _OS == "Darwin":
            out = subprocess.run(
                ["defaults", "read",
                 "com.apple.LaunchServices/com.apple.launchservices.secure",
                 "LSHandlers"],
                capture_output=True, text=True, timeout=5,
            ).stdout.lower()
            for kw in ("firefox", "opera", "brave", "vivaldi", "safari", "chrome", "edge"):
                if kw in out:
                    return kw
        elif _OS == "Linux":
            out = subprocess.run(
                ["xdg-settings", "get", "default-web-browser"],
                capture_output=True, text=True, timeout=5,
            ).stdout.lower()
            for kw in ("firefox", "opera", "brave", "vivaldi", "chrome", "edge"):
                if kw in out:
                    return kw
    except Exception:
        pass
    return "chrome"


# Windows registry lookup names for browsers whose spec has no explicit binary


# ── OCADE structured-control page scripts and safety gates ───────────────────
# Page content is untrusted: these scripts only READ the page and label
# elements; nothing a page says can change what an action is allowed to do.

# The page semantics live in one file, the same for JARVIS's own browser and the person's.
_OCADE_PAGE = (Path(__file__).resolve().parent / "ocade_page.js").read_text(encoding="utf-8")
_OCADE_INIT = _OCADE_PAGE


def _page_fn(args: str, body: str) -> str:
    """A function Playwright evaluates: load the page semantics (idempotent), then use them."""
    return f"({args}) => {{ {_OCADE_PAGE}\n {body} }}" if args != "()" else f"() => {{ {_OCADE_PAGE}\n {body} }}"


_OCADE_SNAPSHOT = _page_fn("()", "return window.__ocade.snapshot();")
_OCADE_GEOMETRY = _page_fn("()", "return window.__ocade.geometry();")
_OCADE_IDENTITY = _page_fn("el", "return window.__ocade.identityOf(el);")
_OCADE_FORM_SUBMIT = _page_fn("el", "return window.__ocade.submitOf(el);")
_OCADE_FOCUSED_SUBMIT = _page_fn("()", "return window.__ocade.submitOf(document.activeElement);")
_OCADE_FOCUSED = _page_fn("()", "const el = document.activeElement; "
                          "return el ? window.__ocade.identityOf(el.closest('a,button,input,select,textarea,[role]') || el) : {name: ''};")
_OCADE_AT_POINT = _page_fn("[x, y]", "return window.__ocade.atPoint(x, y);")

_KEYS = {"Enter", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
         "PageUp", "PageDown", "Home", "End", "Backspace", "Space"}

# The gates are in the shared contract, so the extension enforces the same words.
_GATES = json.loads((Path(__file__).resolve().parents[1] / "ocade_protocol.json").read_text())["gates"]
# Final purchase or payment: never, confirmed or not.
_PURCHASE = re.compile(_GATES["purchase"], re.I)
# Submissions with legal, financial, medical, security or public effect.
_SENSITIVE = re.compile(_GATES["sensitive"], re.I)


def _gate(kind: str, info: dict, confirmed: bool) -> dict | None:
    """A hard rule the model cannot argue with. `confirmed` is set by a person."""
    name = str(info.get("name", ""))
    if kind == "type":
        if info.get("card"):
            return {"status": "blocked", "summary": "JARVIS never enters payment card details"}
        if info.get("password"):
            return {"status": "human_required",
                    "summary": "A password is needed. Take over and type it yourself."}
        return None
    if kind in ("click", "submit"):
        if _PURCHASE.search(name):
            return {"status": "blocked", "summary": "JARVIS never completes a purchase or payment"}
        if _SENSITIVE.search(name) and not confirmed:
            return {"status": "needs_confirmation",
                    "summary": f"Confirm before JARVIS presses “{name[:60]}”"}
    return None


class _BrowserSession:
    """
    A full session for one browser instance.
    All browsers open on the real profile via launch_persistent_context.
    """

    def __init__(self, browser_name: str, mode: str = "isolated",
                 headless: bool = False, executable: str | None = None,
                 cdp_endpoint: str | None = None, egress=None):
        self.browser_name = browser_name
        # OCADE modes: "isolated" = a dedicated automation profile,
        # "real" = the user's own browser, attached only over an endpoint the
        # user started.
        self.mode         = mode
        self.headless     = headless
        self.executable   = executable
        self.cdp_endpoint = cdp_endpoint
        # OCADE network boundary (ocade_egress.EgressProxy): the isolated browser
        # sends everything through it; JARVIS's own tabs in the real browser are
        # checked per request and per response address.
        self.egress = egress
        self._private_hit: str | None = None
        self._observations: dict[str, dict] = {}
        self._observation_seq = 0
        self._boundary: str | None = None

        self._loop:    asyncio.AbstractEventLoop | None = None
        self._thread:  threading.Thread | None          = None
        self._ready    = threading.Event()

        self._pw:      Playwright     | None = None
        self._context: BrowserContext | None = None
        self._page:    Page           | None = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(
            target=self._run_loop,
            daemon=True,
            name=f"BrowserThread-{self.browser_name}",
        )
        self._thread.start()
        self._ready.wait(timeout=20)

    def _run_loop(self):
        loop = self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._async_init())
        self._ready.set()
        loop.run_forever()
        # Stopped by close(): what is still pending ends here, then the loop and its thread go.
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()

    async def _async_init(self):
        self._pw = await async_playwright().start()

    def run(self, coro, timeout: int = 60, cancel: threading.Event | None = None) -> str:
        if not self._loop:
            raise RuntimeError(f"Session for '{self.browser_name}' not started.")
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        if cancel is None:
            return future.result(timeout=timeout)
        deadline = time.monotonic() + timeout
        while not future.done():
            if cancel.wait(0.1):
                future.cancel()  # cancels the page operation inside the browser loop
                return {"status": "failed", "summary": "Stopped before it finished", "stopped": True}
            if time.monotonic() > deadline:
                future.cancel()
                raise TimeoutError("The browser did not answer in time")
        return future.result()

    def close(self):
        loop, self._loop = self._loop, None
        if not loop or loop.is_closed():
            return
        try:
            asyncio.run_coroutine_threadsafe(self._async_close(), loop).result(10)
        finally:
            loop.call_soon_threadsafe(loop.stop)
            if self._thread:
                self._thread.join(10)

    async def _async_close(self):
        if self._context and self.mode == "real":
            # Never close the person's own browser: only JARVIS's tab goes.
            if self._page and not self._page.is_closed():
                await self._page.close()
            self._context = None
        if self._context:
            try:
                await self._context.close()
            except Exception:
                pass
        if self._pw:
            try:
                await self._pw.stop()
            except Exception:
                pass
        self._context = self._page = None


    async def _launch(self):
        """
        Launches the browser with the real user profile.
        Does nothing if the context is already open.
        """
        if self._context is not None:
            return

        if self.mode not in ("isolated", "real"):
            raise RuntimeError(f"Unknown browser mode {self.mode!r}")
        await self._launch_ocade()


    async def _get_page(self) -> Page:
        await self._launch()
        # If somehow page got closed, open a fresh one
        if self._page is None or self._page.is_closed():
            self._page = await self._new_page()
            await asyncio.sleep(0.2)
        return self._page

    async def _new_page(self) -> Page:
        page = await self._context.new_page()
        if self.mode == "real":
            await self._guard(page)
        return page

    async def _guard(self, page: Page) -> None:
        """
        The network boundary for a tab JARVIS works in, in the person's own
        browser: one it opened, one of theirs it switched to, and any popup
        either opens. The person's other tabs are theirs and left alone.
        """
        policy = self.egress.policy if self.egress else None
        if policy is None or getattr(page, "_ocade_guarded", False):
            return
        page._ocade_guarded = True
        from ocade_egress import Blocked, is_public, scope_match
        from urllib.parse import urlsplit
        loop = asyncio.get_running_loop()

        async def check(route):
            url = urlsplit(route.request.url)
            if url.scheme in ("http", "https", "ws", "wss") and url.hostname:
                try:
                    await loop.run_in_executor(None, policy.resolve, url.hostname,
                                               url.port or (443 if url.scheme in ("https", "wss") else 80))
                except Blocked:  # a private address is recorded in policy.blocked
                    await route.abort("blockedbyclient")
                    return
            await route.continue_()

        async def seen(response):
            # The browser resolves names itself; if it still reached a private
            # address (DNS changed after the check), nothing from it is used.
            try:
                addr = await response.server_addr()
            except Exception:
                return
            host = urlsplit(response.url).hostname or ""
            if addr and not is_public(addr["ipAddress"]) and not scope_match(host, policy.allowed):
                self._private_hit = f"{host} reached a private network address"

        await page.route("**/*", check)
        page.on("response", lambda r: asyncio.ensure_future(seen(r)))
        page.on("popup", lambda popup: asyncio.ensure_future(self._guard(popup)))


    # ── OCADE structured control ────────────────────────────────────────────
    # Control priority: structured DOM/accessibility identity first, Playwright
    # locators second (fresh geometry at the moment of acting), the user's own
    # authorized browser third, a screenshot for visual understanding fourth,
    # and a coordinate click last — accepted only while the geometry it was
    # measured in is still the geometry on screen.

    async def _launch_ocade(self):
        if self.mode == "real":
            if not self.cdp_endpoint:
                raise RuntimeError("The real browser was not authorized on this device.")
            browser = await self._pw.chromium.connect_over_cdp(self.cdp_endpoint)
            self._context = browser.contexts[0] if browser.contexts else await browser.new_context()
            # JARVIS works in a tab of its own; the person's tabs are only read if
            # a task switches to them, and nothing is injected profile-wide.
            self._page = await self._new_page()
            return
        else:
            profile = Path(os.environ.get("OCADE_JARVIS_HOME", Path.home() / ".ocade_jarvis")) / "isolated-profile"
            profile.mkdir(parents=True, exist_ok=True)
            kwargs: dict = {"headless": self.headless, "viewport": {"width": 1280, "height": 800},
                            "timeout": 25_000}
            if self.egress is not None:
                # Everything, loopback included, goes through the egress proxy;
                # WebRTC may not open its own UDP paths around it.
                kwargs["args"] = [f"--proxy-server={self.egress.url}", "--proxy-bypass-list=<-loopback>",
                                  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]
            if self.executable:
                kwargs["executable_path"] = self.executable
            self._context = await self._pw.chromium.launch_persistent_context(str(profile), **kwargs)
        await self._context.add_init_script(_OCADE_INIT)
        self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()

    async def _geometry(self, page: Page) -> dict:
        try:
            geo = await page.evaluate(_OCADE_GEOMETRY)
        except Exception:
            geo = {}
        geo["url"] = page.url
        geo["tab"] = self._context.pages.index(page) if page in self._context.pages else -1
        return geo

    async def observe(self, with_frame: bool = False) -> dict:
        page = await self._get_page()
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=8_000)
        except Exception:
            pass
        try:
            await page.evaluate(_OCADE_INIT)  # idempotent; covers tabs JARVIS did not open
            snap = await page.evaluate(_OCADE_SNAPSHOT)
        except Exception as e:
            snap = {"elements": [], "text": "", "boundary": None, "error": str(e)[:200]}
        geo = await self._geometry(page)
        self._boundary = snap.get("boundary")
        self._observation_seq += 1
        obs_id = f"o{self._observation_seq}"
        self._observations = {obs_id: {"geometry": geo,
                                        "refs": {e["ref"]: (e["role"], e["name"]) for e in snap["elements"]}}}
        tabs = []
        for i, p in enumerate(self._context.pages):
            try:
                title = await p.title()
            except Exception:
                title = ""
            tabs.append({"index": i, "title": title[:80], "url": p.url[:300], "active": p is page})
        out = {"observationId": obs_id, "url": page.url, "title": (await page.title())[:120],
               "tabs": tabs, "viewport": {k: geo.get(k) for k in ("w", "h", "dpr", "zoom", "sx", "sy")},
               "elements": snap["elements"], "text": snap["text"], "humanBoundary": snap["boundary"]}
        if with_frame:
            out["frame"] = await self.frame()
        return out

    async def frame(self) -> str | None:
        page = await self._get_page()
        try:
            import base64
            shot = await page.screenshot(type="jpeg", quality=45, scale="css", timeout=8_000)
            return base64.b64encode(shot).decode()
        except Exception:
            return None

    async def _stale(self, page: Page, observation_id: str | None) -> str | None:
        """Why the geometry an action was planned against is no longer on screen."""
        held = self._observations.get(observation_id or "")
        if not held:
            return "That observation is no longer current."
        now = await self._geometry(page)
        was = held["geometry"]
        for key, label in (("url", "the page navigated"), ("tab", "the tab changed"),
                           ("w", "the viewport resized"), ("h", "the viewport resized"),
                           ("dpr", "the display scale changed"), ("zoom", "the zoom changed"),
                           ("sx", "the page scrolled"), ("sy", "the page scrolled"),
                           ("m", "the page content changed")):
            if now.get(key) != was.get(key):
                return f"Geometry is stale: {label}."
        return None

    async def _target(self, page: Page, ref: str, observation_id: str | None):
        """Resolve a ref to the SAME element it named when observed, or refuse."""
        held = self._observations.get(observation_id or "")
        if not held or ref not in held["refs"]:
            return None, "That element is not in the current observation."
        loc = page.locator(f'[data-ocade-ref="{ref}"]')
        if await loc.count() != 1:
            return None, "That element is gone from the page."
        role, name = held["refs"][ref]
        live = await loc.evaluate(_OCADE_IDENTITY)
        if live.get("role") != role or live.get("name") != name:
            return None, "That element changed since it was observed."
        return loc, None

    async def act(self, action: dict, confirmed: bool = False) -> dict:
        """Run one action, then verify it by observing the resulting state."""
        policy = self.egress.policy if self.egress else None
        self._private_hit = None
        if policy:
            policy.blocked = None
        outcome = await self._act(action, confirmed)
        self._private_hit = self._private_hit or (policy.blocked if policy else None)
        if self._private_hit:
            # Nothing observed on a private address leaves the device.
            try:
                await (await self._get_page()).goto("about:blank")
            except Exception:
                pass
            return {"status": "blocked", "summary": f"Stopped: {self._private_hit[:200]}"}
        return outcome

    async def _act(self, action: dict, confirmed: bool) -> dict:
        kind = str(action.get("action", ""))
        page = await self._get_page()
        if self.mode == "real":
            await self._guard(page)  # whichever of the person's tabs JARVIS is in now
        before = await self._geometry(page)
        detail = ""

        if kind == "observe":
            return {"status": "done", "summary": "Looked at the page", "observation": await self.observe()}
        if kind == "look":
            return {"status": "done", "summary": "Looked at the screen",
                    "observation": await self.observe(with_frame=True)}

        if kind in ("click", "type", "select", "press", "click_at") and \
                self._boundary in ("captcha", "otp", "passkey"):
            # Human verification is the person's to complete; JARVIS never does it.
            return {"status": "human_required",
                    "summary": "This page needs a person to verify. Take over to continue."}

        if kind in ("open", "new_tab"):
            url = _normalize_url(str(action.get("url", "")))
            if not url.startswith(("https://", "http://")):
                return {"status": "blocked", "summary": "Only web addresses can be opened"}
            if kind == "new_tab" or action.get("newTab"):
                page = await self._new_page()
                self._page = page
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            except PlaywrightTimeout:
                pass
            except Exception as e:
                return {"status": "failed", "summary": f"Could not open that page ({str(e).split(chr(10))[0][:120]})",
                        "observation": await self.observe()}
            detail = f"Opened {page.url[:120]}"
        elif kind == "switch_tab":
            pages = self._context.pages
            index = int(action.get("index", -1))
            if not 0 <= index < len(pages):
                return {"status": "failed", "summary": "That tab does not exist"}
            self._page = page = pages[index]
            if self.mode == "real":
                await self._guard(page)
            await page.bring_to_front()
            detail = f"Switched to tab {index + 1}"
        elif kind == "close_tab":
            if len(self._context.pages) <= 1:
                return {"status": "failed", "summary": "The last tab stays open"}
            await page.close()
            self._page = page = self._context.pages[-1]
            detail = "Closed the tab"
        elif kind in ("back", "forward"):
            await (page.go_back if kind == "back" else page.go_forward)(timeout=10_000)
            detail = f"Went {kind}"
        elif kind == "scroll":
            dy = 600 if action.get("direction", "down") == "down" else -600
            await page.mouse.wheel(0, dy)
            await asyncio.sleep(0.3)
            detail = f"Scrolled {action.get('direction', 'down')}"
        elif kind == "wait":
            await asyncio.sleep(min(5.0, max(0.2, float(action.get("seconds", 1)))))
            detail = "Waited"
        elif kind in ("click", "type", "select"):
            loc, why = await self._target(page, str(action.get("ref", "")), action.get("observationId"))
            if loc is None:
                return {"status": "stale", "summary": why, "observation": await self.observe()}
            info = await loc.evaluate(_OCADE_IDENTITY)
            gate = _gate(kind, info, confirmed)
            if gate:
                return gate
            if kind == "click":
                await loc.click(timeout=8_000)
                detail = f"Clicked “{info.get('name') or info.get('role')}”"
            elif kind == "type":
                text = str(action.get("text", ""))[:2000]
                await loc.fill(text, timeout=8_000)
                if action.get("submit"):
                    submit_gate = _gate("submit", await loc.evaluate(_OCADE_FORM_SUBMIT), confirmed)
                    if submit_gate:
                        return submit_gate
                    await loc.press("Enter")
                value = await loc.input_value() if info.get("editable") else text
                if value != text:
                    return {"status": "failed", "summary": "The field did not take the text",
                            "observation": await self.observe()}
                detail = f"Typed into “{info.get('name') or 'a field'}”"
            else:
                await loc.select_option(label=str(action.get("option", "")), timeout=8_000)
                detail = f"Chose “{action.get('option', '')}”"
        elif kind in ("upload", "download"):
            # `_file` and `_folder` are set by the device from the person's work
            # folder; the model only names the element and the workspace path.
            loc, why = await self._target(page, str(action.get("ref", "")), action.get("observationId"))
            if loc is None:
                return {"status": "stale", "summary": why, "observation": await self.observe()}
            if kind == "upload":
                await loc.set_input_files(str(action["_file"]), timeout=8_000)
                detail = f"Attached {Path(action['_file']).name}"
            else:
                info = await loc.evaluate(_OCADE_IDENTITY)
                gate = _gate("click", info, confirmed)
                if gate:
                    return gate
                async with page.expect_download(timeout=60_000) as waiting:
                    await loc.click(timeout=8_000)
                download = await waiting.value
                folder = Path(action["_folder"])
                folder.mkdir(parents=True, exist_ok=True)
                name = Path(download.suggested_filename).name or "download"
                target = folder / name
                stem, suffix, n = target.stem, target.suffix, 1
                while target.exists():  # never overwrite what is already there
                    n += 1
                    target = folder / f"{stem} ({n}){suffix}"
                await download.save_as(str(target))
                detail = f"Downloaded {target.name} to {folder.name}"
        elif kind == "press":
            key = str(action.get("key", "Enter"))
            if key not in _KEYS:
                return {"status": "blocked", "summary": "That key is not allowed"}
            # Enter and Space press whatever has the focus, and Enter submits its form.
            if key in ("Enter", "Space"):
                gate = _gate("click", await page.evaluate(_OCADE_FOCUSED), confirmed)
                if key == "Enter":
                    gate = gate or _gate("submit", await page.evaluate(_OCADE_FOCUSED_SUBMIT), confirmed)
                if gate:
                    return gate
            await page.keyboard.press(key)
            detail = f"Pressed {key}"
        elif kind == "click_at":
            why = await self._stale(page, action.get("observationId"))
            if why:
                return {"status": "stale", "summary": why, "observation": await self.observe()}
            x, y = float(action.get("x", -1)), float(action.get("y", -1))
            if not (0 <= x <= before.get("w", 0) and 0 <= y <= before.get("h", 0)):
                return {"status": "failed", "summary": "That point is outside the page"}
            info = await page.evaluate(_OCADE_AT_POINT, [x, y])
            gate = _gate("click", info, confirmed)
            if gate:
                return gate
            await page.mouse.click(x, y)
            detail = "Clicked a point on the page"
        else:
            return {"status": "failed", "summary": "Unknown browser action"}

        try:
            await page.wait_for_load_state("domcontentloaded", timeout=8_000)
        except Exception:
            pass
        after_page = await self._get_page()
        observation = await self.observe()
        after = await self._geometry(after_page)
        changed = [k for k in ("url", "tab", "m", "sy") if after.get(k) != before.get(k)]
        return {"status": "done", "summary": detail[:280], "changed": changed, "observation": observation}


# ── Tool declaration (auto-discovered by core/action_loader.py) ──────────────
