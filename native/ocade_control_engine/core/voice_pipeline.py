"""The offline voice pipeline: Windows speech out, Whisper in, barge-in between.

NOTHING HERE TOUCHES A NETWORK once the Whisper weights are cached. No API key,
no account, no telemetry. The one honest caveat is stated where it belongs, on
`WhisperEars.load`: the very first run downloads the model from Hugging Face,
and every run after that is local. A product that says "offline" must be able to
point at the moment it stopped needing the internet.

WHY SAPI5 AND NOT pyttsx3
-------------------------
pyttsx3 is the obvious choice and it is the wrong one HERE, for one reason:
barge-in. Interrupting speech means killing audio that is already playing, and
pyttsx3 drives its Windows output through a `runAndWait` loop whose `stop()` is
unreliable mid-utterance — the queue is what stops, not the sentence in flight.

SAPI5 exposes exactly the primitive this needs. `Speak(text, SVSFlagsAsync)`
returns immediately, and `Speak("", SVSFPurgeBeforeSpeak)` purges what is
playing. Measured on this machine: 40 ms from decision to silence. That is the
difference between an assistant that stops when told and one that finishes its
sentence first.

It is also already installed — `win32com` ships with pywin32, which the engine
depends on regardless — so the honest, faster option is also the one that adds
no new dependency.

WHY THE VOICE IS HARDCODED
--------------------------
OCADE has one voice for the same reason it has one model: a product that sounds
different on two machines is two products. Zira is the US English female voice
present on essentially every Windows install; Hazel is the en-GB equivalent and
is the fallback. If neither exists, this REFUSES rather than silently speaking
in whatever voice happened to be first in the list — a male voice appearing
without explanation is a bug the user cannot diagnose.

THE STOP CONTRACT
-----------------
`StopSignal` is the one kill switch, and everything that can be interrupted
watches it: TTS purges, the microphone loop exits, and the bridge's own action
handlers refuse to start new work while it is tripped. It is deliberately a
process-wide object rather than a parameter threaded through call sites, because
a stop that only reaches the code that remembered to accept it is not a stop.
"""

from __future__ import annotations

import queue
import re
import threading
import time
from typing import Any, Callable

# ---------------------------------------------------------------- constants

# SAPI5 flags. Named because `Speak(text, 3)` at a call site is unreadable.
SVSF_ASYNC = 1
SVSF_PURGE_BEFORE_SPEAK = 2

# Whisper wants 16 kHz mono; webrtcvad accepts only 8/16/32/48 kHz. 16 kHz is
# the one value that satisfies both without resampling in between.
SAMPLE_RATE = 16_000
FRAME_MS = 30
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000

# What counts as the user interrupting. Kept SHORT and closed on purpose: this
# list runs against a hasty transcription of a word shouted over the top of
# speech, so every entry must be a word nobody says by accident mid-sentence.
STOP_WORDS = ("stop", "wait", "cancel", "halt", "abort", "quiet", "shut up", "enough")
_STOP_RE = re.compile(r"\b(" + "|".join(w.replace(" ", r"\s+") for w in STOP_WORDS) + r")\b", re.I)


#: An interruption is SHOUTED, not composed. Nobody cancels a running task with
#: a subordinate clause, so a long transcription is somebody talking — to a
#: colleague, to the room, or dictating text that happens to discuss stopping.
MAX_STOP_WORDS = 4


def is_stop_phrase(text: str) -> bool:
    """True when a transcription is the user asking OCADE to stop.

    TWO GATES, AND BOTH ARE NEEDED.

    Substring matching would be wrong — "stop" is inside "stopped" and
    "unstoppable" — so the pattern is word-boundary anchored. But that alone
    still fires on "write a note about when to stop", which is a task
    INSTRUCTION containing the word, not an interruption. So length gates it
    too: an interruption is a handful of words at most.

    The barge-in listener also refuses segments longer than ~2.5 seconds, but
    that guard lives in the caller and this function is called from more than
    one place. A safety predicate that is only correct when its caller
    remembers to help is not a safety predicate.
    """
    if not text or not _STOP_RE.search(text):
        return False
    return len(text.split()) <= MAX_STOP_WORDS


# ------------------------------------------------------------- stop signal


