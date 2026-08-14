"""OCADE on your phone: a pairing QR on the desktop, a web app in your hand.

WHAT THIS IS
------------
A small HTTP server, started only when the user asks for it, bound to this
machine's address on the local network. It serves one mobile-shaped page and one
JSON endpoint, and it forwards approved commands into the same bridge every
other caller uses. The phone is a second keyboard, not a second engine.

THE FOUR THINGS THAT KEEP AN OPEN PORT FROM BEING A MISTAKE
------------------------------------------------------------
1. **It is off until asked.** Nothing starts this at boot. `start()` is a
   deliberate act with a visible consequence — a QR code appears.

2. **A token, compared in constant time.** Thirty-two bytes from
   `secrets.token_urlsafe`, required on every request including the page itself.
   Without it the server answers 401 and nothing else. `secrets.compare_digest`
   rather than `==`, because a string comparison that returns early leaks the
   token one character at a time to anybody patient.

3. **A closed command list, and it is NOT the bridge's.** The phone can see the
   machine, speak, search, set reminders and run the everyday controls. It
   cannot shut the computer down, send a message as the user, or delete a file.
   Those need somebody at the keyboard, because the person holding the phone
   might not be the person who owns the desk — and a QR code photographed over
   somebody's shoulder is a real thing that happens.

4. **It expires.** The token dies with the server, and the server stops itself
   after `IDLE_SECONDS` with nobody using it. A pairing left running overnight
   is a pairing somebody forgot about.

WHY THE PAGE IS INLINE AND HAS NO DEPENDENCIES
-----------------------------------------------
It is served to a phone that may be on a network with no route to the internet
— which is the normal case for a home wifi with the router's DNS down, and the
exact moment somebody reaches for a local assistant. A page that loads a font, a
framework or an icon set from a CDN is a blank screen then. Everything below is
one file: markup, styles and script, sent in a single response.
"""

from __future__ import annotations

import json
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable

#: The server stops itself after this long with no request. A phone left on the
#: page keeps it alive by polling; a phone put in a pocket does not.
IDLE_SECONDS = 30 * 60

#: Ports are tried in order. A fixed port collides with whatever else the user
#: runs; a random one changes on every restart and invalidates the QR they just
#: photographed. A short, stable, rarely-used range is the compromise.
_PORTS = (8787, 8788, 8789, 8790, 8791)

#: What a paired phone may ask for. Every name here is a bridge command, and the
#: list is the security boundary — see the header. Adding a command to this set
#: is a decision about what a stranger with a photographed QR may do.
REMOTE_COMMANDS = frozenset(
    {
        # Look
        "engine.info",
        "system.status",
        "window.list",
        # What is actually in front, as structure. Read-only, and the natural
        # companion to window.list on a phone screen.
        "window.read",
        "screen.observe",
        "memory.snapshot",
        "memory.recall",
        "reminder.list",
        "monitor.watch",
        "weather",
        "web.search",
        "search.mode",
        "presence.briefing",
        "presence.proactive",
        "monitor.check",
        "clipboard",
        "game.list",
        # Act, reversibly
        "voice.speak",
        "voice.silence",
        "app.open",
        "app.focus",
        "folder.open",
        "system.volume",
        "system.brightness",
        "system.media",
        "window.arrange",
        "memory.remember",
        "memory.project",
        "reminder.set",
        "reminder.cancel",
        # NO BROWSER AND NO YOUTUBE, AND THAT IS NOT AN OVERSIGHT. Both live in
        # the Node host, which the phone never reaches — it talks to this Python
        # engine directly, on purpose, so that a phone command works whether or
        # not the desktop app is open. Listing a command the engine cannot serve
        # would produce "unknown command" on a button somebody just pressed.
    }
)


class RemoteRefused(RuntimeError):
    """The remote dashboard will not do that, with a reason."""


