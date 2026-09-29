"""Manual proof on the person's real running Chrome (not run by the test suite).

Run: python tests/manual_existing_chrome.py
Opens one JARVIS tab on a local page, clicks, reads the result, closes only that tab.
"""
import functools
import http.server
import sys
import tempfile
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocade_device  # noqa: E402

site = tempfile.mkdtemp()
Path(site, "index.html").write_text(
    "<title>OCADE existing-browser proof</title>"
    "<button onclick=\"document.title='Clicked by JARVIS'\">Press me</button>")
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=site)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_address[1]}/index.html"

browsers = ocade_device.Browsers(headless=False, cdp=None)
print("capabilities:", browsers.capabilities())
print("endpoint found:", bool(browsers.endpoint()))
cancel = threading.Event()
opened = browsers.run("real", {"action": "open", "url": url}, False, ["127.0.0.1"], cancel)
print("open:", opened["status"], opened.get("summary"))
obs = opened.get("observation") or {}
print("tabs in the person's browser:", len(obs.get("tabs", [])))
button = next(e for e in obs["elements"] if e["name"] == "Press me")
clicked = browsers.run("real", {"action": "click", "ref": button["ref"],
                                "observationId": obs["observationId"]}, False, ["127.0.0.1"], cancel)
print("click:", clicked["status"], "title now:", clicked["observation"]["title"])
browsers.close()
print("closed JARVIS's tab only")
server.shutdown()
