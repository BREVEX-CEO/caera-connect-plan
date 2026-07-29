import { useCallback, useState } from "react";
import type { AddressStyle, VoiceGender } from "./ocade-voice";

/**
 * OCADE Voice preferences (Plan §22, decisions #22-#27).
 *
 * Device-scoped and stored locally: captions and voice choices are properties
 * of *this* browser profile. Preference storage itself needs no server
 * round-trip. The browser's speech-recognition engine may still use an online
 * service; that boundary is reported separately by the voice capability probe.
 *
 * Defaults encode the confirmed decisions:
 *  - no assumed voice — the user picks (gender starts `unknown`);
 *  - address by first name with NO title, never inferred;
 *  - wake phrase OFF by default (push-to-talk is the default input).
 */
export interface VoicePrefs {
  /** Chosen OCADE voice. "unknown" means the user hasn't picked yet. */
  gender: VoiceGender;
  /** Exact platform voice name once chosen, for stable playback. */
  voiceName: string | null;
  rate: number;
  pitch: number;
  language: string;
  /** Opt-in local wake phrase (decision #23). */
  wakeEnabled: boolean;
  /** Live captions for spoken replies. */
  captionsEnabled: boolean;
  /** Speak replies aloud automatically. */
  autoSpeak: boolean;
  /** Hard mute — emergency stop for all speech output. */
  muted: boolean;
  addressStyle: AddressStyle;
  preferredName: string;
  /** Free-text honorific the USER supplies; never inferred (decision #26). */
  preferredTitle: string;
  greetingEnabled: boolean;
  /** Selected input device id, "" = system default. */
  microphoneId: string;
  outputId: string;
}

export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  gender: "unknown",
  voiceName: null,
  rate: 1,
  pitch: 1,
  language: "en-US",
  wakeEnabled: false,
  captionsEnabled: true,
  autoSpeak: false,
  muted: false,
  addressStyle: "first_name",
  preferredName: "",
  preferredTitle: "",
  greetingEnabled: true,
  microphoneId: "",
  outputId: "",
};

const KEY = "caera:voice:v1";
const MAX_DEVICE_ID = 160;

type VoiceStorage = Pick<Storage, "setItem">;
type SaveVoicePrefsResult = { ok: true } | { ok: false; reason: string };

function clampNumber(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
}

/** Merge stored JSON over defaults, rejecting malformed values. */
export function parseVoicePrefs(raw: string | null): VoicePrefs {
  if (!raw) return { ...DEFAULT_VOICE_PREFS };
  try {
    const p = JSON.parse(raw) as Partial<VoicePrefs>;
    const bool = <K extends keyof VoicePrefs>(key: K): VoicePrefs[K] =>
      (typeof p[key] === "boolean" ? p[key] : DEFAULT_VOICE_PREFS[key]) as VoicePrefs[K];
    const boundedString = (value: unknown, fallback: string, max: number) =>
      typeof value === "string" ? value.slice(0, max) : fallback;
    const addressStyles: AddressStyle[] = ["first_name", "full_name", "custom_title", "none"];
    const language =
      typeof p.language === "string" &&
      /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(p.language) &&
      p.language.length <= 35
        ? p.language
        : DEFAULT_VOICE_PREFS.language;
    return {
      gender: p.gender === "male" || p.gender === "female" ? p.gender : "unknown",
      voiceName:
        p.voiceName === null
          ? null
          : boundedString(p.voiceName, "", 160) || DEFAULT_VOICE_PREFS.voiceName,
      rate: clampNumber(p.rate, 0.5, 2, 1),
      pitch: clampNumber(p.pitch, 0.5, 2, 1),
      language,
      wakeEnabled: bool("wakeEnabled"),
      captionsEnabled: bool("captionsEnabled"),
      autoSpeak: bool("autoSpeak"),
      muted: bool("muted"),
      addressStyle: addressStyles.includes(p.addressStyle as AddressStyle)
        ? (p.addressStyle as AddressStyle)
        : DEFAULT_VOICE_PREFS.addressStyle,
      preferredName: typeof p.preferredName === "string" ? p.preferredName.slice(0, 80) : "",
      preferredTitle: typeof p.preferredTitle === "string" ? p.preferredTitle.slice(0, 40) : "",
      greetingEnabled: bool("greetingEnabled"),
      microphoneId: boundedString(p.microphoneId, DEFAULT_VOICE_PREFS.microphoneId, MAX_DEVICE_ID),
      outputId: boundedString(p.outputId, DEFAULT_VOICE_PREFS.outputId, MAX_DEVICE_ID),
    };
  } catch {
    return { ...DEFAULT_VOICE_PREFS };
  }
}

/** Persist one exact snapshot and report failure instead of implying success. */
export function saveVoicePrefs(storage: VoiceStorage, prefs: VoicePrefs): SaveVoicePrefsResult {
  try {
    storage.setItem(KEY, JSON.stringify(prefs));
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason:
        "OCADE couldn't save voice settings in this browser. The previous settings remain active.",
    };
  }
}

export function useVoicePrefs() {
  const [state, setState] = useState<{ prefs: VoicePrefs; storageError: string | null }>(() => {
    if (typeof window === "undefined") {
      return { prefs: { ...DEFAULT_VOICE_PREFS }, storageError: null };
    }
    try {
      return { prefs: parseVoicePrefs(window.localStorage.getItem(KEY)), storageError: null };
    } catch {
      return {
        prefs: { ...DEFAULT_VOICE_PREFS },
        storageError: "OCADE couldn't read voice settings from this browser.",
      };
    }
  });

  const update = useCallback((patch: Partial<VoicePrefs>) => {
    setState((current) => {
      const next = parseVoicePrefs(JSON.stringify({ ...current.prefs, ...patch }));
      if (typeof window === "undefined") return { prefs: next, storageError: null };
      const saved = saveVoicePrefs(window.localStorage, next);
      return saved.ok
        ? { prefs: next, storageError: null }
        : { prefs: current.prefs, storageError: saved.reason };
    });
  }, []);

  /** Emergency mute: stop speech immediately and keep it off. */
  const emergencyMute = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    update({ muted: true, autoSpeak: false });
  }, [update]);

  return { prefs: state.prefs, update, emergencyMute, storageError: state.storageError };
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

/**
 * Enumerate audio devices. Labels are only exposed by browsers after microphone
 * permission is granted, so unlabeled entries are reported honestly rather than
 * given invented names.
 */
export async function listAudioDevices(): Promise<{
  inputs: AudioDevice[];
  outputs: AudioDevice[];
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const map = (d: MediaDeviceInfo, i: number): AudioDevice => ({
      deviceId: d.deviceId,
      label: d.label || `Device ${i + 1} (name hidden until microphone access is allowed)`,
    });
    return {
      inputs: devices.filter((d) => d.kind === "audioinput").map(map),
      outputs: devices.filter((d) => d.kind === "audiooutput").map(map),
    };
  } catch {
    return { inputs: [], outputs: [] };
  }
}
