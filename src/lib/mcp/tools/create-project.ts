import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_project",
  title: "Create an OCADE project",
  description:
    "Create a new OCADE project for the signed-in user, optionally with standing instructions.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Project name."),
    instructions: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .describe("Standing instructions OCADE should follow inside this project."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, instructions }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const userId = ctx.getUserId();
    if (!userId)
      return { content: [{ type: "text", text: "No user in the token." }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("ocade_projects")
      .insert({ user_id: userId, name, instructions: instructions ?? null })
      .select("id, name, instructions, created_at")
      .single();
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : {
          content: [{ type: "text", text: JSON.stringify(data) }],
          structuredContent: { project: data },
        };
  },
});
