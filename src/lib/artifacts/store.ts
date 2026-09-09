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
 * WHERE THEY LIVE, AND WHY THAT CHANGED. Artifacts were kept in `localStorage`
 * under `ocade.artifacts.v1` while `ocade_outputs` held the same class of thing
 * in the account — two stores for one idea. An artifact made on a laptop was
 * invisible on a phone, sat outside every export and deletion path the account
 * offers, and vanished when somebody cleared their browser. `PLAN.md` Phase 2
 * leaves ONE persistent authority: this module is a typed view over
 * `ocade_outputs`, and every function here is a request.
 */
import {
  createOutput,
  deleteOutput,
  getOutput,
  listOutputs,
  purgeExpiredOutputs,
  setOutputRetention,
  type OcadeOutput,
  type OutputContext,
} from "@/lib/ocade-projects.functions";
import type { Outcome } from "../outcome";

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

export type ArtifactContext = OutputContext;

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
  /**
   * The chain this artifact belongs to, and its place in it. Version history is
   * recorded by the account rather than inferred from names, so a rename does
   * not split a lineage and two unrelated files with the same name do not merge
   * into one.
   */
  lineageId: string;
  version: number;
  /** The version this one was saved from, when it was saved from one. */
  parentId: string | null;
  /** Honest app/file families that can consume this artifact's exported bytes. */
  compatibleApps: string[];
  /** Optional task context that produced the artifact. */
  context?: ArtifactContext;
  /** Null/absent means keep until the user deletes it. */
  expiresAt?: string | null;
}

/* ----------------------------------------------------------------- hashing -- */

/**
 * SHA-256 via Web Crypto, which exists in browsers and in Node 18+.
 *
 * Returns a refusal rather than falling back to a weaker hash when it isn't
 * available: a digest that silently changed algorithm is worse than none,
 * because stored and recomputed values would disagree for the wrong reason.
 */
