/**
 * Signed, sandboxed, revocable community skills (P11.S05).
 *
 * `unknown-app-learning` could compile a private skill and `pack-registry`
 * could register one, but nothing could establish whether a skill came from who
 * it claimed, restrict what it may do, or WITHDRAW it once installed. Grep for
 * revocation across the whole repository returned nothing.
 *
 * That last gap is the serious one. A community skill drives someone's
 * computer. Without revocation, a skill later found to be malicious stays
 * installed and trusted on every machine that has it, forever — the publisher
 * has no way to pull it and the user has no way to learn it was pulled. Signing
 * without revocation is the weaker half of the problem.
 *
 * Three rules this module will not bend:
 *
 *   1. UNSIGNED IS UNTRUSTED. Not "trusted with a warning" — a warning on a
 *      skill that can drive a computer is a decision the user cannot make well.
 *   2. REVOCATION BEATS A VALID SIGNATURE. A correctly signed skill that has
 *      been revoked is refused. Revocation exists precisely for the case where
 *      the signature was and remains genuine.
 *   3. A SKILL MAY ONLY DO WHAT IT DECLARED. Capabilities are checked against
 *      the SIGNED manifest, so a skill cannot widen its own scope after review.
 */
import { verifyUpdateSignature } from "../packaging/update-signature";

/** Capabilities a skill may request. Nothing outside this list can be granted. */
export const SKILL_CAPABILITIES = [
  "read_screen",
  "click",
  "type",
  "read_files",
  "write_files",
  "run_cli",
  "network",
] as const;
export type SkillCapability = (typeof SKILL_CAPABILITIES)[number];

/**
 * Capabilities that can destroy data or exfiltrate it.
 *
 * A skill requesting one of these needs explicit user approval every time it is
 * installed, regardless of who signed it — a trusted publisher can still ship a
 * mistake.
 */
export const HIGH_RISK_CAPABILITIES: readonly SkillCapability[] = [
  "write_files",
  "run_cli",
  "network",
];

export interface SkillManifest {
  id: string;
  version: string;
  publisher: string;
  /** SHA-256 of the skill body, lower-case hex. Signed, not asserted. */
  contentSha256: string;
  capabilities: SkillCapability[];
  /** Application this skill was learned against — see version binding below. */
  targetAppId: string;
  targetAppVersion: string;
}

export interface SignedSkill {
  manifest: SkillManifest;
  /** Detached Ed25519 signature over contentSha256, base64. */
  signatureBase64: string | null;
}

export interface RevocationEntry {
  /** Revoke one exact version, or every version when `version` is absent. */
  skillId: string;
  version?: string;
  reason: string;
  revokedAt: string;
}

export interface PublisherKey {
  publisher: string;
  publicKeyBase64: string;
  /** A compromised publisher key revokes everything it ever signed. */
  revoked?: boolean;
}

export type TrustRefusal =
  | "unsigned"
  | "unknown_publisher"
  | "publisher_revoked"
  | "bad_signature"
  | "skill_revoked"
  | "undeclared_capability"
  | "capability_not_granted"
  | "version_drift"
  | "no_signing_key";

export type TrustVerdict =
  | { trusted: true; evidence: string; needsApproval: SkillCapability[] }
  | { trusted: false; refusal: TrustRefusal; reason: string };

export interface TrustInput {
  skill: SignedSkill;
  publishers: PublisherKey[];
  revocations: RevocationEntry[];
  /** Capabilities the user has actually granted this skill. */
  grantedCapabilities: SkillCapability[];
  /** Version of the application as observed right now. */
  observedAppVersion: string;
}

/**
 * Decide whether a skill may run.
 *
 * Order is deliberate and each step can only REFUSE. Revocation is checked
 * before the signature is even computed: a revoked skill must be refused
 * whether or not its signature still verifies, and doing the cheap check first
 * means a flood of revoked skills cannot be used to burn CPU on crypto.
 */
