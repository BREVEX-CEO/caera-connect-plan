import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * LIBRARY: ONE TABLE, ONE PRIVATE BUCKET, ONE SET OF FUNCTIONS.
 *
 * Everything here runs as the CALLER, through `requireSupabaseAuth`, so the
 * row-level policies decide what each call can touch. Nothing uses the service
 * role: a library is the most personal thing in the product, and a server
 * function holding an admin client is one bug away from reading everybody's.
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

/** The whole library for this account, newest first. */
export const listLibraryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LibraryItemRow[]> => {
    const { data, error } = await context.supabase
      .from("ocade_library_items")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      /*
       * Bounded, because PostgREST's own ceiling truncates at a thousand and
       * tells nobody. A library past this is a paging problem to solve when
       * somebody has one, not a silent lie now.
       */
      .limit(500);
    if (error) throw new Error(`Your library could not be read: ${error.message}`);
    return (data ?? []) as LibraryItemRow[];
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
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(300),
      mime: z.string().trim().min(1).max(200),
      kind: z.enum(["image", "file"]),
      source: z.enum(["upload", "generated"]).default("upload"),
      conversationId: uuid.nullish(),
      /** base64, without a data: prefix. */
      contentBase64: z.string().min(1),
    }).parse,
  )
  .handler(async ({ data, context }): Promise<LibraryItemRow> => {
    const bytes = Uint8Array.from(atob(data.contentBase64), (character) => character.charCodeAt(0));
    if (bytes.byteLength > LIBRARY_MAX_BYTES) {
      throw new Error("That file is larger than OCADE can keep in your library.");
    }

    const id = crypto.randomUUID();
    const storagePath = `${context.userId}/${id}`;

    const { data: row, error } = await context.supabase
      .from("ocade_library_items")
      .insert({
        id,
        user_id: context.userId,
        kind: data.kind,
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
      .upload(storagePath, bytes, { contentType: data.mime, upsert: false });
    if (upload.error) {
      // Neither, rather than a row pointing at nothing.
      await context.supabase.from("ocade_library_items").delete().eq("id", id);
      throw new Error(`That could not be saved: ${upload.error.message}`);
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
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: uuid }).parse)
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { data: row, error } = await context.supabase
      .from("ocade_library_items")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("That item is not in your library.");

    const signed = await context.supabase.storage
      .from("library")
      .createSignedUrl(row.storage_path, 60);
    if (signed.error || !signed.data) {
      throw new Error(`That link could not be created: ${signed.error?.message ?? "no url"}`);
    }
    return { url: signed.data.signedUrl };
  });

/**
 * Remove one item, bytes and all.
 *
 * The row goes first, which tombstones the object, and then the object is
 * removed directly so the person does not wait on a sweep. A failed object
 * delete is not an error the person needs: the tombstone is the durable record
 * that those bytes are owed a deletion.
 */
export const deleteLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ocade_library_items")
      .select("storage_path")
      .eq("id", data.id)
      .single();

    const { error } = await context.supabase.from("ocade_library_items").delete().eq("id", data.id);
    if (error) throw new Error(`That could not be deleted: ${error.message}`);

    if (row?.storage_path) {
      await context.supabase.storage.from("library").remove([row.storage_path]);
    }
    return { ok: true as const };
  });

/** Everything, which is what Data Controls offers. */
export const deleteAllLibraryItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ removed: number }> => {
    /*
     * The paths are read before the rows go, so the objects can be removed
     * immediately rather than waiting on the tombstone sweep. Bounded at the
     * same 500 the list is: past that the rows are still all deleted and their
     * tombstones still name every object, so the sweep finishes the job.
     */
    const { data: rows } = await context.supabase
      .from("ocade_library_items")
      .select("storage_path")
      .limit(500);

    const { data: removed, error } = await context.supabase.rpc("ocade_delete_all_library_items");
    if (error) throw new Error(`Your library could not be emptied: ${error.message}`);

    const paths = (rows ?? []).map((row) => row.storage_path).filter(Boolean);
    if (paths.length > 0) await context.supabase.storage.from("library").remove(paths);

    return { removed: Number(removed ?? 0) };
  });
