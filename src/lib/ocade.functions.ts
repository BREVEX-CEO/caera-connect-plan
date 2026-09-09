/**
 * OCADE server functions — conversations, messages, prompt improvement.
 * All routes use requireSupabaseAuth so RLS applies as the caller.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIST_CAP, readAllPages } from "@/lib/supabase/read-all";
import type { Json } from "@/integrations/supabase/types";

const uuid = z.string().uuid();

/* -------------------- Conversations -------------------- */

/**
 * One conversation row, as every surface reads it.
 *
 * Named rather than inferred at each call site: Chat, Projects and Search all
 * render the same row, and three inferred shapes drift the moment a column is
 * added.
 */
export interface OcadeConversationRow {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  model_id: string | null;
  project_id: string | null;
  updated_at: string;
  created_at: string;
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    /*
     * Bounded, and bounded by US rather than by PostgREST's own ceiling — which
     * truncates silently at 1,000 and tells nobody. A sidebar does not need an
     * unbounded list; the most recent few hundred, pinned first, is the list.
     * Anything older is reached through Search, which reads the same rows.
     */
    const { data, error } = await context.supabase
      .from("ocade_conversations")
      .select("id, title, pinned, archived, model_id, project_id, updated_at, created_at")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(LIST_CAP);
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        id: uuid.optional(),
        title: z.string().max(200).optional(),
        modelId: z.string().max(200).optional(),
        projectId: uuid.nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_conversations")
      .upsert(
        {
          ...(data.id ? { id: data.id } : {}),
          user_id: context.userId,
          title: data.title ?? "New chat",
          model_id: data.modelId ?? null,
          ...(data.projectId !== undefined ? { project_id: data.projectId } : {}),
        },
        { onConflict: "id" },
      )
      .select("id, title, pinned, archived, model_id, project_id, updated_at, created_at")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

const updateInput = z.object({
  id: uuid,
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  modelId: z.string().max(200).nullable().optional(),
});

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => updateInput.parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (data.archived !== undefined) patch.archived = data.archived;
    if (data.modelId !== undefined) patch.model_id = data.modelId;
    const { error } = await context.supabase
      .from("ocade_conversations")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ocade_conversations").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/**
 * DELETE EVERY CONVERSATION ON THE ACCOUNT — PLAN.md §8's "delete-all".
 *
 * ONE STATEMENT, NOT A LOOP OVER IDS. A client-driven loop would delete some
 * conversations and stop where the connection did, leaving a history that is
 * neither cleared nor intact and no way for the person to tell which. Postgres
 * deletes the set or none of it.
 *
 * NO ID LIST IS ACCEPTED, deliberately. The scope is "this caller's
 * conversations", decided by the session and enforced by row-level security —
 * a request that could name what to clear could name somebody else's.
 *
 * Messages go with them: `ocade_messages` references the conversation ON DELETE
 * CASCADE, so there is no second pass that could half-succeed.
 */
export const deleteAllConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error, count } = await context.supabase
      .from("ocade_conversations")
      .delete({ count: "exact" })
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const, deleted: count ?? 0 };
  });

/* -------------------- Messages -------------------- */

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ conversationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    /*
     * A TRANSCRIPT HAS TO BE WHOLE. Capping this would silently delete the
     * beginning of any conversation past the row ceiling — the reader would
     * see a coherent-looking chat that simply starts in the middle, and the
     * model asked to continue it would be reasoning from a truncated history.
     */
    const rows = await readAllPages<{
      id: string;
      role: string;
      content: string;
      attachments: Json;
      citations: Json | null;
      reaction: string | null;
      model_id: string | null;
      provider_id: string | null;
      created_at: string;
    }>((from, to) =>
      context.supabase
        .from("ocade_messages")
        .select(
          "id, role, content, attachments, citations, reaction, model_id, provider_id, created_at",
        )
        .eq("conversation_id", data.conversationId)
        /*
         * ORDINARY TURNS ONLY. A side conversation is a message with an anchor,
         * and it belongs to that anchor rather than to the transcript. Without
         * this filter every side question would appear inline and be sent to
         * the engine as part of the thread it was deliberately kept out of.
         */
        .is("anchor_message_id", null)
        .order("created_at", { ascending: true })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows;
  });

/**
 * One side conversation: the short thread hanging off a single message.
 *
 * Separate from `listMessages` rather than a flag on it, because the two are
 * read at different moments and by different surfaces — the transcript loads
 * on open, a side thread loads when somebody expands one — and a single
 * function with a mode is how the wrong rows end up in the wrong place.
 */
