/**
 * OCADE companion update-decision & rollback engine (master plan §18 — packaging,
 * "updater / rollback").
 *
 * This is the SOURCE-AUTHORABLE half of self-update: the deterministic policy
 * that decides whether an offered update may be applied, and — when a staged
 * apply fails its post-install verification — which known-good version to roll
 * back to. The RUNTIME half (downloading bytes, swapping the binary on disk,
 * relaunching the process, verifying an Ed25519 signature against the shipped
 * public key) lives in the Tauri updater plugin and can only be proven on a real
 * installed machine. That boundary is deliberate: nothing here claims a binary
 * was downloaded, swapped, signed, or run. It decides; the host acts.
 *
 * THREE HONESTY / SAFETY RULES:
 *
 * 1. **Fail closed on missing provenance.** An update with no signature or no
 *    content hash is never "apply" — it is refused. Silence about provenance is
 *    treated as absence of provenance, not permission.
 * 2. **Never auto-downgrade.** An offered version older than what is installed
 *    is refused, not silently applied. Downgrade is a recovery decision a human
 *    makes, not something an update feed can trigger.
 * 3. **Rollback needs a proven-good target.** A staged version that has not yet
 *    passed verification is not a rollback target. If no strictly-older
 *    known-good version exists, rollback refuses and asks for manual recovery
 *    rather than pretending it can restore something it never proved good.
 */

// ---------------------------------------------------------------------------
// Semantic versions (semver.org §11 precedence, dependency-free).
// ---------------------------------------------------------------------------

export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** Dot-separated prerelease identifiers, e.g. ["beta", "2"]; empty for a release. */
  readonly prerelease: readonly string[];
  readonly raw: string;
}

const CORE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PRE_IDENT = /^[0-9A-Za-z-]+$/;
const NUMERIC = /^(0|[1-9]\d*)$/;

/**
 * Strictly parse `major.minor.patch` with an optional `-prerelease`. Build
 * metadata (`+…`) is intentionally rejected rather than ignored: an updater that
 * silently drops part of a version string can treat two different builds as the
 * same. Returns null on any malformed input — callers must fail closed on null.
 */
export function parseVersion(raw: string): SemVer | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 256) return null;
  const [coreAndPre, ...extra] = raw.split("+");
  if (extra.length > 0) return null; // build metadata not accepted
  const dash = coreAndPre.indexOf("-");
  const core = dash === -1 ? coreAndPre : coreAndPre.slice(0, dash);
  const pre = dash === -1 ? "" : coreAndPre.slice(dash + 1);

  const m = CORE.exec(core);
  if (!m) return null;

  let prerelease: string[] = [];
  if (dash !== -1) {
    if (pre.length === 0) return null; // trailing dash, no identifiers
    prerelease = pre.split(".");
    for (const id of prerelease) {
      if (!PRE_IDENT.test(id)) return null;
      // A numeric identifier must not have a leading zero (semver §9).
      if (NUMERIC.test(id) === false && /^\d+$/.test(id)) return null;
    }
  }

  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease,
    raw,
  };
}

function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  // A version WITHOUT prerelease outranks the same version WITH one.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const ai = a[i];
    const bi = b[i];
    const an = NUMERIC.test(ai);
    const bn = NUMERIC.test(bi);
    if (an && bn) {
      const d = Number(ai) - Number(bi);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (an) {
      return -1; // numeric identifiers are lower than alphanumeric
    } else if (bn) {
      return 1;
    } else if (ai !== bi) {
      return ai < bi ? -1 : 1; // ASCII lexical
    }
  }
  // All shared identifiers equal: the longer set has higher precedence.
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

/** -1 if a < b, 0 if equal precedence, 1 if a > b. */
export function compareVersions(a: SemVer, b: SemVer): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  const p = comparePrerelease(a.prerelease, b.prerelease);
  return p === 0 ? 0 : p < 0 ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Update decision.
// ---------------------------------------------------------------------------

/** A manifest as an update feed / Tauri updater endpoint would return it. */
export interface UpdateManifest {
  readonly version: string;
  /** Detached signature over the canonical manifest. Absent/empty ⇒ refused. */
  readonly signature?: string | null;
  /** Content hash of the artifact. Absent/empty ⇒ unverifiable ⇒ refused. */
  readonly sha256?: string | null;
  /** Download location; recorded on the plan, never fetched here. */
  readonly url?: string;
  /** Stable identity of the trusted signing key. */
  readonly signingKeyId?: string | null;
  /** Epoch milliseconds included in the signed manifest. */
  readonly signedAt?: number | null;
  /**
   * Optional upgrade floor: the client must already be at least this version to
   * accept this update directly (a staged upgrade path). Below it ⇒ refused with
   * the floor named, so the host can fetch the intermediate first.
   */
  readonly minimumClientVersion?: string;
  readonly notes?: string;
}

