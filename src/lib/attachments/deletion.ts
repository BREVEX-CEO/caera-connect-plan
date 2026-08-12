/**
 * Deleting an attachment, everywhere it left a trace.
 *
 * THE PROBLEM THIS SOLVES. An uploaded file does not live in one place. By the
 * time it has been used in a conversation it has scattered:
 *
 *   - the extracted text, in the project-file store
 *   - verbatim excerpts, in saved citations under old assistant replies
 *   - the encrypted payload, in the browser vault
 *   - cached copies, in Cache Storage
 *   - the metadata, embedded in chat message records
 *   - and when synced: a database row plus the bytes in a storage bucket
 *
 * "Delete" implemented as one `DELETE FROM` removes the most visible copy and
 * leaves the rest. The user is told the document is gone while its text is
 * still readable in a citation snippet and its bytes are still in a bucket.
 *
 * TWO RULES MAKE THIS CORRECT, AND THEY PULL IN OPPOSITE DIRECTIONS.
 *
 * 1. REMOTE ORDER IS FIXED: bytes before row. The database row holds
 *    `storage_path`, which is the only record of where the bytes are. Delete
 *    the row first, fail on the object, and the bytes are unreachable forever.
 *    The reverse leaves a row pointing at a missing object, which is visible,
 *    reportable and fixable. (The database also writes a tombstone on delete,
 *    so a cascade cannot orphan an object either — see
 *    `20260806120000_ocade_attachment_deletion.sql`.)
 *
 * 2. LOCAL SITES ARE ALL ATTEMPTED, EVEN AFTER ONE FAILS. Aborting at the
 *    first failure is the intuitive choice and the wrong one: it leaves a
 *    partial deletion, reports failure, and the user retries into the same
 *    wall while the sites after the failure have never once been tried. Every
 *    site is attempted; the receipt says precisely which ones still hold data.
 *
 * WHAT IS NOT LISTED HERE. Retrieval passages and the BM25 index are computed
 * from the extracted text at query time and never persisted, so they cease to
 * exist when the project-file record does. They get no deletion step because
 * inventing one would imply a store that does not exist — and a deletion
 * receipt that lists imaginary work is exactly the reassurance this module is
 * built to avoid.
 */

import { removeProjectFile } from "../project-files";
import { removeCitationsForSource } from "../chat-citation-store";
import type { StorageAdapter } from "../storage/types";

/** Every place one attachment can have left something behind. */
export type DeletionSite =
  | "extracted_text"
  | "citation_excerpts"
  | "vault_payload"
  | "cached_copies"
  | "remote_object"
  | "remote_row";

export interface AttachmentRef {
  /** Project-file record id, when the text was extracted into one. */
  fileId?: string;
  /** Display name — how citations identify the source. */
  name: string;
  /** Vault record id and class, when a payload was stored on device. */
  vaultId?: string;
  vaultClass?: "files" | "images";
  /** Set only for a synced attachment. */
  remote?: { rowId: string; storagePath: string; bucket?: string };
}

export interface SiteOutcome {
  site: DeletionSite;
  /** True when this site is now empty — including when it never held anything. */
  cleared: boolean;
  /** What happened, in the user's terms. */
  detail: string;
}

export interface DeletionReceipt {
  /** True only when every attempted site is clear. */
  complete: boolean;
  outcomes: SiteOutcome[];
  /** Sites that still hold data, for an honest error message. */
  remaining: DeletionSite[];
  /** One sentence fit to show the user. */
  summary: string;
}

/**
 * The remote half, in the only safe order.
 *
 * Exported so the ordering is testable on its own: this is the rule that
 * silently loses a user's bytes when it is got wrong, and it is invisible in
 * the combined function.
 */
export function remoteDeletionOrder(): DeletionSite[] {
  return ["remote_object", "remote_row"];
}

/**
 * Which sites a given attachment actually occupies.
 *
 * A file that was never synced has no remote sites, and the receipt must not
 * list them as "cleared" — reporting success for work never done is the same
 * lie in a friendlier shape.
 */
export function sitesFor(ref: AttachmentRef): DeletionSite[] {
  const sites: DeletionSite[] = [];
  if (ref.fileId) sites.push("extracted_text");
  sites.push("citation_excerpts", "cached_copies");
  if (ref.vaultId && ref.vaultClass) sites.push("vault_payload");
  if (ref.remote) sites.push(...remoteDeletionOrder());
  return sites;
}

export interface DeletionPorts {
  /** Vault adapter, when there is a payload to remove. */
  adapter?: Pick<StorageAdapter, "delete">;
  /** Deletes the bucket object. Must resolve false rather than throw. */
  deleteRemoteObject?: (bucket: string, path: string) => Promise<boolean>;
  /** Deletes the database row. Only ever called after the object is gone. */
  deleteRemoteRow?: (rowId: string) => Promise<boolean>;
  /** Cache Storage, injectable so this is testable off a browser. */
  caches?: CacheStorage;
}