export const listSideMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ conversationId: uuid, anchorMessageId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    /*
     * Paged for the same reason the transcript is: a side thread is usually
     * three turns and occasionally is not, and "usually" is not a bound.
     */
    const rows = await readAllPages<{
      id: string;
      role: string;
      content: string;
      created_at: string;
      anchor_message_id: string | null;
    }>((from, to) =>
      context.supabase
        .from("ocade_messages")
        .select("id, role, content, created_at, anchor_message_id")
        .eq("conversation_id", data.conversationId)
        .eq("anchor_message_id", data.anchorMessageId)
        .order("created_at", { ascending: true })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows;
  });

/** Discard a whole side thread. The anchor and the transcript are untouched. */
export const deleteSideThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ conversationId: uuid, anchorMessageId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ocade_messages")
      .delete()
      .eq("conversation_id", data.conversationId)
      .eq("anchor_message_id", data.anchorMessageId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ocade_messages").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/**
 * Persist a single OCADE message (P4c). Used when the assistant response is
 * produced by OCADE Local on-device — the browser streams the completion and
 * then records the user + assistant turns here. Ownership is enforced by RLS
 * (own-row on ocade_messages/ocade_conversations). Prompts to a local engine
 * never touch the server; only the resulting message text is persisted when
 * private sync is enabled.
 */
export const appendOcadeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        conversationId: uuid,
        role: z.enum(["user", "assistant"]),
        content: z.string().max(200_000),
        modelId: z.string().max(200).nullable().optional(),
        providerId: z.string().max(100).nullable().optional(),
        /**
         * An idempotency key chosen on the device, for a turn that waited in
         * an open tab while the database was unreachable.
         *
         * Optional because a message written while connected has no need of
         * one. When present it is what stops a replayed flush — a request that
         * timed out after it was applied, a reload part-way through — from
         * writing the same sentence into somebody's transcript twice.
         */
        clientKey: z.string().min(8).max(200).optional(),
        /**
         * The message this turn hangs off, for a side conversation.
         *
         * Absent for an ordinary turn. Present, the row is excluded from the
         * transcript and read only by the thread it belongs to — and the
         * foreign key removes it when the anchor goes.
         */
        anchorMessageId: uuid.optional(),
        attachments: z
          .array(
            z.object({
              kind: z.enum(["image", "file"]),
              name: z.string().max(500),
              mime: z.string().max(200),
              sizeBytes: z.number().int().nonnegative(),
            }),
          )
          .max(10)
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: conv } = await context.supabase
      .from("ocade_conversations")
      .select("id, title")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) throw new Response("Conversation not found", { status: 404 });

    const COLUMNS =
      "id, role, content, attachments, citations, reaction, model_id, provider_id, created_at";

    /*
     * ALREADY WRITTEN? SAY SO AND STOP.
     *
     * Checked before inserting rather than only after a conflict, because the
     * common replay is not a race: it is the same device asking again seconds
     * or minutes later, and answering that from a SELECT costs one indexed
     * lookup instead of a failed write. The unique index is still what makes
     * this correct — two tabs flushing the same buffer at once reach the
     * INSERT together, and the loser is caught below.
     */
    if (data.clientKey) {
      const { data: existing } = await context.supabase
        .from("ocade_messages")
        .select(COLUMNS)
        .eq("user_id", context.userId)
        .eq("client_key", data.clientKey)
        .maybeSingle();
      if (existing) return existing;
    }

    const { data: row, error } = await context.supabase
      .from("ocade_messages")
      .insert({
        conversation_id: data.conversationId,
        user_id: context.userId,
        role: data.role,
        content: data.content,
        model_id: data.modelId ?? null,
        provider_id: data.providerId ?? null,
        client_key: data.clientKey ?? null,
        anchor_message_id: data.anchorMessageId ?? null,
        attachments: (data.attachments ?? []) as never,
      })
      .select(COLUMNS)
      .single();
    if (error) {
      /*
       * 23505 on this table can only be the client-key index: every other
       * unique column is a generated id. The row the other writer inserted is
       * the answer, so read it back rather than failing a flush that
       * succeeded.
       */
      if (data.clientKey && error.code === "23505") {
        const { data: raced } = await context.supabase
          .from("ocade_messages")
          .select(COLUMNS)
          .eq("user_id", context.userId)
          .eq("client_key", data.clientKey)
          .maybeSingle();
        if (raced) return raced;
      }
      throw new Response(error.message, { status: 500 });
    }

    // Auto-title from the first user message.
    if (
      data.role === "user" &&
      !data.anchorMessageId &&
      (conv.title ?? "").toLowerCase() === "new chat" &&
      data.content.trim()
    ) {
      await context.supabase
        .from("ocade_conversations")
        .update({ title: data.content.trim().slice(0, 60) } as never)
        .eq("id", data.conversationId);
    }
    return row;
  });

