"""Qualify frozen workers and the bundled visible browser with an empty developer PATH.

The browser visits a random runner-local HTTP fixture under the explicit private-web
test flag. This is a frozen-worker component check, not a customer task or a bypass
of the Gateway's HTTPS-only action protocol. No personal browser/profile is used.
"""

import argparse
import asyncio
import json
import secrets
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from PIL import Image

WORKERS = ("ocade_agent.office_worker", "ocade_agent.verify_worker", "ocade_agent.media_worker",
           "ocade_agent.web_worker", "ocade_agent.windows_worker", "ocade_agent.command_worker")


def facts(answer) -> dict:
    if answer.is_error:
        raise RuntimeError("frozen worker returned a tool error")
    value = answer.structured_content or json.loads(answer.content[0].text)
    if set(value) == {"result"}:
        value = value["result"]
    if "refused" in value:
        raise RuntimeError("frozen worker refused its fixture: " + value["refused"])
    return value


async def main(executable: str, path: str) -> None:
    root = Path(executable).resolve().parent
    candidates = (root / "_internal" / "playwright-browsers", root / "playwright-browsers")
    browsers = [candidate for candidate in candidates if candidate.is_dir()]
    chrome = next((exe for folder in browsers for exe in folder.rglob("chrome.exe")), None)
    if chrome is None:
        raise RuntimeError("frozen installer is missing its Playwright Chromium dependency")
    files = [file for file in root.rglob("*") if file.is_file()]
    print("OCADE_FROZEN_BUNDLE:" + json.dumps({
        "browserBundled": True, "files": len(files),
        "bytes": sum(file.stat().st_size for file in files),
    }), flush=True)

    nonce = secrets.token_hex(16)
    content = ("<!doctype html><html><head><title>" + nonce +
               "</title></head><body><h1>" + nonce + "</h1></body></html>").encode()
    received = []

    class Fixture(BaseHTTPRequestHandler):
        def do_GET(self):
            received.append(self.path)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="ocade-frozen-") as temporary:
            workspace = Path(temporary)
            Image.new("RGB", (320, 180), (200, 10, 10)).save(workspace / "a.png")
            for module in WORKERS:
                params = StdioServerParameters(
                    command=executable, args=["worker", module],
                    env={
                        "OCADE_WORKSPACE": str(workspace),
                        "OCADE_AGENT_HOME": str(workspace / "agent-home"),
                        "PATH": path,
                        "OCADE_ALLOW_PRIVATE_WEB": "1",
                        "OCADE_BROWSER_EXECUTABLE": str(chrome),
                    },
                )
                async with stdio_client(params) as (read, write), ClientSession(
                    read, write, read_timeout_seconds=90
                ) as session:
                    await session.initialize()
                    result = {"module": module, "tools": len((await session.list_tools()).tools)}
                    if module.endswith("media_worker"):
                        result["inspect"] = facts(await session.call_tool("media_inspect", {"path": "a.png"}))["kind"]
                    if module.endswith("web_worker"):
                        url = f"http://127.0.0.1:{server.server_address[1]}/{nonce}"
                        page = facts(await session.call_tool("web_open", {"url": url}))
                        if page.get("title") != nonce or nonce not in page.get("text", "") or "/" + nonce not in received:
                            raise RuntimeError("the frozen bundled browser did not read the real fixture")
                        facts(await session.call_tool("web_close", {"page": page["page"]}))
                        result["bundledBrowserFixture"] = True
                    print(json.dumps(result), flush=True)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("executable")
    parser.add_argument("--path", default="")
    args = parser.parse_args()
    asyncio.run(main(args.executable, args.path))
