/**
 * JARVIS voice: the browser's own recogniser and speech, one shared context
 * with typing, and explicit Interrupt, Pause, Continue and End.
 *
 * From the original runtime's voice design: the microphone is not listening
 * while JARVIS speaks, and for a short echo tail after (core/echo.py), so it
 * never answers itself; and a wake phrase gates what is sent (core/wake_word.py).
 * Here the phrase is "Hey OCADE", matched in the recogniser's transcript, and it
 * exists only where the browser has a recogniser.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
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
type RecognitionConstructor = new () => Recognition;

const ECHO_TAIL_MS = 600;
const WAKE = /^\s*(hey|hi)[,\s]+o\s?cade\b[,.!\s]*/i;

function recogniser(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type VoiceState = "off" | "listening" | "speaking" | "paused";

export interface JarvisVoice {
  supported: boolean;
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

export function useJarvisVoice(onHeard: (text: string) => void, wake: boolean): JarvisVoice {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<VoiceState>("off");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const meter = useRef(0);
  const stateRef = useRef<VoiceState>("off");
  const deliver = useRef(onHeard);
  deliver.current = onHeard;
  const wakeRef = useRef(wake);
  wakeRef.current = wake;

  const set = (next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  };

  useEffect(() => setSupported(recogniser() !== null && "speechSynthesis" in window), []);

  const listen = useCallback(() => {
    const Recogniser = recogniser();
    if (!Recogniser || recognition.current) return;
    const r = new Recogniser();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language || "en-US";
    r.onresult = (event) => {
      for (let at = event.resultIndex; at < event.results.length; at += 1) {
        const result = event.results[at]!;
        if (!result.isFinal) continue;
        const text = heard(result[0].transcript, wakeRef.current);
        if (text) deliver.current(text);
      }
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was refused.");
        set("off");
      }
    };
    r.onend = () => {
      recognition.current = null;
      // The recogniser ends on its own after silence; keep listening while voice is on.
      if (stateRef.current === "listening") window.setTimeout(listen, 300);
    };
    try {
      r.start();
      recognition.current = r;
    } catch {
      recognition.current = null;
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

  const start = useCallback(async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const context = new AudioContext();
      audio.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let lastPaint = 0;
      const sample = (now: number) => {
        if (!audio.current) return;
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
      setError("Microphone access was refused.");
      return;
    }
    set("listening");
    listen();
  }, [listen]);

  const speak = useCallback(
    (text: string) => {
      if (stateRef.current === "off" || !("speechSynthesis" in window)) return;
      stopListening();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      utterance.onend = () => {
        if (stateRef.current !== "speaking") return;
        window.setTimeout(() => {
          if (stateRef.current !== "speaking") return;
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
    if (window.speechSynthesis.paused) {
      set("speaking");
      window.speechSynthesis.resume();
    } else {
      set("listening");
      listen();
    }
  }, [listen]);

  const end = useCallback(() => {
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

  // Leaving the page ends voice: no microphone outlives the screen.
  useEffect(() => () => end(), [end]);

  return { supported, state, level, error, start, speak, interrupt, pause, resume, end };
}
