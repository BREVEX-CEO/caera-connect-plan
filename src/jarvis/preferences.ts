/** Per-device JARVIS choices. Losing them is an inconvenience, never data loss. */
export interface JarvisPreferences {
  accent: string | null;
  railExpanded: boolean;
  micAsked: boolean;
  wake: boolean;
}

const KEY = "ocade:jarvis:v1";
const DEFAULTS: JarvisPreferences = {
  accent: null,
  railExpanded: false,
  micAsked: false,
  wake: false,
};

export function readPreferences(): JarvisPreferences {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<JarvisPreferences>;
    return {
      accent:
        typeof raw.accent === "string" && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : null,
      railExpanded: raw.railExpanded === true,
      micAsked: raw.micAsked === true,
      wake: raw.wake === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export function writePreferences(prefs: JarvisPreferences): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* A blocked store only means the choice is not remembered. */
  }
}
