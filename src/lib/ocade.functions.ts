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
      .select(
        "id, title, pinned, archived, model_id, privacy_mode, project_id, updated_at, created_at",
      )
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
        privacyMode: z.enum(["browser_only", "pc_vault", "private_sync"]).optional(),
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
          ...(data.privacyMode ? { privacy_mode: data.privacyMode } : {}),
          ...(data.projectId !== undefined ? { project_id: data.projectId } : {}),
        },
        { onConflict: "id" },
      )
      .select(
        "id, title, pinned, archived, model_id, privacy_mode, project_id, updated_at, created_at",
      )
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
      model_id: string | null;
      provider_id: string | null;
      created_at: string;
    }>((from, to) =>
      context.supabase
        .from("ocade_messages")
        .select("id, role, content, attachments, model_id, provider_id, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true })
        .range(from, to),
    ).catch((cause: Error) => {
      throw new Response(cause.message, { status: 500 });
    });
    return rows;
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

    const { data: row, error } = await context.supabase
      .from("ocade_messages")
      .insert({
        conversation_id: data.conversationId,
        user_id: context.userId,
        role: data.role,
        content: data.content,
        model_id: data.modelId ?? null,
        provider_id: data.providerId ?? null,
        attachments: (data.attachments ?? []) as never,
      })
      .select("id, role, content, attachments, model_id, provider_id, created_at")
      .single();
    if (error) throw new Response(error.message, { status: 500 });

    // Auto-title from the first user message.
    if (
      data.role === "user" &&
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
