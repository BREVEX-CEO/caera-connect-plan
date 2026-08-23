import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listConversations from "./tools/list-conversations";
import readConversation from "./tools/read-conversation";
import listProjects from "./tools/list-projects";
import createProject from "./tools/create-project";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ocade-foundation-plan",
  title: "OCADE Foundation Plan",
  version: "0.1.0",
  instructions:
    "Tools for CARCC CADANE. Read the signed-in user's OCADE conversations and projects, and create new projects. All access runs as the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listConversations, readConversation, listProjects, createProject],
});
