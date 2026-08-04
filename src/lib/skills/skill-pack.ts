/**
 * OCADE Skill Packs — the universal software-control contract.
 *
 * A Skill Pack describes how OCADE drives ONE application family. The design
 * rule that shapes everything here: OCADE must never claim knowledge of an app
 * or version it has not actually verified.
 *
 * Three states, and they are not interchangeable:
 *  - `verified`   — this exact app+version range was tested. Full confidence.
 *  - `probed`     — OCADE inspected the app once and saved a map. Usable, but
 *                   reported as learned-not-tested, and re-probed after change.
 *  - `unknown`    — no pack, no map. OCADE says so and offers to inspect. It
 *                   does NOT guess from a similar app.
 *
 * Control-method preference is also a safety ordering, not a style choice:
 * official API → adapter → DOM/accessibility → direct file → vision+input.
 * Vision with synthetic mouse/keyboard is the LAST resort because it is the
 * only method that cannot verify what it acted on before acting.
 */

/** Software categories OCADE can carry packs for. */
export type SkillCategory =
  | "os_utilities"
  | "erp_crm_hcm_scm"
  | "office_docs"
  | "graphics_media"
  | "dev_tools"
  | "engineering_cad"
  | "chat_projects"
  | "security_networking"
  | "data_bi_ai"
  | "browsers_transfer"
  | "finance_commerce"
  | "healthcare_imaging"
  | "education"
  | "games_streaming";

export const SKILL_CATEGORIES: SkillCategory[] = [
  "os_utilities",
  "erp_crm_hcm_scm",
  "office_docs",
  "graphics_media",
  "dev_tools",
  "engineering_cad",
  "chat_projects",
  "security_networking",
  "data_bi_ai",
  "browsers_transfer",
  "finance_commerce",
  "healthcare_imaging",
  "education",
  "games_streaming",
];

/**
 * How an action reaches the application, best first.
 *
 * Lower index = more reliable AND more verifiable. `vision_input` is last
 * because it drives pixels: it cannot confirm the control it is about to click
 * is the control it means, only that something looks right.
 */
export type ControlMethod =
  "official_api" | "adapter" | "accessibility" | "dom" | "file" | "cli" | "vision_input";

export const CONTROL_PREFERENCE: ControlMethod[] = [
  "official_api",
  "adapter",
  "accessibility",
  "dom",
  "file",
  "cli",
  "vision_input",
];

/** Lower is better. Used to choose between available methods. */
export function methodRank(m: ControlMethod): number {
  const i = CONTROL_PREFERENCE.indexOf(m);
  return i === -1 ? CONTROL_PREFERENCE.length : i;
}

/**
 * Pick the most reliable method available for a capability.
 * Returns null when nothing is available — never falls back to guessing.
 */
export function preferredMethod(available: ControlMethod[]): ControlMethod | null {
  if (available.length === 0) return null;
  return [...available].sort((a, b) => methodRank(a) - methodRank(b))[0];
}

export type PackConfidence = "verified" | "probed" | "unknown";

export interface AppIdentity {
  /** Stable id, e.g. "libreoffice.calc". */
  appId: string;
  /** Human name shown to the user. */
  displayName: string;
  /** Detected version string, when the app reports one. */
  version?: string | null;
}

export interface SkillCapability {
  /** Stable action id within the pack, e.g. "export_pdf". */
  id: string;
  /** Plain description shown before OCADE acts. */
  label: string;
  /** Methods this capability can use, in any order. */
  methods: ControlMethod[];
  /** True when the action changes user data or state. */
  mutating: boolean;
  /**
   * How the result is confirmed after acting. A capability with no
   * verification cannot be reported as succeeded.
   */
  verifyBy: "file" | "ui" | "log" | "api" | "none";
  /** True when this capability was covered by a real test. */
  tested: boolean;
}

export interface SkillPack {
  appId: string;
  displayName: string;
  category: SkillCategory;
  /**
   * Version ranges this pack was tested against, as plain prefixes
   * (e.g. ["24.", "25."]). Empty means "version not pinned" and downgrades the
   * pack to `probed` confidence at match time.
   */
  testedVersions: string[];
  capabilities: SkillCapability[];
  /** Licensing note. OCADE never drives unlicensed or cracked software. */
  requiresLicensedInstall: boolean;
  /**
   * What this pack does NOT cover, in the user's words.
   *
   * Several packs work on the open FILE FORMATS of a category rather than the
   * vendor applications — OCADE can read a GeoJSON file but cannot drive
   * SolidWorks. Without this note a green row in the coverage table reads as
   * "OCADE handles CAD", which is the precise over-claim this design exists to
   * prevent. Packs that genuinely drive the application leave it undefined.
   */
  coverageNote?: string;
}

/* ------------------------------------------------------------- matching -- */

export interface PackMatch {
  pack: SkillPack | null;
  confidence: PackConfidence;
  /** Honest, user-facing explanation. Always present. */
  reason: string;
}

function versionMatches(pack: SkillPack, version?: string | null): boolean {
  if (pack.testedVersions.length === 0) return false;
  if (!version) return false;
  return pack.testedVersions.some((prefix) => version.startsWith(prefix));
}