/**
 * The evidence for one answer, kept ON the answer.
 *
 * Citations lived in `localStorage` with their own copies of the conversation
 * and message ids, and that produced the failure worth naming: deleting a
 * conversation left the records behind, so verbatim excerpts of documents
 * somebody had deleted stayed on disk under messages that no longer existed.
 * As a column they go when the message goes.
 */
export const saveMessageCitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        messageId: uuid,
        citations: z
          .array(
            z.object({
              sourceId: z.string().regex(/^(?:S|W)\d+$/),
              name: z.string().max(500),
              kind: z.string().max(100),
              locator: z
                .object({
                  line: z.number().int().positive().optional(),
                  page: z.number().int().positive().optional(),
                  sheet: z.string().max(200).optional(),
                  section: z.string().max(500).optional(),
                })
                .default({}),
              snippet: z.string().max(4000).nullable(),
              provenance: z
                .enum(["attached_document", "project_context", "internet_evidence"])
                .optional(),
              url: z.string().max(2000).optional(),
              domain: z.string().max(300).optional(),
              publishedAt: z.string().max(100).nullable().optional(),
              retrievedAt: z.string().max(100).optional(),
            }),
          )
          // At least one: storing an empty list would say "this answer has no
          // evidence" where absent says "none was recorded", and those are
          // different claims.
          .min(1)
          .max(10),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_messages")
      .update({ citations: data.citations as never })
      .eq("id", data.messageId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Message not found", { status: 404 });
    return { ok: true as const };
  });

/**
 * Whether the reader found an answer helpful.
 *
 * `null` clears it, and clearing is a supported operation rather than an
 * omission: pressing the active choice again is how somebody takes back
 * feedback they gave by accident, and a function that could only set one would
 * leave them no way to.
 */
export const setMessageReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z.object({ messageId: uuid, reaction: z.enum(["helpful", "not_helpful"]).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_messages")
      .update({ reaction: data.reaction })
      .eq("id", data.messageId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!row) throw new Response("Message not found", { status: 404 });
    return { ok: true as const };
  });

/**
 * Forget every excerpt of one source, across every conversation.
 *
 * WHY THIS EXISTS. A citation carries a `snippet` — a verbatim excerpt of the
 * document it cites. Deleting a file while leaving its citations behind means
 * somebody asked for a document to be gone and its text is still stored, still
 * rendered under old answers. The excerpt is small, which is exactly why it
 * gets forgotten, and it is still their content.
 *
 * Matched on the citation's `name`, because that is the only identifier a
 * citation carries. A message left with no citations has the column cleared
 * rather than set to an empty list, so "none recorded" and "evidence was
 * removed" do not become the same state.
 */
export const forgetCitationsForSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ name: z.string().trim().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const rows = await readAllPages<{ id: string; citations: Json | null }>((from, to) =>
      context.supabase
        .from("ocade_messages")
        .select("id, citations")
        .eq("user_id", context.userId)
        .not("citations", "is", null)
        .order("created_at", { ascending: true })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });

    let removed = 0;
    for (const row of rows) {
      const citations = Array.isArray(row.citations)
        ? (row.citations as Array<{ name?: unknown }>)
        : [];
      const kept = citations.filter((citation) => citation.name !== data.name);
      if (kept.length === citations.length) continue;
      removed += citations.length - kept.length;
      const { error } = await context.supabase
        .from("ocade_messages")
        .update({ citations: (kept.length > 0 ? kept : null) as never })
        .eq("id", row.id)
        .eq("user_id", context.userId);
      if (error) throw new Response(error.message, { status: 500 });
    }
    return { removed };
  });

export const exportConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ conversationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      context.supabase
        .from("ocade_conversations")
        .select("id, title, model_id, created_at, updated_at")
        .eq("id", data.conversationId)
        .maybeSingle(),
      // An export that stops at the row ceiling is a corrupt export, so this
      // one pages until it genuinely runs out.
      readAllPages<{
        role: string;
        content: string;
        attachments: Json;
        model_id: string | null;
        provider_id: string | null;
        created_at: string;
      }>((from, to) =>
        context.supabase
          .from("ocade_messages")
          .select("role, content, attachments, model_id, provider_id, created_at")
          .eq("conversation_id", data.conversationId)
          .order("created_at", { ascending: true })
          .range(from, to),
      ).then((rows) => ({ data: rows })),
    ]);
    if (!conv) throw new Response("Conversation not found", { status: 404 });
    return {
      conversation: conv,
      messages: msgs ?? [],
      exported_at: new Date().toISOString(),
      exported_by: "OCADE by CARCC CADANE",
    };
  });

/*
 * Improve Prompt used to live here as a server function calling Gemini
 * through the Lovable gateway, with no privacy gate of any kind. It is now
 * `improvePromptLocally` in src/lib/chat/improve-prompt.ts and runs on the
 * user's own engine. Nothing server-side is involved, so nothing server-side
 * remains.
 */
