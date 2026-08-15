/**
 * CAERA CADANE ThemeProvider.
 *
 * Owns the visual mode (dark | light | real), reduced-motion preference,
 * low-performance mode (auto-detected via rAF FPS sampling), and cursor
 * preferences. Persists to Supabase user_settings when signed in; falls back
 * to localStorage otherwise. Applies classes / data attributes / CSS
 * variables on <html> so styles.css tokens do the rest.
 *
 * No hardcoded page colors — everything flows through CSS variables.
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
import { getSupabaseBrowserConfiguration, supabase } from "@/integrations/supabase/client";
import {
  ThemeContext,
  type AppearanceContextValue,
  type AppearancePrefs,
  type CursorKind,
  type ThemeMode,
} from "./use-appearance";

export type { AppearancePrefs, CursorKind, ThemeMode };

const DEFAULT: AppearancePrefs = {
  theme: "dark",
  reducedMotion: false,
  highContrast: false,
  lowPerformance: false,
  cursor: "system",
  cursorCustom: null,
  cursorSize: 24,
  cursorTrail: false,
};

const LS_KEY = "caera:appearance:v1";

function readLocal(): AppearancePrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

function writeLocal(prefs: AppearancePrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota — ignore */
  }
}

/** Apply prefs to the document element via classes + CSS vars. */
function applyToDocument(prefs: AppearancePrefs, osReducedMotion: boolean, autoLowPerf: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.classList.remove("theme-dark", "theme-light", "theme-real", "light", "real");
  root.classList.add(`theme-${prefs.theme}`);
  if (prefs.theme === "light") root.classList.add("light");
  if (prefs.theme === "real") root.classList.add("real");

  root.classList.toggle("high-contrast", prefs.highContrast);

  const motionOff = prefs.reducedMotion || osReducedMotion;
  root.classList.toggle("reduce-motion", motionOff);
  root.classList.toggle("low-perf", prefs.lowPerformance || autoLowPerf);

  // Cursor
  root.classList.toggle("cursor-accessibility", prefs.cursor === "accessibility");
  root.style.setProperty("--cursor-size", `${prefs.cursorSize}px`);
  root.style.setProperty("--cursor-hotspot", `${Math.round(prefs.cursorSize / 8)}`);

  let cursorUrl: string | null = null;
  switch (prefs.cursor) {
    case "caera_black":
      cursorUrl = "/cursors/caera-black.svg";
      break;
    case "caera_white":
      cursorUrl = "/cursors/caera-white.svg";
      break;
    case "auto_contrast":
      // Choose based on theme brightness.
      cursorUrl = prefs.theme === "light" ? "/cursors/caera-black.svg" : "/cursors/caera-white.svg";
      break;
    case "custom":
      cursorUrl = prefs.cursorCustom;
      break;
    case "system":
    case "accessibility":
    default:
      cursorUrl = null;
  }

  if (cursorUrl) {
    root.style.setProperty("--app-cursor", `url("${cursorUrl}") 2 2, auto`);
    root.classList.add("has-custom-cursor");
  } else {
    root.style.removeProperty("--app-cursor");
    root.classList.remove("has-custom-cursor");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(() => readLocal());
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  const [autoLowPerf, setAutoLowPerf] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // OS reduced-motion listener
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setOsReducedMotion(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // FPS sampler → auto low-perf when frames drop for a few seconds.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    let last = performance.now();
    let slowFrames = 0;
    let fastFrames = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (dt > 40) {
        slowFrames++;
        fastFrames = 0;
        if (slowFrames > 90) {
          setAutoLowPerf(true);
        }
      } else if (dt < 20) {
        fastFrames++;
        slowFrames = 0;
        if (fastFrames > 300) {
          setAutoLowPerf(false);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Load from Supabase when a session is available.
  useEffect(() => {
    if (!getSupabaseBrowserConfiguration().configured) {
      // Local appearance preferences remain available on public/offline pages.
      // Authenticated preference sync stays disabled until the intended
      // Supabase project is explicitly configured.
      return;
    }
    let cancelled = false;
    async function load(userId: string) {
      const { data } = await supabase
        .from("user_settings")
        .select(
          "theme, reduced_motion, high_contrast, appearance_cursor, appearance_cursor_custom, appearance_cursor_size, appearance_cursor_trail, appearance_low_performance",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const rec = data as unknown as Record<string, unknown>;
      const theme = (rec.theme as string) ?? "dark";
      const next: AppearancePrefs = {
        theme:
          theme === "light" || theme === "real" || theme === "dark" ? (theme as ThemeMode) : "dark",
        reducedMotion: !!rec.reduced_motion,
        highContrast: !!rec.high_contrast,
        lowPerformance: !!rec.appearance_low_performance,
        cursor: (rec.appearance_cursor as CursorKind) ?? "system",
        cursorCustom: (rec.appearance_cursor_custom as string | null) ?? null,
        cursorSize:
          typeof rec.appearance_cursor_size === "number"
            ? (rec.appearance_cursor_size as number)
            : 24,
        cursorTrail: !!rec.appearance_cursor_trail,
      };
      setPrefs(next);
      writeLocal(next);
    }

    supabase.auth.getSession().then(({ data }) => {
      userIdRef.current = data.session?.user.id ?? null;
      if (userIdRef.current) load(userIdRef.current);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      userIdRef.current = session?.user.id ?? null;
      if (userIdRef.current) load(userIdRef.current);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Whenever prefs / OS / auto-perf change → apply to document.
  useEffect(() => {
    applyToDocument(prefs, osReducedMotion, autoLowPerf);
  }, [prefs, osReducedMotion, autoLowPerf]);

  const update = useCallback(async (patch: Partial<AppearancePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writeLocal(next);
      const uid = userIdRef.current;
      if (uid) {
        const row: Record<string, unknown> = {};
        if (patch.theme !== undefined) row.theme = patch.theme;
        if (patch.reducedMotion !== undefined) row.reduced_motion = patch.reducedMotion;
        if (patch.highContrast !== undefined) row.high_contrast = patch.highContrast;
        if (patch.lowPerformance !== undefined)
          row.appearance_low_performance = patch.lowPerformance;
        if (patch.cursor !== undefined) row.appearance_cursor = patch.cursor;
        if (patch.cursorCustom !== undefined) row.appearance_cursor_custom = patch.cursorCustom;
        if (patch.cursorSize !== undefined) row.appearance_cursor_size = patch.cursorSize;
        if (patch.cursorTrail !== undefined) row.appearance_cursor_trail = patch.cursorTrail;
        if (Object.keys(row).length > 0) {
          void supabase
            .from("user_settings")
            .update(row as never)
            .eq("user_id", uid);
        }
      }
      return next;
    });
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({ ...prefs, osReducedMotion, autoLowPerf, update }),
    [prefs, osReducedMotion, autoLowPerf, update],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