/**
 * Resolve an app to a pack, reporting HOW confident OCADE actually is.
 *
 * A pack for the right app but an untested version is deliberately downgraded
 * to `probed`: menus and shortcuts move between releases, and acting on a stale
 * map is exactly how an agent clicks the wrong thing.
 */
export function matchPack(app: AppIdentity, packs: SkillPack[]): PackMatch {
  const pack = packs.find((p) => p.appId === app.appId);
  if (!pack) {
    return {
      pack: null,
      confidence: "unknown",
      reason: `OCADE doesn't have a tested skill pack for ${app.displayName}. It can inspect the app once and learn it, with your approval.`,
    };
  }
  if (versionMatches(pack, app.version)) {
    return {
      pack,
      confidence: "verified",
      reason: `Tested with ${pack.displayName} ${app.version}.`,
    };
  }
  return {
    pack,
    confidence: "probed",
    reason: `OCADE knows ${pack.displayName}, but not version ${app.version ?? "(unreported)"}. It will re-check the app's layout before acting.`,
  };
}

/* ----------------------------------------------------------- confidence -- */

export interface ActionAssessment {
  capability: SkillCapability;
  method: ControlMethod | null;
  confidence: number; // 0..1
  /** True when OCADE may proceed without re-checking. */
  proceed: boolean;
  reason: string;
}

/** Below this, OCADE re-inspects rather than acting. */
export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Score an action before it runs.
 *
 * Deliberately pessimistic: an untested capability, a stale version map, or a
 * vision-only path all pull the score down, and a mutating action needs more
 * confidence than a read.
 */
export function assessAction(
  capability: SkillCapability,
  packConfidence: PackConfidence,
  availableMethods: ControlMethod[],
  /**
   * Evidence from a freshly-verified layout map, when one exists.
   *
   * Inspecting an app is only worth doing if it changes the decision. Without
   * this, OCADE would inspect and then still refuse — the map would be dead
   * weight. `uses` is real evidence: a map that has driven the app correctly
   * ten times is worth more than one learned a moment ago, so the credit grows
   * with proven use and is capped so it can never substitute for a tested pack.
   */
  freshMap?: { uses: number } | null,
): ActionAssessment {
  const method = preferredMethod(capability.methods.filter((m) => availableMethods.includes(m)));

  if (!method) {
    return {
      capability,
      method: null,
      confidence: 0,
      proceed: false,
      reason: "None of the ways OCADE knows to do this are available right now.",
    };
  }

  let score = packConfidence === "verified" ? 0.9 : packConfidence === "probed" ? 0.6 : 0.3;

  // A current, working map of this exact build is real evidence about this
  // exact build. Capped at +0.2 so a learned map never reaches the confidence
  // of a pack that was actually tested against the app.
  if (freshMap) score += Math.min(0.2, 0.1 + freshMap.uses * 0.02);

  if (!capability.tested) score -= 0.15;
  // Vision cannot confirm its target before acting.
  if (method === "vision_input") score -= 0.2;
  // A change with no way to check it afterwards is not worth the risk.
  if (capability.mutating && capability.verifyBy === "none") score -= 0.25;
  score = Math.max(0, Math.min(1, score));

  const proceed = score >= CONFIDENCE_THRESHOLD;
  return {
    capability,
    method,
    confidence: Number(score.toFixed(2)),
    proceed,
    reason: proceed
      ? `Using ${describeMethod(method)}.`
      : `OCADE isn't confident enough to do this unattended (${Math.round(score * 100)}%). It will inspect the app first.`,
  };
}

export function describeMethod(m: ControlMethod): string {
  switch (m) {
    case "official_api":
      return "the app's official API";
    case "adapter":
      return "a built-in adapter";
    case "accessibility":
      return "the accessibility tree";
    case "dom":
      return "the page structure";
    case "file":
      return "direct file access";
    case "cli":
      return "the app's command line";
    case "vision_input":
      return "screen reading with mouse and keyboard";
  }
}

/* -------------------------------------------------------------- receipt -- */

/**
 * Evidence that an action actually happened. Produced AFTER verification, never
 * before — a receipt without a check is exactly the fabricated success this
 * product refuses to produce.
 */
export interface EvidenceReceipt {
  appId: string;
  capabilityId: string;
  method: ControlMethod;
  at: string;
  verified: boolean;
  /** How it was confirmed, in the user's words. */
  evidence: string;
}

export function buildReceipt(input: {
  app: AppIdentity;
  capability: SkillCapability;
  method: ControlMethod;
  verified: boolean;
  evidence: string;
  now?: Date;
}): EvidenceReceipt {
  return {
    appId: input.app.appId,
    capabilityId: input.capability.id,
    method: input.method,
    at: (input.now ?? new Date()).toISOString(),
    verified: input.verified,
    // An unverified action must say so in its own evidence line.
    evidence: input.verified
      ? input.evidence
      : `NOT CONFIRMED: ${input.evidence || "no check was possible"}`,
  };
}
