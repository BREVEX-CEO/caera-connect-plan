import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Chat uses project and attachment context without duplicating the current turn", () => {
  const route = read("src/routes/api/ocade.chat.ts");

  it("proves project ownership and reads instructions before persisting or invoking a model", () => {
    const project = route.indexOf("if (conv.project_id)");
    const persistence = route.indexOf("// Persist user message.");
    expect(project).toBeGreaterThan(-1);
    expect(route).toContain('.eq("user_id", user.id)');
    expect(route).toContain("project_context_unavailable");
    expect(route).toContain("projectContext.instructions.slice(0, 20_000)");
    expect(persistence).toBeGreaterThan(project);
  });

  it("removes the just-persisted turn from history and appends it once after file context", () => {
    const filter = route.indexOf(
      "if (userMessageResult.data && m.id === userMessageResult.data.id) continue;",
    );
    const documents = route.indexOf("if (docContext.trim())");
    const current = route.indexOf("const currentImages");
    expect(filter).toBeGreaterThan(-1);
    expect(documents).toBeGreaterThan(filter);
    expect(current).toBeGreaterThan(documents);
    expect(route).toContain("content: body.message.content");
  });

  it("requires a literal cloud-transfer approval and re-guards client document context", () => {
    expect(route).toContain("body.allowCloud !== true");
    expect(route).toMatch(
      /wrapUntrustedContent\(\s*docContext,\s*"client-supplied attachment context",\s*\)/,
    );
    expect(route).toContain("guardedDocumentContext");
  });
});

