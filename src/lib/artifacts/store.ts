/**
 * OCADE Artifacts — the things OCADE produced, kept with their provenance.
 *
 * An artifact without provenance is just a file. The questions that matter when
 * you find one three weeks later are: what made this, was the result actually
 * checked, and is it still the bytes that were written? All three are stored
 * with the content and none of them are optional.
 *
 * TWO DESIGN RULES.
 *
 * 1. **An unverified artifact says so, permanently.** `verified: false` is
 *    carried on the record and rendered every time it is listed. A file
 *    produced by a step that could not confirm its own result is not the same
 *    as one that was checked, and the distinction is invisible in the content.
 *
 * 2. **Integrity is checked by re-hashing, not by trusting the stored hash.**
 *    `verifyIntegrity` recomputes the digest from the content it just read. A
 *    check that compared the stored hash against itself would pass on a
 *    truncated file, which is exactly the case it exists to catch.
 *
 * Storage is local to the device, matching the rest of OCADE's local-first
 * surfaces. Nothing here uploads anything.
 */

export type ArtifactOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type ArtifactKind = "gltf" | "patch" | "table" | "text" | "receipt";

export interface Provenance {
  /** The surface or pack that produced it, e.g. "ocade.data:data.summarise". */
  producedBy: string;
  /**
   * Whether the producing step confirmed its own result. False is a permanent
   * property of the artifact, not a transient UI state.
   */
  verified: boolean;
  /** The producer's own evidence line, stored verbatim. */
  evidence: string;
}

export interface ArtifactContext {
  conversationId: string;
  messageId: string;
  projectId?: string;
  projectName?: string;
  projectInstructions?: string;
  files: Array<{
    name: string;
    sha256: string;
  }>;
}

export interface Artifact {
  id: string;
  name: string;
  kind: ArtifactKind;
  content: string;
  createdAt: string;
  provenance: Provenance;
  /** SHA-256 of the content at the moment it was stored. */
  sha256: string;
  byteLength: number;
  /** Where this artifact record is stored. New local artifacts never imply cloud sync. */
  privacyClass: "on_device" | "private_sync" | "pc_vault";
  /** Honest app/file families that can consume this artifact's exported bytes. */
  compatibleApps: string[];
  /** Optional task context that produced the artifact. */
  context?: ArtifactContext;
  /** Null/absent means keep until the user deletes it. */
  expiresAt?: string | null;
}

const STORAGE_KEY = "ocade.artifacts.v1";

/* ----------------------------------------------------------------- hashing -- */

/**
 * SHA-256 via Web Crypto, which exists in browsers and in Node 18+.
 *
 * Returns a refusal rather than falling back to a weaker hash when it isn't
 * available: a digest that silently changed algorithm is worse than none,
 * because stored and recomputed values would disagree for the wrong reason.
 */
export async function sha256(text: string): Promise<ArtifactOutcome<string>> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return {
      ok: false,
      reason:
        "This device doesn't expose Web Crypto, so OCADE can't fingerprint the file. It won't substitute a weaker hash and call it the same thing.",
    };
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { ok: true, data: hex, evidence: `SHA-256 ${hex.slice(0, 12)}…` };
}

/* ------------------------------------------------------------------ store -- */

function read(): ArtifactOutcome<Artifact[]> {
  const storage = globalThis.localStorage;
  if (!storage) {
    return {
      ok: false,
      reason: "Browser storage is unavailable, so artifacts cannot be read.",
    };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ok: true, data: [], evidence: "No artifacts stored." };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        reason:
          "Artifact storage is corrupt. OCADE will not replace it or render it as an empty list.",
      };
    }
    const artifacts = (parsed as Artifact[]).map((artifact) => ({
      ...artifact,
      privacyClass: artifact.privacyClass ?? "on_device",
      compatibleApps:
        Array.isArray(artifact.compatibleApps) && artifact.compatibleApps.length > 0
          ? artifact.compatibleApps
          : compatibleAppsFor(artifact.kind),
    }));
    return {
      ok: true,
      data: artifacts,
      evidence: `${artifacts.length} artifacts read.`,
    };
  } catch {
    return {
      ok: false,
      reason:
        "Artifact storage is corrupt. OCADE will not replace it or render it as an empty list.",
    };
  }
}

