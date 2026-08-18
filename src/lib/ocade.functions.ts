/**
 * OCADE server functions — conversation/message persistence only.
 *
 * AI inference is local-only. These authenticated functions may persist data
 * when the user selected Private Sync, but they never call an AI provider or
 * read an AI-provider API key.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/* -------------------- Conversations -------------------- */

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ocade_conversations")
      .select(
        "id, title, pinned, archived, model_id, privacy_mode, project_id, updated_at, created_at",
      )
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({ title: z.string().max(200).optional(), modelId: z.string().max(200).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ocade_conversations")
      .insert({
        user_id: context.userId,
        title: data.title ?? "New chat",
        model_id: data.modelId ?? null,
      })
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
    const { data: changed, error } = await context.supabase
      .from("ocade_conversations")
      .update(patch as never)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!changed) throw new Response("Conversation not found", { status: 404 });
    return { ok: true as const };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("ocade_conversations")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!deleted) throw new Response("Conversation not found", { status: 404 });
    return { ok: true as const };
  });

/* -------------------- Messages -------------------- */

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ conversationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ocade_messages")
      .select("id, role, content, attachments, model_id, provider_id, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Response(error.message, { status: 500 });
    return rows ?? [];
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await context.supabase
      .from("ocade_messages")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!deleted) throw new Response("Message not found", { status: 404 });
    return { ok: true as const };
  });

/** Persist one on-device-generated OCADE message when Private Sync is enabled. */
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
    const { data: conv, error: convError } = await context.supabase
      .from("ocade_conversations")
      .select("id, title")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (convError) throw new Response(convError.message, { status: 500 });
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

    let titleUpdateFailed = false;
    if (
      data.role === "user" &&
      (conv.title ?? "").toLowerCase() === "new chat" &&
      data.content.trim()
    ) {
      const { error: titleError } = await context.supabase
        .from("ocade_conversations")
        .update({ title: data.content.trim().slice(0, 60) } as never)
        .eq("id", data.conversationId);
      // The message already committed. Throwing here would make the client
      // retry the whole send and duplicate the message, so report the secondary
      // title failure without pretending the message itself failed.
      titleUpdateFailed = !!titleError;
    }
    return { ...row, title_update_failed: titleUpdateFailed };
  });

export const exportConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ conversationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [convResult, msgResult] = await Promise.all([
      context.supabase
        .from("ocade_conversations")
        .select("id, title, model_id, created_at, updated_at")
        .eq("id", data.conversationId)
        .maybeSingle(),
      context.supabase
        .from("ocade_messages")
        .select("role, content, attachments, model_id, provider_id, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true }),
    ]);
    if (convResult.error) throw new Response(convResult.error.message, { status: 500 });
    if (msgResult.error) throw new Response(msgResult.error.message, { status: 500 });
    if (!convResult.data) throw new Response("Conversation not found", { status: 404 });
    return {
      conversation: convResult.data,
      messages: msgResult.data ?? [],
      exported_at: new Date().toISOString(),
      exported_by: "OCADE by CAERA CADANE",
    };
  });

/* -------------------- Prompt cleanup -------------------- */

/**
 * Compatibility replacement for the old server-side cloud prompt improver.
 * It performs only deterministic whitespace cleanup on the server. Any future
 * semantic rewrite must run through the user's on-device Brain, never a server
 * AI provider.
 */
export const improvePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ text: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => ({
    improved: data.text
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    localOnly: true as const,
  }));
