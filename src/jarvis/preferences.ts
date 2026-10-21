import { useEffect, useState } from "react";

/** Per-device JARVIS choices. Losing them is an inconvenience, never data loss. */
export interface JarvisPreferences {
  railExpanded: boolean;
  wake: boolean;
  /** Read answers aloud while voice is on. Off keeps answers text-only. */
  speak: boolean;
  /** The device voice answers are read in (its voiceURI); null is the browser's own default. */
  voice: string | null;
  /** The computer new tasks go to when several are connected; null lets OCADE choose. */
  target: string | null;
}

const KEY = "ocade:jarvis:v1";
export const JARVIS_DEFAULTS: JarvisPreferences = {
  railExpanded: false,
  wake: false,
  speak: true,
  voice: null,
  target: null,
};

export function readPreferences(): JarvisPreferences {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<JarvisPreferences>;
    return {
      railExpanded: raw.railExpanded === true,
      wake: raw.wake === true,
      speak: raw.speak !== false,
      voice: typeof raw.voice === "string" && raw.voice.length <= 300 ? raw.voice : null,
      target: typeof raw.target === "string" && raw.target.length <= 64 ? raw.target : null,
    };
  } catch {
    return JARVIS_DEFAULTS;
  }
}

/** Fired when any surface changes them, so an open JARVIS page follows Settings at once. */
export const PREFERENCES_CHANGED = "ocade:jarvis-preferences";

export function writePreferences(prefs: JarvisPreferences): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* A blocked store only means the choice is not remembered. */
  }
  window.dispatchEvent(new Event(PREFERENCES_CHANGED));
}

/** The stored choices, following every change from any surface (Settings, a reset, the page). */
export function useJarvisPreferences(): JarvisPreferences {
  const [prefs, setPrefs] = useState(JARVIS_DEFAULTS);
  useEffect(() => {
    const follow = () => setPrefs(readPreferences());
    follow();
    window.addEventListener(PREFERENCES_CHANGED, follow);
    return () => window.removeEventListener(PREFERENCES_CHANGED, follow);
  }, []);
  return prefs;
}
