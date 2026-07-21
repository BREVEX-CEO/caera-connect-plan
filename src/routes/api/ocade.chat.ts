/**
 * OCADE streaming chat endpoint. Verifies the caller with a Supabase bearer,
 * enforces the user's chats privacy mode, persists messages, and streams the
 * assistant response back as text/plain chunks.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import { createLovableGateway, OCADE_DEFAULT_MODEL } from "@/lib/ai-gateway.server";

type Attachment = { kind: "image" | "file"; name: string; mime: string; dataUrl?: string; sizeBytes: number };
type ChatBody = {
  conversationId: string;
  model?: string;
  allowCloud?: boolean;
  message: { content: string; attachments?: Attachment[] };
};

export const Route = createFileRoute("/api/ocade/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env.SUPABASE_URL;
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !publishable) return new Response("Backend misconfigured", { status: 500 });
        if (!lovableKey) return new Response("AI gateway not configured", { status: 500 });

        const supabase = createClient(supabaseUrl, publishable, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        });
        const { data: userRes } = await supabase.auth.getUser(token);
        const user = userRes.user;
        if (!user) return new Response("Unauthorized", { status: 401 });

        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!body?.conversationId || typeof body.message?.content !== "string") {
          return new Response("Missing conversationId or message", { status: 400 });
        }
        const modelId = body.model || OCADE_DEFAULT_MODEL;

        // Verify conversation ownership (RLS also enforces this).
        const { data: conv } = await supabase
          .from("ocade_conversations")
          .select("id, title, privacy_mode")
          .eq("id", body.conversationId)
          .maybeSingle();
        if (!conv) return new Response("Conversation not found", { status: 404 });

        // Read chats privacy mode; browser_only refuses cloud without explicit approval.
        const { data: pRow } = await supabase
          .from("data_class_privacy")
          .select("mode")
          .eq("user_id", user.id)
          .eq("data_class", "chats")
          .maybeSingle();
        const chatsMode = (pRow?.mode as string | undefined) ?? "private_sync";
        if (chatsMode === "browser_only" && !body.allowCloud) {
          return new Response(
            JSON.stringify({
              error: "cloud_transfer_required",
              message:
                "Your chats are set to Browser Only. Approve one-time cloud transfer to use this model.",
            }),
            { status: 428, headers: { "content-type": "application/json" } },
          );
        }

        const attachments = body.message.attachments ?? [];
        for (const a of attachments) {
          if (a.sizeBytes > 20 * 1024 * 1024) {
            return new Response("Attachment exceeds 20 MB limit", { status: 413 });
          }
        }
        if (attachments.length > 10) {
          return new Response("Maximum 10 attachments per message", { status: 413 });
        }

        // Persist user message.
        await supabase.from("ocade_messages").insert({
          conversation_id: conv.id,
          user_id: user.id,
          role: "user",
          content: body.message.content,
          attachments: attachments.map((a) => ({
            kind: a.kind,
            name: a.name,
            mime: a.mime,
            sizeBytes: a.sizeBytes,
          })) as never,
        });

        // Rename conversation from first user message if still default.
        if ((conv.title ?? "").toLowerCase() === "new chat" && body.message.content.trim()) {
          const auto = body.message.content.trim().slice(0, 60);
          await supabase.from("ocade_conversations").update({ title: auto } as never).eq("id", conv.id);
        }

        // Load full history for context.
        const { data: history } = await supabase
          .from("ocade_messages")
          .select("role, content, attachments")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });

        const systemPrompt =
          "You are OCADE by CAERA CADANE, a private AI coworker. Always introduce yourself as \"OCADE by CAERA CADANE.\" Never claim to be ChatGPT, Claude, Gemini, Llama or any other product. If the user directly asks what model, LLM, or provider powers you, answer truthfully by naming the currently active model. Never claim CAERA CADANE trained the underlying weights. Be helpful, concise, and honest about limits.";

        const modelMessages: ModelMessage[] = [{ role: "system", content: systemPrompt }];
        for (const m of history ?? []) {
          if (m.role === "system") continue;
          const atts = (m.attachments as Attachment[] | null) ?? [];
          const imageAtts = atts.filter((a) => a.kind === "image" && a.dataUrl);
          if (m.role === "user" && imageAtts.length > 0) {
            modelMessages.push({
              role: "user",
              content: [
                { type: "text", text: String(m.content) },
                ...imageAtts.map((a) => ({ type: "image" as const, image: a.dataUrl! })),
              ],
            });
          } else {
            modelMessages.push({ role: m.role as "user" | "assistant", content: String(m.content) });
          }
        }
        // Append current user message with any inline image data (not persisted with data URL).
        const currentImages = attachments.filter((a) => a.kind === "image" && a.dataUrl);
        if (currentImages.length > 0) {
          modelMessages.push({
            role: "user",
            content: [
              { type: "text", text: body.message.content },
              ...currentImages.map((a) => ({ type: "image" as const, image: a.dataUrl! })),
            ],
          });
        }

        const gateway = createLovableGateway(lovableKey);
        try {
          const result = streamText({
            model: gateway(modelId),
            messages: modelMessages,
            onFinish: async ({ text }) => {
              await supabase.from("ocade_messages").insert({
                conversation_id: conv.id,
                user_id: user.id,
                role: "assistant",
                content: text,
                model_id: modelId,
                provider_id: "lovable-ai",
              });
              await supabase
                .from("ocade_conversations")
                .update({ model_id: modelId, provider_id: "lovable-ai" } as never)
                .eq("id", conv.id);
            },
          });
          return result.toTextStreamResponse();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(`AI gateway error: ${msg}`, { status: 502 });
        }
      },
    },
  },
});
