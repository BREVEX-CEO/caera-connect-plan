import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "read_conversation",
  title: "Read an OCADE conversation",
  description: "Return the messages of one OCADE conversation owned by the signed-in user.",
  inputSchema: {
    conversationId: z.string().uuid().describe("The conversation id."),
    limit: z.number().int().min(1).max(200).default(50).describe("How many messages to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ conversationId, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: conversation, error: convError } = await supabase
      .from("ocade_conversations")
      .select("id, title, model_id, privacy_mode, project_id, updated_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (convError) return { content: [{ type: "text", text: convError.message }], isError: true };
    if (!conversation)
      return {
        content: [{ type: "text", text: "No conversation with that id is available to you." }],
        isError: true,
      };
    const { data, error } = await supabase
      .from("ocade_messages")
      .select("id, role, content, created_at, model_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : {
          content: [{ type: "text", text: JSON.stringify({ conversation, messages: data ?? [] }) }],
          structuredContent: { conversation, messages: data ?? [] },
        };
  },
});