def lan_address() -> str:
    """This machine's address on the local network, as a phone would reach it.

    Found by opening a UDP socket towards a public address and asking the OS
    which interface it CHOSE. Nothing is sent — UDP connect only sets the
    default route — so this works with no network traffic and, unlike
    `gethostbyname(gethostname())`, returns the real LAN address rather than
    127.0.0.1 on the many machines whose hostname resolves to loopback.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.settimeout(0.5)
        probe.connect(("8.8.8.8", 80))
        return str(probe.getsockname()[0])
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def qr_svg(text: str) -> str:
    """The pairing URL as an inline SVG QR code, or an empty string.

    `qrcode` is a pure-Python package with no build step, so this works on any
    machine that ran `pip install -r requirements.txt`. When it is genuinely
    absent the caller still gets the URL and the numeric code, and pairing works
    by typing — a QR is the convenient path, never the only one.
    """
    try:
        import qrcode  # noqa: PLC0415
    except Exception:  # noqa: BLE001
        return ""

    try:
        code = qrcode.QRCode(border=2, box_size=1)
        code.add_data(text)
        code.make(fit=True)
        matrix = code.get_matrix()
    except Exception:  # noqa: BLE001
        return ""

    size = len(matrix)
    # One <rect> per dark module would be a few thousand elements. A single
    # path with one "move + 1x1 box" per module is the same picture in a
    # fraction of the bytes, which matters because this string travels through
    # the JSON protocol.
    parts = [
        f"M{x} {y}h1v1h-1z"
        for y, row in enumerate(matrix)
        for x, dark in enumerate(row)
        if dark
    ]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'shape-rendering="crispEdges" width="{size * 6}" height="{size * 6}">'
        f'<rect width="{size}" height="{size}" fill="#fff"/>'
        f'<path fill="#000" d="{"".join(parts)}"/></svg>'
    )


# --------------------------------------------------------------- the page --

_PAGE = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0f14">
<title>OCADE</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  :root{
    --bg:#0b0f14;--card:#141b23;--line:#243040;--ink:#e8eef6;--dim:#8fa3ba;
    --accent:#4da3ff;--good:#3ddc97;--bad:#ff6b6b;
  }
  html,body{margin:0;height:100%}
  body{
    background:var(--bg);color:var(--ink);
    font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    padding:env(safe-area-inset-top) env(safe-area-inset-right)
            env(safe-area-inset-bottom) env(safe-area-inset-left);
    display:flex;flex-direction:column;
  }
  header{padding:18px 18px 10px;border-bottom:1px solid var(--line)}
  h1{margin:0;font-size:19px;letter-spacing:.14em;font-weight:600}
  .sub{color:var(--dim);font-size:13px;margin-top:3px}
  main{flex:1;overflow-y:auto;padding:14px 18px 8px;-webkit-overflow-scrolling:touch}
  .msg{margin:0 0 12px;padding:11px 14px;border-radius:14px;max-width:88%;
       white-space:pre-wrap;overflow-wrap:anywhere}
  .me{background:var(--accent);color:#04101d;margin-left:auto;border-bottom-right-radius:4px}
  .it{background:var(--card);border:1px solid var(--line);border-bottom-left-radius:4px}
  .it.err{border-color:var(--bad);color:#ffd9d9}
  .meta{font-size:11px;color:var(--dim);margin-top:6px}
  .chips{display:flex;gap:8px;overflow-x:auto;padding:10px 18px;border-top:1px solid var(--line);
         scrollbar-width:none}
  .chips::-webkit-scrollbar{display:none}
  .chip{flex:0 0 auto;background:var(--card);border:1px solid var(--line);color:var(--ink);
        border-radius:999px;padding:9px 15px;font-size:14px;cursor:pointer}
  .chip:active{background:var(--line)}
  form{display:flex;gap:9px;padding:10px 18px 16px;border-top:1px solid var(--line)}
  input{flex:1;min-width:0;background:var(--card);border:1px solid var(--line);color:var(--ink);
        border-radius:13px;padding:13px 15px;font-size:16px}
  input:focus{outline:none;border-color:var(--accent)}
  button{background:var(--accent);color:#04101d;border:0;border-radius:13px;
         padding:0 19px;font-size:16px;font-weight:600;cursor:pointer}
  button:disabled{opacity:.45}
  @media (prefers-color-scheme:light){
    :root{--bg:#f5f7fa;--card:#fff;--line:#dde4ec;--ink:#101720;--dim:#5d6f85}
    .me{color:#fff}
  }
</style>
</head><body>
<header><h1>OCADE</h1><div class="sub" id="sub">Connecting…</div></header>
<main id="log"></main>
<div class="chips" id="chips"></div>
<form id="form" autocomplete="off">
  <input id="say" placeholder="Tell OCADE what to do" enterkeyhint="send">
  <button id="send" type="submit">Go</button>
</form>
<script>
(function(){
  var token = new URLSearchParams(location.search).get("t") || "";
  var log = document.getElementById("log");
  var sub = document.getElementById("sub");
  var form = document.getElementById("form");
  var say = document.getElementById("say");
  var send = document.getElementById("send");

  function bubble(text, cls, meta){
    var el = document.createElement("div");
    el.className = "msg " + cls;
    el.textContent = text;
    if (meta) {
      var m = document.createElement("div");
      m.className = "meta"; m.textContent = meta;
      el.appendChild(m);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  async function call(command, payload){
    var response = await fetch("/api/command", {
      method: "POST",
      headers: {"content-type":"application/json","x-ocade-token":token},
      body: JSON.stringify({command: command, payload: payload || {}})
    });
    if (response.status === 401) throw new Error("This link is no longer paired. Scan the code again.");
    return response.json();
  }

  /*
   * The phone does not route. It sends the sentence to the desktop, which runs
   * the same deterministic router every other surface uses — so "turn the
   * volume down" means the same thing typed here as typed there, and there is
   * no second copy of the rules to drift.
   */
  async function ask(text){
    bubble(text, "me");
    say.value = ""; send.disabled = true;
    try {
      var reply = await call("remote.ask", {text: text});
      var data = reply.data || {};
      bubble(data.detail || reply.error || "Done.", reply.ok ? "it" : "it err",
             data.verified === false ? "not confirmed" : "");
    } catch (error) {
      bubble(String(error.message || error), "it err");
    } finally {
      send.disabled = false; say.focus();
    }
  }

  form.addEventListener("submit", function(event){
    event.preventDefault();
    var text = say.value.trim();
    if (text) ask(text);
  });

  var QUICK = [
    ["Status", "how is my computer doing"],
    ["Briefing", "give me my briefing"],
    ["Weather", "what is the weather"],
    ["Screen", "what is on my screen"],
    ["Windows", "list my open windows"],
    ["Volume down", "turn the volume down"],
    ["Mute", "mute"],
    ["Pause", "pause the media"]
  ];
  var chips = document.getElementById("chips");
  QUICK.forEach(function(pair){
    var b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = pair[0];
    b.addEventListener("click", function(){ ask(pair[1]); });
    chips.appendChild(b);
  });

  call("engine.info", {}).then(function(reply){
    sub.textContent = reply.ok ? "Paired with this computer" : "Not paired";
  }).catch(function(){ sub.textContent = "Not paired"; });
})();
</script>
</body></html>
"""