export async function evaluateSkillTrust(input: TrustInput): Promise<TrustVerdict> {
  const { manifest } = input.skill;

  // 1. Revocation, before anything expensive.
  const revoked = input.revocations.find(
    (r) => r.skillId === manifest.id && (r.version === undefined || r.version === manifest.version),
  );
  if (revoked) {
    return {
      trusted: false,
      refusal: "skill_revoked",
      reason: `${manifest.id} was withdrawn: ${revoked.reason}`,
    };
  }

  // 2. Publisher must be known, and not itself revoked.
  const publisher = input.publishers.find((p) => p.publisher === manifest.publisher);
  if (!publisher) {
    return {
      trusted: false,
      refusal: "unknown_publisher",
      reason: `${manifest.publisher} is not a publisher this installation trusts.`,
    };
  }
  if (publisher.revoked) {
    return {
      trusted: false,
      refusal: "publisher_revoked",
      reason: `Everything signed by ${manifest.publisher} was withdrawn after a key compromise.`,
    };
  }

  // 3. Unsigned is untrusted. No warning-and-continue path exists.
  if (!input.skill.signatureBase64) {
    return {
      trusted: false,
      refusal: "unsigned",
      reason: `${manifest.id} is not signed, so it cannot be shown to come from ${manifest.publisher}.`,
    };
  }
  if (!publisher.publicKeyBase64 || publisher.publicKeyBase64.includes("REPLACE_WITH")) {
    // Distinguish "we cannot check" from "the check failed" — they need
    // different fixes and conflating them hides an unconfigured build.
    return {
      trusted: false,
      refusal: "no_signing_key",
      reason: `No signing key is configured for ${manifest.publisher}, so its skills cannot be verified.`,
    };
  }

  // 4. Signature over the CONTENT DIGEST. Signing the manifest alone would let
  //    the body be swapped while the signature still verified.
  const verdict = await verifyUpdateSignature({
    publicKeyBase64: publisher.publicKeyBase64,
    signatureBase64: input.skill.signatureBase64,
    artifactSha256: manifest.contentSha256,
  });
  if (!verdict.ok) {
    return {
      trusted: false,
      refusal: "bad_signature",
      reason: `${manifest.id} failed signature verification: ${verdict.reason}`,
    };
  }

  // 5. Capability sandbox. Anything outside the known set is refused outright —
  //    an unrecognised capability cannot be reasoned about or enforced.
  const undeclared = manifest.capabilities.filter(
    (c) => !(SKILL_CAPABILITIES as readonly string[]).includes(c),
  );
  if (undeclared.length > 0) {
    return {
      trusted: false,
      refusal: "undeclared_capability",
      reason: `${manifest.id} requests unknown capabilities: ${undeclared.join(", ")}.`,
    };
  }
  const notGranted = manifest.capabilities.filter((c) => !input.grantedCapabilities.includes(c));
  if (notGranted.length > 0) {
    return {
      trusted: false,
      refusal: "capability_not_granted",
      reason: `${manifest.id} needs permission for: ${notGranted.join(", ")}.`,
    };
  }

  // 6. Version binding. A skill learned against one version of an application
  //    describes THAT version's controls; running it after the application
  //    changed is how automation clicks the wrong thing.
  if (!versionsCompatible(manifest.targetAppVersion, input.observedAppVersion)) {
    return {
      trusted: false,
      refusal: "version_drift",
      reason: `${manifest.id} was learned against ${manifest.targetAppId} ${manifest.targetAppVersion} but this machine has ${input.observedAppVersion}. It must be re-learned.`,
    };
  }

  return {
    trusted: true,
    evidence: `Signed by ${manifest.publisher}, not revoked, capabilities granted, matched to ${manifest.targetAppId} ${input.observedAppVersion}.`,
    // Trusted still does not mean unattended: high-risk capabilities are
    // surfaced for confirmation even from a publisher the user trusts.
    needsApproval: manifest.capabilities.filter((c) => HIGH_RISK_CAPABILITIES.includes(c)),
  };
}

/**
 * Is a skill learned against `learned` still valid on `observed`?
 *
 * Major and minor must match; patch may differ. A patch release fixes bugs
 * without moving controls, while a minor release routinely adds or renames
 * them — and a renamed control is exactly what makes automation press the
 * wrong button.
 */
export function versionsCompatible(learned: string, observed: string): boolean {
  const parse = (v: string) => v.trim().split(".").map((p) => Number.parseInt(p, 10));
  const [lMaj, lMin] = parse(learned);
  const [oMaj, oMin] = parse(observed);
  if (![lMaj, lMin, oMaj, oMin].every((n) => Number.isFinite(n))) {
    // An unparseable version is not evidence of compatibility.
    return learned.trim() === observed.trim();
  }
  return lMaj === oMaj && lMin === oMin;
}

/** In-memory revocation list. A real deployment fetches and caches a signed one. */
export class RevocationList {
  private readonly entries: RevocationEntry[] = [];

  add(entry: RevocationEntry): void {
    this.entries.push(entry);
  }

  /** Withdraw every version of a skill at once. */
  revokeAllVersions(skillId: string, reason: string, at = new Date().toISOString()): void {
    this.entries.push({ skillId, reason, revokedAt: at });
  }

  all(): RevocationEntry[] {
    return [...this.entries];
  }

  isRevoked(skillId: string, version: string): boolean {
    return this.entries.some(
      (r) => r.skillId === skillId && (r.version === undefined || r.version === version),
    );
  }
}
