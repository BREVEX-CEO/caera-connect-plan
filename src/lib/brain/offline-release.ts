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

export interface OfflineRelease {
  /** Opaque, derived from the artifact's digest. Never a model name. */
  releaseId: string;
  totalBytes: number;
  sha256: string;
  contextTokens: number;
  /** Working set while running. Used for the honest pre-check. */
  requiredMemoryBytes: number;
  /** Whether deliberating before answering earns its cost on this artifact. */
  thinkingSuitable: boolean;
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
  if (value.schemaVersion !== 2) return null;
  if (typeof value.releaseId !== "string" || !/^ocr-[0-9a-f]{16}$/.test(value.releaseId)) {
    return null;
  }
  if (typeof value.totalBytes !== "number" || value.totalBytes <= 0) return null;
  if (typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.sha256)) return null;

  return {
    releaseId: value.releaseId,
    totalBytes: value.totalBytes,
    sha256: value.sha256,
    contextTokens: value.contextTokens ?? 4096,
    requiredMemoryBytes: value.requiredMemoryBytes ?? 900 * 1024 * 1024,
    thinkingSuitable: value.thinkingSuitable === true,
  };
}

/**
 * THE ONLY NAME A CUSTOMER EVER SEES FOR THIS.
 *
 * One constant, so a screen cannot invent a second one and a diagnostics panel
 * cannot leak the first.
 */
export const OFFLINE_LABEL = "Offline Intelligence";

/** Bytes → "512 MB", for the one line shown before a download starts. */
export function formatSize(bytes: number): string {
  const MB = 1024 * 1024;
  return bytes >= 1024 * MB
    ? `${(bytes / (1024 * MB)).toFixed(2)} GB`
    : `${Math.round(bytes / MB)} MB`;
}