class StopSignal:
    """The single kill switch, shared by speech, microphone and PC control.

    Callbacks fire on the thread that trips it, in registration order, and each
    is isolated: a listener that raises must not prevent the ones after it from
    running, because the ones after it may be the mouse letting go of a button.
    """

    def __init__(self) -> None:
        self._event = threading.Event()
        self._callbacks: list[Callable[[], None]] = []
        self._lock = threading.Lock()
        self.reason: str | None = None
        self.at: float | None = None

    def on_stop(self, callback: Callable[[], None]) -> None:
        with self._lock:
            self._callbacks.append(callback)

    def trip(self, reason: str = "stop requested") -> None:
        with self._lock:
            if self._event.is_set():
                return
            self.reason = reason
            self.at = time.time()
            self._event.set()
            callbacks = list(self._callbacks)
        for callback in callbacks:
            try:
                callback()
            except Exception:  # noqa: BLE001, S110
                # Deliberately swallowed. See the class docstring: one broken
                # listener must not strand a held mouse button.
                pass

    def clear(self) -> None:
        with self._lock:
            self._event.clear()
            self.reason = None
            self.at = None

    def is_set(self) -> bool:
        return self._event.is_set()

    def raise_if_stopped(self) -> None:
        """For long-running work to call between units of work."""
        if self._event.is_set():
            raise Interrupted(self.reason or "Stopped.")


class Interrupted(RuntimeError):
    """Raised inside a loop that noticed the stop signal."""


# The process-wide instance. One switch, so a stop from the microphone, from the
# Node agent and from the fast router all mean the same thing.
STOP = StopSignal()


# --------------------------------------------------------------------- TTS


class ZiraVoice:
    """Windows SAPI5 speech, fixed to the built-in English female voice."""

    #: Preference order. US English female first, en-GB female as the fallback.
    #:
    #: THE VOICE IS FEMALE, AND THAT IS A PRODUCT DECISION, NOT A DEFAULT.
    #: It is not exposed as a setting and there is no code path that selects a
    #: male voice: a spoken assistant that sounds different on two machines is
    #: two products, and "which voice" is exactly the kind of choice that turns
    #: a coherent identity into a preferences page. Both names below are female
    #: voices that ship with Windows, so the fallback never changes the
    #: character — only the accent.
    #:
    #: `_engine` REFUSES rather than falling back to whatever SAPI offers
    #: first, because the first installed voice is frequently David, and a
    #: silent substitution is how a fixed decision quietly stops being one.
    PREFERRED = ("Zira", "Hazel")

    def __init__(self, rate: int = 0, volume: int = 100) -> None:
        self._lock = threading.Lock()
        self._voice = None
        self._rate = rate
        self._volume = volume

    def _engine(self):
        if self._voice is not None:
            return self._voice
        try:
            import pythoncom  # noqa: PLC0415
            import win32com.client  # noqa: PLC0415
        except Exception as error:  # noqa: BLE001
            raise VoiceUnavailable(
                "Windows speech needs pywin32, which is not installed in this "
                "Python environment."
            ) from error

        # SAPI is COM. A thread that speaks without initialising its own
        # apartment gets an opaque failure rather than an error that names the
        # cause, and the barge-in listener speaks from a worker thread.
        try:
            pythoncom.CoInitialize()
        except Exception:  # noqa: BLE001, S110
            pass

        voice = win32com.client.Dispatch("SAPI.SpVoice")
        tokens = list(voice.GetVoices())
        available = [token.GetDescription() for token in tokens]

        # PREFERENCE ORDER, NOT FIRST MATCH.
        #
        # The first version scanned the voice list once and took whatever
        # matched any preferred name. On this machine SAPI returns
        # [Hazel (en-GB), Zira (en-US)], so it selected Hazel — the fallback —
        # while reporting success. The outer loop has to be the PREFERENCE, with
        # the machine's voice list scanned once per preference.
        chosen = None
        for wanted in self.PREFERRED:
            for token, description in zip(tokens, available):
                if wanted in description:
                    chosen = token
                    break
            if chosen is not None:
                break

        if chosen is None:
            raise VoiceUnavailable(
                "No built-in English female voice (Zira or Hazel) is installed on "
                "this computer. Add one under Settings → Time & language → Speech. "
                f"Voices present: {', '.join(available) or 'none'}."
            )
        voice.Voice = chosen
        voice.Rate = self._rate
        voice.Volume = self._volume
        self._voice = voice
        return voice

    @property
    def description(self) -> str:
        return self._engine().Voice.GetDescription()

    def say(self, text: str, *, block: bool = False) -> dict[str, Any]:
        """Speak. Asynchronous by default, because speech that blocks cannot be
        interrupted by the listener that is supposed to interrupt it."""
        if not text or not text.strip():
            raise VoiceUnavailable("There is nothing to say.")
        engine = self._engine()
        with self._lock:
            STOP.clear()
            engine.Speak(text, SVSF_ASYNC)
        if block:
            self.wait()
        return {"spoken": text[:400], "voice": self.description, "async": not block}

    def wait(self, timeout: float = 300.0) -> bool:
        """Wait for speech to finish, returning False if stopped instead.

        WAITS FOR SPEECH TO START BEFORE WAITING FOR IT TO END. `Speak` with
        SVSFlagsAsync returns before SAPI has spun up its audio thread, so
        `RunningState` is still idle for a few tens of milliseconds afterwards.
        Polling only for "finished" therefore returned instantly and reported a
        sentence as fully spoken before a single word had been played.
        """
        deadline = time.monotonic() + timeout
        start_by = time.monotonic() + 1.0
        while time.monotonic() < start_by:
            if STOP.is_set():
                return False
            if self.speaking:
                break
            time.sleep(0.02)

        while time.monotonic() < deadline:
            if STOP.is_set():
                return False
            if not self.speaking:
                return True
            time.sleep(0.05)
        return not self.speaking

    @property
    def speaking(self) -> bool:
        try:
            # RunningState 2 == SRSEIsSpeaking.
            return int(self._engine().Status.RunningState) == 2
        except Exception:  # noqa: BLE001
            return False

    def silence(self) -> None:
        """Cut speech mid-word. This is the barge-in primitive."""
        try:
            engine = self._engine()
            engine.Speak("", SVSF_ASYNC | SVSF_PURGE_BEFORE_SPEAK)
        except Exception:  # noqa: BLE001, S110
            pass


