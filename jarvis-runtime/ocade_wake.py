"""
"OCADE" and "Hey OCADE" on this computer: heard here, only in Background/Wake Mode.

OCADE's own wake model, trained by OCADE (scripts/wake/) and bundled with the Device
Agent in `wake/`: no download after installation, no model hub, no vendor runtime —
the features and the small network run in numpy. Microphone audio never leaves this
computer; when the phrase is heard, OCADE JARVIS opens with voice on.

ONE AUTHORITY. `wake/manifest.json` names the model's version, its SHA-256, how it was
made and how it runs; `wake/manifest.sig` is the release key's signature over it, the
same key and check the Device Agent's updates use. The model is used only when both
hold. It travels inside the signed agent package, so installing, updating, rolling back
and repairing the agent installs, updates, rolls back and repairs the model; a model
damaged on disk is reported (never used) and a repair of the agent restores it.

Listening is cheap when nothing is said: quiet audio is not even looked at, and the
model runs ten times a second on the last 1.6 s only when there is sound.
"""
from __future__ import annotations

import hashlib
import json
import sys
import threading
import time
import webbrowser
from pathlib import Path

SAMPLE_RATE = 16000
FRAME, HOP, NFFT, MELS = 400, 160, 512, 40       # 25 ms frames every 10 ms, 40 mel bands
FMIN, FMAX = 60.0, 7600.0
WINDOW_SAMPLES = 25600                            # 1.6 s heard at once
WINDOW_FRAMES = 1 + (WINDOW_SAMPLES - FRAME) // HOP  # 158
STEP_SAMPLES = 1600                               # looked at every 100 ms
QUIET_RMS = 0.004                                 # below this the window is silence (about -48 dBFS)
REFRACTORY_S = 2.0                                # one wake per saying of the phrase