export async function sha256(text: string): Promise<Outcome<string>> {
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

/* -------------------------------------------------- artifacts as outputs -- */

/**
 * An artifact's kind is its FILE FAMILY; an output's kind is its category.
 *
 * They are different questions about the same row, so both are stored: the
 * category is what a Projects list groups by, and the file family decides the
 * extension an export gets. The mime type is what carries the family, which is
 * why the reverse mapping reads it first — a `text/csv` output produced by
 * something other than the artifact path is still a table, and calling it a
 * document because its category said "export" would give it the wrong file
 * extension on the way out.
 */
const KIND_TO_OUTPUT: Record<ArtifactKind, { kind: OcadeOutput["kind"]; mime: string }> = {
  gltf: { kind: "visual", mime: "model/gltf+json" },
  patch: { kind: "export", mime: "text/x-diff" },
  table: { kind: "export", mime: "text/csv" },
  text: { kind: "document", mime: "text/plain" },
  receipt: { kind: "other", mime: "application/json" },
};

const MIME_TO_KIND = new Map<string, ArtifactKind>(
  (Object.entries(KIND_TO_OUTPUT) as Array<[ArtifactKind, { mime: string }]>).map(
    ([kind, { mime }]) => [mime, kind],
  ),
);

function kindOf(row: OcadeOutput): ArtifactKind {
  const byMime = row.mime ? MIME_TO_KIND.get(row.mime) : undefined;
  if (byMime) return byMime;
  // An output written by another surface. `text` is the honest fallback: it
  // says nothing about the content beyond that it is readable.
  return row.kind === "visual" ? "gltf" : "text";
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

/**
 * Turn a stored row into an artifact.
 *
 * A row with no `produced_by` predates provenance being recorded. It is
 * rendered as unverified, from an unknown producer — never as verified, and
 * never with an invented producer, which is the exact lie the provenance
 * columns exist to prevent.
 */
export function artifactFromOutput(row: OcadeOutput): Artifact {
  const kind = kindOf(row);
  const content = row.content ?? "";
  return {
    id: row.id,
    name: row.title,
    kind,
    content,
    createdAt: row.created_at,
    provenance: {
      producedBy: row.produced_by ?? "an earlier version of OCADE",
      verified: row.verified,
      evidence: row.evidence ?? "",
    },
    sha256: row.content_sha256 ?? "",
    byteLength: row.size_bytes,
    lineageId: row.lineage_id,
    version: row.version,
    parentId: row.parent_output_id,
    compatibleApps: compatibleAppsFor(kind),
    ...(row.context ? { context: row.context } : {}),
    expiresAt: row.expires_at,
  };
}

/** Every request goes through here, so one unreachable account reads the same everywhere. */
function unreachable(error: unknown, doing: string): { ok: false; reason: string } {
  const detail = error instanceof Error ? error.message : "the request did not complete";
  return {
    ok: false,
    reason: `OCADE could not reach your account to ${doing}: ${detail}. Nothing was changed.`,
  };
}

/* ------------------------------------------------------------------ store -- */

export interface SaveInput {
  name: string;
  kind: ArtifactKind;
  content: string;
  provenance: Provenance;
  context?: ArtifactContext;
  /** The artifact this one is a new version of. */
  parentId?: string | null;
  /** Days to keep it; null or absent means keep until deleted. */
  retentionDays?: number | null;
  projectId?: string | null;
  conversationId?: string | null;
}

/** Store an artifact, fingerprinting its content as it goes. */
export async function saveArtifact(input: SaveInput): Promise<Outcome<Artifact>> {
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

  const mapped = KIND_TO_OUTPUT[input.kind];
  try {
    const row = await createOutput({
      data: {
        kind: mapped.kind,
        mime: mapped.mime,
        title: name,
        content: input.content,
        producedBy: input.provenance.producedBy.trim(),
        verified: input.provenance.verified,
        evidence: input.provenance.evidence || null,
        context: input.context ?? null,
        parentOutputId: input.parentId ?? null,
        projectId: input.projectId ?? null,
        conversationId: input.conversationId ?? null,
        retentionDays: input.retentionDays ?? null,
      },
    });
    const artifact = artifactFromOutput(row);
    return {
      ok: true,
      data: artifact,
      evidence: input.provenance.verified
        ? `Saved “${name}” (${artifact.byteLength} bytes), produced by ${input.provenance.producedBy} and confirmed.`
        : `Saved “${name}” (${artifact.byteLength} bytes). NOT CONFIRMED: ${input.provenance.producedBy} could not verify this result.`,
    };
  } catch (error) {
    return unreachable(error, `save “${name}”`);
  }
}

/** Everything stored, newest first. */
export async function listArtifacts(): Promise<Artifact[]> {
  const result = await inspectArtifactStore();
  return result.ok ? result.data : [];
}

/**
 * Strict read for UI/error boundaries that distinguish empty from unreachable.
 *
 * The distinction is the point. An account that could not be reached must not
 * render as "you have no artifacts": somebody would conclude their work was
 * gone and act on it.
 */
export async function inspectArtifactStore(): Promise<Outcome<Artifact[]>> {
  try {
    const rows = await listOutputs({ data: {} });
    const artifacts = rows.map(artifactFromOutput);
    return { ok: true, data: artifacts, evidence: `${artifacts.length} artifacts read.` };
  } catch (error) {
    return unreachable(error, "read your artifacts");
  }
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  try {
    return artifactFromOutput(await getOutput({ data: { id } }));
  } catch {
    return null;
  }
}

/**
 * Remove one artifact.
 *
 * Reports whether it was actually there. A delete that returns success for an
 * id that never existed lets a UI show "deleted" for something it didn't touch.
 */
export async function removeArtifact(id: string): Promise<Outcome<{ removed: boolean }>> {
  try {
    await getOutput({ data: { id } });
  } catch {
    return { ok: false, reason: "That artifact isn't here — nothing was deleted." };
  }
  try {
    await deleteOutput({ data: { id } });
    return { ok: true, data: { removed: true }, evidence: "Deleted." };
  } catch (error) {
    return unreachable(error, "delete that artifact");
  }
}

export async function setArtifactRetention(
  id: string,
  days: number | null,
): Promise<Outcome<Artifact>> {
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    return {
      ok: false,
      reason: "Retention must be between 1 and 3,650 days, or keep until deleted.",
    };
  }
  try {
    const artifact = artifactFromOutput(await setOutputRetention({ data: { id, days } }));
    return {
      ok: true,
      data: artifact,
      evidence:
        artifact.expiresAt == null
          ? "Artifact will be kept until you delete it."
          : `Artifact will be eligible for deletion after ${artifact.expiresAt}.`,
    };
  } catch (error) {
    if (error instanceof Response && error.status === 404) {
      return { ok: false, reason: "That artifact isn't here." };
    }
    return unreachable(error, "change how long that artifact is kept");
  }
}

export async function purgeExpiredArtifacts(): Promise<Outcome<{ removed: number }>> {
  try {
    const { removed } = await purgeExpiredOutputs();
    return {
      ok: true,
      data: { removed },
      evidence:
        removed === 0
          ? "No expired artifacts were deleted."
          : `Deleted ${removed} expired artifact${removed === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return unreachable(error, "delete expired artifacts");
  }
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
export async function verifyIntegrity(id: string): Promise<Outcome<IntegrityResult>> {
  const artifact = await getArtifact(id);
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
