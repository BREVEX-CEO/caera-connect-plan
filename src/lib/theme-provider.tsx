/**
 * CARCC CADANE ThemeProvider.
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
  type PerfFallbackState,
  type ThemeMode,
} from "./use-appearance";
import { FALLBACK_CHANGES, assessDevice, readDeviceSignals } from "./perf-fallback";

export type { AppearancePrefs, CursorKind, ThemeMode };

const DEFAULT: AppearancePrefs = {
  theme: "dark",
  reducedMotion: false,
  highContrast: false,
  lowPerformance: false,
  cursor: "system",
  cursorSize: 24,
  depth3d: true,
  depthStrength: 100,
};

/** Keep a stored or typed pointer size inside the range the artwork stays legible at. */
export function clampCursorSize(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 24;
  return Math.max(16, Math.min(64, Math.round(n)));
}

/** Keep a stored or typed strength inside the range the geometry is tuned for. */
export function clampDepthStrength(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(200, Math.round(n)));
}

const LS_KEY = "caera:appearance:v1";
/**
 * "Keep full quality on this device anyway" lives per browser, not per
 * account: it is a judgement about this machine, and syncing it would force a
 * fast desktop's choice onto a struggling phone.
 */
const LS_PERF_OVERRIDE = "caera:appearance:perf-override:v1";

function readFallbackOverride(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LS_PERF_OVERRIDE) === "1";
  } catch {
    return false;
  }
}

function writeFallbackOverride(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(LS_PERF_OVERRIDE, "1");
    else window.localStorage.removeItem(LS_PERF_OVERRIDE);
  } catch {
    /* storage blocked — the choice still applies for this session */
  }
}

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
  /*
   * The fallback flattens the scene as well as dropping blur: pointer-driven
   * depth is the single most expensive thing on screen, so leaving it running
   * while claiming to have stepped down would be the fallback in name only.
   */
  const lowPerf = prefs.lowPerformance || autoLowPerf;
  root.style.setProperty(
    "--depth-strength",
    lowPerf ? "0" : (clampDepthStrength(prefs.depthStrength) / 100).toFixed(2),
  );

  /* ------------------------------------------------------------- cursor --
   * WHY THE POINTER IS BUILT HERE RATHER THAN LINKED FROM /cursors.
   *
   * `cursor: url(...)` takes the image at its intrinsic size. The two files in
   * /cursors are 24px, so the size preference below could not change anything
   * — it was written to a `--cursor-size` custom property that no rule read,
   * and a person who set the pointer to 64px got a 24px pointer and no error.
   *
   * Generating the SVG at the chosen size fixes that, and it fixes the hotspot
   * with it: the arrow tip sits at 2/24ths of the artwork, so on a 64px pointer
   * the hotspot has to move to 5, or the click lands where the pointer is not.
   */
  root.classList.toggle("cursor-accessibility", prefs.cursor === "accessibility");

  const size = clampCursorSize(prefs.cursorSize);
  const fill =
    prefs.cursor === "caera_black"
      ? "black"
      : prefs.cursor === "caera_white"
        ? "white"
        : prefs.cursor === "auto_contrast"
          ? // Contrast against the page, not against the cursor: a light theme
            // needs a dark pointer.
            prefs.theme === "light"
            ? "black"
            : "white"
          : null;

  if (fill) {
    root.style.setProperty(
      "--app-cursor",
      `${pointerDataUri(fill, size)} ${hotspotFor(size)}, auto`,
    );
    root.classList.add("has-custom-cursor");
  } else {
    root.style.removeProperty("--app-cursor");
    root.classList.remove("has-custom-cursor");
  }
}

/** The pointer artwork, at a given size, as a `url()` value. */
function pointerDataUri(fill: "black" | "white", size: number): string {
  const body = fill === "white" ? "#f5f7fa" : "#0a0d12";
  const edge = fill === "white" ? "#0a0d12" : "#f5f7fa";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
    `<path d="M3 2 L3 20 L8 15.5 L11 22 L14 20.5 L11 14 L18 14 Z" fill="${body}" ` +
    `stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The click point, scaled with the artwork so it stays on the arrow tip. */
function hotspotFor(size: number): string {
  const offset = Math.round((2 / 24) * size);
  return `${offset} ${offset}`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(() => readLocal());
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  /**
   * The automatic fallback: whether it is active, what tripped it, and whether
   * the person has told us to keep full quality anyway. The override is held
   * per browser (not per account) because it is a statement about THIS machine.
   */
  const [perfFallback, setPerfFallback] = useState<PerfFallbackState>(() => ({
    active: false,
    trigger: null,
    reason: null,
    overridden: readFallbackOverride(),
    changes: FALLBACK_CHANGES,
  }));
  const autoLowPerf = perfFallback.active && !perfFallback.overridden;

  const keepFullQuality = useCallback(() => {
    writeFallbackOverride(true);
    setPerfFallback((s) => ({ ...s, overridden: true }));
  }, []);

  const resumeAutoFallback = useCallback(() => {
    writeFallbackOverride(false);
    setPerfFallback((s) => ({ ...s, overridden: false }));
  }, []);

  // Static device check — runs before the first animated frame is scheduled.
  useEffect(() => {
    const assessment = assessDevice(readDeviceSignals());
    if (!assessment.lowEnd) return;
    setPerfFallback((s) =>
      s.active ? s : { ...s, active: true, trigger: "device", reason: assessment.reason },
    );
  }, []);

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
          setPerfFallback((s) =>
            s.active ? s : { ...s, active: true, trigger: "frames", reason: null },
          );
        }
      } else if (dt < 20) {
        fastFrames++;
        slowFrames = 0;
        if (fastFrames > 300) {
          /*
           * Only a MEASURED fallback recovers. A device that reported four
           * cores still has four cores after a smooth stretch, so lifting a
           * static fallback here would just make it flap.
           */
          setPerfFallback((s) =>
            s.active && s.trigger === "frames"
              ? { ...s, active: false, trigger: null, reason: null }
              : s,
          );
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
        cursorSize: clampCursorSize(rec.appearance_cursor_size),
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
      if (patch.cursorSize !== undefined)
        row.appearance_cursor_size = clampCursorSize(patch.cursorSize);
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
        appearance_cursor_size: clampCursorSize(p.cursorSize),
        appearance_depth_3d: p.depth3d,
        appearance_depth_strength: clampDepthStrength(p.depthStrength),
      };
    }
    await flush();
  }, [flush]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...prefs,
      osReducedMotion,
      autoLowPerf,
      perfFallback,
      keepFullQuality,
      resumeAutoFallback,
      update,
      persistence,
      retryPersist,
    }),
    [
      prefs,
      osReducedMotion,
      autoLowPerf,
      perfFallback,
      keepFullQuality,
      resumeAutoFallback,
      update,
      persistence,
      retryPersist,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
