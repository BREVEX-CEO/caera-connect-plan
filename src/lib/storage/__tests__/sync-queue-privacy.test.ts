// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { browserOutbox, enqueue } from "../sync-queue";

const QUEUE_KEY = "ocade.sync.outbox.v1";

describe("private sync queue stores metadata, never record bodies", () => {
  beforeEach(() => localStorage.clear());

  it("does not copy a newly queued value into plaintext localStorage", async () => {
    await enqueue({ dataClass: "files", id: "output:1", value: "TOP SECRET BODY" });

    const raw = localStorage.getItem(QUEUE_KEY) ?? "";
    expect(raw).not.toContain("TOP SECRET BODY");
    expect((await browserOutbox.all())[0]?.payload).toEqual({
      dataClass: "files",
      id: "output:1",
    });
  });

  it("strips plaintext bodies left by an older build on first read", async () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        {
          id: "put:chats:m1",
          kind: "message",
          conversationId: "m1",
          payload: { dataClass: "chats", id: "m1", value: "OLD PLAINTEXT" },
          queuedAt: "2026-01-01T00:00:00.000Z",
          attempts: 0,
          nextAttemptAt: 0,
        },
      ]),
    );

    await browserOutbox.all();
    expect(localStorage.getItem(QUEUE_KEY)).not.toContain("OLD PLAINTEXT");
  });
});
