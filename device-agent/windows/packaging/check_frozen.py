"""Release check for a built companion: each bundled worker starts from the frozen executable
and answers MCP, with nothing but the build's own runtime (PATH holds only `--path`).

    python packaging/check_frozen.py "dist/OCADE JARVIS/ocade-agent.exe" --path <dir with ffmpeg or empty>
"""

import argparse
import asyncio
import json
import tempfile
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client
from PIL import Image

WORKERS = ("ocade_agent.office_worker", "ocade_agent.verify_worker", "ocade_agent.media_worker",
           "ocade_agent.web_worker", "ocade_agent.windows_worker")


async def main(executable: str, path: str) -> None:
    # PyInstaller --onedir places datas in _internal on modern builds.
    # A green worker handshake without a browser bundle is not an installable product.
    root = Path(executable).resolve().parent
    candidates = (root / "_internal" / "playwright-browsers", root / "playwright-browsers")
    browsers = [candidate for candidate in candidates if candidate.is_dir()]
    if not any(any(folder.rglob("chrome.exe")) for folder in browsers):
        raise RuntimeError("frozen installer is missing its Playwright Chromium dependency")
    print(json.dumps({"browserBundled": True}), flush=True)
    workspace = Path(tempfile.mkdtemp())
    Image.new("RGB", (320, 180), (200, 10, 10)).save(workspace / "a.png")
    for module in WORKERS:
        params = StdioServerParameters(command=executable, args=["worker", module],
                                       env={"OCADE_WORKSPACE": str(workspace), "PATH": path})
        async with stdio_client(params) as (read, write), ClientSession(read, write) as session:
            await session.initialize()
            result = {"module": module, "tools": len((await session.list_tools()).tools)}
            if module.endswith("media_worker"):
                answer = await session.call_tool("media_inspect", {"path": "a.png"})
                result["inspect"] = json.loads(answer.content[0].text)["kind"]
            print(json.dumps(result), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("executable")
    parser.add_argument("--path", default="")
    args = parser.parse_args()
    asyncio.run(main(args.executable, args.path))
