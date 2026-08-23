// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  deliveryStateFor,
  quoteForReply,
  readChatReactions,
  toggleChatReaction,
  writeChatReactions,
} from "@/lib/chat/message-feedback";

describe("local chat reactions", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists only message IDs and explicit feedback values", () => {
    const reactions = { m1: "helpful" as const, m2: "not_helpful" as const };
    expect(writeChatReactions("user", "conversation", reactions)).toBe(true);
    expect(readChatReactions("user", "conversation")).toEqual(reactions);
    expect(JSON.stringify(window.localStorage)).not.toContain("conversation content");
  });

  it("toggles the active reaction off and replaces the opposite reaction", () => {
    expect(toggleChatReaction({ m1: "helpful" }, "m1", "helpful")).toEqual({});
    expect(toggleChatReaction({ m1: "helpful" }, "m1", "not_helpful")).toEqual({
      m1: "not_helpful",
    });
  });

  it("drops malformed stored values instead of trusting local storage", () => {
    window.localStorage.setItem(
      "ocade.chat.reactions.v1:user:conversation",
      JSON.stringify({ good: "helpful", bad: "admin", object: { reaction: "helpful" } }),
    );
    expect(readChatReactions("user", "conversation")).toEqual({ good: "helpful" });
  });
});

describe("message lifecycle and reply quoting", () => {
  const messages = [{ role: "user" as const }, { role: "assistant" as const }];

  it("marks a user turn processed only after a later assistant turn exists", () => {
    expect(deliveryStateFor(messages, 0, false)).toBe("processed");
    expect(deliveryStateFor([{ role: "user" }], 0, true)).toBe("processing");
    expect(deliveryStateFor([{ role: "user" }], 0, false)).toBe("sent");
    expect(deliveryStateFor(messages, 1, false)).toBeUndefined();
  });

  it("quotes a bounded, single-line excerpt and leaves room to type", () => {
    expect(quoteForReply(" First\n\nsecond ")).toBe("> First second\n\n");
    expect(quoteForReply("123456", 5)).toBe("> 1234…\n\n");
  });
});
