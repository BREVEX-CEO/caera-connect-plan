"""Qualify frozen workers and the bundled visible browser with an empty developer PATH.

The browser visits a random runner-local HTTP fixture under the explicit private-web
test flag. This is a frozen-worker component check, not a customer task or a bypass
of the Gateway's HTTPS-only action protocol. No personal browser/profile is used.
"""

import argparse
import asyncio
import json
import secrets
import os
import time
from contextlib import contextmanager
import sys
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



def profile_processes(profile: Path) -> list:
    """Retain stable handles for this fixture's processes before shutdown."""
    if sys.platform != "win32":
        return []
    import pythoncom
    import pywintypes
    import win32api
    import win32com.client

    pythoncom.CoInitialize()
    try:
        rows = list(win32com.client.GetObject(r"winmgmts:root\cimv2").ExecQuery(
            "SELECT ProcessId, ParentProcessId, CommandLine FROM Win32_Process"))
        parents = {int(row.ProcessId): int(row.ParentProcessId) for row in rows}
        needles = {str(profile).casefold(), str(profile.resolve()).casefold()}
        roots = {int(row.ProcessId) for row in rows
                 if any(needle in str(row.CommandLine or "").casefold() for needle in needles)}
        del rows
    finally:
        pythoncom.CoUninitialize()
    if not roots:
        raise RuntimeError("No owned fixture browser process was discovered")
    owned = set(roots)
    for root in roots:
        chain, current = set(), root
        while current in parents and current not in chain and current != os.getpid():
            chain.add(current)
            current = parents[current]
        if current == os.getpid():
            owned.update(chain)
    while True:
        children = {pid for pid, parent in parents.items() if parent in owned}
        if children <= owned:
            break
        owned.update(children)
    handles = []
    try:
        for pid in sorted(owned - {os.getpid()}):
            try:
                handles.append((pid, win32api.OpenProcess(0x00100000, False, pid)))
            except pywintypes.error as error:
                if error.args[0] != 87:  # an already exited process has no openable PID
                    raise
        return handles
    except BaseException:
        close_process_handles(handles)
        raise


def close_process_handles(handles: list) -> None:
    for _, handle in handles:
        handle.Close()


def wait_for_process_exit(handles: list, seconds: float = 5.0) -> None:
    """A process handle signals completed termination; no process is killed here."""
    if sys.platform != "win32":
        return
    import win32event

    started = time.monotonic()
    deadline = started + seconds
    for pid, handle in handles:
        result = win32event.WaitForSingleObject(handle, max(0, int((deadline - time.monotonic()) * 1000)))
        if result != win32event.WAIT_OBJECT_0:
            raise TimeoutError(f"Owned fixture process {pid} did not finish shutdown within {seconds}s")
    print("OCADE_FROZEN_QUIESCENCE:" + json.dumps({
        "trackedProcesses": len(handles), "allExited": True,
        "waitSeconds": round(time.monotonic() - started, 3),
    }), flush=True)


@contextmanager
def fixture_directory():
    directory = tempfile.TemporaryDirectory(prefix="ocade-frozen-")
    root = Path(directory.name).resolve()
    if root.parent != Path(tempfile.gettempdir()).resolve() or not root.name.startswith("ocade-frozen-"):
        raise RuntimeError("Refusing cleanup outside the explicitly owned fixture directory")
    completed, retries = False, 0
    try:
        yield root
        completed = True
    finally:
        deadline = time.monotonic() + 5.0
        while True:
            try:
                directory.cleanup()
                if root.exists():
                    raise RuntimeError("Owned fixture directory was not removed")
                print("OCADE_FROZEN_CLEANUP:" + json.dumps({"sharingRetries": retries, "removed": True}), flush=True)
                break
            except PermissionError as error:
                # Only after all owned process handles have signaled: pending Windows
                # file I/O or an external scanner can still release a shared file late.
                if (not completed or sys.platform != "win32" or getattr(error, "winerror", None) not in (32, 33)
                        or time.monotonic() >= deadline):
                    raise
                retries += 1
                time.sleep(0.05)


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
        def handle(self):
            # Chromium can abandon speculative connections before sending a request.
            try:
                super().handle()
            except (ConnectionResetError, BrokenPipeError):
                pass

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
        with fixture_directory() as workspace:
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
                handles = []
                try:
                    with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as errors:
                        async with stdio_client(params, errlog=errors) as (read, write), ClientSession(
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
                                handles = await asyncio.to_thread(profile_processes, workspace / "agent-home" / "browser-profile")
                                facts(await session.call_tool("web_close", {"page": page["page"]}))
                                result["bundledBrowserFixture"] = True
                        if module.endswith("web_worker"):
                            await asyncio.to_thread(wait_for_process_exit, handles)
                        errors.seek(0)
                        diagnostic = errors.read()
                        if diagnostic:
                            sys.stderr.write(diagnostic)
                        if "Exception ignored in:" in diagnostic or "Traceback (most recent call last):" in diagnostic:
                            raise RuntimeError("unclean frozen worker shutdown: " + module)
                        print(json.dumps(result), flush=True)
                finally:
                    close_process_handles(handles)
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
