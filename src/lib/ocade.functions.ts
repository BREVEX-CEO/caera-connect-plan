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
 * Named rather than inferred at each call site, so the shape does not drift the
 * moment a column changes.
 *
 * `project_id` is gone from it. The column was dropped with the Projects
 * product's tables, and the regenerated database types are what caught this
 * still writing to it — an upsert naming a column that no longer exists is a
 * failed Send, not a warning.
 */
export interface OcadeConversationRow {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  model_id: string | null;
  updated_at: string;
  created_at: string;
  /** When this was moved to trash. `null` means it is not in the trash. */
  deleted_at: string | null;
}

const CONVERSATION_COLUMNS =
  "id, title, pinned, archived, model_id, updated_at, created_at, deleted_at";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    /*
     * Bounded, and bounded by US rather than by PostgREST's own ceiling — which
     * truncates silently at 1,000 and tells nobody. A sidebar does not need an
     * unbounded list; the most recent few hundred, pinned first, is the list.
     * Anything older is reached through Search, which reads the same rows.
     */
    /*
     * THE TRASH IS SWEPT BEFORE THE LIST IS READ.
     *
     * Anything past the undo period is genuinely gone, and the only moment that
     * has to be true is when somebody looks — which is here. Swept on read
     * rather than on a schedule, the way `listApprovals` already expires
     * approvals: a cron job is a second system to deploy and monitor for a
     * question that answers itself at the point of use.
     *
     * A FAILED SWEEP IS NOT FATAL. A conversation lingering a few minutes past
     * thirty days is a cosmetic wrong; refusing to show somebody their history
     * because a cleanup failed is not. The list still excludes it.
     */
    await context.supabase.rpc("ocade_purge_expired_conversation_trash");

    /*
     * Bounded, and bounded by US rather than by PostgREST's own ceiling — which
     * truncates silently at 1,000 and tells nobody. A sidebar does not need an
     * unbounded list; the most recent few hundred, pinned first, is the list.
     * Anything older is reached through Search, which reads the same rows.
     */
    const { data, error } = await context.supabase
      .from("ocade_conversations")
      .select(CONVERSATION_COLUMNS)
      .is("deleted_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(LIST_CAP);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Move a conversation to the trash, or take it back out.
 *
 * SEPARATE FROM `updateConversation`, which patches whatever it is given. This
 * one writes a timestamp the caller does not choose: a client that could set
 * `deleted_at` could date something into the past and have it swept
 * immediately, which turns an undoable act into a permanent one through the
 * ordinary update path.
 *
 * Restoring clears the timestamp and nothing else. A conversation that was
 * archived before it was trashed comes back archived, because that is where its
 * owner left it.
 */
export const setConversationTrashed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid, trashed: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_conversations")
      .update({ deleted_at: data.trashed ? new Date().toISOString() : null })
      .eq("id", data.id)
      .select(CONVERSATION_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That conversation no longer exists.");
    return row;
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        id: uuid.optional(),
        title: z.string().max(200).optional(),
        modelId: z.string().max(200).optional(),
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
        },
        { onConflict: "id" },
      )
      .select(CONVERSATION_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
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
      throw new Error(cause.message);
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
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ocade_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * DROP A QUESTION AND EVERYTHING AFTER IT, IN ONE STATEMENT.
 *
 * Edit, Regenerate and Retry all replace a turn and its successors. The browser
 * used to delete them one call at a time, in parallel, so a failure part-way
 * through left the account's transcript missing turns from the middle — gone,
 * with no way back and nothing but a re-read to discover what remained.
 *
 * `ocade_delete_messages_from` is one DELETE, so it removes all of them or none.
 * It runs as the caller, so `own_messages` is what decides which rows it can
 * see: this function adds reachability, never authority.
 *
 * FROM A MOMENT, NOT FROM A ROW: a turn held in the tab because the account was
 * unreachable has no row to name, and the turns after it may well have been
 * stored.
 */
export const deleteMessagesFrom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z.object({ conversationId: uuid, from: z.string().datetime({ offset: true }) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase.rpc("ocade_delete_messages_from", {
      p_conversation_id: data.conversationId,
      p_from: data.from,
    });
    if (error) throw new Error(error.message);
    return { removed: Number(removed ?? 0) };
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
    if (!conv) throw new Error("Conversation not found");

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
      throw new Error(error.message);
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

/*
 * Improve Prompt used to live here as a server function calling Gemini
 * through the Lovable gateway, with no privacy gate of any kind. It is now
 * `improvePromptLocally` in src/lib/chat/improve-prompt.ts and runs on the
 * user's own engine. Nothing server-side is involved, so nothing server-side
 * remains.
 */
