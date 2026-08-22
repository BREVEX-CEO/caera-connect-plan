"""The microphone: choosing one, and listening to it for a bounded moment.

WHAT SURVIVED FROM THE DESKTOP-CONTROL SOURCE
----------------------------------------------
Its microphone handling was the genuinely hard-won part, and it is kept almost
intact: the running noise floor, the spike ratio measured against that floor
rather than against an absolute level, the re-arm threshold that stops one loud
event counting twice, and — most valuable of all — the startup probe that
notices the default input device is silent and scans for one that is not. That
last behaviour is the difference between "OCADE cannot hear you" and OCADE
quietly using the microphone that works.

WHAT DID NOT SURVIVE
--------------------
The infinite loop. That script listened forever and, on hearing two claps, ran
one fixed errand. A sidecar command that never returns cannot be part of a
request/response protocol, and a listener that owns the microphone for the
lifetime of the process is a listener nobody else can use.

So ``audio.listen`` takes a duration, returns what it heard, and gives the
device back. A caller that wants continuous listening calls it repeatedly and
stays in control of stopping — which is the only arrangement where "stop
listening" can be honoured immediately.

TRANSIENTS ARE REPORTED, NOT ACTED ON
-------------------------------------
This module detects that two sharp sounds happened close together. It does not
decide what that means. Meaning belongs to the task engine, where it can be
turned off, changed, or attached to something the user actually asked for.

NOTHING IS RECORDED. Levels are computed from each block and the block is
discarded. No audio is written to disk, kept in memory beyond one window, or
returned to the caller.
"""

from __future__ import annotations

import time
from typing import Any

from ._win32 import require
from .protocol import Refusal, clamp_text

SAMPLE_RATE = 44_100
BLOCK_MS = 40
CHANNELS = 1

# Tuning, carried over unchanged: these numbers were arrived at against real
# rooms and real microphones, and re-deriving them from first principles would
# be re-doing work that has already been done.
SPIKE_RATIO = 7.0
RETRIGGER_RATIO = 0.55
NOISE_FLOOR_ALPHA = 0.992
QUIET_GATE_MULT = 2.2
MIN_RMS = 0.012
COOLDOWN_S = 0.45
MIN_DOUBLE_GAP_S = 0.05
MAX_DOUBLE_GAP_S = 0.35

# A device whose loudest block over half a second is below this is not hearing
# anything — muted, disconnected, or the wrong endpoint.
PROBE_S = 0.5
SILENT_RMS = 0.001

# Ceiling on one listen. A caller wanting more calls again; a caller that has
# gone away cannot leave the microphone open indefinitely.
MAX_LISTEN_S = 30.0


def _sounddevice():
    try:
        sounddevice = require("sounddevice", "Microphone input")  # noqa: PLC0415
    except (ImportError, OSError) as error:
        # OSError too: sounddevice raises it when PortAudio itself is missing,
        # which is a different problem from the package being absent and worth
        # saying out loud.
        raise Refusal(
            "This computer's microphone support is not installed, so OCADE cannot listen here.",
            "unsupported",
        ) from error
    return sounddevice


def _block_samples() -> int:
    return max(1, int(SAMPLE_RATE * BLOCK_MS / 1000))


def _rms(block) -> float:
    import numpy as np  # noqa: PLC0415

    data = block
    if getattr(data, "ndim", 1) > 1:
        data = np.mean(data.astype(np.float64), axis=1)
    else:
        data = data.astype(np.float64)
    if data.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(data**2)))


def _input_devices(sd) -> list[tuple[int, dict]]:
    return [
        (index, device)
        for index, device in enumerate(sd.query_devices())
        if device["max_input_channels"] >= 1
    ]


def _probe(sd, device: int, blocksize: int) -> float | None:
    """Loudest block this device produced in half a second, or None if unopenable."""
    try:
        with sd.InputStream(
            device=device,
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="float32",
            blocksize=blocksize,
        ) as stream:
            peak = 0.0
            deadline = time.monotonic() + PROBE_S
            while time.monotonic() < deadline:
                data, _ = stream.read(blocksize)
                peak = max(peak, _rms(data))
            return peak
    except Exception:
        return None


