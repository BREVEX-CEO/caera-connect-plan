import { describe, expect, it } from "vitest";
import { deliveryStateFor, quoteForReply } from "@/lib/chat/message-feedback";

/**
 * WHAT A TRANSCRIPT SAYS ABOUT A TURN.
 *
 * Reactions used to live here as a per-browser map and had their own tests.
 * `PLAN.md` Phase 2 puts feedback on the message row, so those moved to where
 * the writes are; what stays is the rendering, and its one dangerous case:
 * a turn that never left the tab must not read as sent.
 */

describe("what a user turn's delivery state says", () => {
  const messages = [{ role: "user" as const }, { role: "assistant" as const }];

  it("marks a user turn processed only after a later assistant turn exists", () => {
    expect(deliveryStateFor(messages, 0, false)).toBe("processed");
    expect(deliveryStateFor([{ role: "user" }], 0, true)).toBe("processing");
    expect(deliveryStateFor([{ role: "user" }], 0, false)).toBe("sent");
    expect(deliveryStateFor(messages, 1, false)).toBeUndefined();
  });

  it("says UNSYNCHRONISED ahead of everything else", () => {
    /*
     * A turn held in this tab has not been sent anywhere, whatever has happened
     * around it in the transcript. Answering "processed" because an assistant
     * turn followed it would tell somebody their message is safely in their
     * account when closing the tab would discard it.
     */
    const held = [{ role: "user" as const, unsynced: true }, { role: "assistant" as const }];
    expect(deliveryStateFor(held, 0, false)).toBe("unsynced");
    expect(deliveryStateFor([{ role: "user", unsynced: true }], 0, true)).toBe("unsynced");
  });
});

describe("quoting a message in a reply", () => {
  it("quotes a bounded, single-line excerpt and leaves room to type", () => {
    expect(quoteForReply(" First\n\nsecond ")).toBe("> First second\n\n");
    expect(quoteForReply("123456", 5)).toBe("> 1234…\n\n");
  });

  it("quotes nothing rather than an empty block", () => {
    expect(quoteForReply("   ")).toBe("");
  });
});
