/**
 * THE ONE AUTHORITY FOR HOW OCADE LOOKS.
 *
 * Three preferences and nothing else: theme, reduced motion, high contrast.
 * The previous provider also owned a cursor family with four kinds and a size,
 * a 3D depth strength, a cursor trail and an automatic low-performance mode
 * driven by a permanent requestAnimationFrame sampler. All of it belonged to a
 * product that no longer exists, and the sampler ran on every page of it.
 *
 * WHERE A PREFERENCE LIVES, AND WHY BOTH PLACES.
 *
 *   localStorage answers the FIRST PAINT. It is synchronous, so the boot
 *   script in `__root.tsx` can read it before React exists and the page never
 *   flashes the wrong theme.
 *
 *   `user_settings` answers EVERY OTHER DEVICE. Signing in on a new machine
 *   should not mean choosing the theme again.
 *
 * The browser value wins until the account's row has been read, and the read
 * only overwrites what the person has not just changed. A cloud snapshot that
 * lands after a click and silently undoes it is the failure this ordering
 * exists to prevent.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light";

export interface AppearancePrefs {
  theme: ThemeMode;
  /** The person's own override. The OS preference is honoured separately. */
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface AppearanceValue extends AppearancePrefs {
  /** True when either the preference or the OS asks for calm. */
  motionReduced: boolean;
  setAppearance: (patch: Partial<AppearancePrefs>) => void;
  /** Null until a save has been attempted; a short, truthful line otherwise. */
  saveError: string | null;
}

/** The key the boot script in `__root.tsx` reads. Changing one changes both. */
export const APPEARANCE_STORAGE_KEY = "ocade:appearance:v1";

const DEFAULTS: AppearancePrefs = { theme: "dark", reducedMotion: false, highContrast: false };

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance must be used inside <AppearanceProvider>");
  return value;
}

function readLocal(): AppearancePrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return {
      theme: parsed.theme === "light" ? "light" : "dark",
      reducedMotion: parsed.reducedMotion === true,
      highContrast: parsed.highContrast === true,
    };
  } catch {
    // Blocked storage, private mode, corrupt value: the default is still a
    // usable product, so none of them is worth surfacing.
    return DEFAULTS;
  }
}

function writeLocal(prefs: AppearancePrefs) {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Nothing to recover: the account row is the durable copy. */
  }
}

/** Applies the preferences to <html>, which is what every rule in styles.css reads. */
function applyToDocument(prefs: AppearancePrefs, osReducedMotion: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", prefs.theme === "light");
  root.classList.toggle("high-contrast", prefs.highContrast);
  root.classList.toggle("reduce-motion", prefs.reducedMotion || osReducedMotion);
  root.style.colorScheme = prefs.theme === "light" ? "light" : "dark";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(readLocal);
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Set by the first local change, so a late cloud read cannot undo it. */
  const touchedRef = useRef(false);

  useEffect(() => {
    applyToDocument(prefs, osReducedMotion);
  }, [prefs, osReducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOsReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  /*
   * The account's copy, read once per signed-in session.
   *
   * The Supabase client is imported dynamically. A static import pulls auth,
   * PostgREST, realtime and storage into the entry graph, which every visitor
   * would parse before first paint for a preference the browser already holds.
   */
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let loadedFor: string | null = null;

    async function load(userId: string) {
      if (loadedFor === userId) return;
      loadedFor = userId;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("user_settings")
        .select("theme, reduced_motion, high_contrast")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || error || !data || touchedRef.current) return;
      setPrefs((current) => {
        const next: AppearancePrefs = {
          theme: data.theme === "light" ? "light" : current.theme,
          reducedMotion:
            typeof data.reduced_motion === "boolean" ? data.reduced_motion : current.reducedMotion,
          highContrast:
            typeof data.high_contrast === "boolean" ? data.high_contrast : current.highContrast,
        };
        writeLocal(next);
        return next;
      });
    }

    void import("@/integrations/supabase/client").then(
      ({ getSupabaseBrowserConfiguration, supabase }) => {
        if (cancelled || !getSupabaseBrowserConfiguration().configured) return;
        void supabase.auth.getSession().then(({ data }) => {
          if (!cancelled && data.session) void load(data.session.user.id);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          if (session) void load(session.user.id);
          else loadedFor = null;
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      },
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const setAppearance = useCallback((patch: Partial<AppearancePrefs>) => {
    touchedRef.current = true;
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeLocal(next);
      void persist(next).then(setSaveError);
      return next;
    });
  }, []);

  const value = useMemo<AppearanceValue>(
    () => ({
      ...prefs,
      motionReduced: prefs.reducedMotion || osReducedMotion,
      setAppearance,
      saveError,
    }),
    [prefs, osReducedMotion, setAppearance, saveError],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/**
 * Writes the preferences to the account, and says plainly when it could not.
 *
 * Signed out is not a failure — the browser copy is the whole story for a
 * visitor who has no account to write to — so it returns no error.
 */
async function persist(prefs: AppearancePrefs): Promise<string | null> {
  try {
    const { getSupabaseBrowserConfiguration, supabase } =
      await import("@/integrations/supabase/client");
    if (!getSupabaseBrowserConfiguration().configured) return null;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        theme: prefs.theme,
        reduced_motion: prefs.reducedMotion,
        high_contrast: prefs.highContrast,
      },
      { onConflict: "user_id" },
    );
    return error ? "Appearance is saved on this device only. Try again later." : null;
  } catch {
    return "Appearance is saved on this device only. Try again later.";
  }
}
