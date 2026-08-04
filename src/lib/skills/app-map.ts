/**
 * Learned application maps (Skill Packs, second half).
 *
 * When OCADE meets an app it has no tested pack for, it inspects it ONCE —
 * version, window titles, menus, accessibility tree, known file locations — and
 * saves a reusable map. Later tasks reuse that map instead of re-inspecting,
 * which is where most of the speed comes from.
 *
 * The correctness rule is the interesting part: a saved map is only valid while
 * the app is unchanged. Menus and control ids move between releases, and acting
 * on a stale map is precisely how an agent clicks the wrong thing. So every map
 * carries a fingerprint, and a mismatch forces a re-probe rather than a guess.
 *
 * Maps describe STRUCTURE only — control names, menu paths, file locations.
 * They never contain document contents, field values or anything the user
 * typed, so a saved map is not a copy of the user's data.
 */
import { CONTROL_PREFERENCE, type AppIdentity, type ControlMethod } from "./skill-pack";

const KEY = "caera:appmaps:v1";

/** A single control OCADE learned how to reach. */
export interface MappedControl {
  /** Stable id used by capabilities, e.g. "menu.file.export". */
  id: string;
  /** What the user would call it. */
  label: string;
  /** How this control is reached. */
  method: ControlMethod;
  /**
   * A stable anchor — accessibility id, menu path, selector. Never a raw pixel
   * coordinate: coordinates break on resize, DPI change and theme change, and
   * a broken coordinate silently clicks the wrong thing.
   */
  anchor: string;
}

export interface AppMap {
  appId: string;
  displayName: string;
  version: string | null;
  /**
   * Identifies the exact build/layout this map describes. Any change means the
   * map must be re-probed.
   */
  fingerprint: string;
  controls: MappedControl[];
  learnedAt: string;
  /** How many times this map has been used successfully. */
  uses: number;
}

/** Structural observation returned by an approved app-inspection host. */
export interface AppProbeObservation {
  appId: string;
  version: string | null;
  windowTitle: string | null;
  locale: string | null;
  controls: MappedControl[];
  /** What was inspected. Must not contain document or field values. */
  evidence: string;
}

export interface AppProbeHost {
  inspect(app: AppIdentity): Promise<AppProbeObservation>;
}

export type AppLearningOutcome =
  | {
      status: "learned";
      map: AppMap;
      rejected: { control: MappedControl; reason: string }[];
      evidence: string;
    }
  | { status: "refused" | "unsupported" | "failed"; reason: string };

/**
 * Build a fingerprint from what the probe observed.
 *
 * Deliberately includes UI shape (window title, control count), not just the
 * version string: an app can change its layout in a patch release without
 * changing the version the user sees, and a plugin can add menu items to an
 * otherwise-identical build.
 */
export function fingerprintApp(input: {
  version?: string | null;
  windowTitle?: string | null;
  controlCount?: number;
  locale?: string | null;
}): string {
  return [
    input.version ?? "no-version",
    input.windowTitle ?? "no-title",
    String(input.controlCount ?? 0),
    // Menu labels are localised, so a language change invalidates label anchors.
    input.locale ?? "no-locale",
  ].join("|");
}

function cloneMap(map: AppMap): AppMap {
  return {
    ...map,
    controls: map.controls.map((control) => ({ ...control })),
  };
}

function isCanonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  try {
    return new Date(time).toISOString() === value;
  } catch {
    return false;
  }
}

function isStoredAppMap(value: unknown): value is AppMap {
  if (!value || typeof value !== "object") return false;
  const map = value as AppMap;
  if (
    typeof map.appId !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(map.appId) ||
    typeof map.displayName !== "string" ||
    !map.displayName.trim() ||
    map.displayName.length > 200 ||
    (map.version !== null && (typeof map.version !== "string" || map.version.length > 100)) ||
    typeof map.fingerprint !== "string" ||
    !map.fingerprint.trim() ||
    map.fingerprint.length > 1_000 ||
    !isCanonicalIso(map.learnedAt) ||
    !Number.isInteger(map.uses) ||
    map.uses < 0 ||
    map.uses > 1_000_000 ||
    !Array.isArray(map.controls) ||
    map.controls.length > 1_000
  ) {
    return false;
  }
  const ids = new Set<string>();
  return map.controls.every((control) => {
    if (
      !control ||
      typeof control !== "object" ||
      typeof control.id !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(control.id) ||
      ids.has(control.id) ||
      typeof control.label !== "string" ||
      !control.label.trim() ||
      control.label.length > 200 ||
      !CONTROL_PREFERENCE.includes(control.method) ||
      typeof control.anchor !== "string" ||
      control.anchor.length > 500 ||
      !isStableAnchor(control.anchor)
    ) {
      return false;
    }
    ids.add(control.id);
    return true;
  });
}

