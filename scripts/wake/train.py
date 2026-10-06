"""
Train OCADE's wake model for "OCADE" and "Hey OCADE" (owner direction 2026-10-02).

Data: scripts/wake/make_data.py (Windows voices on this computer; no download).
Features and inference: jarvis-runtime/ocade_wake.py, the same code the agent runs.
Every training window is made fresh: speed, loudness, room echo, microphone band,
noise, music-like tones, other speech and silence, at random. Hard negatives (okay,
arcade, Ocado, Hey Kate, other assistants) and phrases cut off before they end teach
it what NOT to wake for.

    python scripts/wake/train.py --data %LOCALAPPDATA%/ocade-wake-data --holdout ravi,susan
    python scripts/wake/train.py --data %LOCALAPPDATA%/ocade-wake-data --export

--holdout trains without those voices and reports how it does on them (unseen speakers).
--export trains on every voice, picks the threshold, measures false wakes per hour and
writes jarvis-runtime/wake/{model npz, manifest.json} (sign it with sign_manifest.py).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
import wave
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "jarvis-runtime"))
import ocade_wake as W  # noqa: E402

SR = W.SAMPLE_RATE
WIN = W.WINDOW_SAMPLES
DILATIONS = (1, 2, 4, 8)
VERSION = "1.0.0"


# -- audio --------------------------------------------------------------------------

def read(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        if w.getnchannels() > 1:
            raw = raw.reshape(-1, w.getnchannels()).mean(axis=1)
        return resample(raw, w.getframerate())


def resample(x: np.ndarray, rate: int, to: int = SR) -> np.ndarray:
    if rate == to:
        return x
    if rate > to:  # low-pass below the new Nyquist first, so nothing folds back
        taps = np.arange(-64, 65)
        cutoff = 0.45 * to / rate
        h = 2 * cutoff * np.sinc(2 * cutoff * taps) * np.hamming(len(taps))
        x = np.convolve(x, h / h.sum(), mode="same")
    t = np.arange(0, len(x) * to / rate) * rate / to
    return np.interp(t, np.arange(len(x)), x).astype(np.float32)


def trim(x: np.ndarray) -> np.ndarray:
    frames = x[: len(x) // 320 * 320].reshape(-1, 320)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    loud = np.nonzero(rms > rms.max() * 0.06)[0]
    if len(loud) == 0:
        return x
    return x[max(0, loud[0] * 320 - 480): min(len(x), (loud[-1] + 1) * 320 + 480)]


def speed(x: np.ndarray, factor: float) -> np.ndarray:
    return resample(x, int(SR * factor)) if abs(factor - 1) > 1e-3 else x


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2)) + 1e-9)


# -- what the room and the microphone do --------------------------------------------

def noise(rng: np.random.Generator, n: int) -> np.ndarray:
    white = rng.standard_normal(n).astype(np.float32)
    kind = rng.integers(3)
    if kind == 0:
        return white
    spectrum = np.fft.rfft(white)
    f = np.maximum(np.arange(len(spectrum)), 1)
    shaped = np.fft.irfft(spectrum / (np.sqrt(f) if kind == 1 else f), n=n).astype(np.float32)
    return shaped / rms(shaped)


def tones(rng: np.random.Generator, n: int) -> np.ndarray:
    """Music-like: chords of a few notes, changing on a beat, with soft envelopes."""
    out = np.zeros(n, dtype=np.float32)
    t = np.arange(n) / SR
    beat = int(SR * rng.uniform(0.2, 0.6))
    for start in range(0, n, beat):
        root = 110 * 2 ** (rng.integers(0, 24) / 12)
        chord = [root * 2 ** (s / 12) for s in rng.choice([0, 3, 4, 7, 10, 12], size=3)]
        seg = slice(start, min(n, start + beat))
        env = np.exp(-np.arange(seg.stop - seg.start) / (beat * 0.6))
        for hz in chord:
            out[seg] += np.sin(2 * np.pi * hz * t[seg]) * env * (1 + 0.3 * np.sin(2 * np.pi * 2 * hz * t[seg]))
    return out / rms(out)


def reverb(rng: np.random.Generator, x: np.ndarray) -> np.ndarray:
    rt60 = rng.uniform(0.15, 0.7)
    length = int(SR * rt60)
    tail = rng.standard_normal(length) * np.exp(-6.9 * np.arange(length) / length)
    tail[0] = 1.0
    n = len(x) + length
    wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(tail / np.abs(tail).sum() * rng.uniform(1.5, 4), n),
                       n)[: len(x)]
    return (x + wet).astype(np.float32)


def microphone(rng: np.random.Generator, x: np.ndarray) -> np.ndarray:
    """A cheap or distant microphone: a band from 100-300 Hz up to 3.4-8 kHz."""
    spectrum = np.fft.rfft(x)
    hz = np.fft.rfftfreq(len(x), 1 / SR)
    low, high = rng.uniform(100, 300), rng.uniform(3400, 8000)
    gain = 1 / (1 + (low / np.maximum(hz, 1)) ** 4) / (1 + (hz / high) ** 4)
    return np.fft.irfft(spectrum * gain, n=len(x)).astype(np.float32)


# -- the corpus ---------------------------------------------------------------------

class Corpus:
    def __init__(self, data: Path, holdout: set[str]):
        self.positive, self.held, self.hard, self.speech = [], [], [], []
        for path in sorted((data / "positive").glob("*.wav")):
            voice = path.stem.split("_")[-3]
            clip = trim(read(path))
            if len(clip) > WIN - 1600:
                continue  # longer than the window allows with room around it
            (self.held if voice in holdout else self.positive).append(clip)
        for path in sorted((data / "negative").glob("*.wav")):
            voice = path.stem.split("_")[-1]
            if voice in holdout:
                continue
            (self.hard if path.stem.startswith("hard") else self.speech).append(trim(read(path)))
        self.media = []
        for path in sorted(Path("C:/Windows/Media").rglob("*.wav")):
            try:
                self.media.append(read(path))
            except (wave.Error, EOFError, ValueError):
                continue
        self.babble = np.concatenate(self.speech)

    def summary(self) -> dict:
        return {"positive": len(self.positive), "heldOut": len(self.held), "hardNegative": len(self.hard),
                "speech": len(self.speech), "media": len(self.media)}


class Windows:
    """Training windows, made fresh each time."""

    def __init__(self, corpus: Corpus, seed: int):
        self.c, self.rng = corpus, np.random.default_rng(seed)

    def background(self, n: int) -> np.ndarray:
        rng = self.rng
        kind = rng.integers(5)
        if kind == 0:
            return np.zeros(n, dtype=np.float32)
        if kind == 1:
            return noise(rng, n)
        if kind == 2:
            return tones(rng, n)
        if kind == 3:
            start = rng.integers(0, len(self.c.babble) - n)
            return self.c.babble[start:start + n] / rms(self.c.babble[start:start + n])
        clip = self.c.media[rng.integers(len(self.c.media))]
        clip = np.tile(clip, n // len(clip) + 1)[:n]
        return clip / rms(clip)

    def place(self, clip: np.ndarray, right: bool) -> np.ndarray:
        out = np.zeros(WIN, dtype=np.float32)
        clip = clip[:WIN]
        latest = WIN - len(clip)
        start = self.rng.integers(max(0, latest - 6400), latest + 1) if right else self.rng.integers(0, latest + 1)
        out[start:start + len(clip)] = clip
        return out

    def finish(self, x: np.ndarray) -> np.ndarray:
        rng = self.rng
        if rng.random() < 0.35:
            x = reverb(rng, x)
        if rng.random() < 0.5:
            x = microphone(rng, x)
        if rng.random() < 0.8:
            snr = rng.uniform(0, 30)
            bed = self.background(WIN)
            x = x + bed * (rms(x) / 10 ** (snr / 20)) if rms(x) > 1e-4 else bed * 0.05
        x = x / max(rms(x), 1e-4) * 10 ** (rng.uniform(-40, -12) / 20)  # quiet to loud speech
        return np.clip(x, -1, 1).astype(np.float32)

    def one(self, clips: list[np.ndarray] | None = None) -> tuple[np.ndarray, int]:
        rng = self.rng
        clips = clips or self.c.positive
        if rng.random() < 0.45:
            clip = speed(clips[rng.integers(len(clips))], rng.uniform(0.88, 1.12))
            return self.finish(self.place(clip, right=rng.random() < 0.85)), 1
        kind = rng.random()
        if kind < 0.3:
            clip = speed(self.c.hard[rng.integers(len(self.c.hard))], rng.uniform(0.88, 1.12))
            x = self.place(clip, right=True)
        elif kind < 0.5:  # the phrase cut off before it ends is not the phrase yet
            clip = self.c.positive[rng.integers(len(self.c.positive))]
            cut = clip[: int(len(clip) * rng.uniform(0.3, 0.7))]
            x = self.place(cut, right=True)
        elif kind < 0.8:
            start = rng.integers(0, len(self.c.babble) - WIN)
            x = self.c.babble[start:start + WIN].copy()
        else:
            x = np.zeros(WIN, dtype=np.float32)
        return self.finish(x), 0

    def batch(self, n: int, clips=None, augment: bool = False) -> tuple[torch.Tensor, torch.Tensor]:
        made = [self.one(clips) for _ in range(n)]
        x = np.stack([W.log_mel(a) for a, _ in made])
        if augment:
            x = np.stack([self.speaker(f) for f in x])
        return torch.from_numpy(x), torch.tensor([y for _, y in made], dtype=torch.float32)

    def speaker(self, features: np.ndarray) -> np.ndarray:
        """Another voice and a little lost detail: the mel axis warped as a longer or shorter
        vocal tract would (VTLP), then a band and a moment masked (SpecAugment)."""
        rng = self.rng
        bins = np.arange(W.MELS, dtype=np.float32)
        warped = np.clip(bins * rng.uniform(0.86, 1.14), 0, W.MELS - 1)
        out = np.stack([np.interp(warped, bins, frame) for frame in features]).astype(np.float32)
        fill = out.mean()
        for _ in range(rng.integers(0, 3)):
            width = rng.integers(1, 5)
            band = rng.integers(0, W.MELS - width)
            out[:, band:band + width] = fill
        for _ in range(rng.integers(0, 3)):
            width = rng.integers(1, 12)
            moment = rng.integers(0, len(out) - width)
            out[moment:moment + width] = fill
        return out


# -- the network (ocade_wake.Model runs the same thing in numpy) ----------------------

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        widths = [W.MELS, 48, 48, 64, 64]
        kernels = [5, 5, 5, 3]
        self.convs = nn.ModuleList(
            nn.Conv1d(widths[i], widths[i + 1], kernels[i], dilation=DILATIONS[i],
                      padding=DILATIONS[i] * (kernels[i] - 1) // 2) for i in range(4))
        self.f1 = nn.Linear(64, 32)
        self.f2 = nn.Linear(32, 1)
        self.drop = nn.Dropout(0.1)
        self.register_buffer("mean", torch.zeros(W.MELS))
        self.register_buffer("std", torch.ones(W.MELS))

    def forward(self, x):  # (B, T, MELS)
        x = ((x - self.mean) / self.std).transpose(1, 2)
        for conv in self.convs:
            x = self.drop(torch.relu(conv(x)))
        x = x.max(dim=2).values
        return self.f2(torch.relu(self.f1(x))).squeeze(1)


class Batches(torch.utils.data.IterableDataset):
    """Each worker makes its own fresh windows (its own seed), in parallel."""

    def __init__(self, corpus: Corpus, seed: int, size: int):
        self.corpus, self.seed, self.size = corpus, seed, size

    def __iter__(self):
        info = torch.utils.data.get_worker_info()
        windows = Windows(self.corpus, self.seed * 100 + (info.id if info else 0))
        while True:
            yield windows.batch(self.size, augment=True)


def train(corpus: Corpus, epochs: int, seed: int, workers: int = 6) -> Net:
    torch.manual_seed(seed)
    windows = Windows(corpus, seed)
    net = Net()
    sample, _ = windows.batch(1000)
    net.mean.copy_(sample.mean(dim=(0, 1)))
    net.std.copy_(sample.std(dim=(0, 1)) + 1e-3)
    optimizer = torch.optim.AdamW(net.parameters(), lr=3e-3, weight_decay=1e-4)
    steps = epochs * 120
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=3e-3, total_steps=steps)
    loss_fn = nn.BCEWithLogitsLoss()
    started = time.time()
    loader = iter(torch.utils.data.DataLoader(Batches(corpus, seed, 128), batch_size=None,
                                              num_workers=workers, persistent_workers=True))
    for step in range(steps):
        x, y = next(loader)
        net.train()
        loss = loss_fn(net(x), y * 0.98 + 0.01)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        schedule.step()
        if step % 120 == 0:
            print(f"epoch {step // 120:3d} loss {loss.item():.4f} {time.time() - started:.0f}s", flush=True)
    return net.eval()


def mine(net: Net, corpus: Corpus, seed: int, windows_to_try: int = 30_000) -> np.ndarray:
    """Negative windows the model still mistakes for the phrase: kept to learn from."""
    windows = Windows(corpus, seed)
    found = []
    for _ in range(windows_to_try // 500):
        audio = []
        while len(audio) < 500:
            x, y = windows.one()
            if y == 0:
                audio.append(x)
        features = np.stack([W.log_mel(a) for a in audio])
        with torch.no_grad():
            scores = torch.sigmoid(net(torch.from_numpy(features))).numpy()
        found.extend(features[scores >= 0.3])
    print(f"mined {len(found)} hard negatives of {windows_to_try}", flush=True)
    return np.stack(found) if found else np.zeros((0, W.WINDOW_FRAMES, W.MELS), dtype=np.float32)


def refine(net: Net, corpus: Corpus, mined: np.ndarray, epochs: int, seed: int, workers: int = 6) -> Net:
    """More training with the mined mistakes in every batch, at a gentle rate."""
    if len(mined) == 0:
        return net
    rng = np.random.default_rng(seed)
    shaper = Windows(corpus, seed + 7)
    optimizer = torch.optim.AdamW(net.parameters(), lr=4e-4, weight_decay=1e-4)
    loss_fn = nn.BCEWithLogitsLoss()
    loader = iter(torch.utils.data.DataLoader(Batches(corpus, seed + 1, 96), batch_size=None,
                                              num_workers=workers, persistent_workers=True))
    for step in range(epochs * 120):
        x, y = next(loader)
        hard = np.stack([shaper.speaker(mined[i]) for i in rng.integers(0, len(mined), 32)])
        x = torch.cat([x, torch.from_numpy(hard)])
        y = torch.cat([y, torch.zeros(len(hard))])
        net.train()
        loss = loss_fn(net(x), y * 0.98 + 0.01)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        if step % 120 == 0:
            print(f"refine {step // 120:3d} loss {loss.item():.4f}", flush=True)
    return net.eval()


def export(net: Net, threshold: float, path: Path) -> None:
    weights = {}
    for i, conv in enumerate(net.convs):
        weights[f"c{i + 1}.weight"] = conv.weight.detach().numpy()
        weights[f"c{i + 1}.bias"] = conv.bias.detach().numpy()
    for name in ("f1", "f2"):
        weights[f"{name}.weight"] = getattr(net, name).weight.detach().numpy()
        weights[f"{name}.bias"] = getattr(net, name).bias.detach().numpy()
    weights.update(mean=net.mean.numpy(), std=net.std.numpy(), threshold=np.float32(threshold),
                   dilations=np.array(DILATIONS, dtype=np.int32))
    np.savez(path, **{k: np.asarray(v, dtype=np.float32) if k != "dilations" else v
                      for k, v in weights.items()})


# -- measurement ----------------------------------------------------------------------

def window_scores(net: Net, windows: Windows, n: int, clips=None) -> tuple[np.ndarray, np.ndarray]:
    with torch.no_grad():
        x, y = windows.batch(n, clips)
        return torch.sigmoid(net(x)).numpy(), y.numpy()


def stream(corpus: Corpus, model: W.Model, seed: int, minutes: float, with_phrases: list | None):
    """A long recording of a room: speech, TV-like tones, noise and silence, with phrases
    said now and then. Counts wakes that are not a phrase (false) and phrases heard."""
    rng = np.random.default_rng(seed)
    windows = Windows(corpus, seed)
    said, wakes, clock = [], [], [0.0]
    listener = W.Listener(model, lambda: wakes.append(clock[0]), clock=lambda: clock[0])
    total = int(minutes * 60 * SR)
    at = 0
    while at < total:
        length = int(SR * rng.uniform(4, 12))
        piece = windows.background(length) * 10 ** (rng.uniform(-45, -20) / 20)
        speech = corpus.speech + corpus.hard
        phrase = with_phrases[rng.integers(len(with_phrases))] if with_phrases and rng.random() < 0.5 else None
        gap = (0, 0)
        if phrase is not None:
            where = rng.integers(0, max(1, length - len(phrase) - SR))
            piece[where:where + len(phrase)] += phrase * 10 ** (rng.uniform(-6, 0) / 20)
            said.append(((at + where) / SR, (at + where + len(phrase)) / SR))
            gap = (where - SR // 4, where + len(phrase) + SR // 4)
        for _ in range(rng.integers(0, 4)):
            clip = speech[rng.integers(len(speech))]
            loud = rng.uniform(-6, 0)
            where = rng.integers(0, max(1, length - len(clip)))
            if where < gap[1] and where + len(clip) > gap[0]:
                loud -= rng.uniform(10, 20)  # someone talking over the phrase is a TV, not a person in front
            piece[where:where + len(clip)] += clip[: length - where] * 10 ** (loud / 20)
        piece = np.clip(piece, -1, 1)
        for start in range(0, len(piece), W.STEP_SAMPLES):
            clock[0] = (at + start) / SR
            listener.feed(piece[start:start + W.STEP_SAMPLES])
        at += length
    # A wake while the phrase is being said, or within 1.5 s of its end, is that phrase heard.
    near = lambda w, start, end: start + 0.3 <= w <= end + 1.5  # noqa: E731
    heard = sum(1 for start, end in said if any(near(w, start, end) for w in wakes))
    false = sum(1 for w in wakes if not any(near(w, start, end) for start, end in said))
    early = [round(w - end, 2) for start, end in said for w in wakes if near(w, start, end)]
    return {"minutes": minutes, "said": len(said), "heard": heard, "falseWakes": false,
            "falsePerHour": round(false / minutes * 60, 2), "modelRuns": listener.looked,
            "wakeAfterEndSeconds": [float(np.percentile(early, q)) for q in (10, 50, 90)] if early else None}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--holdout", default="")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--threshold", type=float, default=None,
                        help="use this threshold (chosen on unseen voices) instead of picking one here")
    parser.add_argument("--unseen", default=None, help="a JSON file of the held-out-voice results to record")
    args = parser.parse_args()
    holdout = {v for v in args.holdout.split(",") if v}
    corpus = Corpus(Path(args.data), holdout)
    print("corpus", corpus.summary(), flush=True)
    net = train(corpus, args.epochs, args.seed)
    for round_ in range(2):  # learn from what still fools it, twice
        net = refine(net, corpus, mine(net, corpus, args.seed + 50 + round_), 8, args.seed + round_)
    check = Windows(corpus, args.seed + 1000)
    scores, labels = window_scores(net, check, 3000)
    report: dict = {"corpus": corpus.summary()}
    for threshold in (0.5, 0.7, 0.8, 0.9, 0.95):
        miss = float(np.mean(scores[labels == 1] < threshold))
        false = float(np.mean(scores[labels == 0] >= threshold))
        report[f"windows@{threshold}"] = {"missed": round(miss, 4), "falseWindows": round(false, 4)}
    if holdout:
        scores, labels = window_scores(net, check, 1500, corpus.held)
        report["heldOutVoices"] = {t: round(float(np.mean(scores[labels == 1] < t)), 4)
                                   for t in (0.5, 0.7, 0.8, 0.9)}
    out = ROOT / "jarvis-runtime" / "wake"
    out.mkdir(exist_ok=True)
    candidate = out / "candidate.npz"
    best = None
    for threshold in (0.6, 0.7, 0.8, 0.9, 0.95):
        export(net, threshold, candidate)
        measured = stream(corpus, W.Model(candidate), args.seed + 2, 30,
                          corpus.held if holdout else corpus.positive)
        report[f"stream@{threshold}"] = measured
        print(threshold, measured, flush=True)
        recall = measured["heard"] / max(1, measured["said"])
        # The lowest threshold that keeps false wakes to at most one an hour.
        if best is None and measured["falsePerHour"] <= 1.0:
            best = (threshold, recall, measured)
    print(json.dumps(report, indent=1))
    if args.export:
        if args.threshold is not None:
            threshold = args.threshold
            export(net, threshold, candidate)
            measured = stream(corpus, W.Model(candidate), args.seed + 3, 30, corpus.positive)
        elif best is None:
            sys.exit("No threshold kept false wakes under one an hour; not exported.")
        else:
            threshold, _, measured = best
        model_file = out / "ocade_wake_v1.npz"
        export(net, threshold, model_file)
        candidate.unlink(missing_ok=True)
        provenance = json.loads((Path(args.data) / "provenance.json").read_text(encoding="utf-8"))
        manifest = {
            "name": "OCADE wake",
            "version": VERSION,
            "phrases": ["OCADE", "Hey OCADE"],
            "file": model_file.name,
            "sha256": hashlib.sha256(model_file.read_bytes()).hexdigest(),
            "bytes": model_file.stat().st_size,
            "runtime": {"engine": "ocade_wake numpy", "sampleRate": W.SAMPLE_RATE, "frame": W.FRAME,
                        "hop": W.HOP, "fft": W.NFFT, "mels": W.MELS, "melRange": [W.FMIN, W.FMAX],
                        "windowSamples": W.WINDOW_SAMPLES, "stepSamples": W.STEP_SAMPLES,
                        "threshold": threshold, "consecutive": 2, "refractorySeconds": W.REFRACTORY_S,
                        "quietRms": W.QUIET_RMS},
            "provenance": {
                "madeBy": "OCADE (scripts/wake/make_data.py and train.py), on the owner's computer",
                "speech": provenance["made_with"],
                "voices": provenance["voices"],
                "clips": corpus.summary(),
                "backgrounds": "Windows Media sounds on the computer; generated noise and tones",
                "notUsed": provenance["not_used"],
            },
            "measured": {"falsePerHour": measured["falsePerHour"],
                         "heardInStream": f"{measured['heard']}/{measured['said']}",
                         "streamMinutes": measured["minutes"],
                         "voices": "the training voices (optimistic)",
                         "unseenVoices": json.loads(Path(args.unseen).read_text()) if args.unseen else None},
            "created": time.strftime("%Y-%m-%d"),
        }
        (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8",
                                           newline="\n")
        print("exported", model_file, manifest["sha256"])


if __name__ == "__main__":
    main()
