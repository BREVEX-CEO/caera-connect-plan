/**
 * OCADE server functions — conversations, messages, prompt improvement.
 * All routes use requireSupabaseAuth so RLS applies as the caller.
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
    const { error } = await context.supabase.from("ocade_messages").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/**
 * Persist a single OCADE message (P4c). Used when the assistant response is
 * produced by OCADE Local on-device — the browser streams the completion and
 * then records the user + assistant turns here. Ownership is enforced by RLS
 * (own-row on ocade_messages/ocade_conversations). Prompts to a local engine
 * never touch the server; only the resulting message text is persisted, exactly
 * as the cloud path already persists it.
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

    // Auto-title from the first user message, matching the cloud path.
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
      context.supabase
        .from("ocade_messages")
        .select("role, content, attachments, model_id, provider_id, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true }),
    ]);
    if (!conv) throw new Response("Conversation not found", { status: 404 });
    return {
      conversation: conv,
      messages: msgs ?? [],
      exported_at: new Date().toISOString(),
      exported_by: "OCADE by CAERA CADANE",
    };
  });

/* -------------------- Improve Prompt -------------------- */

export const improvePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ text: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Response("AI gateway not configured", { status: 500 });
    const { createLovableGateway, OCADE_DEFAULT_MODEL } = await import("./ai-gateway.server");
    const { generateText } = await import("ai");
    const gateway = createLovableGateway(key);
    const result = await generateText({
      model: gateway(OCADE_DEFAULT_MODEL),
      messages: [
        {
          role: "system",
          content:
            "You rewrite user prompts to be clearer, more specific and complete WITHOUT changing the user's meaning, intent, task, or constraints. Keep the same language. Preserve all facts the user gave. Do not add new tasks or invent details. Return ONLY the improved prompt text, no preamble, no quotes.",
        },
        { role: "user", content: data.text },
      ],
    });
    return { improved: result.text.trim() };
  });