function readAll(): AppMap[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredAppMap).map(cloneMap);
  } catch {
    return [];
  }
}

function writeAll(maps: AppMap[]): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(maps));
    return true;
  } catch {
    return false;
  }
}

export function listAppMaps(): AppMap[] {
  return readAll();
}

export type MapLookup =
  | { status: "fresh"; map: AppMap }
  | { status: "stale"; map: AppMap; reason: string }
  | { status: "missing"; reason: string };

/**
 * Find a usable map for an app.
 *
 * `stale` is returned rather than `missing` when a map exists but the app
 * changed: the caller can show what OCADE previously knew while making clear it
 * must re-check. Returning `missing` would throw away useful context; returning
 * `fresh` would be a lie.
 */
export function lookupAppMap(appId: string, fingerprint: string): MapLookup {
  const map = readAll().find((m) => m.appId === appId);
  if (!map) {
    return {
      status: "missing",
      reason: "OCADE hasn't inspected this app yet.",
    };
  }
  if (map.fingerprint !== fingerprint) {
    return {
      status: "stale",
      map,
      reason:
        "This app has changed since OCADE last looked at it — a different version, layout or language. OCADE will inspect it again before acting.",
    };
  }
  return { status: "fresh", map };
}

/** Save (or replace) a learned map. */
export function saveAppMap(
  map: Omit<AppMap, "learnedAt" | "uses">,
  now: Date = new Date(),
): AppMap {
  const existing = readAll().find((m) => m.appId === map.appId);
  const controls = rejectUnstableControls(map.controls).kept;
  const next: AppMap = {
    ...map,
    controls,
    learnedAt: now.toISOString(),
    // Re-learning after a change resets the usage count: the old successes were
    // against a different layout and say nothing about this one.
    uses: existing && existing.fingerprint === map.fingerprint ? existing.uses : 0,
  };
  if (!isStoredAppMap(next)) {
    throw new Error("The learned app map is malformed or contains unsafe structural controls.");
  }
  if (!writeAll([...readAll().filter((m) => m.appId !== map.appId), next])) {
    throw new Error("The learned app map could not be saved.");
  }
  return cloneMap(next);
}

/**
 * Inspect and learn an unfamiliar application after explicit approval.
 *
 * Only structural metadata crosses this boundary. Raw coordinates are dropped,
 * duplicate or malformed control identities fail closed, and an empty safe map
 * is reported as unsupported rather than saved as if learning succeeded.
 */
