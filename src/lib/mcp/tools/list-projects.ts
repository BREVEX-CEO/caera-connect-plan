import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List OCADE projects",
  description: "List the signed-in user's OCADE projects with their standing instructions.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many projects to return."),
    includeArchived: z.boolean().default(false).describe("Include archived projects."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, includeArchived }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("ocade_projects")
      .select("id, name, instructions, archived, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!includeArchived) query = query.eq("archived", false);
    const { data, error } = await query;
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : {
          content: [{ type: "text", text: JSON.stringify(data ?? []) }],
          structuredContent: { projects: data ?? [] },
        };
  },
});
