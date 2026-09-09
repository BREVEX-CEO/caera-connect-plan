import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeOutputStore } from "./support/fake-outputs";

/**
 * SAVING AN ANSWER AS AN ARTIFACT — ONE ROW, AND THE LEDGER IT IS.
 *
 * The activity entry used to be a second record in `localStorage`, written
 * after the artifact and rolled back if it failed. Most of this file was about
 * that split: whether the ledger could disagree with the artifact list, and
 * whether the rollback fired. `PLAN.md` Phase 2 leaves one row, and the ledger
 * is a projection of it, so the split is unrepresentable and what is worth
 * proving changed:
 *
 *  - the context an answer was produced from is stored WITH it, not alongside;
 *  - the entry the Activity screen shows is derived from that row;
 *  - an output that fails its immediate re-hash is removed rather than kept.
 */

const outputs = createFakeOutputStore();
vi.mock("@/lib/ocade-projects.functions", () => outputs.module);

const { listArtifacts } = await import("../artifacts/store");
const { listOutputActivity, saveChatOutput } = await import("../artifacts/chat-output-flow");

beforeEach(() => {
  outputs.reset();
});

const answer = {
  title: "Quarterly answer",
  content: "North grew by 12%.",
  conversationId: "conversation-1",
  messageId: "message-9",
  project: {
    id: "project-2",
    name: "Q2 review",
    instructions: "Use the approved sales workbook.",
  },
  files: [{ name: "sales.csv", content: "region,growth\nNorth,12\n" }],
  producerEvidence: "Assistant response completed and was re-hashed after storage.",
  producerVerified: true,
};

describe("a chat output becomes one artifact carrying its own context", () => {
  it("keeps project, conversation, message and file context on the row", async () => {
    const result = await saveChatOutput(answer);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    expect(result.data.integrity.intact).toBe(true);
    expect(result.data.artifact.context).toMatchObject({
      conversationId: "conversation-1",
      messageId: "message-9",
      projectId: "project-2",
      projectName: "Q2 review",
    });
    // The source file's digest, not its bytes: what was read is recorded, and
    // the file itself is not uploaded.
    expect(result.data.artifact.context?.files?.[0]!.sha256).toHaveLength(64);
    expect(outputs.rows[0]!.context).toMatchObject({ messageId: "message-9" });
  });

  it("files the row under the conversation and project it came from", async () => {
    await saveChatOutput(answer);
    expect(outputs.rows[0]!.conversation_id).toBe("conversation-1");
    expect(outputs.rows[0]!.project_id).toBe("project-2");
  });

  it("shows the same facts in the activity ledger, because it is the same row", async () => {
    const result = await saveChatOutput(answer);
    if (!result.ok) throw new Error("unreachable");

    const activity = await listOutputActivity();
    expect(activity.ok).toBe(true);
    if (!activity.ok) throw new Error("unreachable");
    expect(activity.data).toHaveLength(1);
    expect(activity.data[0]).toMatchObject({
      artifactId: result.data.artifact.id,
      outputName: "Quarterly answer",
      outputSha256: result.data.artifact.sha256,
      projectId: "project-2",
      conversationId: "conversation-1",
      messageId: "message-9",
      result: "verified",
    });
  });

  it("marks an unconfirmed answer unconfirmed in the ledger too", async () => {
    await saveChatOutput({ ...answer, producerVerified: false });
    const activity = await listOutputActivity();
    if (!activity.ok) throw new Error("unreachable");
    expect(activity.data[0]!.result).toBe("not_confirmed");
  });

  it("leaves artifacts from other surfaces out of the ledger", async () => {
    // The Activity screen answers "what have I saved from a conversation".
    // Padding it with every patch and receipt would bury the entry somebody
    // came looking for.
    const { saveArtifact } = await import("../artifacts/store");
    await saveChatOutput(answer);
    await saveArtifact({
      name: "Code patch",
      kind: "patch",
      content: "--- a\n+++ b\n",
      provenance: { producedBy: "ocade.code:workspace-1", verified: true, evidence: "applied" },
    });

    const activity = await listOutputActivity();
    if (!activity.ok) throw new Error("unreachable");
    expect(activity.data).toHaveLength(1);
    expect(await listArtifacts()).toHaveLength(2);
  });
});

describe("it fails closed", () => {
  it("does not claim success when the account cannot be reached", async () => {
    const failing = vi
      .spyOn(outputs.module, "createOutput")
      .mockRejectedValueOnce(new Error("Failed to fetch"));
    const result = await saveChatOutput(answer);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/could not reach your account/i);
    expect(outputs.rows).toHaveLength(0);
    failing.mockRestore();
  });

  it("REMOVES an output that fails its immediate integrity check", async () => {
    /*
     * The re-hash reads the content back from where it was stored. An artifact
     * whose bytes did not survive the write is not worth keeping with a
     * warning: it is not the thing that was produced, and leaving it would let
     * somebody rely on it later.
     */
    const saved = outputs.module.createOutput.bind(outputs.module);
    const truncating = vi
      .spyOn(outputs.module, "createOutput")
      .mockImplementation(async (input) => {
        const row = await saved(input);
        outputs.corrupt(row.id, { content: "not what was written" });
        return row;
      });

    const result = await saveChatOutput(answer);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/failed its immediate integrity check and was removed/i);
    expect(outputs.rows, "a corrupt output was left in the account").toHaveLength(0);
    truncating.mockRestore();
  });

  it("reports an unreachable ledger instead of rendering an empty one", async () => {
    const failing = vi
      .spyOn(outputs.module, "listOutputs")
      .mockRejectedValueOnce(new Error("offline"));
    const result = await listOutputActivity();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/could not reach your account/i);
    failing.mockRestore();
  });
});