export async function learnAppFromProbe(input: {
  app: AppIdentity;
  approved: boolean;
  probe: AppProbeHost;
  now?: Date;
}): Promise<AppLearningOutcome> {
  if (!input.approved) {
    return {
      status: "refused",
      reason: `OCADE needs approval before it inspects ${input.app.displayName}.`,
    };
  }

  let observation: AppProbeObservation;
  try {
    observation = await input.probe.inspect(input.app);
  } catch (error) {
    return {
      status: "failed",
      reason: `OCADE could not inspect ${input.app.displayName}: ${
        error instanceof Error ? error.message : "the inspection host failed"
      }.`,
    };
  }

  if (
    !observation ||
    observation.appId !== input.app.appId ||
    (observation.version !== null && typeof observation.version !== "string") ||
    (observation.windowTitle !== null && typeof observation.windowTitle !== "string") ||
    (observation.locale !== null && typeof observation.locale !== "string") ||
    !Array.isArray(observation.controls) ||
    observation.controls.length > 1_000 ||
    typeof observation.evidence !== "string" ||
    !observation.evidence.trim() ||
    observation.evidence.length > 1_000
  ) {
    return {
      status: "failed",
      reason: "The app inspection returned malformed or mismatched structural evidence.",
    };
  }

  const ids = new Set<string>();
  for (const control of observation.controls) {
    if (
      !control ||
      typeof control.id !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(control.id) ||
      ids.has(control.id) ||
      typeof control.label !== "string" ||
      !control.label.trim() ||
      control.label.length > 200 ||
      !CONTROL_PREFERENCE.includes(control.method) ||
      typeof control.anchor !== "string" ||
      control.anchor.length > 500
    ) {
      return {
        status: "failed",
        reason: "The app inspection returned an unsafe or duplicate control identity.",
      };
    }
    ids.add(control.id);
  }

  const { kept, rejected } = rejectUnstableControls(observation.controls);
  if (kept.length === 0) {
    return {
      status: "unsupported",
      reason:
        "The inspection found no stable structural control. OCADE will not learn raw screen coordinates as an app map.",
    };
  }

  const fingerprint = fingerprintApp({
    version: observation.version,
    windowTitle: observation.windowTitle,
    controlCount: observation.controls.length,
    locale: observation.locale,
  });
  let map: AppMap;
  try {
    map = saveAppMap(
      {
        appId: input.app.appId,
        displayName: input.app.displayName,
        version: observation.version,
        fingerprint,
        controls: kept,
      },
      input.now,
    );
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "The learned app map could not be saved.",
    };
  }
  return {
    status: "learned",
    map,
    rejected,
    evidence: `${observation.evidence} Learned ${kept.length} stable control${
      kept.length === 1 ? "" : "s"
    }; rejected ${rejected.length} positional control${rejected.length === 1 ? "" : "s"}.`,
  };
}

/** Record a successful use, so a well-proven map can be trusted more. */
export function recordMapUse(appId: string): boolean {
  const maps = readAll();
  const idx = maps.findIndex((m) => m.appId === appId);
  if (idx === -1) return true;
  if (maps[idx].uses >= 1_000_000) return false;
  maps[idx] = { ...maps[idx], uses: maps[idx].uses + 1 };
  return writeAll(maps);
}

/** Look up a control within a map. Returns null rather than a near-match. */
export function findControl(map: AppMap, controlId: string): MappedControl | null {
  return map.controls.find((c) => c.id === controlId) ?? null;
}

export function forgetAppMap(appId: string): boolean {
  return writeAll(readAll().filter((m) => m.appId !== appId));
}

export function clearAppMaps(): boolean {
  return writeAll([]);
}

/**
 * A control anchor must be stable across resize, DPI and theme changes.
 * Raw coordinates are rejected: they are the single most common cause of an
 * automation clicking the wrong thing after a display change.
 */
export function isStableAnchor(anchor: string): boolean {
  const a = anchor.trim();
  if (!a) return false;
  /*
   * Positional forms, all rejected:
   *   "120,340"  "(120, 340)"  "[12;44]"  "x=120 y=340"  "x:120 y:340"
   *
   * The separator may be a comma, semicolon OR whitespace — an earlier version
   * required punctuation and so accepted "x=120 y=340" as stable, which is
   * exactly the anchor that breaks first on a DPI change.
   */
  return !/^[({[]?\s*(?:x\s*[=:]\s*)?-?\d+(?:\.\d+)?\s*(?:[,;]|\s)\s*(?:y\s*[=:]\s*)?-?\d+(?:\.\d+)?\s*[)}\]]?$/i.test(
    a,
  );
}

/** Drop any control whose anchor is positional, with the reason. */
export function rejectUnstableControls(controls: MappedControl[]): {
  kept: MappedControl[];
  rejected: { control: MappedControl; reason: string }[];
} {
  const kept: MappedControl[] = [];
  const rejected: { control: MappedControl; reason: string }[] = [];
  for (const c of controls) {
    if (isStableAnchor(c.anchor)) kept.push(c);
    else
      rejected.push({
        control: c,
        reason:
          "Anchored to a screen position, which moves when the window is resized or the display scaling changes.",
      });
  }
  return { kept, rejected };
}