export interface UpdatePolicy {
  readonly currentVersion: string;
  /** Refuse unsigned updates. Default true; never silently relaxed. */
  readonly requireSignature?: boolean;
  /** Refuse updates with no content hash. Default true. */
  readonly requireHash?: boolean;
  /** Allow moving onto a prerelease build. Default false (stable channel). */
  readonly allowPrerelease?: boolean;
}

export type UpdateDecision =
  | { readonly action: "apply"; readonly from: string; readonly to: string; readonly url?: string }
  | { readonly action: "skip"; readonly reason: string }
  | { readonly action: "refuse"; readonly reason: string };

/**
 * Decide what to do with an offered update. Pure and total: every path returns
 * one of apply / skip / refuse, and every refuse names why. `skip` means "no
 * action needed, nothing wrong" (already current); `refuse` means "an update was
 * offered but policy forbids applying it".
 */
export function planUpdate(manifest: UpdateManifest, policy: UpdatePolicy): UpdateDecision {
  const requireSignature = policy.requireSignature !== false;
  const requireHash = policy.requireHash !== false;

  const current = parseVersion(policy.currentVersion);
  if (!current)
    return { action: "refuse", reason: `unreadable current version "${policy.currentVersion}"` };

  const next = parseVersion(manifest.version);
  if (!next)
    return { action: "refuse", reason: `unreadable manifest version "${manifest.version}"` };

  // Provenance is checked BEFORE version math: an unsigned or unhashed feed is
  // untrustworthy about its own version number too.
  //
  // NOTE ON SCOPE: this is a PRESENCE check. Whether the signature is genuine is
  // decided by `verifyUpdateSignature` in ./update-signature, which needs the
  // downloaded artifact's real digest and therefore cannot run at planning time.
  // `planUpdate` says "this update may be fetched"; it never says "this update
  // is authentic". The staged-apply state machine below refuses to COMMIT until
  // verification has passed, so a manifest that lies about its signature is
  // caught before anything is installed.
  if (requireSignature && !hasValue(manifest.signature)) {
    return { action: "refuse", reason: "update is unsigned — refusing (fail closed)" };
  }
  if (requireHash && !hasValue(manifest.sha256)) {
    return { action: "refuse", reason: "update has no content hash — refusing (fail closed)" };
  }

  const cmp = compareVersions(next, current);
  if (cmp < 0) {
    return {
      action: "refuse",
      reason: `offered ${next.raw} is older than installed ${current.raw} — never auto-downgrade`,
    };
  }
  if (cmp === 0) {
    return { action: "skip", reason: `already at ${current.raw}` };
  }

  if (next.prerelease.length > 0 && policy.allowPrerelease !== true) {
    return {
      action: "skip",
      reason: `${next.raw} is a prerelease and this channel is stable-only`,
    };
  }

  if (hasValue(manifest.minimumClientVersion)) {
    const floor = parseVersion(manifest.minimumClientVersion as string);
    if (!floor) {
      return {
        action: "refuse",
        reason: `manifest minimumClientVersion "${manifest.minimumClientVersion}" is unreadable`,
      };
    }
    if (compareVersions(current, floor) < 0) {
      return {
        action: "refuse",
        reason: `staged upgrade required: install ${floor.raw} before ${next.raw} (current ${current.raw})`,
      };
    }
  }

  return { action: "apply", from: current.raw, to: next.raw, url: manifest.url };
}

