import { useCallback, useEffect, useRef, useState } from "react";

/*
 * JARVIS'S OWN VOICE: natural and female-presenting where the device has one (owner, 21 Oct).
 * Browsers do not say a voice's gender, so it is told by the device voices' published names
 * (Windows, macOS/iOS, Android/Chrome); a natural/online voice of the page's language comes
 * first. A device with none of them uses its own default. The person's choice always wins.
 */
const FEMALE_VOICE =
  /female|\b(aria|jenny|sonia|libby|natasha|clara|emma|ava|michelle|samantha|karen|moira|tessa|fiona|victoria|allison|susan|serena|zira|hazel|catherine|heera|neerja|swara)\b/i;
const NATURAL_VOICE = /natural|online|neural|enhanced|premium/i;

export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  chosen: string | null,
  lang: string,
): SpeechSynthesisVoice | null {
  const own = chosen ? voices.find((voice) => voice.voiceURI === chosen) : undefined;
  if (own) return own;
  const language = lang.toLowerCase().split("-")[0]!;
  const score = (voice: SpeechSynthesisVoice) =>
    (voice.lang.toLowerCase().startsWith(language) ? 4 : 0) +
    (FEMALE_VOICE.test(voice.name) ? 2 : 0) +
    (NATURAL_VOICE.test(voice.name) ? 1 : 0);
  const best = [...voices].sort((a, b) => score(b) - score(a))[0];
  return best && FEMALE_VOICE.test(best.name) ? best : null;
}


type RecognitionEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };

interface DictationRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  abort(): void;
}

function browserDictation() {
  const browser = window as Window & {
    SpeechRecognition?: new () => DictationRecognition;
    webkitSpeechRecognition?: new () => DictationRecognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

function stopRecognition(recognition: DictationRecognition | null) {
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;
  try {
    recognition.abort();
  } catch {
    // Some browsers already ended recognition before delivering onerror.
  }
}

export function useJarvisDictation(enabled: boolean, onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "starting" | "listening">("idle");
  const [error, setError] = useState<string | null>(null);
  const current = useRef<DictationRecognition | null>(null);


  const cancel = useCallback(() => {
    const recognition = current.current;
    current.current = null;
    stopRecognition(recognition);
    setState("idle");
  }, []);

  useEffect(() => {
    setSupported(enabled && Boolean(browserDictation()));
    if (!enabled) cancel();
    const hidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      const recognition = current.current;
      current.current = null;
      stopRecognition(recognition);
    };
  }, [enabled, cancel]);

  const start = () => {
    const Recognition = browserDictation();
    if (!enabled || !Recognition || current.current) return;
    const recognition = new Recognition();
    current.current = recognition;
    recognition.lang = document.documentElement.lang || navigator.language || "en";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      if (current.current === recognition) setState("listening");
    };
    recognition.onend = () => {
      if (current.current === recognition) {
        current.current = null;
        setState("idle");
      }
    };
    recognition.onresult = (event) => {
      if (current.current !== recognition) return;
      const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (transcript) onText(transcript);
    };
    recognition.onerror = ({ error: code }) => {
      if (current.current !== recognition) return;
      setError(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone or speech recognition permission is blocked. Check this site's browser permissions."
          : code === "audio-capture"
            ? "Your browser could not open a microphone."
            : code === "no-speech"
              ? "No speech was heard. Try again or type your message."
              : "Dictation is unavailable. You can still type your message.",
      );
      cancel();
    };
    setError(null);
    setState("starting");
    try {
      recognition.start();
    } catch {
      cancel();
      setError("Your browser could not start dictation.");
    }
  };

  return { supported, state, error, start, cancel };
}
