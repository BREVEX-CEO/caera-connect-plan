import { useCallback, useEffect, useRef, useState } from "react";
import { speechRecognitionAvailable } from "./speech-capabilities";

/**
 * Dictation for the composer: speak, see it typed, send.
 *
 * WHY INTERIM RESULTS MATTER. With `interimResults` off, the field stays empty
 * until the recogniser decides you have finished, which on a long sentence is
 * several seconds of a microphone button that looks broken. Interim text
 * appears as you speak and is replaced by the final transcript when it lands.
 *
 * WHY IT DOES NOT AUTO-SEND. It would be one line, and it would be wrong: the
 * recogniser mishears names, punctuation and numbers constantly, and a message
 * that sends itself gives the user no moment to fix it. Dictation fills the
 * composer; the person still presses send. `autoSend` exists for a caller that
 * genuinely wants hands-free, and is off by default.
 *
 * EVERY FAILURE IS NAMED. A denied microphone, no microphone at all, and a
 * network recogniser that could not be reached are three different problems
 * with three different fixes, and "dictation failed" helps with none of them.
 */

export type DictationState =
  | "unsupported"
  | "idle"
  /** Microphone open, nothing heard yet. */
  | "listening"
  /** Words are arriving. */
  | "hearing"
  | "error";

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
  length: number;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  error: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

/** Turn the recogniser's error codes into something a person can act on. */
function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "OCADE needs permission to use your microphone. Allow it in your browser's address bar, then try again.";
    case "audio-capture":
      return "No microphone was found. Check that one is connected and selected in your system settings.";
    case "network":
      // Worth its own sentence: this is the one that surprises people on a
      // product that advertises working offline.
      return "Speech recognition in this browser needs a connection, and OCADE could not reach it. Typing still works offline.";
    case "no-speech":
      return "OCADE did not hear anything. Try again a little closer to the microphone.";
    case "aborted":
      return "Dictation stopped.";
    default:
      return "Dictation stopped unexpectedly. Try again, or type instead.";
  }
}

export function useDictation(options: {
  /** BCP-47 tag, e.g. `hi-IN`. Changing it applies to the next start. */
  lang: string;
  /** Called with the transcript as it grows, final or interim. */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Fire when a final transcript lands. Off by default, deliberately. */
  autoSend?: boolean;
  onAutoSend?: (text: string) => void;
}): {
  state: DictationState;
  error: string | null;
  supported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
} {
  const { lang, onTranscript, autoSend = false, onAutoSend } = options;
  const [state, setState] = useState<DictationState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  // Held in refs so a changing handler does not tear down an open microphone.
  const transcriptRef = useRef(onTranscript);
  const autoSendRef = useRef(onAutoSend);
  const langRef = useRef(lang);
  transcriptRef.current = onTranscript;
  autoSendRef.current = onAutoSend;
  langRef.current = lang;

  const supported = typeof window !== "undefined" && speechRecognitionAvailable(window);

  useEffect(() => {
    if (!supported) setState("unsupported");
  }, [supported]);

  // A microphone left open after the component unmounts keeps the browser's
  // recording indicator lit, which reads as the product spying.
  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState((prev) => (prev === "unsupported" ? prev : "idle"));
  }, []);

  const start = useCallback(() => {
    if (!supported || recognitionRef.current) return;
    setError(null);

    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      (new () => RecognitionLike) | undefined;
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = langRef.current;
    // Continuous keeps the microphone open across pauses, which is what a
    // person dictating a paragraph expects.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      const combined = (finalText + interimText).trim();
      if (combined) setState("hearing");
      transcriptRef.current(combined, finalText.length > 0 && interimText.length === 0);
      if (autoSend && finalText.trim() && !interimText) {
        autoSendRef.current?.(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      // `aborted` is what `stop()` produces; surfacing it as an error would
      // make every deliberate stop look like a failure.
      if (event.error === "aborted") return;
      setError(describeError(event.error));
      setState("error");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setState((prev) => (prev === "error" || prev === "unsupported" ? prev : "idle"));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Calling start() twice throws. Treat as already listening rather than
      // as a failure the user should read about.
      setState("listening");
    }
  }, [supported, autoSend]);

  const toggle = useCallback(() => {
    if (recognitionRef.current) stop();
    else start();
  }, [start, stop]);

  return { state, error, supported, start, stop, toggle };
}