class VoiceUnavailable(RuntimeError):
    """Speech or hearing is not usable on this machine, with a reason."""


# --------------------------------------------------------------------- STT


class WhisperEars:
    """Offline transcription through faster-whisper (CTranslate2, no PyTorch).

    TWO SIZES, FOR TWO DIFFERENT JOBS. Barge-in asks one question — "did they
    just say stop?" — of a one-second buffer, many times a minute, and `tiny`
    answers it in a fraction of the time. Dictation asks for an accurate
    sentence once, and `base` is worth its extra latency there. Using one model
    for both would either make interruption sluggish or dictation poor.
    """

    def __init__(self, model_name: str = "base") -> None:
        self.model_name = model_name
        self._model = None
        self._lock = threading.Lock()

    def load(self):
        """Load the weights.

        THE ONE MOMENT THIS PIPELINE IS NOT OFFLINE. faster-whisper fetches the
        model from Hugging Face the first time a given size is requested and
        caches it under ~/.cache/huggingface. Every later run is local. This is
        called out rather than hidden because "works offline" and "downloads
        160 MB on first use" are both true and the user is entitled to both.
        """
        if self._model is not None:
            return self._model
        with self._lock:
            if self._model is not None:
                return self._model
            try:
                from faster_whisper import WhisperModel  # noqa: PLC0415
            except Exception as error:  # noqa: BLE001
                raise VoiceUnavailable(
                    "Speech recognition needs the 'faster-whisper' package, which "
                    "is not installed in this Python environment."
                ) from error
            # int8 on CPU: this runs on the same machines the 3B model targets,
            # where float16 has no hardware to run on.
            self._model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
            return self._model

    def transcribe(self, samples, language: str = "en") -> str:
        """Turn float32 mono 16 kHz audio into text."""
        model = self.load()
        segments, _info = model.transcribe(
            samples,
            language=language,
            beam_size=1,
            # The pipeline has already gated on speech with webrtcvad, so
            # Whisper's own VAD would only re-litigate the decision more slowly.
            vad_filter=False,
            condition_on_previous_text=False,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()


# --------------------------------------------------------- microphone + VAD


class MicState:
    """Whether OCADE may open the microphone at all, and which one.

    OFF MEANS THE STREAM IS CLOSED, NOT IGNORED. A muted-but-open microphone is
    still a microphone: the OS shows the in-use indicator, the device stays
    claimed so nothing else can take it, and the only thing standing between the
    room and a transcript is a boolean somebody could get wrong. Releasing the
    stream makes "off" a fact about the hardware rather than a promise about the
    code, and the indicator going dark is how the user can check it.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._enabled = False
        self._device: int | None = None
        self._listeners: list[Callable[[bool], None]] = []

    def on_change(self, callback: Callable[[bool], None]) -> None:
        with self._lock:
            self._listeners.append(callback)

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def device(self) -> int | None:
        return self._device

    def set_device(self, device: int | None) -> None:
        with self._lock:
            self._device = device

    def set(self, enabled: bool) -> bool:
        with self._lock:
            if self._enabled == enabled:
                return self._enabled
            self._enabled = enabled
            listeners = list(self._listeners)
        for listener in listeners:
            try:
                listener(enabled)
            except Exception:  # noqa: BLE001, S110
                # One broken listener must not leave the mic state half-applied.
                pass
        return enabled

    def require(self) -> None:
        if not self._enabled:
            raise VoiceUnavailable(
                "The microphone is off. Turn it on in Control + Work before OCADE can listen."
            )


#: Process-wide, for the same reason STOP is: a microphone that is off for some
#: callers and on for others is not off.
MIC = MicState()


def list_input_devices() -> list[dict[str, Any]]:
    """Every microphone this machine can record from.

    Reports what the audio layer ACTUALLY offers rather than a curated list, so
    a Bluetooth headset that is paired but not connected simply is not here —
    which is the honest answer to "why can't I pick my earbuds".
    """
    try:
        import sounddevice as sd  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise VoiceUnavailable(
            "Listing microphones needs the 'sounddevice' package, which is not "
            "installed in this Python environment."
        ) from error

    try:
        default_input = sd.default.device[0]
    except Exception:  # noqa: BLE001
        default_input = None

    devices: list[dict[str, Any]] = []
    for index, info in enumerate(sd.query_devices()):
        if int(info.get("max_input_channels", 0)) <= 0:
            continue
        devices.append(
            {
                "id": index,
                "name": str(info.get("name", f"Input {index}"))[:120],
                "channels": int(info.get("max_input_channels", 0)),
                "sampleRate": int(info.get("default_samplerate", 0) or 0),
                "isDefault": index == default_input,
                "isSelected": index == MIC.device,
            }
        )
    return devices


class Microphone:
    """A 16 kHz mono input stream delivering fixed-size frames to a queue."""

    def __init__(self, device: int | None = None) -> None:
        self.device = device
        self._queue: queue.Queue = queue.Queue()
        self._stream = None

    def __enter__(self):
        try:
            import sounddevice as sd  # noqa: PLC0415
        except Exception as error:  # noqa: BLE001
            raise VoiceUnavailable(
                "Listening needs the 'sounddevice' package, which is not "
                "installed in this Python environment."
            ) from error

        def on_audio(indata, _frames, _time, status):  # noqa: ANN001
            if status:
                return
            self._queue.put(bytes(indata))

        try:
            self._stream = sd.RawInputStream(
                samplerate=SAMPLE_RATE,
                blocksize=FRAME_SAMPLES,
                device=self.device,
                dtype="int16",
                channels=1,
                callback=on_audio,
            )
            self._stream.start()
        except Exception as error:  # noqa: BLE001
            raise VoiceUnavailable(
                f"No usable microphone: {error}. Check Windows privacy settings "
                "allow microphone access for desktop apps."
            ) from error
        return self

    def __exit__(self, *_exc) -> None:
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:  # noqa: BLE001, S110
                pass
            self._stream = None

    def frames(self, timeout: float = 0.5):
        while True:
            try:
                yield self._queue.get(timeout=timeout)
            except queue.Empty:
                yield None


def _vad():
    try:
        import webrtcvad  # noqa: PLC0415
    except Exception as error:  # noqa: BLE001
        raise VoiceUnavailable(
            "Voice activity detection needs the 'webrtcvad-wheels' package, "
            "which is not installed in this Python environment."
        ) from error
    # Aggressiveness 2 of 0-3. Chosen for a room with a fan and a laptop
    # speaker: 3 clips the start of quiet words, 1 treats keyboard noise as
    # speech and wakes Whisper constantly.
    return webrtcvad.Vad(2)


def _to_float32(raw: bytes):
    import numpy as np  # noqa: PLC0415

    return np.frombuffer(raw, dtype=np.int16).astype("float32") / 32768.0


# ------------------------------------------------------------- the pipeline


def listen_once(
    *,
    ears: WhisperEars,
    silence_ms: int = 800,
    max_ms: int = 15_000,
    device: int | None = None,
) -> dict[str, Any]:
    """Record one utterance, end it on silence, and transcribe it.

    Ends on SILENCE rather than a fixed duration, because a fixed window either
    truncates a long sentence or makes a short one wait — and the user cannot
    tell which they are getting until it has already gone wrong.
    """
    MIC.require()
    vad = _vad()
    collected: list[bytes] = []
    quiet_for = 0
    started = time.monotonic()
    heard_speech = False

    with Microphone(device if device is not None else MIC.device) as mic:
        for frame in mic.frames():
            if STOP.is_set():
                return {"text": "", "stopped": True, "detail": "Listening was stopped."}
            if not MIC.enabled:
                return {"text": "", "stopped": True, "detail": "The microphone was turned off."}
            if (time.monotonic() - started) * 1000 > max_ms:
                break
            if frame is None:
                continue
            speech = vad.is_speech(frame, SAMPLE_RATE)
            if speech:
                heard_speech = True
                quiet_for = 0
                collected.append(frame)
            elif heard_speech:
                quiet_for += FRAME_MS
                collected.append(frame)
                if quiet_for >= silence_ms:
                    break

    if not collected:
        return {"text": "", "stopped": False, "detail": "Nothing was said."}

    text = ears.transcribe(_to_float32(b"".join(collected)))
    return {
        "text": text,
        "stopped": False,
        "seconds": round(len(collected) * FRAME_MS / 1000, 2),
        "detail": f"Heard: {text}" if text else "Speech was detected but not understood.",
    }


class BargeInListener:
    """Listens WHILE OCADE speaks or works, and trips STOP on a stop word.

    RUNS AS A DAEMON THREAD so that a crash in the audio stack can never keep
    the process alive after the work is done. It is a safety control, and a
    safety control that prevents shutdown is its own hazard.

    THE COST OF BEING WRONG IS ASYMMETRIC, and the tuning follows from that. A
    missed "stop" means the user says it again. A false "stop" kills work they
    asked for. So a segment is only tested when webrtcvad is confident enough to
    have collected several frames of real speech, and only exact stop WORDS
    count — not a sentence that happens to contain one.
    """

    def __init__(
        self,
        *,
        voice: ZiraVoice | None = None,
        model_name: str = "tiny",
        device: int | None = None,
        on_trip: Callable[[str], None] | None = None,
    ) -> None:
        self.voice = voice
        self.ears = WhisperEars(model_name)
        self.device = device
        self.on_trip = on_trip
        self._thread: threading.Thread | None = None
        self._running = threading.Event()
        self.last_heard: str = ""

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        # Pay the model load here, not on the first word. Loading inside the
        # loop would mean the very first "stop" — the one most likely to be
        # urgent — is the slowest one.
        self.ears.load()
        self._running.set()
        self._thread = threading.Thread(target=self._run, name="ocade-barge-in", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running.clear()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=2.0)
        self._thread = None

    @property
    def listening(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def _run(self) -> None:
        try:
            vad = _vad()
        except VoiceUnavailable:
            return
        segment: list[bytes] = []
        quiet = 0
        try:
            with Microphone(self.device if self.device is not None else MIC.device) as mic:
                for frame in mic.frames():
                    if not self._running.is_set():
                        return
                    # THE MIC SWITCH IS CHECKED INSIDE THE LOOP, and turning it
                    # off returns out of the `with` block — which closes the
                    # stream and releases the device. Merely skipping frames
                    # would leave the OS recording indicator lit while OCADE
                    # claimed not to be listening.
                    if not MIC.enabled:
                        return
                    if frame is None:
                        continue
                    if vad.is_speech(frame, SAMPLE_RATE):
                        segment.append(frame)
                        quiet = 0
                        continue
                    if not segment:
                        continue
                    quiet += FRAME_MS
                    segment.append(frame)
                    # ~300 ms of quiet closes a shouted word without waiting the
                    # full utterance timeout an ordinary dictation would use.
                    if quiet < 300:
                        continue

                    # Too short to be a word, or long enough to be a sentence
                    # the user is speaking to somebody else. Either way, not an
                    # interruption.
                    duration_ms = len(segment) * FRAME_MS
                    if 200 <= duration_ms <= 2500:
                        self._consider(b"".join(segment))
                    segment, quiet = [], 0
        except VoiceUnavailable:
            return

    def _consider(self, raw: bytes) -> None:
        try:
            text = self.ears.transcribe(_to_float32(raw))
        except Exception:  # noqa: BLE001
            return
        if not text:
            return
        self.last_heard = text
        if is_stop_phrase(text):
            self.trip(f"heard “{text.strip()}”")

    def trip(self, reason: str) -> None:
        """Silence speech FIRST, then tell everything else."""
        if self.voice is not None:
            self.voice.silence()
        STOP.trip(reason)
        if self.on_trip is not None:
            try:
                self.on_trip(reason)
            except Exception:  # noqa: BLE001, S110
                pass