/** Remove any cached response whose URL mentions this attachment. */
async function clearCached(name: string, store: CacheStorage | undefined): Promise<SiteOutcome> {
  if (!store) {
    return {
      site: "cached_copies",
      cleared: true,
      detail: "No cache store on this device.",
    };
  }
  try {
    let removed = 0;
    const needle = encodeURIComponent(name);
    for (const cacheName of await store.keys()) {
      const cache = await store.open(cacheName);
      for (const request of await cache.keys()) {
        if (request.url.includes(needle) || request.url.includes(name)) {
          if (await cache.delete(request)) removed += 1;
        }
      }
    }
    return {
      site: "cached_copies",
      cleared: true,
      detail:
        removed === 0
          ? "No cached copies were held."
          : `${removed} cached ${removed === 1 ? "copy" : "copies"} deleted.`,
    };
  } catch (error) {
    return {
      site: "cached_copies",
      cleared: false,
      detail: `Cached copies could not be reached: ${
        error instanceof Error ? error.message : "the browser refused"
      }.`,
    };
  }
}

/**
 * Delete one attachment from every site it occupies.
 *
 * Never throws. A deletion routine that throws halfway is the partial-deletion
 * failure mode with a stack trace attached; the caller needs the receipt more
 * than it needs the exception.
 */
export async function deleteAttachment(
  ref: AttachmentRef,
  ports: DeletionPorts = {},
): Promise<DeletionReceipt> {
  const outcomes: SiteOutcome[] = [];

  // --- extracted text -------------------------------------------------------
  if (ref.fileId) {
    const result = removeProjectFile(ref.fileId);
    outcomes.push({
      site: "extracted_text",
      // "Not here" is a cleared site. The goal is absence, not a delete count,
      // and treating an already-absent record as failure makes retry impossible.
      cleared: result.ok || /not here/i.test(result.reason ?? ""),
      detail: result.ok
        ? "Extracted text and its fingerprint deleted. Retrieval passages and the search index were derived from it and no longer exist."
        : (result.reason ?? "Extracted text could not be deleted."),
    });
  }

  // --- citation excerpts ----------------------------------------------------
  const citations = removeCitationsForSource(ref.name);
  outcomes.push({
    site: "citation_excerpts",
    cleared: citations.ok,
    detail: citations.ok
      ? (citations.evidence ?? "Stored excerpts deleted.")
      : (citations.reason ?? "Stored excerpts could not be deleted."),
  });

  // --- vault payload --------------------------------------------------------
  if (ref.vaultId && ref.vaultClass) {
    try {
      await ports.adapter?.delete(ref.vaultClass, ref.vaultId);
      outcomes.push({
        site: "vault_payload",
        cleared: true,
        detail: "Encrypted copy deleted from this device's vault.",
      });
    } catch (error) {
      outcomes.push({
        site: "vault_payload",
        cleared: false,
        // A locked vault is the common case and it is recoverable, so it is
        // reported as itself rather than as a generic failure.
        detail: `Vault copy not deleted: ${
          error instanceof Error ? error.message : "the vault refused"
        }.`,
      });
    }
  }

  // --- cached copies --------------------------------------------------------
  outcomes.push(
    await clearCached(
      ref.name,
      ports.caches ?? (typeof caches !== "undefined" ? caches : undefined),
    ),
  );

  // --- remote: BYTES FIRST, THEN THE ROW ------------------------------------
  if (ref.remote) {
    const bucket = ref.remote.bucket ?? "message-attachments";
    let objectGone = false;
    try {
      objectGone = (await ports.deleteRemoteObject?.(bucket, ref.remote.storagePath)) ?? false;
    } catch {
      objectGone = false;
    }
    outcomes.push({
      site: "remote_object",
      cleared: objectGone,
      detail: objectGone
        ? "The stored file was deleted from the server."
        : "The stored file could not be deleted from the server yet.",
    });

    if (objectGone) {
      let rowGone = false;
      try {
        rowGone = (await ports.deleteRemoteRow?.(ref.remote.rowId)) ?? false;
      } catch {
        rowGone = false;
      }
      outcomes.push({
        site: "remote_row",
        cleared: rowGone,
        detail: rowGone
          ? "The server record was deleted."
          : "The server record remains and still points at the deleted file.",
      });
    } else {
      /*
       * The row is deliberately KEPT. It holds `storage_path`, the only record
       * of where the bytes live; deleting it now would strand them permanently.
       * A row pointing at an object that still exists is a retryable state. The
       * reverse is not.
       */
      outcomes.push({
        site: "remote_row",
        cleared: false,
        detail:
          "The server record was kept on purpose: it is the only record of where the file is stored, and deleting it would leave the file on the server with nothing able to find it. Deleting again will retry.",
      });
    }
  }

  const remaining = outcomes.filter((o) => !o.cleared).map((o) => o.site);
  const complete = remaining.length === 0;

  return {
    complete,
    outcomes,
    remaining,
    summary: complete
      ? `“${ref.name}” was deleted from every place it was stored.`
      : `“${ref.name}” was partly deleted. ${remaining.length} ${
          remaining.length === 1 ? "place" : "places"
        } still hold data — deleting again retries only those.`,
  };
}

/** Plain-language name for a site, for the deletion receipt UI. */
export function describeSite(site: DeletionSite): string {
  switch (site) {
    case "extracted_text":
      return "Text read from the file";
    case "citation_excerpts":
      return "Quoted excerpts in past replies";
    case "vault_payload":
      return "Encrypted copy on this device";
    case "cached_copies":
      return "Cached copies";
    case "remote_object":
      return "The file on the server";
    case "remote_row":
      return "The server record";
  }
}
