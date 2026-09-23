import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * FOUR DEFECTS IN `send` AND `resend`, ALL OF THEM AN ORDERING.
 *
 * None of them is visible at runtime without a second account, a slow allowance
 * service, or a storage failure at one exact moment, and each is one edit away
 * from coming back. They are orderings in one file, so they are checked as
 * orderings in one file — the same reasoning as
 * `a-failed-server-function-reaches-its-caller.test.ts`.
 *
 * What was wrong:
 *
 *   - the send captured the screen it belonged to AFTER awaiting the permit, so
 *     switching account or conversation during that wait let the old send
 *     resume as though it belonged to the new screen;
 *   - the `finally` cleared the duplicate-Send guard unconditionally, so an
 *     abandoned send opened the window for a newer one that was already running;
 *   - delivery was recorded after the answer was PERSISTED, so a storage failure
 *     un-charged an answer the person had already read;
 *   - Regenerate passed `false, false` for Thinking and Research, quietly
 *     answering a different question from the one being repeated.
 */
const SOURCE = readFileSync("src/lib/chat/use-chat.ts", "utf8");
const at = (needle: string) => {
  const index = SOURCE.indexOf(needle);
  expect(index, `use-chat.ts no longer contains ${needle}`).toBeGreaterThan(-1);
  return index;
};

describe("a send knows which screen it belongs to", () => {
  it("captures the epoch before the first await, not after the permit", () => {
    expect(at("const at = epoch.current")).toBeLessThan(at("await beginBilledRequest"));
  });

  it("gives the permit back when the screen moved during the wait", () => {
    const check = SOURCE.indexOf("if (!mine()) return true;", at("await beginBilledRequest"));
    expect(check, "the send no longer checks whose screen it is after the permit").toBeGreaterThan(
      -1,
    );
    /*
     * Inside the `try`, so the ONE settlement in the `finally` covers this exit
     * like every other — `every-ai-surface-is-gated.test.ts` counts that one and
     * a second `settle` call here would be a second place to get it wrong.
     */
    expect(SOURCE.indexOf("try {", at("await beginBilledRequest"))).toBeLessThan(check);
    // And before anything of this screen's is touched, or written.
    expect(check).toBeLessThan(at("setBusy(true)"));
    expect(check).toBeLessThan(at("await createConversation"));
  });

  it("releases the duplicate-Send guard only from the send that took it", () => {
    for (const match of SOURCE.matchAll(/sending\.current = false/g)) {
      const before = SOURCE.slice(Math.max(0, match.index - 200), match.index);
      /*
       * Either the release belongs to a send whose screen is still current, or
       * it is `abandonInFlight` — which moves the epoch on the line above, and
       * is the one caller entitled to take the guard from whoever holds it.
       */
      expect(before, "an unguarded release can clear a newer send's guard").toMatch(
        /mine\(\)|epoch\.current \+= 1/,
      );
    }
  });
});

describe("what was delivered is what is charged", () => {
  it("records delivery at the first visible token, before any persistence", () => {
    const delivered = at("billed.recordDelivery({ answer })");
    // Inside the token branch, guarded by the screen that renders it.
    const tokenBranch = at('if (event.type === "token")');
    expect(delivered).toBeGreaterThan(tokenBranch);
    expect(SOURCE.slice(tokenBranch, delivered)).toContain("if (mine())");
    expect(delivered).toBeLessThan(SOURCE.indexOf('role: "assistant"'));
    // Exactly one delivery marker: a late second one is how F23 came back.
    expect(SOURCE.match(/billed\.recordDelivery/g)).toHaveLength(1);
  });

  it("keeps a partially read answer with its own conversation after a switch", () => {
    const moved = at("if (!mine()) {\n          /*\n           * THE SCREEN MOVED AFTER PART");
    const kept = SOURCE.indexOf("content: shown", moved);
    expect(kept).toBeGreaterThan(moved);
    // Same account only, and never a temporary chat.
    expect(SOURCE.slice(moved, kept)).toContain("lastAccount.current === owner");
    expect(SOURCE.slice(moved, kept)).toContain("!temporary");
  });

  it("still settles once, on every way out", () => {
    expect(at("await billed.settle()")).toBeGreaterThan(-1);
    expect(SOURCE).toContain("} finally {");
  });
});

describe("asking a question again asks the same question", () => {
  it("passes back the Thinking and Research the question was asked with", () => {
    expect(SOURCE).toContain("askedWith.current.get(question.id)");
    expect(SOURCE).toContain("options.thinking");
    expect(SOURCE).toContain("options.research");
    // The defect, exactly: two literal falses where the options belong.
    expect(SOURCE).not.toContain("send(text, choice, files, false, false");
  });

  it("drops the replaced turns in one statement rather than one call each", () => {
    expect(SOURCE).toContain("deleteMessagesFrom({");
    expect(SOURCE).not.toMatch(/Promise\.all\(\s*dropped/);
  });

  /*
   * A CLOCK THIS DEVICE WROTE MUST NOT DECIDE WHAT THE ACCOUNT DELETES.
   *
   * The boundary is a MOMENT, and the anchor's own `created_at` is the obvious
   * thing to send — except that a turn held in the tab because the account was
   * unreachable carries a time this browser wrote. A slow clock would name a
   * moment before turns that are genuinely earlier, and one statement would
   * take those too.
   */
  it("takes the boundary from a stored turn, never from a local one", () => {
    expect(SOURCE).toContain("find((record) => !record.unsynced)?.created_at");
    expect(SOURCE).not.toContain("from: question.created_at");
    // Nothing stored among the dropped turns means nothing to ask the account
    // to delete, rather than a call with a made-up boundary.
    expect(SOURCE).toContain("!conversationId || !from");
  });
});
