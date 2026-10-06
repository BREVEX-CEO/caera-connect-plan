import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { imageMediaType, isMediaType } from "@/lib/media-type";

/**
 * LIBRARY: ONE TABLE, ONE PRIVATE BUCKET, ONE SET OF FUNCTIONS.
 *
 * Everything here runs as the CALLER, through `requireSupabaseAuth`, so the
 * row-level policies decide what each call can touch. The one exception is
 * settling deletion tombstones (`tombstones.server.ts`), which only the service
 * role may write, scoped to the caller's own id.
 *
 * WHAT A ROW IS. An index entry: a name, a kind, a size and where the object
 * sits. The bytes live in the private `library` bucket under the owner's own
 * id, and they are reached only through a short-lived signed URL minted for the
 * person who asked.
 *
 * WHY UPLOADS GO THROUGH HERE RATHER THAN STRAIGHT TO STORAGE. The row and the
 * object have to agree. Uploading first and inserting second leaves an orphan
 * object when the insert fails; inserting first leaves a row pointing at
 * nothing. The order below is: insert the row, upload the bytes, and delete the
 * row if the upload fails — so the only state anybody can observe is "both" or
 * "neither".
 */

const uuid = z.string().uuid();

export interface LibraryItemRow {
  id: string;
  kind: "image" | "file";
  source: "upload" | "generated";
  name: string;
  mime: string;
  size_bytes: number;
  storage_path: string;
  conversation_id: string | null;
  created_at: string;
}

const COLUMNS =
  "id, kind, source, name, mime, size_bytes, storage_path, conversation_id, created_at";

/**
 * A hundred megabytes, matching the bucket's own ceiling.
 *
 * `PLAN.md` and `docs/TRD.md` both name that figure for one intentionally
 * supported attachment. Refusing it here as well means a person is told before
 * spending the upload rather than after it.
 */
export const LIBRARY_MAX_BYTES = 100 * 1024 * 1024;

/** What `LIBRARY_MAX_BYTES` costs as base64, with room for the padding. */
const MAX_BASE64_LENGTH = Math.ceil(LIBRARY_MAX_BYTES / 3) * 4 + 4;

/**
 * The whole library for this account, newest first: every item, in pages, so an older file
 * is still found and opened (PostgREST's own ceiling would truncate silently). The id breaks
 * ties so the pages neither repeat nor skip an item.
 */