def bundled() -> Path:
    """The wake folder inside the installed agent (or beside this file in development)."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / "wake"


# -- features: the same code trains the model and runs it ---------------------------

def _mel_points(count: int):
    import numpy as np
    to_mel = lambda hz: 2595.0 * np.log10(1.0 + hz / 700.0)  # noqa: E731
    to_hz = lambda mel: 700.0 * (10 ** (mel / 2595.0) - 1.0)  # noqa: E731
    return to_hz(np.linspace(to_mel(FMIN), to_mel(FMAX), count))


_FILTERS = None


def mel_filters():
    """(MELS, NFFT//2+1) triangular HTK-mel filters."""
    global _FILTERS
    if _FILTERS is None:
        import numpy as np
        edges = _mel_points(MELS + 2)
        bins = np.arange(NFFT // 2 + 1) * SAMPLE_RATE / NFFT
        filters = np.zeros((MELS, NFFT // 2 + 1), dtype=np.float32)
        for m in range(MELS):
            low, centre, high = edges[m], edges[m + 1], edges[m + 2]
            rising = (bins - low) / (centre - low)
            falling = (high - bins) / (high - centre)
            filters[m] = np.maximum(0.0, np.minimum(rising, falling))
        _FILTERS = filters
    return _FILTERS


def log_mel(samples) -> "np.ndarray":
    """float samples at 16 kHz in [-1, 1] -> (frames, MELS) log-mel energies."""
    import numpy as np
    samples = np.asarray(samples, dtype=np.float32)
    count = 1 + (len(samples) - FRAME) // HOP
    if count <= 0:
        return np.zeros((0, MELS), dtype=np.float32)
    index = np.arange(FRAME)[None, :] + HOP * np.arange(count)[:, None]
    window = np.hanning(FRAME + 1)[:-1].astype(np.float32)  # periodic Hann
    spectrum = np.abs(np.fft.rfft(samples[index] * window, n=NFFT)) ** 2
    return np.log(spectrum.astype(np.float32) @ mel_filters().T + 1e-6)


# -- the model: a few dilated 1-D convolutions over time, then the strongest moment ----

class Model:
    LAYERS = ("c1", "c2", "c3", "c4")

    def __init__(self, path: Path):
        import numpy as np
        with np.load(path) as weights:
            self.w = {k: weights[k].astype(np.float32) for k in weights.files}
        self.threshold = float(self.w["threshold"])
        self.dilations = [int(d) for d in self.w["dilations"]]

    @staticmethod
    def _conv(x, weight, bias, dilation):
        """x (T, Cin), weight (Cout, Cin, K): same-length dilated convolution."""
        import numpy as np
        cout, cin, k = weight.shape
        pad = dilation * (k - 1) // 2
        padded = np.pad(x, ((pad, pad), (0, 0)))
        cols = np.stack([padded[i * dilation: i * dilation + len(x)] for i in range(k)], axis=2)
        return cols.reshape(len(x), cin * k) @ weight.reshape(cout, cin * k).T + bias

    def score(self, features) -> float:
        """features (WINDOW_FRAMES, MELS) -> probability that the window holds the phrase."""
        import numpy as np
        x = (features - self.w["mean"]) / self.w["std"]
        for name, dilation in zip(self.LAYERS, self.dilations):
            x = np.maximum(0.0, self._conv(x, self.w[f"{name}.weight"], self.w[f"{name}.bias"], dilation))
        x = x.max(axis=0)
        x = np.maximum(0.0, x @ self.w["f1.weight"].T + self.w["f1.bias"])
        logit = float((x @ self.w["f2.weight"].T + self.w["f2.bias"])[0])
        return 1.0 / (1.0 + np.exp(-logit))


# -- the one authority: a signed manifest that names the bundled model ----------------

class WakeUnavailable(Exception):
    pass


def verify(folder: Path | None = None, public_key: str | None = None) -> dict:
    """The manifest, once its signature and the model's hash both hold."""
    folder = folder or bundled()
    try:
        manifest_bytes = (folder / "manifest.json").read_bytes()
        signature = (folder / "manifest.sig").read_text().strip()
    except OSError as error:
        raise WakeUnavailable("The wake model is not installed with this agent") from error
    import ocade_update
    try:
        manifest = ocade_update.verify_manifest(manifest_bytes, signature,
                                                public_key or ocade_update.UPDATE_PUBLIC_KEY)
    except Exception as error:
        raise WakeUnavailable("The wake model's manifest is not OCADE's") from error
    model = folder / manifest["file"]
    try:
        digest = hashlib.sha256(model.read_bytes()).hexdigest()
    except OSError as error:
        raise WakeUnavailable("The wake model is missing; repair the OCADE Device Agent") from error
    if digest != manifest["sha256"]:
        raise WakeUnavailable("The wake model is damaged; repair the OCADE Device Agent")
    return manifest


def health(folder: Path | None = None) -> dict:
    """What the tray and OCADE show: ready with its version, or why not."""
    try:
        import numpy  # noqa: F401
        import sounddevice  # noqa: F401
    except Exception:
        return {"wake": "unavailable", "why": "This computer cannot listen for the wake phrase"}
    try:
        manifest = verify(folder)
    except WakeUnavailable as error:
        return {"wake": "unavailable", "why": str(error)}
    return {"wake": "ready", "version": manifest["version"], "phrases": manifest["phrases"]}


def available(_home: Path | None = None) -> bool:
    return health()["wake"] == "ready"


# -- listening ----------------------------------------------------------------------

class Listener:
    """Fed 16 kHz audio in any block size; calls on_detect once per saying of the phrase."""

    def __init__(self, model: Model, on_detect, clock=time.monotonic):
        import numpy as np
        self.model, self.on_detect, self.clock = model, on_detect, clock
        self.audio = np.zeros(WINDOW_SAMPLES, dtype=np.float32)
        self.pending = 0
        self.hits = 0
        self.quiet_until = 0.0
        self.looked = 0  # how often the model ran (idle cost, for health and tests)

    def feed(self, block) -> None:
        import numpy as np
        raw = np.asarray(block).reshape(-1)
        block = raw.astype(np.float32) / (32768.0 if raw.dtype.kind == "i" else 1.0)
        for start in range(0, len(block), STEP_SAMPLES):
            piece = block[start:start + STEP_SAMPLES]
            self.audio = np.concatenate([self.audio[len(piece):], piece])
            self.pending += len(piece)
            if self.pending >= STEP_SAMPLES:
                self.pending = 0
                self._look()

    def _look(self) -> None:
        import numpy as np
        now = self.clock()
        if now < self.quiet_until or float(np.sqrt(np.mean(self.audio[-8000:] ** 2))) < QUIET_RMS:
            self.hits = 0
            return
        self.looked += 1
        score = self.model.score(log_mel(self.audio))
        self.hits = self.hits + 1 if score >= self.model.threshold else 0
        if self.hits >= 2:  # two looks in a row, 100 ms apart: not a click or a cough
            self.hits = 0
            self.quiet_until = now + REFRACTORY_S
            self.on_detect()


def open_voice(server: str) -> None:
    webbrowser.open(f"{server.rstrip('/')}/ocade-jarvis?voice=1")


def listen(home: Path, server: str, stop: threading.Event, on_detect=None) -> bool:
    """Listen until `stop` is set; survives a microphone unplugged, changed or asleep.
    False when wake cannot run on this computer."""
    if not available(home):
        return False
    import queue
    import sounddevice
    manifest = verify()
    listener = Listener(Model(bundled() / manifest["file"]), on_detect or (lambda: open_voice(server)))
    blocks: queue.Queue = queue.Queue(maxsize=50)
    heard = [time.monotonic()]

    def take(data, *_):  # the audio thread only queues; a busy moment drops audio, never blocks
        heard[0] = time.monotonic()
        try:
            blocks.put_nowait(data[:, 0].copy())
        except queue.Full:
            pass

    def work():
        while not stop.is_set():
            try:
                listener.feed(blocks.get(timeout=0.5))
            except queue.Empty:
                continue

    threading.Thread(target=work, daemon=True, name="ocade-wake").start()
    while not stop.is_set():
        try:
            heard[0] = time.monotonic()
            with sounddevice.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32",
                                         blocksize=STEP_SAMPLES, callback=take):
                # No audio for 3 s: the microphone went away, changed, or the computer slept.
                while not stop.wait(1.0) and time.monotonic() - heard[0] < 3.0:
                    pass
        except Exception:
            pass
        if stop.wait(2.0):  # look for a microphone again shortly
            break
        sounddevice._terminate()
        sounddevice._initialize()  # a new default microphone is found only by asking again
    return True
