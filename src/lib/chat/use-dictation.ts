/**
 * SPEAKING INSTEAD OF TYPING, USING WHAT THE BROWSER ALREADY HAS.
 *
 * `SpeechRecognition` ships in the browsers OCADE targets. No dependency, no
 * upload, no audio leaving the device on OCADE's account — the browser does the
 * recognition and hands back text. Anything else would have meant a recorder, a
 * transport, a transcription service and a second privacy promise to keep, for
 * a control that writes into a text box.
 *
 * WHAT IT REFUSES TO DO. It does not exist where the API does not, and the
 * control says so rather than being present and inert: a microphone button
 * that does nothing when pressed is worse than no microphone button, because
 * somebody has to press it to find out.
 *
 * The transcript is appended to whatever is already in the composer, so
 * dictating after typing adds to the sentence rather than replacing it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => Recognition;

function available(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export interface Dictation {
  /** False where the browser has no recogniser. The control hides itself. */
  supported: boolean;
  listening: boolean;
  toggle(): void;
}

export function useDictation(onText: (text: string) => void): Dictation {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const session = useRef<Recognition | null>(null);
  // Held in a ref so starting a session does not capture a stale composer.
  const deliver = useRef(onText);
  deliver.current = onText;

  // Read after mount: the server has no `window`, and deciding on the server
  // would render a control the browser then disagrees about.
  useEffect(() => setSupported(available() !== null), []);

  // A session left running when the screen goes is a microphone left on.
  useEffect(() => () => session.current?.stop(), []);

  const toggle = useCallback(() => {
    if (session.current) {
      session.current.stop();
      return;
    }
    const Recogniser = available();
    if (!Recogniser) return;

    const recognition = new Recogniser();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let said = "";
      for (let at = event.resultIndex; at < event.results.length; at += 1) {
        const result = event.results[at]!;
        if (result.isFinal) said += result[0].transcript;
      }
      if (said.trim()) deliver.current(said.trim());
    };
    // An error and a normal end are the same thing here: the session is over,
    // and the composer keeps whatever was already transcribed.
    recognition.onerror = () => recognition.stop();
    recognition.onend = () => {
      session.current = null;
      setListening(false);
    };

    try {
      recognition.start();
      session.current = recognition;
      setListening(true);
    } catch {
      session.current = null;
      setListening(false);
    }
  }, []);

  return { supported, listening, toggle };
}