function hasValue(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Rollback decision.
// ---------------------------------------------------------------------------

export type InstallHealth = "known_good" | "unverified" | "failed";

export interface InstallRecord {
  readonly version: string;
  /** Epoch ms the record was written; used only for tie-independent ordering info. */
  readonly installedAt: number;
  readonly health: InstallHealth;
}

export type RollbackDecision =
  | { readonly action: "rollback"; readonly from: string; readonly to: string }
  | { readonly action: "refuse"; readonly reason: string };

/**
 * A staged apply of `failedVersion` did not pass post-install verification.
 * Choose the roll-back target: the highest-precedence version in `history` that
 * is (a) marked `known_good` and (b) strictly older than the failed version.
 *
 * Fail closed: if no such proven-good older version exists, refuse and ask for
 * manual recovery rather than restoring something never proven good (an
 * `unverified` or `failed` record is not a valid target).
 */
export function decideRollback(
  history: readonly InstallRecord[],
  failedVersion: string,
): RollbackDecision {
  const failed = parseVersion(failedVersion);
  if (!failed) return { action: "refuse", reason: `unreadable failed version "${failedVersion}"` };

  let best: SemVer | null = null;
  for (const rec of history) {
    if (rec.health !== "known_good") continue;
    const v = parseVersion(rec.version);
    if (!v) continue;
    if (compareVersions(v, failed) >= 0) continue; // must be strictly older
    if (best === null || compareVersions(v, best) > 0) best = v;
  }

  if (best === null) {
    return {
      action: "refuse",
      reason: `no known-good version older than ${failed.raw} — manual recovery required`,
    };
  }
  return { action: "rollback", from: failed.raw, to: best.raw };
}

// ---------------------------------------------------------------------------
// Staged-apply state machine (write → stage → verify → commit | rollback).
// ---------------------------------------------------------------------------

export type StageState = "idle" | "staged" | "verifying" | "committed" | "rolled_back";
export type StageEvent = "stage" | "verify" | "pass" | "fail";

/**
 * The legal transitions of a staged apply. Modelled as a pure function so the
 * "you cannot commit before verifying" and "a failed verify goes to rollback,
 * never to committed" invariants are unit-testable without a filesystem.
 * `committed` and `rolled_back` are terminal.
 */
export function advanceStage(state: StageState, event: StageEvent): StageState | { error: string } {
  switch (state) {
    case "idle":
      return event === "stage" ? "staged" : { error: `cannot ${event} from idle` };
    case "staged":
      return event === "verify" ? "verifying" : { error: `cannot ${event} from staged` };
    case "verifying":
      if (event === "pass") return "committed";
      if (event === "fail") return "rolled_back";
      return { error: `cannot ${event} while verifying` };
    case "committed":
    case "rolled_back":
      return { error: `${state} is terminal` };
    default:
      return { error: `unknown state ${state as string}` };
  }
}

// ---------------------------------------------------------------------------
// Staged-artifact integrity verdict (the decision the `verify` step is made on).
// ---------------------------------------------------------------------------

export interface IntegrityEvidence {
  /** Hash the manifest promised. */
  readonly expectedSha256: string;
  /** Hash actually computed over the downloaded bytes (by the host — not here). */
  readonly computedSha256: string;
  /** Size the manifest promised, in bytes. */
  readonly expectedBytes: number;
  /** Size actually written to the staging slot. */
  readonly actualBytes: number;
}

export type IntegrityVerdict =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Decide whether a staged artifact may be committed, given the hash/size the
 * manifest promised and what the host actually observed on disk. This is the
 * PURE verdict behind the state machine's `verify` step — the host computes the
 * SHA-256 (it has the bytes; this module never does) and hands the result here.
 *
 * Fails closed: a malformed expected hash, a size mismatch, or any hash
 * difference is a refusal, never a pass. Hashes are lower-cased and length-
 * checked before comparison so a truncated or upper/lower-case-skewed digest is
 * rejected as malformed rather than silently "not matching".
 */
export function verifyStagedArtifact(evidence: IntegrityEvidence): IntegrityVerdict {
  const expected = normaliseHash(evidence.expectedSha256);
  const computed = normaliseHash(evidence.computedSha256);

  if (expected === null)
    return { ok: false, reason: "manifest hash is not a valid sha-256 digest" };
  if (computed === null)
    return { ok: false, reason: "computed hash is not a valid sha-256 digest" };

  if (!Number.isInteger(evidence.expectedBytes) || evidence.expectedBytes <= 0) {
    return { ok: false, reason: "manifest size is missing or non-positive" };
  }
  if (evidence.actualBytes !== evidence.expectedBytes) {
    return {
      ok: false,
      reason: `size mismatch: staged ${evidence.actualBytes} bytes, manifest promised ${evidence.expectedBytes}`,
    };
  }

  if (!constantTimeEqual(expected, computed)) {
    return {
      ok: false,
      reason: "content hash does not match the manifest — bytes are wrong or tampered",
    };
  }
  return { ok: true };
}

function normaliseHash(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const lower = raw.trim().toLowerCase();
  return HEX64.test(lower) ? lower : null;
}

/**
 * Length-independent, content constant-time string comparison. Both inputs are
 * already validated as 64-char hex, so lengths are equal; the loop still avoids
 * an early return so a match verdict does not leak timing about where a
 * mismatching digest first diverged.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
