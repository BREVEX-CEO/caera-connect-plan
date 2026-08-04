import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getChatCitations,
  removeConversationCitations,
  saveChatCitations,
} from "../chat-citation-store";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
});

const citation = {
  sourceId: "S1",
  name: "brief.md",
  kind: "text" as const,
  locator: { line: 3 },
  snippet: "Approved requirement",
};

describe("chat citation history", () => {
  it("binds verified citation cards to one exact assistant message and restores them", () => {
    expect(
      saveChatCitations({
        conversationId: "c1",
        messageId: "a1",
        citations: [citation],
        now: new Date("2026-07-25T05:00:00.000Z"),
      }).ok,
    ).toBe(true);
    const restored = getChatCitations("c1", "a1");
    expect(restored.ok && restored.data).toEqual([citation]);
    const other = getChatCitations("c1", "a2");
    expect(other.ok && other.data).toBe(null);
  });

  it("deletes all citation evidence with its conversation", () => {
    saveChatCitations({ conversationId: "c1", messageId: "a1", citations: [citation] });
    saveChatCitations({ conversationId: "c2", messageId: "a2", citations: [citation] });
    const removed = removeConversationCitations("c1");
    expect(removed.ok && removed.data.removed).toBe(1);
    const deleted = getChatCitations("c1", "a1");
    const kept = getChatCitations("c2", "a2");
    expect(deleted.ok && deleted.data).toBe(null);
    expect(kept.ok && kept.data).toEqual([citation]);
  });

  it("fails closed and preserves corrupt storage", () => {
    storage.set("ocade.chat-citations.v1", "{broken");
    const saved = saveChatCitations({
      conversationId: "c1",
      messageId: "a1",
      citations: [citation],
    });
    expect(saved.ok).toBe(false);
    expect(storage.get("ocade.chat-citations.v1")).toBe("{broken");
  });
});
