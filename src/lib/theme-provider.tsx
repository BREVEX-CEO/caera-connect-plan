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
  type AppearancePersistence,
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
  depth3d: true,
  depthStrength: 100,
};

/** Keep a stored or typed strength inside the range the geometry is tuned for. */
export function clampDepthStrength(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(200, Math.round(n)));
}

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

/**
 * Persist to this browser. Returns whether it actually landed — a private
 * window with storage blocked, or a full quota, must surface as "not saved"
 * rather than being swallowed and later mistaken for a lost setting.
 */
function writeLocal(prefs: AppearancePrefs): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    /* storage blocked or full — reported to the caller, never swallowed */
    return false;
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

  /*
   * Depth strength is published as a plain multiplier the stylesheet reads.
   * Written here rather than by `DepthScene` so the value is already correct on
   * the first painted frame — a scene that starts at full strength and drops to
   * the chosen one a frame later is a visible lurch on every page load.
   */
  root.style.setProperty("--depth-strength", (clampDepthStrength(prefs.depthStrength) / 100).toFixed(2));

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
  const [persistence, setPersistence] = useState<AppearancePersistence>({
    status: "idle",
    scope: "local",
    message: null,
    loadedFromCloud: false,
    loadError: null,
    lastSavedAt: null,
    hasPendingChanges: false,
  });
  /**
   * The accumulated columns of every write that has not been confirmed yet.
   * Retrying replays the whole set, so a switch flipped after a failure is not
   * silently dropped just because the earlier one is what the user retried.
   */
  const pendingRowRef = useRef<Record<string, unknown>>({});
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;


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
      const { data, error } = await supabase
        .from("user_settings")
        .select(
          "theme, reduced_motion, high_contrast, appearance_cursor, appearance_cursor_custom, appearance_cursor_size, appearance_cursor_trail, appearance_low_performance, appearance_depth_3d, appearance_depth_strength",
        )
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        /*
         * The account's stored preferences could not be READ. What is on screen
         * came from this browser, so it is still correct here — but it may not
         * match the account, and the panel has to say so rather than presenting
         * local values as the synced truth.
         */
        setPersistence((p) => ({
          ...p,
          scope: "local",
          loadedFromCloud: false,
          loadError:
            "We couldn't load the preferences saved to your account. You're seeing this browser's settings.",
        }));
        return;
      }
      if (!data) {
        /*
         * Signed in with no settings row yet — an empty state, not a failure.
         * The next change upserts one, so mark the scope as cloud-capable.
         */
        setPersistence((p) => ({ ...p, scope: "cloud", loadedFromCloud: true, loadError: null }));
        return;
      }
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
        /*
         * Absent means ON. A row written before these columns existed must not
         * read as "this person switched depth off" — that would silently
         * flatten the interface for every existing account on first sync.
         */
        depth3d:
          rec.appearance_depth_3d === undefined || rec.appearance_depth_3d === null
            ? true
            : !!rec.appearance_depth_3d,
        depthStrength: clampDepthStrength(rec.appearance_depth_strength ?? 100),
      };
      setPrefs(next);
      const localOk = writeLocal(next);
      setPersistence((p) => ({
        ...p,
        scope: "cloud",
        loadedFromCloud: true,
        loadError: null,
        status: p.hasPendingChanges ? p.status : "idle",
        message: localOk
          ? p.hasPendingChanges
            ? p.message
            : null
          : "This browser is blocking local storage, so preferences are kept in your account only.",
      }));
    }

    supabase.auth.getSession().then(({ data }) => {
      userIdRef.current = data.session?.user.id ?? null;
      if (userIdRef.current) void load(userIdRef.current);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const nextId = session?.user.id ?? null;
      userIdRef.current = nextId;
      if (nextId) {
        void load(nextId);
      } else {
        // Signed out: only this browser can hold preferences again.
        setPersistence((p) => ({ ...p, scope: "local", loadedFromCloud: false, loadError: null }));
      }
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

  /**
   * Push whatever is queued to the account.
   *
   * UPSERT, NOT UPDATE. A plain update against a missing settings row reports
   * success while changing nothing, which is exactly the failure this task is
   * about: the switch moves, the refresh reverts it, and nothing ever said why.
   */
  const flush = useCallback(async () => {
    const uid = userIdRef.current;
    const row = pendingRowRef.current;
    if (!uid || Object.keys(row).length === 0) return;
    setPersistence((p) => ({ ...p, status: "saving" }));
    const payload = { user_id: uid, ...row };
    const { error } = await supabase
      .from("user_settings")
      .upsert(payload as never, { onConflict: "user_id" });
    if (error) {
      setPersistence((p) => ({
        ...p,
        status: "error",
        hasPendingChanges: true,
        message:
          "We couldn't save this to your account. It still applies here and on this browser after a refresh.",
      }));
      return;
    }
    pendingRowRef.current = {};
    setPersistence((p) => ({
      ...p,
      status: "saved",
      scope: "cloud",
      hasPendingChanges: false,
      message: null,
      lastSavedAt: Date.now(),
    }));
  }, []);

  const update = useCallback(
    async (patch: Partial<AppearancePrefs>) => {
      const next = { ...prefsRef.current, ...patch };
      prefsRef.current = next;
      setPrefs(next);

      const localOk = writeLocal(next);
      const uid = userIdRef.current;

      const row: Record<string, unknown> = {};
      if (patch.theme !== undefined) row.theme = patch.theme;
      if (patch.reducedMotion !== undefined) row.reduced_motion = patch.reducedMotion;
      if (patch.highContrast !== undefined) row.high_contrast = patch.highContrast;
      if (patch.lowPerformance !== undefined) row.appearance_low_performance = patch.lowPerformance;
      if (patch.cursor !== undefined) row.appearance_cursor = patch.cursor;
      if (patch.cursorCustom !== undefined) row.appearance_cursor_custom = patch.cursorCustom;
      if (patch.cursorSize !== undefined) row.appearance_cursor_size = patch.cursorSize;
      if (patch.cursorTrail !== undefined) row.appearance_cursor_trail = patch.cursorTrail;
      if (patch.depth3d !== undefined) row.appearance_depth_3d = patch.depth3d;
      if (patch.depthStrength !== undefined)
        row.appearance_depth_strength = clampDepthStrength(patch.depthStrength);

      if (!uid) {
        // Signed out or demo: this browser is the only store there is.
        setPersistence((p) => ({
          ...p,
          status: localOk ? "saved" : "error",
          scope: localOk ? "local" : "none",
          lastSavedAt: localOk ? Date.now() : p.lastSavedAt,
          message: localOk
            ? null
            : "This browser is blocking local storage, so this change will be lost when the page reloads. Sign in, or allow site data, to keep it.",
        }));
        return;
      }

      if (Object.keys(row).length === 0) return;
      pendingRowRef.current = { ...pendingRowRef.current, ...row };
      await flush();
    },
    [flush],
  );

  const retryPersist = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      const localOk = writeLocal(prefsRef.current);
      setPersistence((p) => ({
        ...p,
        status: localOk ? "saved" : "error",
        scope: localOk ? "local" : "none",
        lastSavedAt: localOk ? Date.now() : p.lastSavedAt,
        message: localOk ? null : p.message,
      }));
      return;
    }
    if (Object.keys(pendingRowRef.current).length === 0) {
      // Nothing queued: replay the whole current state so a retry after a read
      // failure still reconciles the account with what is on screen.
      const p = prefsRef.current;
      pendingRowRef.current = {
        theme: p.theme,
        reduced_motion: p.reducedMotion,
        high_contrast: p.highContrast,
        appearance_low_performance: p.lowPerformance,
        appearance_cursor: p.cursor,
        appearance_cursor_custom: p.cursorCustom,
        appearance_cursor_size: p.cursorSize,
        appearance_cursor_trail: p.cursorTrail,
        appearance_depth_3d: p.depth3d,
        appearance_depth_strength: clampDepthStrength(p.depthStrength),
      };
    }
    await flush();
  }, [flush]);

  const value = useMemo<AppearanceContextValue>(
    () => ({ ...prefs, osReducedMotion, autoLowPerf, update, persistence, retryPersist }),
    [prefs, osReducedMotion, autoLowPerf, update, persistence, retryPersist],

  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