export const listLibraryItems = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<LibraryItemRow[]> => {
    const { readAllPages } = await import("@/lib/supabase/read-all");
    try {
      return await readAllPages<LibraryItemRow>(
        (from, to) =>
          context.supabase
            .from("ocade_library_items")
            .select(COLUMNS)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to) as unknown as PromiseLike<{
            data: LibraryItemRow[] | null;
            error: { message: string } | null;
          }>,
      );
    } catch (error) {
      throw new Error(
        `Your library could not be read: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  });

/**
 * Put something in the library.
 *
 * The bytes arrive base64-encoded in the request rather than by a direct upload
 * to storage, because the row and the object must be created together and only
 * the server can undo half of that. It bounds the size for the same reason the
 * bucket does.
 */
export const addLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(300),
      /*
       * Shaped like a media type, because it is recorded as one. It is never
       * acted on — see the stored content type below — but a column that says
       * "media type" should not hold a free-form string a caller chose.
       */
      mime: z.string().trim().min(1).max(200).refine(isMediaType, "That file type is not valid."),
      kind: z.enum(["image", "file"]),
      source: z.enum(["upload", "generated"]).default("upload"),
      conversationId: uuid.nullish(),
      /**
       * base64, without a data: prefix.
       *
       * BOUNDED BEFORE IT IS DECODED. The ceiling was checked on the decoded
       * bytes, so the only thing standing between a request and an arbitrary
       * amount of memory in the isolate was the decode itself — a caller could
       * post half a gigabyte of base64 and have it materialised twice over
       * before anything said it was too large. A string that cannot hold
       * `LIBRARY_MAX_BYTES` is refused without being looked at.
       */
      contentBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
    }).parse,
  )
  .handler(async ({ data, context }): Promise<LibraryItemRow> => {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data.contentBase64), (character) => character.charCodeAt(0));
    } catch {
      // `atob` throws on anything that is not base64, and the raw exception is
      // neither useful to a person nor safe to show them.
      throw new Error("That file could not be read.");
    }
    if (bytes.byteLength > LIBRARY_MAX_BYTES) {
      throw new Error("That file is larger than OCADE can keep in your library.");
    }

    /*
     * WHAT THE BYTES ARE, NOT WHAT THE CALLER SAID THEY WERE.
     *
     * The stored object's content type was whatever arrived in `mime`, and the
     * Library opens an object by minting a signed URL and handing it to a new
     * tab. Storage serves what it was told, so a file stored as `text/html` or
     * `image/svg+xml` was an attacker-chosen DOCUMENT served from the project's
     * own storage domain, reached through OCADE's own screen. Nothing about the
     * caller's declaration reaches that decision now: an image is stored as the
     * format its first bytes actually are, and everything else is stored as
     * bytes to be downloaded.
     */
    const signature = imageMediaType(bytes.subarray(0, 12));
    const kind = data.kind === "image" && signature ? "image" : "file";
    const storedType = signature && kind === "image" ? signature : "application/octet-stream";

    const id = crypto.randomUUID();
    const storagePath = `${context.userId}/${id}`;

    const { data: row, error } = await context.supabase
      .from("ocade_library_items")
      .insert({
        id,
        user_id: context.userId,
        kind,
        source: data.source,
        name: data.name,
        mime: data.mime,
        size_bytes: bytes.byteLength,
        storage_path: storagePath,
        conversation_id: data.conversationId ?? null,
      })
      .select(COLUMNS)
      .single();
    if (error || !row) throw new Error(`That could not be saved: ${error?.message ?? "no row"}`);

    const upload = await context.supabase.storage
      .from("library")
      .upload(storagePath, bytes, { contentType: storedType, upsert: false });
    if (upload.error) {
      // Neither, rather than a row pointing at nothing — and said plainly when that undo fails.
      const undone = await context.supabase.from("ocade_library_items").delete().eq("id", id);
      throw new Error(
        undone.error
          ? `That could not be saved, and its empty entry “${data.name}” is still listed in your Library: delete it there.`
          : `That could not be saved: ${upload.error.message}`,
      );
    }

    return row as LibraryItemRow;
  });

/**
 * A short-lived link to one object, for previewing or downloading it.
 *
 * Signed rather than public, and minted per request: the bucket is private, so
 * a URL is the only way bytes reach a browser, and one that does not expire is
 * a public file with an unguessable name.
 */
export const signLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator(z.object({ id: uuid, download: z.boolean().optional() }).parse)
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { data: row, error } = await context.supabase
      .from("ocade_library_items")
      .select("storage_path, name")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("That item is not in your library.");

    // A download link is served as an attachment with the item's own name.
    const signed = await context.supabase.storage
      .from("library")
      .createSignedUrl(row.storage_path, 60, data.download ? { download: row.name } : undefined);
    if (signed.error || !signed.data) {
      throw new Error(`That link could not be created: ${signed.error?.message ?? "no url"}`);
    }
    return { url: signed.data.signedUrl };
  });

/**
 * Remove one item, bytes and all.
 *
 * The row goes first, which tombstones the object; the sweep then removes the
 * bytes and acknowledges the tombstone only once Storage confirms. A failed
 * removal stays pending and is retried by the owner's next deletion.
 */
export const deleteLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator(z.object({ id: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase
      .from("ocade_library_items")
      .delete({ count: "exact" })
      .eq("id", data.id);
    if (error) throw new Error(`That could not be deleted: ${error.message}`);
    if (!count) throw new Error("That item is not in your library.");
    const { pending } = await (await import("./tombstones.server")).sweepTombstones(context.userId);
    /** Bytes not yet erased: the item is gone from the list, its file is still being removed. */
    return { ok: true as const, pending };
  });

/** Everything, which is what Data Controls offers. */
export const deleteAllLibraryItems = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<{ removed: number; pending: number }> => {
    const { data: removed, error } = await context.supabase.rpc("ocade_delete_all_library_items");
    if (error) throw new Error(`Your library could not be emptied: ${error.message}`);
    const { pending } = await (await import("./tombstones.server")).sweepTombstones(context.userId);
    return { removed: Number(removed ?? 0), pending };
  });
