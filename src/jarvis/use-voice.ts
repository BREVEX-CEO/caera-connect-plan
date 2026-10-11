/**
 * JARVIS voice: the browser's own recogniser and speech, one shared context
 * with typing, and explicit Interrupt, Pause, Continue and End.
 *
 * From the original runtime's voice design: the microphone is not listening
 * while JARVIS speaks, and for a short echo tail after (core/echo.py), so it
 * never answers itself; and a wake phrase gates what is sent (core/wake_word.py).
 *
 * WAKE IS LOCAL OR IT IS OFF. Waiting for "Hey OCADE" means listening before
 * anyone asked, so that listening must never leave the device. The wake mode
 * runs only on a recogniser that processes on the device; where the browser has
 * none, "Hey OCADE" is unavailable rather than quietly streamed to a service.
 * Pressing Voice is the person asking, so ordinary voice may use the browser's
 * standard recogniser.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  processLocally?: boolean;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = (new () => Recognition) & {
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">;
};

const ECHO_TAIL_MS = 600;
/** "OCADE" on its own or after "Hey", however the recogniser spells it ("O cade", "O'Kade"). */
const WAKE = /^\s*(?:(?:hey|hi)[,\s]+)?o[\s'-]?[ck]ade\b[,.!\s]*/i;

function recogniser(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type VoiceState = "off" | "starting" | "listening" | "speaking" | "paused";

export interface JarvisVoice {
  /** Speech can be heard here (input). */
  supported: boolean;
  /** Answers can be spoken here (output); without it they stay text. */
  speaks: boolean;
  /** True only where "Hey OCADE" can be heard without audio leaving the device. */
  wakeLocal: boolean;
  state: VoiceState;
  level: number;
  error: string | null;
  start(): Promise<void>;
  speak(text: string): void;
  interrupt(): void;
  pause(): void;
  resume(): void;
  end(): void;
}

/** Only what follows "Hey OCADE" when the wake phrase is on; everything otherwise. */
export function heard(transcript: string, wake: boolean): string | null {
  const said = transcript.trim();
  if (!said) return null;
  if (!wake) return said;
  const match = WAKE.exec(said);
  return match ? said.slice(match[0].length).trim() || null : null;
}

export type VoiceCommand = "stop" | "pause" | "continue" | "end";

/** A spoken control word, said on its own, or null for anything to send. */
export function voiceCommand(text: string): VoiceCommand | null {
  const said = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
  if (/^(stop|stop jarvis|stop the task)$/.test(said)) return "stop";
  if (/^(pause|pause voice)$/.test(said)) return "pause";
  if (/^(continue|carry on|resume)$/.test(said)) return "continue";
  if (/^(cancel|end voice|stop listening|goodbye)$/.test(said)) return "end";
  return null;
}

export function useJarvisVoice(onHeard: (text: string) => void, wake: boolean): JarvisVoice {
  const [supported, setSupported] = useState(false);
  const [speaks, setSpeaks] = useState(false);
  const [wakeLocal, setWakeLocal] = useState(false);
  const [state, setState] = useState<VoiceState>("off");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const meter = useRef(0);
  // Each voice session and each utterance has its own number: a late callback from an
  // ended one finds a newer number and does nothing (no second microphone, no echo).
  const session = useRef(0);
  const utterances = useRef(0);
  const stateRef = useRef<VoiceState>("off");
  const endRef = useRef<() => void>(() => undefined);
  const deliver = useRef(onHeard);
  deliver.current = onHeard;
  const wakeRef = useRef(wake);
  wakeRef.current = wake;

  const set = (next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  };

  useEffect(() => {
    const Recogniser = recogniser();
    // Hearing and speaking are separate: without speech output, answers stay text.
    setSupported(Recogniser !== null);
    setSpeaks("speechSynthesis" in window);
    void Recogniser?.available?.({ langs: [navigator.language || "en-US"], processLocally: true })
      .then((answer) => setWakeLocal(answer === "available"))
      .catch(() => setWakeLocal(false));
  }, []);
  const wakeLocalRef = useRef(wakeLocal);
  wakeLocalRef.current = wakeLocal;

  const listen = useCallback((): boolean => {
    const Recogniser = recogniser();
    // Every way into listening (a restart after silence, the end of speech, Continue) checks
    // here: after End, Pause or leaving, a late timer cannot open the microphone again.
    if (!Recogniser || stateRef.current !== "listening") return false;
    if (recognition.current) return true;
    const r = new Recogniser();
    // Waiting for the wake phrase happens on the device, or not at all.
    // A browser without one ignores the wake choice: pressing Voice already asked.
    if (wakeRef.current && wakeLocalRef.current) r.processLocally = true;
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";
    r.onresult = (event) => {
      for (let at = event.resultIndex; at < event.results.length; at += 1) {
        const result = event.results[at]!;
        if (!result.isFinal) continue;
        const text = heard(result[0].transcript, wakeRef.current && wakeLocalRef.current);
        if (text) deliver.current(text);
      }
    };
    r.onerror = (event) => {
      // Silence and our own aborts are routine; anything else ends voice and says why,
      // rather than restarting a recogniser that cannot work.
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was refused."
          : "Speech recognition is not available right now. You can still type.",
      );
      endRef.current();
    };
    r.onend = () => {
      recognition.current = null;
      // The recogniser ends on its own after silence; keep listening while voice is on.
      if (stateRef.current === "listening") window.setTimeout(listen, 300);
    };
    try {
      r.start();
      recognition.current = r;
      return true;
    } catch {
      recognition.current = null;
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onend = null;
      r.abort();
    }
  }, []);

  // Turning the wake phrase on or off restarts listening under the new rule, so a
  // recogniser started for ordinary voice never keeps listening for the wake phrase.
  useEffect(() => {
    if (stateRef.current !== "listening") return;
    stopListening();
    listen();
  }, [wake, wakeLocal, listen, stopListening]);

  const start = useCallback(async () => {
    setError(null);
    const mine = ++session.current;
    set("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Ended (End, sign-out, leaving) or started again while the permission prompt was
      // open: this session's microphone is released at once instead of left running.
      if (session.current !== mine) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const context = new AudioContext();
      audio.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let lastPaint = 0;
      const sample = (now: number) => {
        if (session.current !== mine) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        meter.current = Math.min(1, Math.sqrt(sum / data.length) * 4);
        if (now - lastPaint > 66) {
          lastPaint = now;
          setLevel(
            stateRef.current === "listening"
              ? meter.current
              : stateRef.current === "speaking"
                ? 0.35
                : 0,
          );
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    } catch {
      if (session.current !== mine) return; // a newer session owns the microphone now
      // Whatever part started is released; nothing keeps the microphone.
      endRef.current();
      setError("Microphone access was refused.");
      return;
    }
    set("listening");
    if (!listen()) {
      endRef.current();
      setError("Speech recognition is not available right now. You can still type.");
    }
  }, [listen]);

  const speak = useCallback(
    (text: string) => {
      if (stateRef.current === "off" || !("speechSynthesis" in window)) return;
      stopListening();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      const spoken = ++utterances.current;
      utterance.onend = () => {
        if (utterances.current !== spoken || stateRef.current !== "speaking") return;
        window.setTimeout(() => {
          if (utterances.current !== spoken || stateRef.current !== "speaking") return;
          set("listening");
          listen();
        }, ECHO_TAIL_MS);
      };
      set("speaking");
      window.speechSynthesis.speak(utterance);
    },
    [listen, stopListening],
  );

  const interrupt = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (stateRef.current !== "off") {
      set("listening");
      listen();
    }
  }, [listen]);

  const pause = useCallback(() => {
    if (stateRef.current === "speaking") window.speechSynthesis.pause();
    stopListening();
    set("paused");
  }, [stopListening]);

  const resume = useCallback(() => {
    if (stateRef.current !== "paused") return;
    // Hearing works without speaking: a browser with no speech output just listens again.
    if ("speechSynthesis" in window && window.speechSynthesis.paused) {
      set("speaking");
      window.speechSynthesis.resume();
    } else {
      set("listening");
      listen();
    }
  }, [listen]);

  const end = useCallback(() => {
    session.current += 1;
    utterances.current += 1;
    set("off");
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    stopListening();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
    meter.current = 0;
    setLevel(0);
  }, [stopListening]);

  endRef.current = end;

  // Leaving the page ends voice: no microphone outlives the screen.
  useEffect(() => () => end(), [end]);

  return {
    supported,
    speaks,
    wakeLocal,
    state,
    level,
    error,
    start,
    speak,
    interrupt,
    pause,
    resume,
    end,
  };
}