function write(items: Artifact[]): ArtifactOutcome<number> {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return {
        ok: false,
        reason: "Browser storage is unavailable, so the artifact was not saved.",
      };
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    return { ok: true, data: items.length, evidence: `${items.length} artifacts stored.` };
  } catch (e) {
    // Quota is the realistic failure, and silently dropping the newest artifact
    // is the worst possible response to it.
    return {
      ok: false,
      reason: `The artifact couldn't be saved: ${e instanceof Error ? e.message : "storage refused it"}. Nothing was changed — delete an older artifact and try again.`,
    };
  }
}

export interface SaveInput {
  name: string;
  kind: ArtifactKind;
  content: string;
  provenance: Provenance;
  context?: ArtifactContext;
  expiresAt?: string | null;
  privacyClass?: Artifact["privacyClass"];
  compatibleApps?: string[];
  /** Injected in tests; defaults to now. */
  now?: Date;
  /** Injected in tests; defaults to a random id. */
  id?: string;
}

/** Store an artifact, fingerprinting its content as it goes. */
export async function saveArtifact(input: SaveInput): Promise<ArtifactOutcome<Artifact>> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: "An artifact needs a name." };
  if (input.content.length === 0) {
    return { ok: false, reason: `“${name}” has no content, so there is nothing to keep.` };
  }
  if (!input.provenance.producedBy.trim()) {
    return {
      ok: false,
      reason:
        "An artifact must record what produced it. OCADE won't store a file with no provenance — that's how an unchecked result becomes indistinguishable from a checked one.",
    };
  }

  const hash = await sha256(input.content);
  if (!hash.ok) return hash;

  const existingResult = read();
  if (!existingResult.ok) return existingResult;
  const existing = existingResult.data;
  const requestedAt = input.now ?? new Date();
  const latestStoredMs = input.now
    ? Number.NEGATIVE_INFINITY
    : existing.reduce((latest, item) => {
        const parsed = Date.parse(item.createdAt);
        return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
      }, Number.NEGATIVE_INFINITY);
  // Several saves can complete inside one millisecond. Default timestamps must
  // still be strictly monotonic or a restore can sort behind the version it
  // restored and the UI will keep showing stale content as current. Explicit
  // test/import timestamps are preserved exactly and retain the id tiebreak.
  const createdAtMs = input.now
    ? requestedAt.getTime()
    : Math.max(requestedAt.getTime(), latestStoredMs + 1);
  const artifact: Artifact = {
    id: input.id ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    kind: input.kind,
    content: input.content,
    createdAt: new Date(createdAtMs).toISOString(),
    provenance: input.provenance,
    sha256: hash.data,
    byteLength: new TextEncoder().encode(input.content).length,
    privacyClass: input.privacyClass ?? "on_device",
    compatibleApps:
      input.compatibleApps && input.compatibleApps.length > 0
        ? [...new Set(input.compatibleApps.map((app) => app.trim()).filter(Boolean))].slice(0, 20)
        : compatibleAppsFor(input.kind),
    ...(input.context ? { context: input.context } : {}),
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
  };

  const stored = write([artifact, ...existing]);
  if (!stored.ok) return stored;

  return {
    ok: true,
    data: artifact,
    evidence: input.provenance.verified
      ? `Saved “${name}” (${artifact.byteLength} bytes), produced by ${input.provenance.producedBy} and confirmed.`
      : `Saved “${name}” (${artifact.byteLength} bytes). NOT CONFIRMED: ${input.provenance.producedBy} could not verify this result.`,
  };
}

function compatibleAppsFor(kind: ArtifactKind): string[] {
  switch (kind) {
    case "gltf":
      return ["glTF-compatible 3D tools", "Blender"];
    case "patch":
      return ["Git", "text editors"];
    case "table":
      return ["spreadsheet apps", "text editors"];
    case "receipt":
      return ["OCADE Activity", "JSON/text viewers"];
    case "text":
      return ["text editors", "Markdown-compatible apps"];
  }
}

/** Everything stored, newest first. */
export function listArtifacts(): Artifact[] {
  const result = read();
  return result.ok ? result.data : [];
}

/** Strict read for UI/error boundaries that distinguish empty from corrupt. */
export function inspectArtifactStore(): ArtifactOutcome<Artifact[]> {
  return read();
}

export function getArtifact(id: string): Artifact | null {
  const result = read();
  return result.ok ? (result.data.find((a) => a.id === id) ?? null) : null;
}

/**
 * Remove one artifact.
 *
 * Reports whether it was actually there. A delete that returns success for an
 * id that never existed lets a UI show "deleted" for something it didn't touch.
 */
