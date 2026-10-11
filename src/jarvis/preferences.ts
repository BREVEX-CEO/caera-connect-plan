/** Per-device JARVIS choices. Losing them is an inconvenience, never data loss. */
export interface JarvisPreferences {
  accent: string | null;
  railExpanded: boolean;
  wake: boolean;
  /** Read answers aloud while voice is on. Off keeps answers text-only. */
  speak: boolean;
}

const KEY = "ocade:jarvis:v1";
const DEFAULTS: JarvisPreferences = {
  accent: null,
  railExpanded: false,
  wake: false,
  speak: true,
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
    };
  } catch {
    return DEFAULTS;
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
