"""
The product's real device executor behind a loopback HTTP door, for real-model runs.

POST /act {"family": "browser"|"computer", "action": {...}} runs one action exactly as the
Device Agent would (jarvis-runtime Computer, Playwright browser session) and answers its result.
A step that needs the person's confirmation is confirmed, as the person would, and counted.
GET /frame answers the latest screenshot (base64 JPEG); GET /stats the counters.

Run: xvfb-run -a python3 experiments/architectures/device_server.py <workspace> <port>
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "jarvis-runtime"))
from actions.browser_control import _BrowserSession  # noqa: E402
from ocade_computer import Computer  # noqa: E402

root = Path(sys.argv[1]).resolve()
root.mkdir(parents=True, exist_ok=True)
pc = Computer(str(root))
browser: _BrowserSession | None = None
lock = threading.Lock()  # one action at a time, as on the device
stats = {"actions": 0, "approvals": 0, "device_ms": 0.0, "by_action": {}}
last_frame: str | None = None


def act(family: str, action: dict) -> dict:
    global browser, last_frame
    if family == "computer":
        result = pc.run(action)
        if result.get("status") == "needs_confirmation":
            stats["approvals"] += 1
            result = pc.run(action, confirmed=True)
        return result
    if browser is None:
        browser = _BrowserSession("chromium", mode="isolated", headless=True)
        browser.start()
    step = dict(action)
    if step.get("action") == "upload":
        step["_file"] = str(pc._inside(str(step.get("path", "")), change=False))
    if step.get("action") in ("download", "click"):
        step["_folder"] = str(root / "Downloads")
    result = browser.run(browser.act(step), timeout=120)
    if result.get("status") == "needs_confirmation":
        stats["approvals"] += 1
        result = browser.run(browser.act(step, True), timeout=120)
    if step.get("action") == "look":
        last_frame = browser.run(browser.frame(), timeout=30)
    return result


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, value) -> None:
        data = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send({"frame": last_frame} if self.path == "/frame" else stats)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        with lock:
            started = time.perf_counter()
            try:
                result = act(body["family"], body["action"])
            except Exception as error:  # an executor crash is a failed step, said so
                result = {"status": "failed", "summary": f"{type(error).__name__}: {str(error)[:200]}"}
            ms = (time.perf_counter() - started) * 1000
            name = str(body["action"].get("action"))
            stats["actions"] += 1
            stats["device_ms"] += ms
            entry = stats["by_action"].setdefault(name, [0, 0.0])
            entry[0] += 1
            entry[1] += ms
            # One line per step on stdout (the run's server log): what ran and what it answered.
            shown = {k: (v[:6000] if isinstance(v, str) else v) for k, v in body["action"].items()}
            print(json.dumps({"family": body["family"], "action": shown, "saved": result.get("saved"),
                              "result": json.dumps(result)[:1500], "ms": round(ms)}), flush=True)
        self._send({"result": result, "ms": round(ms, 2)})


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), Handler).serve_forever()
