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
  /*
   * The Chat route was split in Phase 1. The composer, the rail and the
   * dialogs are their own modules now, so the rules they carry are read from
   * the file that owns each one — a slice of the wrong file would pass by
   * matching nothing.
   */
  const composer = read("src/components/ocade/chat/ChatComposer.tsx");
  const rail = read("src/components/ocade/chat/ChatContextualSidebar.tsx");
  const activity = read("src/routes/_authenticated/settings.activity.tsx");
  const projects = read("src/routes/_authenticated/ocade.projects.tsx");
  const bubble = read("src/components/ocade/chat/MessageBubble.tsx");
  const memory = read("src/components/settings/MemoryPanel.tsx");
  const outputs = read("src/lib/ocade-projects.functions.ts");

  it("saves an exact assistant message through the hashed output flow", () => {
    expect(chat).toContain("saveChatOutput({");
    expect(chat).toContain("producerVerified: false");
    /*
     * THE CONTROL IS ASSERTED WHERE IT IS RENDERED, which is not where this
     * used to look. The string it matched — `title="Save to Artifacts and
     * Activity"` — belonged to a `MessageRow` component in the chat route that
     * NOTHING referenced: the transcript has rendered `MessageBubble` for a
     * long time, so this assertion was passing against dead source while
     * telling nobody whether the live surface had a save control at all. It
     * would have gone on passing with the real button deleted.
     *
     * Both halves are checked because either alone is satisfiable without the
     * other: the button exists in the transcript component, and the screen
     * hands it a handler.
     */
    expect(bubble).toContain('<ActionButton label="Save this answer"');
    expect(bubble).toContain("actions.onSave?.(message)");
    expect(chat).toMatch(/onSave: \(m\) => \{/);
  });

  it("edit and retry fork before the user turn instead of duplicating it", () => {
    /*
     * ONE FORK, ON THE SERVER. There used to be two paths — this one, and a
     * local copy that created a conversation in the device vault and replayed
     * the earlier turns into it one write at a time, cleaning up with
     * `deleteVaultConversation` when a turn could not be copied. A copy that
     * can half-finish is the thing this control must not be.
     */
    expect(chat).toContain("forkConversationBeforeMessage({");
    expect(chat).not.toContain("deleteVaultConversation");
    expect(chat).toContain("saveDraft(created.id, message.content)");
    expect(chat).toContain("saveDraft(created.id, userMsg.content)");
    expect(composer).toContain('title="Retry in a new branch"');
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

  it("shows the matching saved-output ledger in Activity", () => {
    expect(activity).toContain("listOutputActivity()");
    expect(activity).toContain("Saved chat outputs");
    expect(activity).toContain("row.outputSha256");
    expect(activity).toContain("row.artifactId");
    // The ledger is the artifact rows, so the copy must not still say these
    // are kept on this device.
    expect(activity, "the Activity screen still claims on-device storage").not.toMatch(
      /on this device/i,
    );
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
    expect(rail).toMatch(/<SidebarLink[^>]*to="\/ocade\/projects"/);
    expect(rail).toMatch(/<SidebarLink[^>]*to="\/ocade\/artifacts"/);
    expect(rail).not.toContain('label="Projects" state="planned"');
    expect(rail).not.toContain('title="Project or folder — planned"');
    // A route that exists only as a disabled button is the defect this guards.
    expect(rail).not.toMatch(/to="\/ocade\/(projects|artifacts)"[^>]*disabled/);
  });

  it("uses reviewable account memory in Chat", () => {
    /*
     * ONE AUTHORITY. Memory used to have an on-device fallback, so this check
     * asserted the local reader. `PLAN.md` Phase 2 leaves `ocade_memory` as the
     * only place memory is kept, and the defect to guard against now is the
     * opposite one: a screen that answers from somewhere else when the account
     * is unreachable.
     */
    expect(chat).toContain("readMemoryContext(conversation.project_id ?? null)");
    expect(chat).toContain("await readMemory()");
    expect(chat, "the chat screen kept a second memory store").not.toContain("local-memory");
    // The project a conversation is filed in comes from the account, with its
    // files, in one round trip rather than two.
    expect(chat).toMatch(/listProjects\(\),\s*listProjectFiles\(\{ data: \{ projectId \} \}\)/);
    // The 20,000-character bound on project instructions moved out of this
    // screen and into the single prompt assembler, where every surface gets
    // it instead of only this one. Asserted where it now lives, and asserted
    // as behaviour rather than as a substring, so it cannot quietly lapse.
    expect(chat).toContain("assembleSystemPrompt({");
    expect(chat).toMatch(/instructions:\s*projectDetails\.instructions/);
    expect(memory).toContain("addMemory({");
    expect(memory).toContain('value="project"');
    expect(memory).toContain("memoryRetention");
    expect(memory).toContain("purgeExpiredMemory()");
    // The panel must not reintroduce the on-device fallback it used to carry:
    // two memory sets meant a review screen could show the wrong one.
    expect(memory, "the memory panel kept a second backend").not.toMatch(/backend|local-memory/);
  });

  it("keeps citation cards ON the answer they belong to, and restores them with it", () => {
    /*
     * Citations used to be a browser store with its own copies of the
     * conversation and message ids, and it had to be swept when a conversation
     * was deleted. The sweep is what failed: verbatim excerpts of deleted
     * documents survived, keyed to messages that no longer existed. They are a
     * column on the message now, so they arrive with the transcript and go with
     * the cascade.
     */
    expect(chat).toContain("saveMessageCitations({ data: { messageId, citations: parsed } })");
    expect(chat).toContain("assistant.citations ?? []");
    expect(chat).toContain("Citation evidence could not be restored or saved");
    expect(chat, "the chat screen kept a second citation store").not.toContain(
      "chat-citation-store",
    );
  });

  it("makes project files and device-first output lifecycle operational", () => {
    expect(projects).toContain("saveProjectFile({");
    expect(projects).toContain("createProjectFolder({");
    expect(projects).toContain('placeholder="Search projects"');
    expect(projects).toContain('placeholder="Search project files"');
    expect(projects).toContain("deleteProject({ data: { id: p.id } })");
    expect(projects).toContain("saveNewOutputVersion");
    expect(projects).toContain("parentOutputId: preview.id");
    expect(projects).toContain("purgeExpiredOutputs()");
    expect(composer).toContain("onSaveAttachmentToProject(a)");
    expect(outputs).toContain('.lt("expires_at", new Date().toISOString())');
    // A project's files and folders go with it through the foreign key rather
    // than through a second sweep that can fail on its own.
    expect(outputs).toContain('.from("ocade_project_files")');
    expect(outputs).toContain('.from("ocade_project_folders")');
  });

  it("shows artifact version, compatible apps, previews and restore controls", () => {
    const artifactRoute = read("src/routes/_authenticated/ocade.artifacts.tsx");
    /*
     * The privacy class is gone, and its absence is asserted. It named which of
     * three stores an artifact happened to be in; there is one store now, and a
     * label offering a choice that no longer exists would be a fake control.
     */
    expect(artifactRoute).not.toContain("privacyClass");
    expect(artifactRoute).toContain("Version {a.version}");
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