# -------------------------------------------------------------- the server --


class _State:
    """Everything one running dashboard needs, in one place.

    A module of globals was the first shape and it made `stop()` unable to tell
    "never started" from "already stopped" — both were None — so a double stop
    reported success on a server that had never existed.
    """

    def __init__(self) -> None:
        self.server: ThreadingHTTPServer | None = None
        self.thread: threading.Thread | None = None
        self.token: str = ""
        self.code: str = ""
        self.url: str = ""
        self.started_at: float = 0.0
        self.last_seen: float = 0.0
        self.requests: int = 0
        self.dispatch: Callable[[str, dict], dict] | None = None


_STATE = _State()
_LOCK = threading.Lock()


def _handler_class(state: _State) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        # The default logger writes a line to stderr per request. stderr is
        # where the bridge sends the engine's chatter, and a phone polling
        # every few seconds would bury it.
        def log_message(self, *_args: Any) -> None:  # noqa: A003
            return

        server_version = "OCADE"
        sys_version = ""

        def _authorised(self) -> bool:
            supplied = self.headers.get("x-ocade-token") or ""
            if not supplied and "?" in self.path:
                from urllib.parse import parse_qs, urlparse  # noqa: PLC0415

                supplied = (parse_qs(urlparse(self.path).query).get("t") or [""])[0]
            # Constant time. `==` returns on the first differing character,
            # which is enough to recover a token by timing if somebody cares.
            return bool(state.token) and secrets.compare_digest(supplied, state.token)

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("content-type", content_type)
            self.send_header("content-length", str(len(body)))
            # This page is served over plain HTTP on a home network. Telling the
            # browser not to cache it, not to be framed, and not to sniff the
            # type costs three headers and removes three whole categories of
            # problem.
            self.send_header("cache-control", "no-store")
            self.send_header("x-content-type-options", "nosniff")
            self.send_header("x-frame-options", "DENY")
            self.send_header("referrer-policy", "no-referrer")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, status: int, payload: dict) -> None:
            self._send(status, json.dumps(payload, default=str).encode("utf-8"), "application/json")

        def do_GET(self) -> None:  # noqa: N802
            state.last_seen = time.time()
            state.requests += 1
            if not self._authorised():
                self._json(401, {"ok": False, "error": "Not paired."})
                return
            path = self.path.split("?", 1)[0]
            if path in ("/", "/index.html"):
                self._send(200, _PAGE.encode("utf-8"), "text/html; charset=utf-8")
                return
            self._json(404, {"ok": False, "error": "No such page."})

        def do_POST(self) -> None:  # noqa: N802
            state.last_seen = time.time()
            state.requests += 1
            if not self._authorised():
                self._json(401, {"ok": False, "error": "Not paired."})
                return
            if self.path.split("?", 1)[0] != "/api/command":
                self._json(404, {"ok": False, "error": "No such endpoint."})
                return

            try:
                length = int(self.headers.get("content-length") or 0)
            except ValueError:
                length = 0
            if length <= 0 or length > 256 * 1024:
                self._json(400, {"ok": False, "error": "Unreadable request."})
                return
            try:
                request = json.loads(self.rfile.read(length) or b"{}")
            except (json.JSONDecodeError, OSError):
                self._json(400, {"ok": False, "error": "Unreadable request."})
                return
            if not isinstance(request, dict):
                self._json(400, {"ok": False, "error": "Unreadable request."})
                return

            command = str(request.get("command") or "")
            payload = request.get("payload")
            if not isinstance(payload, dict):
                payload = {}

            # `remote.ask` is the phone's one open door: it carries a sentence
            # that has not been routed yet, so there is no command here to check.
            #
            # This used to claim the allow-list "still governs" because routing
            # lands on a command from the set below. It did not. `remote_ask`
            # looked the routed command up in the engine's full handler table,
            # and this check never saw it — the set stayed small only because no
            # intent happened to emit anything outside it. The allow-list is now
            # re-applied in `remote_ask` at the point the command is known.
            if command not in REMOTE_COMMANDS and command != "remote.ask":
                self._json(
                    403,
                    {
                        "ok": False,
                        "code": "refused",
                        "error": f"{command} needs somebody at the keyboard.",
                    },
                )
                return

            dispatch = state.dispatch
            if dispatch is None:
                self._json(503, {"ok": False, "error": "The engine is not attached."})
                return
            try:
                self._json(200, dispatch(command, payload))
            except Exception as error:  # noqa: BLE001
                self._json(
                    500,
                    {"ok": False, "code": "retryable_failure", "error": f"{type(error).__name__}"},
                )

    return Handler


