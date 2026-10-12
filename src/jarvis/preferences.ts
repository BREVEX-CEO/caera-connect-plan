import { useEffect, useState } from "react";

/** Per-device JARVIS choices. Losing them is an inconvenience, never data loss. */
export interface JarvisPreferences {
  accent: string | null;
  railExpanded: boolean;
  wake: boolean;
  /** Read answers aloud while voice is on. Off keeps answers text-only. */
  speak: boolean;
  /** The device voice answers are read in (its voiceURI); null is the browser's own default. */
  voice: string | null;
}

const KEY = "ocade:jarvis:v1";
export const JARVIS_DEFAULTS: JarvisPreferences = {
  accent: null,
  railExpanded: false,
  wake: false,
  speak: true,
  voice: null,
};

export function readPreferences(): JarvisPreferences {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<JarvisPreferences>;
    return {
      accent:
        typeof raw.accent === "string" && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : null,
      railExpanded: raw.railExpanded === true,
      wake: raw.wake === true,
      speak: raw.speak !== false,
      voice: typeof raw.voice === "string" && raw.voice.length <= 300 ? raw.voice : null,
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
