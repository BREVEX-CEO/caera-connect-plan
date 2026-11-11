#!/usr/bin/env python3
"""What OCADE's desktop bridge can actually do in real application windows, without a model.

    python tests/jarvis/desktop_probe.py --out <dir>

A qualification tool for the hosted Windows and macOS desktops (plan.md §19.4), never product
code. It opens the model comparison's two "already open" fixtures (the workbook in LibreOffice
Calc, the layered project in GIMP) exactly as the benchmark does, then drives the real companion
gateway and its real `ui_bridge` worker the way a competent planner would, and records what
happened: how each window is named and leased, how long `ui.inspect` takes and what it sees,
whether text and key presses arrive, and whether the benchmark's own oracle then passes.

It answers one question the four benchmark rounds never reached: if the model chooses well, can
the tools finish the task? A stage that fails is a product defect to fix, with its evidence here.
The key sequence below is this probe's own choice for one application; nothing reaches OCADE.
No model, no credential, no staging project. Always exits 0: it is evidence, not a gate.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import random
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "device-agent" / "windows"))

import anyio  # noqa: E402

from ocade_agent.gateway import Gateway  # noqa: E402
from tests.test_gateway import intent  # noqa: E402

spec = importlib.util.spec_from_file_location("benchmark", Path(__file__).with_name("benchmark.py"))
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


def brief(receipt: dict) -> dict:
    """A receipt without its picture: status, error and bounded evidence."""
    evidence = dict(receipt.get("evidence") or {})
    elements = evidence.pop("elements", None)
    small = {key: value if len(json.dumps(value, default=str)) <= 400 else "(long)" for key, value in evidence.items()}
    out = {"status": receipt.get("status"), "errorCode": receipt.get("errorCode"),
           "preview": bool(receipt.get("preview")), "evidence": small}
    if elements is not None:
        out["elements"] = len(elements)
        out["controlTypes"] = Counter(e.get("controlType") or "?" for e in elements).most_common(12)
        out["names"] = [f'{e.get("controlType")}:{e.get("name") or e.get("automationId")}'[:60] for e in elements[:40]]
    return out


async def probe(gateway: Gateway, record: dict, name: str, operation: str, arguments: dict) -> dict:
    started = time.monotonic()
    try:
        receipt = await gateway.run(intent(operation, arguments), gateway.epoch)
    except Exception as error:  # the probe records a crash as a finding and goes on
        receipt = {"status": "probe_error", "errorCode": f"{type(error).__name__}: {error}"[:300]}
    record[name] = brief(receipt) | {"seconds": round(time.monotonic() - started, 2)}
    return receipt


def window_titled(listing: dict, text: str) -> dict | None:
    windows = (listing.get("evidence") or {}).get("windows") or []
    return next((w for w in windows if text.lower() in (w.get("title") or "").lower()), None)


def lease(window: dict) -> dict:
    return {key: window[key] for key in ("exe", "pid", "hwnd", "started")}


async def listed(gateway: Gateway, record: dict, text: str) -> tuple[dict, dict | None]:
    """apps.list until the window titled `text` appears (a large app can take a minute to start)."""
    deadline = time.monotonic() + 90
    while True:
        listing = await probe(gateway, record, "apps.list", "apps.list", {})
        window = window_titled(listing, text)
        if window is not None or time.monotonic() > deadline:
            record["windows"] = [{"exe": w.get("exe"), "title": (w.get("title") or "")[:80]}
                                 for w in (listing.get("evidence") or {}).get("windows") or []]
            return listing, window
        await anyio.sleep(3)


async def answer_dialogs(gateway: Gateway, record: dict, listing: dict, window: dict, name: str) -> None:
    """Other windows of the same app (a first-run welcome, a format question) hold its input:
    inspect each and dismiss it with Escape, as a planner would, before acting on the window."""
    others = [w for w in (listing.get("evidence") or {}).get("windows") or []
              if w.get("pid") == window["pid"] and w.get("hwnd") != window["hwnd"]]
    record[f"{name}.dialogs"] = [(w.get("title") or "")[:80] for w in others]
    for index, dialog in enumerate(others[:2]):
        await probe(gateway, record, f"{name}.inspect.{index}", "ui.inspect", {"window": lease(dialog)})
        await probe(gateway, record, f"{name}.escape.{index}", "ui.send_keys",
                    {"window": lease(dialog), "keys": [{"press": "Escape"}]})
        await anyio.sleep(1)


async def calc_stage(record: dict, ws: Path) -> None:
    request, oracle, _minutes = benchmark.calc(ws, random.Random("7:calc"))
    workbook = next(ws.glob("budget_*.xlsx"))
    record["request"] = request
    async with Gateway(str(ws)) as gateway:
        listing, window = await listed(gateway, record, workbook.name)
        installed = (listing.get("evidence") or {}).get("installed") or []
        record["installedCount"] = len(installed)
        if window is None:
            record["finding"] = "the open workbook's window was not listed"
            return
        record["leasedExe"] = window["exe"]
        record["exeIsInstalledApp"] = window["exe"] in {a.get("exe") for a in installed}
        await probe(gateway, record, "system.inspect", "system.inspect", {"programs": [window["exe"]]})
        await probe(gateway, record, "ui.inspect", "ui.inspect", {"window": lease(window)})
        await answer_dialogs(gateway, record, listing, window, "before")
        # A planner's keyboard route: go to the cell by name, type the value, save in place.
        steps = [
            ("keys.cell", [{"press": "Mod+Shift+T"}, {"text": "B7"}, {"press": "Enter"}]),
            ("keys.value", [{"text": "128"}, {"press": "Enter"}]),
            ("keys.save", [{"press": "Mod+S"}]),
        ]
        for name, keys in steps:
            receipt = await probe(gateway, record, name, "ui.send_keys", {"window": lease(window), "keys": keys})
            if receipt.get("status") != "observed":
                break
            await anyio.sleep(1.5)
        # Saving a non-native format asks which format to keep: a second window of the same app.
        await anyio.sleep(2)
        after = await probe(gateway, record, "apps.list.afterSave", "apps.list", {})
        others = [w for w in (after.get("evidence") or {}).get("windows") or []
                  if w.get("pid") == window["pid"] and w.get("hwnd") != window["hwnd"]]
        record["dialogs"] = [(w.get("title") or "")[:80] for w in others]
        for dialog in others[:1]:  # the format question: Enter keeps the workbook's own format
            await probe(gateway, record, "ui.inspect.dialog", "ui.inspect", {"window": lease(dialog)})
            await probe(gateway, record, "keys.keepFormat", "ui.send_keys",
                        {"window": lease(dialog), "keys": [{"press": "Enter"}]})
        await anyio.sleep(4)
        try:
            ok, detail = oracle()
        except Exception as error:
            ok, detail = False, f"{type(error).__name__}: {error}"[:300]
        record["oracle"] = {"pass": bool(ok), "detail": detail}


async def gimp_stage(record: dict, ws: Path) -> None:
    request, _oracle, _minutes = benchmark.gimp(ws, random.Random("7:gimp"))
    project = next(ws.glob("poster_*.xcf"))
    record["request"] = request
    async with Gateway(str(ws)) as gateway:
        listing, window = await listed(gateway, record, project.stem)
        if window is None:
            record["finding"] = "the open project's window was not listed"
            return
        record["leasedExe"] = window["exe"]
        await probe(gateway, record, "system.inspect", "system.inspect", {"programs": [window["exe"]]})
        await probe(gateway, record, "ui.inspect", "ui.inspect", {"window": lease(window)})
        await answer_dialogs(gateway, record, listing, window, "before")
        await probe(gateway, record, "ui.inspect.after", "ui.inspect", {"window": lease(window)})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    summary: dict = {"system": platform.system(), "machine": platform.platform(),
                     "programs": {"soffice": benchmark.SOFFICE, "gimp": benchmark.GIMP}, "stages": {}}
    for name, stage, program in (("calc", calc_stage, benchmark.SOFFICE), ("gimp", gimp_stage, benchmark.GIMP)):
        record: dict = {}
        summary["stages"][name] = record
        if not program:
            record["finding"] = "application not installed on this machine"
            continue
        ws = Path(tempfile.mkdtemp(prefix=f"ocade-probe-{name}-"))
        try:
            with benchmark.Watch(out / name / "screenshots", every=10):
                anyio.run(stage, record, ws)
        except Exception as error:
            record["probeError"] = f"{type(error).__name__}: {error}"[:600]
        (out / "summary.json").write_text(json.dumps(summary, indent=2, default=str))
    print("OCADE_DESKTOP_PROBE:" + json.dumps(summary, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