describe("Chat outputs and project navigation are real surfaces", () => {
  const chat = read("src/routes/_authenticated/ocade.index.tsx");
  const activity = read("src/routes/_authenticated/settings.activity.tsx");
  const projects = read("src/routes/_authenticated/ocade.projects.tsx");
  const memory = read("src/components/settings/MemoryPanel.tsx");
  const outputs = read("src/lib/ocade-projects.functions.ts");

  it("saves an exact assistant message through the hashed output flow", () => {
    expect(chat).toContain("saveChatOutput({");
    expect(chat).toContain('title="Save to Artifacts and Activity"');
    expect(chat).toContain("producerVerified: false");
  });

  it("edit and retry fork before the user turn instead of duplicating it", () => {
    expect(chat).toContain("forkConversationBeforeMessage({");
    expect(chat).toContain('if (chatsMode === "private_sync")');
    expect(chat).toContain("await persistChatMessage({");
    expect(chat).toContain("await deleteVaultConversation(userId, created.id)");
    expect(chat).toContain("saveDraft(created.id, message.content)");
    expect(chat).toContain("saveDraft(created.id, userMsg.content)");
    expect(chat).toContain('title="Retry in a new branch"');
    expect(chat).not.toContain("setMessages(messages.slice(0, realIdx + 1))");
  });

  it("routes the first home-surface turn through the same streaming ChatSurface pipeline", () => {
    expect(chat).toContain("setPendingMessage({");
    expect(chat).toContain("void sendMessage(initialMessage.text, initialMessage.attachments)");
    expect(chat).not.toContain("async function sendViaApi");
  });

  it("keeps Browser Only and PC Vault message bodies out of Supabase during cloud turns", () => {
    const route = read("src/routes/api/ocade.chat.ts");
    expect(route).toContain('const storesMessagesInCloud = chatsMode === "private_sync"');
    expect(route).toContain("history = supplied.map");
    expect(route).toContain("const assistantMessageResult = storesMessagesInCloud");
    expect(chat).toContain("history: messages");
    expect(chat).toContain('providerId: "ocade-cloud"');
    expect(chat).toContain('if (chatsMode !== "private_sync" && !allowCloud)');
  });

  it("shows the matching local output ledger in Activity", () => {
    expect(activity).toContain("listLocalOutputActivity()");
    expect(activity).toContain("On-device output activity");
    expect(activity).toContain("row.outputSha256");
    expect(activity).toContain("row.artifactId");
  });

  it("routes project and output controls instead of disabling planned buttons", () => {
    /*
     * The property under test is that these controls GO SOMEWHERE REAL. It was
     * previously written as an exact-string match including the human label,
     * which made renaming "Outputs" to "Files" — presentation, decided by the
     * product — look like the control had been removed. The destination and
     * the absence of a "planned" placeholder are what actually matter, so
     * those are what is asserted.
     */
    expect(chat).toMatch(/<SidebarLink[^>]*to="\/ocade\/projects"/);
    expect(chat).toMatch(/<SidebarLink[^>]*to="\/ocade\/artifacts"/);
    expect(chat).not.toContain('label="Projects" state="planned"');
    expect(chat).not.toContain('title="Project or folder — planned"');
    // A route that exists only as a disabled button is the defect this guards.
    expect(chat).not.toMatch(/to="\/ocade\/(projects|artifacts)"[^>]*disabled/);
  });

  it("uses reviewable local memory in local Chat and scoped cloud memory in cloud Chat", () => {
    const route = read("src/routes/api/ocade.chat.ts");
    expect(chat).toContain("localMemoryContext(conversation.project_id ?? null)");
    expect(chat).toContain("getProject({ data: { id: conversation.project_id } })");
    expect(chat).toContain("projectDetails.instructions.slice(0, 20_000)");
    expect(memory).toContain('setBackend("local")');
    expect(memory).toContain("addLocalMemory({");
    expect(memory).toContain('value="project"');
    expect(memory).toContain("memoryRetention");
    expect(memory).toContain("purgeExpiredLocalMemory()");
    expect(route).toContain("memory_authority_unavailable");
    expect(route).toContain("memory_context_unavailable");
    expect(route.indexOf("memorySettingsError")).toBeLessThan(
      route.indexOf("// Persist user message."),
    );
  });

  it("persists citation cards by exact assistant message and restores them after reload", () => {
    expect(chat).toContain("saveChatCitations({");
    expect(chat).toContain("getChatCitations(conversation.id, assistant.id)");
    expect(chat).toContain("removeConversationCitations(target.id)");
    expect(chat).toContain("Citation evidence could not be restored or saved");
  });

  it("makes project files and cloud-output lifecycle operational", () => {
    expect(projects).toContain("saveProjectFile({");
    expect(projects).toContain("createProjectFolder({");
    expect(projects).toContain('placeholder="Search projects"');
    expect(projects).toContain('placeholder="Search project files"');
    expect(projects).toContain("removeProjectFilesForProject(p.id)");
    expect(projects).toContain("saveNewOutputVersion");
    expect(projects).toContain("parentOutputId: preview.id");
    expect(projects).toContain("purgeExpiredOutputs()");
    expect(chat).toContain("onSaveAttachmentToProject(a)");
    expect(outputs).toContain('.lt("expires_at", new Date().toISOString())');
  });

  it("shows artifact privacy, compatible apps, previews and version restore controls", () => {
    const artifactRoute = read("src/routes/_authenticated/ocade.artifacts.tsx");
    expect(artifactRoute).toContain("Privacy: {a.privacyClass");
    expect(artifactRoute).toContain("a.compatibleApps.join");
    expect(artifactRoute).toContain('"Hide preview" : "Preview"');
    expect(artifactRoute).toContain("restore(storedVersion)");
  });

  it("server-renders the public auth shell so protected-route redirects hydrate cleanly", () => {
    const authRoute = read("src/routes/auth.tsx");
    const authenticatedRoute = read("src/routes/_authenticated/route.tsx");
    expect(authRoute).not.toContain('createFileRoute("/auth")({\n  ssr: false');
    expect(authRoute).toContain('if (typeof window === "undefined") return;');
    expect(authenticatedRoute).toContain("reloadDocument: true");
  });
});
