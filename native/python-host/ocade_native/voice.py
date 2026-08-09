from __future__ import annotations

import base64
import io
import tempfile
import time
import wave
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import pyttsx3
import sounddevice as sd
import webrtcvad
from faster_whisper import WhisperModel

SAMPLE_RATE = 16_000


def devices() -> dict[str, Any]:
    rows = []
    for index, device in enumerate(sd.query_devices()):
        rows.append(
            {
                "index": index,
                "name": str(device["name"]),
                "inputs": int(device["max_input_channels"]),
                "outputs": int(device["max_output_channels"]),
                "defaultRate": float(device["default_samplerate"]),
            }
        )
    default = sd.default.device
    return {"devices": rows, "defaultInput": default[0], "defaultOutput": default[1]}


def _wav_bytes(samples: np.ndarray[Any, Any], sample_rate: int = SAMPLE_RATE) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(np.asarray(samples, dtype=np.int16).tobytes())
    return output.getvalue()


def capture(seconds: float, device: int | None = None) -> dict[str, Any]:
    seconds = max(0.25, min(seconds, 15.0))
    started = time.perf_counter()
    audio = sd.rec(
        round(seconds * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="int16",
        device=device,
        blocking=True,
    ).reshape(-1)
    payload = _wav_bytes(audio)
    vad = webrtcvad.Vad(2)
    frame_samples = SAMPLE_RATE * 30 // 1_000
    voiced = 0
    total = 0
    for offset in range(0, len(audio) - frame_samples + 1, frame_samples):
        total += 1
        if vad.is_speech(audio[offset : offset + frame_samples].tobytes(), SAMPLE_RATE):
            voiced += 1
    return {
        "sampleRate": SAMPLE_RATE,
        "samples": len(audio),
        "peak": int(np.max(np.abs(audio))) if len(audio) else 0,
        "rms": round(float(np.sqrt(np.mean(audio.astype(np.float64) ** 2))), 2)
        if len(audio)
        else 0,
        "voicedFrames": voiced,
        "totalFrames": total,
        "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
        "wavBase64": base64.b64encode(payload).decode("ascii"),
    }


def transcribe(
    wav_base64: str,
    model_name: str,
    model_dir: Path,
    emit: Callable[[dict[str, Any]], None],
) -> dict[str, Any]:
    if model_name not in {"tiny.en", "base.en", "small.en"}:
        raise ValueError("STT model is not allowlisted")
    payload = base64.b64decode(wav_base64, validate=True)
    if len(payload) > 32 * 1024 * 1024:
        raise ValueError("audio exceeds the 32 MiB limit")
    model_dir.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temporary:
        temporary.write(payload)
        audio_path = Path(temporary.name)
    try:
        emit({"type": "stt_loading", "model": model_name})
        model = WhisperModel(
            model_name, device="cpu", compute_type="int8", download_root=str(model_dir)
        )
        segments, info = model.transcribe(str(audio_path), vad_filter=True, beam_size=3)
        text_parts: list[str] = []
        first_partial_ms: float | None = None
        for segment in segments:
            if first_partial_ms is None:
                first_partial_ms = (time.perf_counter() - started) * 1_000
            text_parts.append(segment.text.strip())
            emit({"type": "stt_partial", "text": " ".join(text_parts)})
        return {
            "text": " ".join(text_parts).strip(),
            "language": info.language,
            "languageProbability": info.language_probability,
            "firstPartialMs": round(first_partial_ms, 2) if first_partial_ms is not None else None,
            "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
            "model": model_name,
        }
    finally:
        audio_path.unlink(missing_ok=True)


def _female_voice(engine: Any) -> Any:
    voices = engine.getProperty("voices")
    for voice in voices:
        identity = f"{getattr(voice, 'name', '')} {getattr(voice, 'id', '')}".lower()
        gender = str(getattr(voice, "gender", "")).lower()
        if "female" in gender or any(name in identity for name in ("zira", "hazel", "susan")):
            return voice
    if not voices:
        raise RuntimeError("no local SAPI voice is installed")
    return voices[0]


def speak(text: str, emit: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
    if not text or len(text) > 2_000:
        raise ValueError("speech text must contain 1 to 2000 characters")
    started = time.perf_counter()
    engine = pyttsx3.init("sapi5")
    voice = _female_voice(engine)
    engine.setProperty("voice", voice.id)
    engine.setProperty("rate", 180)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temporary:
        output = Path(temporary.name)
    try:
        engine.save_to_file(text, str(output))
        engine.runAndWait()
        with wave.open(str(output), "rb") as reader:
            rate = reader.getframerate()
            channels = reader.getnchannels()
            width = reader.getsampwidth()
            frames = reader.readframes(reader.getnframes())
        if width != 2:
            raise RuntimeError("SAPI produced an unsupported sample width")
        audio = np.frombuffer(frames, dtype=np.int16)
        if channels > 1:
            audio = audio.reshape(-1, channels).mean(axis=1).astype(np.int16)
        first_audio_ms = (time.perf_counter() - started) * 1_000
        sd.play(audio, rate, blocking=False)
        chunk = max(1, rate // 20)
        for offset in range(0, len(audio), chunk):
            section = audio[offset : offset + chunk].astype(np.float64)
            rms = float(np.sqrt(np.mean(section**2))) if len(section) else 0.0
            emit({"type": "tts_amplitude", "rms": round(rms, 2)})
            time.sleep(len(section) / rate)
        sd.wait()
        return {
            "voice": str(getattr(voice, "name", voice.id)),
            "characters": len(text),
            "firstAudioMs": round(first_audio_ms, 2),
            "elapsedMs": round((time.perf_counter() - started) * 1_000, 2),
        }
    finally:
        output.unlink(missing_ok=True)