def _reap(state: _State) -> None:
    """Stop a dashboard nobody has used for a while."""
    while True:
        time.sleep(30)
        with _LOCK:
            if state.server is None:
                return
            if time.time() - state.last_seen > IDLE_SECONDS:
                server = state.server
                state.server = None
                state.token = ""
                break
    try:
        server.shutdown()
        server.server_close()
    except Exception:  # noqa: BLE001, S110
        pass


def start(dispatch: Callable[[str, dict], dict]) -> dict[str, Any]:
    """Open the dashboard and return everything needed to pair with it.

    `dispatch` is injected rather than imported so this module never depends on
    the bridge — which is what keeps the bridge free to import this one.
    """
    with _LOCK:
        if _STATE.server is not None:
            return status()

        _STATE.dispatch = dispatch
        _STATE.token = secrets.token_urlsafe(24)
        # A short numeric code for the case where the camera will not focus,
        # the screen is dirty, or the phone has no camera at all. Same entropy
        # source, different shape.
        _STATE.code = "".join(secrets.choice("0123456789") for _ in range(6))

        handler = _handler_class(_STATE)
        server: ThreadingHTTPServer | None = None
        chosen = 0
        for port in _PORTS:
            try:
                server = ThreadingHTTPServer(("0.0.0.0", port), handler)  # noqa: S104
                chosen = port
                break
            except OSError:
                continue
        if server is None:
            _STATE.token = ""
            raise RemoteRefused(
                f"No free port in {_PORTS[0]}–{_PORTS[-1]}. Close whatever is using them and try again."
            )

        # Daemon threads, so a running dashboard can never keep the engine
        # alive after the bridge's stdin closes.
        _STATE.server = server
        _STATE.started_at = time.time()
        _STATE.last_seen = time.time()
        _STATE.requests = 0
        _STATE.thread = threading.Thread(target=server.serve_forever, daemon=True, name="ocade-remote")
        _STATE.thread.start()
        threading.Thread(target=_reap, args=(_STATE,), daemon=True, name="ocade-remote-reap").start()

        host = lan_address()
        _STATE.url = f"http://{host}:{chosen}/?t={_STATE.token}"

    return status()


