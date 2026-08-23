/**
 * Search has to find what the device holds, including what never leaves it.
 */
import { describe, it, expect } from "vitest";
import {
  searchLocalRecords,
  mergeSearchResults,
  scoreMatch,
  snippetAround,
  sortResults,
  type LocalSearchResult,
} from "../local-search";
import type { LocalConversation } from "@/lib/chat/local-conversations";
import type { ChatMessageRecord } from "@/lib/ocade-chat-store";

const conv = (over: Partial<LocalConversation> = {}): LocalConversation => ({
  id: "c1",
  title: "Tax return 2026",
  pinned: false,
  archived: false,
  model_id: null,
  privacy_mode: "browser_only",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...over,
});

const msg = (over: Partial<ChatMessageRecord> = {}): ChatMessageRecord => ({
  id: "m1",
  conversation_id: "c1",
  role: "user",
  content: "what allowances can I claim on a tax return",
  attachments: [],
  model_id: null,
  created_at: "2026-01-01T00:00:01.000Z",
  ...over,
});

describe("a Browser Only conversation is findable", () => {
  it("finds a conversation that was never uploaded", () => {
    // This is the case the Supabase-only implementation could never satisfy:
    // browser_only records are not in Supabase by design.
    const found = searchLocalRecords("tax", {
      conversations: [conv({ privacy_mode: "browser_only" })],
      messages: [],
    });
    expect(found.map((r) => r.title)).toEqual(["Tax return 2026"]);
    expect(found[0].local).toBe(true);
  });

  it("finds message text inside a local-only conversation", () => {
    const found = searchLocalRecords("allowances", {
      conversations: [conv()],
      messages: [msg()],
    });
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("message");
  });

  it("hands back the conversation id so the result can be opened", () => {
    const found = searchLocalRecords("allowances", {
      conversations: [conv()],
      messages: [msg()],
    });
    expect(found[0].conversationId).toBe("c1");
  });

  it("names a message row by its conversation, not by its role", () => {
    // A list of twelve rows all called "OCADE message" tells the reader
    // nothing about which one they want.
    const found = searchLocalRecords("allowances", {
      conversations: [conv()],
      messages: [msg({ role: "assistant" })],
    });
    expect(found[0].title).toBe("Tax return 2026");
  });

  it("never returns a deleted conversation", () => {
    const found = searchLocalRecords("tax", {
      conversations: [conv({ deleted_at: "2026-02-01T00:00:00.000Z" })],
      messages: [],
    });
    expect(found).toEqual([]);
  });

  it("requires two characters", () => {
    expect(searchLocalRecords("t", { conversations: [conv()], messages: [] })).toEqual([]);
  });
});

describe("ranking is explainable", () => {
  it("puts a title match above a body match", () => {
    const found = searchLocalRecords("tax", {
      conversations: [conv()],
      messages: [msg({ content: "something about tax at the very end of a long sentence" })],
    });
    expect(found[0].kind).toBe("conversation");
  });

  it("rewards a title that starts with the query", () => {
    expect(scoreMatch("Tax return", "", "tax")).toBeGreaterThan(
      scoreMatch("A tax return", "", "tax"),
    );
  });

  it("scores nothing when the query is absent", () => {
    expect(scoreMatch("Groceries", "milk and bread", "tax")).toBe(0);
  });

  it("breaks ties by recency", () => {
    const rows: LocalSearchResult[] = [
      { key: "a", kind: "message", title: "x", score: 10, local: true, createdAt: "2026-01-01" },
      { key: "b", kind: "message", title: "y", score: 10, local: true, createdAt: "2026-06-01" },
    ];
    expect(sortResults(rows).map((r) => r.key)).toEqual(["b", "a"]);
  });
});

describe("snippets show the match", () => {
  it("centres on the match rather than returning the opening words", () => {
    const long = `${"filler ".repeat(60)}CONTRACT${" more".repeat(60)}`;
    const s = snippetAround(long, "contract");
    expect(s.toLowerCase()).toContain("contract");
    expect(s.length).toBeLessThan(220);
  });

  it("falls back to the opening when the match is not present", () => {
    expect(snippetAround("abcdef", "zzz", 3)).toBe("abc");
  });
});

describe("merging the server's copy", () => {
  const local: LocalSearchResult = {
    key: "conversation:c1",
    kind: "conversation",
    title: "Local title",
    score: 100,
    local: true,
  };
  const remote: LocalSearchResult = {
    key: "conversation:c1",
    kind: "conversation",
    title: "Stale server title",
    score: 100,
    local: false,
  };

  it("never shows one record twice", () => {
    expect(mergeSearchResults([local], [remote])).toHaveLength(1);
  });

  it("prefers the device copy, which may hold an undrained edit", () => {
    expect(mergeSearchResults([local], [remote])[0].title).toBe("Local title");
  });

  it("adds a record only the server has", () => {
    const other: LocalSearchResult = {
      key: "conversation:c2",
      kind: "conversation",
      title: "From the laptop",
      score: 90,
      local: false,
    };
    expect(mergeSearchResults([local], [other]).map((r) => r.key)).toEqual([
      "conversation:c1",
      "conversation:c2",
    ]);
  });
});
