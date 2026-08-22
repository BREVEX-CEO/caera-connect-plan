import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/*
 * The first block here asserted how `src/routes/api/ocade.chat.ts` proved
 * project ownership, bounded instructions and ordered persistence around a
 * cloud call. That route is deleted -- Chat generates on the device -- so the
 * properties it guarded now live in the prompt assembler and are asserted in
 * src/lib/prompt/__tests__/, against the bytes that reach the engine rather
 * than against a server file's source order.
 */

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

  it("has no cloud turn left that could carry a Browser Only body to Supabase", () => {
    /*
     * This used to assert that the server route excluded Browser Only and PC
     * Vault bodies from Supabase during a CLOUD turn. There are no cloud turns
     * now, which is a stronger guarantee than the one being tested: the
     * message never leaves the device for generation at all. What is asserted
     * instead is that the screen carries no cloud provenance and no cloud
     * escalation.
     */
    expect(chat).not.toContain('providerId: "ocade-cloud"');
    expect(chat).not.toMatch(/allowCloud:/);
    expect(chat).toContain('providerId: "ocade-local"');
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

  it("uses reviewable local memory in Chat", () => {
    expect(chat).toContain("localMemoryContext(conversation.project_id ?? null)");
    expect(chat).toContain("getProject({ data: { id: conversation.project_id } })");
    // The 20,000-character bound on project instructions moved out of this
    // screen and into the single prompt assembler, where every surface gets
    // it instead of only this one. Asserted where it now lives, and asserted
    // as behaviour rather than as a substring, so it cannot quietly lapse.
    expect(chat).toContain("assembleSystemPrompt({");
    expect(chat).toMatch(/instructions:\s*projectDetails\.instructions/);
    expect(memory).toContain('setBackend("local")');
    expect(memory).toContain("addLocalMemory({");
    expect(memory).toContain('value="project"');
    expect(memory).toContain("memoryRetention");
    expect(memory).toContain("purgeExpiredLocalMemory()");
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