export function removeArtifact(id: string): ArtifactOutcome<{ removed: boolean }> {
  const beforeResult = read();
  if (!beforeResult.ok) return beforeResult;
  const before = beforeResult.data;
  const after = before.filter((a) => a.id !== id);
  if (after.length === before.length) {
    return { ok: false, reason: "That artifact isn't here — nothing was deleted." };
  }
  const stored = write(after);
  if (!stored.ok) return stored;
  return {
    ok: true,
    data: { removed: true },
    evidence: `Deleted. ${after.length} artifacts remain.`,
  };
}

export function setArtifactRetention(
  id: string,
  days: number | null,
  now: Date = new Date(),
): ArtifactOutcome<Artifact> {
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    return {
      ok: false,
      reason: "Retention must be between 1 and 3,650 days, or keep until deleted.",
    };
  }
  const stored = read();
  if (!stored.ok) return stored;
  const index = stored.data.findIndex((artifact) => artifact.id === id);
  if (index < 0) return { ok: false, reason: "That artifact isn't here." };
  const expiresAt =
    days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const updated = { ...stored.data[index], expiresAt };
  const next = [...stored.data];
  next[index] = updated;
  const saved = write(next);
  if (!saved.ok) return saved;
  return {
    ok: true,
    data: updated,
    evidence:
      expiresAt === null
        ? "Artifact will be kept until you delete it."
        : `Artifact will be eligible for deletion after ${expiresAt}.`,
  };
}

export function purgeExpiredArtifacts(
  now: Date = new Date(),
): ArtifactOutcome<{ removed: number; remaining: number }> {
  const stored = read();
  if (!stored.ok) return stored;
  const current = now.getTime();
  const remaining = stored.data.filter((artifact) => {
    if (!artifact.expiresAt) return true;
    const expiry = Date.parse(artifact.expiresAt);
    return !Number.isFinite(expiry) || expiry > current;
  });
  const removed = stored.data.length - remaining.length;
  if (removed === 0) {
    return {
      ok: true,
      data: { removed: 0, remaining: remaining.length },
      evidence: "No expired artifacts were deleted.",
    };
  }
  const saved = write(remaining);
  if (!saved.ok) return saved;
  return {
    ok: true,
    data: { removed, remaining: remaining.length },
    evidence: `Deleted ${removed} expired artifact${removed === 1 ? "" : "s"}.`,
  };
}

/* -------------------------------------------------------------- integrity -- */

export interface IntegrityResult {
  intact: boolean;
  storedHash: string;
  actualHash: string;
}

/**
 * Re-hash an artifact's content and compare with what was stored.
 *
 * The hash is recomputed from the content, never read back and compared with
 * itself — that version of the check passes on a truncated file, which is the
 * case it exists to catch.
 */
export async function verifyIntegrity(id: string): Promise<ArtifactOutcome<IntegrityResult>> {
  const stored = read();
  if (!stored.ok) return stored;
  const artifact = stored.data.find((item) => item.id === id) ?? null;
  if (!artifact) return { ok: false, reason: "That artifact isn't here." };

  const actual = await sha256(artifact.content);
  if (!actual.ok) return actual;

  const intact = actual.data === artifact.sha256;
  return {
    ok: true,
    data: { intact, storedHash: artifact.sha256, actualHash: actual.data },
    evidence: intact
      ? `“${artifact.name}” is byte-for-byte what was written.`
      : `“${artifact.name}” has changed since it was stored. Expected ${artifact.sha256.slice(0, 12)}…, found ${actual.data.slice(0, 12)}…. Don't rely on it.`,
  };
}

/* ----------------------------------------------------------------- export -- */

const EXTENSIONS: Record<ArtifactKind, string> = {
  gltf: "gltf",
  patch: "diff",
  table: "csv",
  text: "txt",
  receipt: "json",
};

export function exportFilename(artifact: Artifact): string {
  // Keep it filesystem-safe without mangling it beyond recognition.
  const base =
    artifact.name
      .replace(/[^\w.\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "-") || "artifact";
  return `${base}.${EXTENSIONS[artifact.kind]}`;
}

/**
 * One line describing an artifact for a list.
 *
 * An unverified artifact is labelled every single time it is shown, not once at
 * creation — see the module header.
 */
export function describeArtifact(a: Artifact): string {
  const size = a.byteLength < 1024 ? `${a.byteLength} B` : `${(a.byteLength / 1024).toFixed(1)} kB`;
  const base = `${size} · from ${a.provenance.producedBy}`;
  return a.provenance.verified ? base : `${base} · NOT CONFIRMED`;
}