def stop() -> dict[str, Any]:
    """Close the dashboard and invalidate the token. Safe to call twice."""
    with _LOCK:
        server = _STATE.server
        _STATE.server = None
        _STATE.token = ""
        _STATE.url = ""
        _STATE.dispatch = None
    if server is None:
        return {"running": False, "verified": True, "detail": "The phone dashboard was not running."}
    try:
        server.shutdown()
        server.server_close()
    except Exception:  # noqa: BLE001, S110
        pass
    return {
        "running": False,
        "verified": True,
        "detail": "The phone dashboard is closed and the pairing link no longer works.",
    }


def status() -> dict[str, Any]:
    """Whether it is running, and how to pair if it is."""
    with _LOCK:
        running = _STATE.server is not None
        url = _STATE.url
        code = _STATE.code
        started = _STATE.started_at
        requests = _STATE.requests
        last = _STATE.last_seen

    if not running:
        return {
            "running": False,
            "verified": True,
            "detail": "The phone dashboard is not running.",
        }

    svg = qr_svg(url)
    return {
        "running": True,
        "url": url,
        "pairingCode": code,
        # Rendered by the interface as an image. Empty when `qrcode` is absent,
        # in which case the URL above is still a working pairing link.
        "qr": svg,
        "qrAvailable": bool(svg),
        "startedAt": started,
        "requests": requests,
        "idleSeconds": int(time.time() - last),
        "expiresInSeconds": max(0, int(IDLE_SECONDS - (time.time() - last))),
        "allowed": sorted(REMOTE_COMMANDS),
        "verified": True,
        "detail": (
            f"Scan the code with your phone, or open {url.split('?')[0]} on the same "
            f"network and enter {code}. It closes itself after "
            f"{IDLE_SECONDS // 60} minutes of no use."
        ),
    }
