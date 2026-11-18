/**
 * THE ONE ARTIFACT OFFLINE INTELLIGENCE INSTALLS, DESCRIBED WITHOUT NAMING IT.
 *
 * Everything here is opaque on purpose. `CLAUDE.md`'s identity rule is that a
 * customer only ever meets OCADE, and the previous catalogue broke it in the
 * most durable way available: a committed JSON file carrying the publisher's
 * repository, the file name, the quantisation and a public download URL, read
 * by a module that put the same strings into storage keys and progress text.
 * Anyone who opened the network panel learned what OCADE runs; anyone who
 * opened the repository learned it without trying.
 *
 * What replaces it is a release id derived from the artifact's own digest, a
 * length, that digest, and the two numbers an installer needs to refuse
 * honestly before it starts. No repository, no file name, no publisher, no
 * quantisation, no vendor, and no permanent URL — the bytes are reached only
 * through an authorised, expiring link OCADE mints for a signed-in person.
 *
 * WHAT THIS IS NOT. It is not a claim that the bytes on a device are
 * unknowable. A determined owner of a machine can inspect anything stored on
 * it, and `PLAN.md` says so plainly. This minimises disclosure as far as a
 * browser allows; it does not pretend to do more.
 */
import record from "../../../release/OCADE_OFFLINE_RELEASE.json";

/** One GGUF inside the artifact, in order: language weights, then the vision projector. */
export interface OfflineReleasePart {
  bytes: number;
  sha256: string;
}

export interface OfflineRelease {
  /** Opaque, derived from the artifact's digest. Never a model name. */
  releaseId: string;
  totalBytes: number;
  /** Digest of the whole artifact: both parts back to back. */
  sha256: string;
  /**
   * Exactly two parts whose sizes add up to `totalBytes`. The installer checks
   * the whole digest, which pins both parts at once; the engine then loads the
   * first as the language weights and the second as the vision projector.
   */
  parts: [OfflineReleasePart, OfflineReleasePart];
  contextTokens: number;
  /** Working set while running. Used for the honest pre-check. */
  requiredMemoryBytes: number;
  /** Whether deliberating before answering earns its cost on this artifact. */
  thinkingSuitable: boolean;
  /** Set only from a PASS of `scripts/prove-offline-artifact.mjs` on this artifact. */
  vision: boolean;
}

const DIGEST = /^[0-9a-f]{64}$/;

function validParts(
  value: unknown,
  totalBytes: number,
): value is [OfflineReleasePart, OfflineReleasePart] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  let sum = 0;
  for (const part of value as Partial<OfflineReleasePart>[]) {
    if (!Number.isSafeInteger(part?.bytes) || (part.bytes as number) <= 0) return false;
    if (typeof part.sha256 !== "string" || !DIGEST.test(part.sha256)) return false;
    sum += part.bytes as number;
  }
  return sum === totalBytes;
}

/**
 * The published release, or null when there is not one yet.
 *
 * Null is a real state, not an error: a deployment whose artifact has not been
 * published must say Offline Intelligence is not available rather than offer an
 * install that cannot finish. Every caller handles it.
 */
export function offlineRelease(): OfflineRelease | null {
  // Read as unknown: the committed file is data, and until a release is
  // published it genuinely does not have this shape.
  const value = record as unknown as Partial<OfflineRelease> & { schemaVersion?: number };
  if (value.schemaVersion !== 3) return null;
  if (typeof value.releaseId !== "string" || !/^ocr-[0-9a-f]{16}$/.test(value.releaseId)) {
    return null;
  }
  if (typeof value.totalBytes !== "number" || value.totalBytes <= 0) return null;
  if (typeof value.sha256 !== "string" || !DIGEST.test(value.sha256)) return null;
  if (!validParts(value.parts, value.totalBytes)) return null;

  return {
    releaseId: value.releaseId,
    totalBytes: value.totalBytes,
    sha256: value.sha256,
    parts: value.parts,
    contextTokens: value.contextTokens ?? 4096,
    requiredMemoryBytes: value.requiredMemoryBytes ?? 900 * 1024 * 1024,
    thinkingSuitable: value.thinkingSuitable === true,
    vision: value.vision === true,
  };
}

/**
 * THE ONLY NAME A CUSTOMER EVER SEES FOR THIS.
 *
 * One constant, so a screen cannot invent a second one and a diagnostics panel
 * cannot leak the first.
 */
export const OFFLINE_LABEL = "Offline Mode";
