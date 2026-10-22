"""
Independent check of the CADFaber car task (TASK 4), from the work folder and the device's own
step log, never from what JARVIS said.

    python3 oracle_cad.py <workspace> <device step log>

Pass needs all of: car.stl came out of a CADFaber page (a browser step on cadfaber.com saved a
.stl whose bytes are car.stl's), the mesh holds at least 10 separate parts, the bill of materials
names at least 12 of the 14 required parts with millimetre sizes, and the wiring list holds
battery-to-motor and battery-to-lights runs with a purpose each.
"""
import hashlib
import json
import re
import struct
import sys
from pathlib import Path

REQUIRED = {
    "body": r"\bbody\b", "chassis": r"chassis|frame", "wheel/tyre": r"wheel|tyre|tire",
    "rim": r"\brims?\b", "steering rack": r"steering", "tie rod": r"tie.?rod",
    "suspension": r"suspension|spring|shock|strut|damper", "motor": r"motor",
    "drive shaft": r"drive.?shaft|half.?shaft|axle", "brake": r"brake|disc|rotor|caliper",
    "headlight": r"head.?light|head.?lamp", "tail light": r"tail.?light|tail.?lamp|rear light",
    "battery": r"battery", "wiring": r"wir(e|ing)|harness|cable",
}


def triangles(data: bytes) -> list[tuple]:
    if data[:5].lower() == b"solid" and b"facet" in data[:400]:
        v = [tuple(map(float, m.split())) for m in re.findall(rb"vertex\s+([^\n]+)", data)]
        return [tuple(v[i:i + 3]) for i in range(0, len(v) - 2, 3)]
    count = struct.unpack("<I", data[80:84])[0]
    out = []
    for i in range(min(count, (len(data) - 84) // 50)):
        f = struct.unpack("<12f", data[84 + 50 * i: 84 + 50 * i + 48])
        out.append((f[3:6], f[6:9], f[9:12]))
    return out


def parts(tris: list[tuple]) -> int:
    """Separate pieces: triangles that share a vertex belong to one piece."""
    parent: dict = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for tri in tris:
        keys = [tuple(round(c, 3) for c in p) for p in tri]
        for k in keys[1:]:
            parent[find(k)] = find(keys[0])
    return len({find(k) for k in list(parent)})


def check(ws: Path, log: Path) -> dict:
    stl = ws / "car.stl"
    data = stl.read_bytes() if stl.is_file() else b""
    steps = []
    for line in log.read_text().splitlines():
        try:
            steps.append(json.loads(line))
        except ValueError:  # an older log cut its lines short: that step is not evidence
            continue
    page = ""
    from_site = False
    for s in steps:
        if s["family"] == "browser" and s["action"].get("action") == "open":
            page = str(s["action"].get("url", ""))
        for saved in (s.get("saved") or []) if "cadfaber.com" in page else []:
            file = ws / saved
            if saved.endswith(".stl") and file.is_file() and data and \
                    hashlib.sha256(file.read_bytes()).digest() == hashlib.sha256(data).digest():
                from_site = True
    tris = triangles(data) if data else []
    bom = (ws / "car-bom.csv").read_text(errors="replace") if (ws / "car-bom.csv").is_file() else ""
    wiring = (ws / "car-wiring.txt").read_text(errors="replace") if (ws / "car-wiring.txt").is_file() else ""
    named = [k for k, rx in REQUIRED.items() if re.search(rx, bom, re.I)]
    sized = len(re.findall(r"\d+(\.\d+)?\s*(mm|x)", bom, re.I))
    runs = re.findall(r"battery[^\n]{0,120}?(motor|light|lamp)", wiring, re.I | re.S)
    out = {
        "stlFromCadfaber": from_site, "stlBytes": len(data), "triangles": len(tris),
        "separateParts": parts(tris) if tris else 0, "bomParts": named,
        "bomMissing": [k for k in REQUIRED if k not in named], "bomSizes": sized,
        "wiringRuns": len(runs),
        "wiringMotorAndLights": bool(re.search(r"motor", wiring, re.I) and re.search(r"light|lamp", wiring, re.I)),
    }
    out["pass"] = (from_site and out["separateParts"] >= 10 and len(named) >= 12 and sized >= 10
                   and out["wiringMotorAndLights"])
    return out


if __name__ == "__main__":
    print(json.dumps(check(Path(sys.argv[1]), Path(sys.argv[2])), indent=1))
