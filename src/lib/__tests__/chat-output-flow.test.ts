import { beforeEach, describe, expect, it, vi } from "vitest";
import { listArtifacts } from "../artifacts/store";
import { listLocalOutputActivity, saveChatOutput } from "../artifacts/chat-output-flow";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => storage.clear(),
  });
});

describe("Chat output becomes one verified artifact and one matching activity entry", () => {
  it("keeps project, conversation, message and file context on the artifact and ledger", async () => {
    const result = await saveChatOutput({
      title: "Quarterly answer",
      content: "North grew by 12%.",
      conversationId: "conversation-1",
      messageId: "message-9",
      project: {
        id: "project-2",
        name: "Q2 review",
        instructions: "Use the approved sales workbook.",
      },
      files: [
        {
          name: "sales.csv",
          content: "region,growth\nNorth,12\n",
        },
      ],
      producerEvidence: "Assistant response completed and was re-hashed after storage.",
      producerVerified: true,
      now: new Date("2026-07-25T04:00:00.000Z"),
      artifactId: "artifact-1",
      activityId: "activity-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    expect(result.data.integrity.intact).toBe(true);
    expect(result.data.artifact.context).toMatchObject({
      conversationId: "conversation-1",
      messageId: "message-9",
      projectId: "project-2",
      projectName: "Q2 review",
    });
    expect(result.data.artifact.context?.files[0].sha256).toHaveLength(64);

    const activity = listLocalOutputActivity();
    expect(activity.ok).toBe(true);
    if (!activity.ok) throw new Error("unreachable");
    expect(activity.data).toHaveLength(1);
    expect(activity.data[0]).toMatchObject({
      id: "activity-1",
      artifactId: "artifact-1",
      outputName: "Quarterly answer",
      outputSha256: result.data.artifact.sha256,
      projectId: "project-2",
      conversationId: "conversation-1",
      messageId: "message-9",
      result: "verified",
    });
  });

  it("does not claim success when local activity persistence fails", async () => {
    let writes = 0;
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes++;
        if (writes === 2) throw new Error("activity quota");
        storage.set(key, value);
      },
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    });

    const result = await saveChatOutput({
      title: "Answer",
      content: "A result",
      conversationId: "conversation-1",
      messageId: "message-1",
      files: [],
      producerEvidence: "Completed.",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/activity.*could not be saved/i);
    expect(listArtifacts()).toHaveLength(0);
  });
});

describe("local persistence fails closed", () => {
  it("refuses an output when browser storage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);

    const result = await saveChatOutput({
      title: "Answer",
      content: "A result",
      conversationId: "conversation-1",
      messageId: "message-1",
      files: [],
      producerEvidence: "Completed.",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/storage.*unavailable/i);
  });

  it("reports corrupt activity storage instead of rendering an empty ledger", () => {
    storage.set("ocade.output-activity.v1", "{not-json");
    const result = listLocalOutputActivity();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/corrupt/i);
  });
});