def _choose_device(sd, blocksize: int, requested: Any = None) -> tuple[int, str]:
    """The microphone to use, and one sentence explaining the choice.

    The scan exists because the system default is frequently wrong — a docked
    laptop whose default is a disconnected headset, a webcam array Windows
    prefers over the microphone the user is actually speaking into.
    """
    if isinstance(requested, int) and requested >= 0:
        sd.query_devices(requested)
        return requested, f"Using the microphone this request named ({requested})."
    if isinstance(requested, str) and requested.strip():
        needle = requested.strip().lower()
        for index, device in _input_devices(sd):
            if needle in device["name"].lower():
                return index, f"Using {device['name']}."
        raise Refusal(f"No microphone matches {requested!r} on this computer.", "unsupported")

    default = sd.default.device[0]
    if isinstance(default, int) and default >= 0:
        peak = _probe(sd, default, blocksize)
        if peak is not None and peak >= SILENT_RMS:
            name = sd.query_devices(default)["name"]
            return default, f"Using the default microphone, {name}."

    best_index: int | None = None
    best_peak = -1.0
    for index, _device in _input_devices(sd):
        if index == default:
            continue
        peak = _probe(sd, index, blocksize)
        if peak is not None and peak > best_peak:
            best_peak, best_index = peak, index

    if best_index is not None and best_peak >= SILENT_RMS:
        name = sd.query_devices(best_index)["name"]
        return best_index, f"The default microphone was silent, so OCADE is using {name}."

    if isinstance(default, int) and default >= 0:
        name = sd.query_devices(default)["name"]
        return default, f"No microphone on this computer is picking anything up. Using {name}."

    devices = _input_devices(sd)
    if not devices:
        raise Refusal("This computer has no microphone.", "unsupported")
    index, device = devices[0]
    return index, f"No microphone is picking anything up. Using {device['name']}."


def list_microphones(_request=None) -> dict[str, Any]:
    """Every input device, with the one OCADE would choose marked."""
    sd = _sounddevice()
    blocksize = _block_samples()
    devices = [
        {
            "index": index,
            "name": clamp_text(device["name"], 200),
            "channels": int(device["max_input_channels"]),
            "defaultSampleRate": int(device.get("default_samplerate") or 0),
        }
        for index, device in _input_devices(sd)
    ]
    chosen, reason = _choose_device(sd, blocksize)
    return {
        "microphones": devices[:40],
        "count": len(devices),
        "chosen": chosen,
        "reason": reason,
    }


def listen(request) -> dict[str, Any]:
    """Listen for a bounded moment and report what the levels did.

    Returns loudness statistics and the timestamps of sharp transients. No audio
    leaves this function, and the device is released before it returns.
    """
    payload = getattr(request, "payload", {}) or {}
    seconds = payload.get("seconds", 3.0)
    if not isinstance(seconds, (int, float)) or not 0 < float(seconds) <= MAX_LISTEN_S:
        raise Refusal(
            f"A listen must be between 0 and {MAX_LISTEN_S:.0f} seconds.", "unsupported"
        )

    sd = _sounddevice()
    blocksize = _block_samples()
    device, reason = _choose_device(sd, blocksize, payload.get("device"))

    noise_floor = 1e-4
    armed = True
    last_transient = 0.0
    transients: list[float] = []
    peak = 0.0
    total = 0.0
    blocks = 0

    started = time.monotonic()
    deadline = started + float(seconds)
    try:
        with sd.InputStream(
            device=device,
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="float32",
            blocksize=blocksize,
        ) as stream:
            while time.monotonic() < deadline:
                data, _overflowed = stream.read(blocksize)
                level = _rms(data)
                blocks += 1
                total += level
                peak = max(peak, level)

                # The floor only learns from quiet blocks. Letting a clap into
                # the average raises the bar for the next one, which is how a
                # detector goes deaf after the first loud thing it hears.
                if level < noise_floor * QUIET_GATE_MULT:
                    noise_floor = NOISE_FLOOR_ALPHA * noise_floor + (1 - NOISE_FLOOR_ALPHA) * level
                    noise_floor = max(noise_floor, 1e-7)

                threshold = max(noise_floor * SPIKE_RATIO, MIN_RMS)
                now = time.monotonic()
                if level < threshold * RETRIGGER_RATIO:
                    armed = True
                if armed and level >= threshold and (now - last_transient) >= COOLDOWN_S:
                    armed = False
                    last_transient = now
                    transients.append(round(now - started, 3))
    except Refusal:
        raise
    except Exception as error:  # noqa: BLE001
        raise Refusal(
            f"OCADE could not open the microphone: {type(error).__name__}.", "retryable_failure"
        ) from None

    doubles = [
        (first, second)
        for first, second in zip(transients, transients[1:])
        if MIN_DOUBLE_GAP_S <= (second - first) <= MAX_DOUBLE_GAP_S
    ]
    return {
        "device": device,
        "reason": reason,
        "seconds": round(time.monotonic() - started, 3),
        "peakLevel": round(peak, 5),
        "averageLevel": round(total / blocks, 5) if blocks else 0.0,
        "noiseFloor": round(noise_floor, 6),
        "transients": transients[:60],
        "doubleTransients": [[round(a, 3), round(b, 3)] for a, b in doubles][:20],
        "heardSomething": peak >= max(noise_floor * SPIKE_RATIO, MIN_RMS),
        # Said plainly because it is the sentence a user deserves when speech
        # input silently does nothing.
        "detail": (
            "The microphone is picking sound up."
            if peak >= SILENT_RMS
            else "The microphone produced no sound at all during that window."
        ),
    }
