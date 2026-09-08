import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeSnapshot,
  isShareToken,
  shareLinkFor,
  shareRefusalOf,
  SHARE_PATH,
  SHARE_REFUSAL_MESSAGE,
} from "../conversation-sharing";

/**
 * THE CLIENT HALF OF SHARING — PLAN.md §8.
 *
 * Everything that decides anything is in the database and is proven against
 * real PostgreSQL in `conversation-share-schema.test.ts`. What is left here is
 * the part a screen could get wrong on its own: the link format, how a refusal
 * is classified, and the sentence that stops somebody believing a share is
 * live when it is frozen — or frozen when they have said more since.
 */

describe("the link", () => {
  it("is built one way, from an origin and a token", () => {
    expect(shareLinkFor("https://ocade.example", "a".repeat(48))).toBe(
      `https://ocade.example${SHARE_PATH}/${"a".repeat(48)}`,
    );
  });

  it("does not produce a double slash from an origin that has one", () => {
    // A link with `//share/` in it is not the route, and it is exactly the
    // shape a trailing slash on `window.location.origin` would produce.
    expect(shareLinkFor("https://ocade.example/", "b".repeat(48))).toBe(
      `https://ocade.example${SHARE_PATH}/${"b".repeat(48)}`,
    );
  });

  it("recognises a real token and refuses anything else", () => {
    expect(isShareToken("c".repeat(48))).toBe(true);
    // Short, long, upper case, and the shapes a hand-typed URL produces.
    expect(isShareToken("c".repeat(47))).toBe(false);
    expect(isShareToken("c".repeat(49))).toBe(false);
    expect(isShareToken("C".repeat(48))).toBe(false);
    expect(isShareToken("../../etc/passwd")).toBe(false);
    expect(isShareToken("")).toBe(false);
  });
});

describe("a refusal is read from `details`, never from the message", () => {
  it("classifies each one the interface has a different answer for", () => {
    for (const detail of [
      "authentication_required",
      "not_found_or_forbidden",
      "conversation_not_synchronised",
      "conversation_empty",
      "expiry_in_past",
    ] as const) {
      expect(shareRefusalOf({ message: "anything at all", details: detail })).toBe(detail);
      expect(SHARE_REFUSAL_MESSAGE[detail].length).toBeGreaterThan(10);
    }
  });

  it("does not pass an unrecognised database string through to a person", () => {
    /*
     * Showing a raw database string on screen is how internal names, column
     * names and occasionally row contents end up in front of somebody.
     */
    expect(shareRefusalOf({ details: 'relation "ocade_conversation_shares" does not exist' })).toBe(
      "unknown",
    );
    expect(shareRefusalOf(new Error("network"))).toBe("unknown");
    expect(shareRefusalOf(null)).toBe("unknown");
    expect(shareRefusalOf({ details: 42 })).toBe("unknown");
  });

  it("tells somebody with a device-only conversation what to change", () => {
    const message = SHARE_REFUSAL_MESSAGE.conversation_not_synchronised;
    // A refusal without a remedy is a dead end, and this one has an exact
    // remedy: the storage mode.
    expect(message).toMatch(/Private Sync/);
    expect(message).toMatch(/only on your device/i);
  });
});

describe("what the dialog says about how current the copy is", () => {
  it("says the copy does not update, when it is up to date", () => {
    const sentence = describeSnapshot({
      messageCount: 4,
      snapshotAt: "2026-09-05T10:00:00.000Z",
      currentMessageCount: 4,
    });
    expect(sentence).toMatch(/4 messages/);
    expect(sentence).toMatch(/does not update by itself/);
  });

  it("counts what is NOT on the link once the conversation has moved on", () => {
    /*
     * THE SENTENCE THAT PREVENTS THE FEATURE'S WORST OUTCOME IN BOTH
     * DIRECTIONS. Somebody who believes the link updates itself will keep
     * talking in a shared conversation and publish it. Somebody who believes it
     * is frozen when it is not will share more than they meant to. Only one of
     * those is true, and the dialog has to say which.
     */
    const sentence = describeSnapshot({
      messageCount: 2,
      snapshotAt: "2026-09-05T10:00:00.000Z",
      currentMessageCount: 7,
    });
    expect(sentence).toMatch(/5 messages since then are not on the link/);
    expect(sentence).toMatch(/Update it/);
  });

  it("reads correctly for exactly one message, in both directions", () => {
    expect(describeSnapshot({ messageCount: 1, snapshotAt: "x", currentMessageCount: 1 })).toMatch(
      /the 1 message in this conversation/,
    );
    const behind = describeSnapshot({
      messageCount: 3,
      snapshotAt: "x",
      currentMessageCount: 4,
    });
    expect(behind).toMatch(/1 message since then is not on the link/);
    expect(behind).toMatch(/include it\./);
  });

  it("never claims the link is ahead of the conversation", () => {
    // A snapshot cannot hold more than the conversation does, but a caller that
    // passed a stale count would produce "-2 messages since then".
    const sentence = describeSnapshot({
      messageCount: 6,
      snapshotAt: "x",
      currentMessageCount: 2,
    });
    expect(sentence).not.toMatch(/-/);
    expect(sentence).toMatch(/does not update by itself/);
  });
});

describe("the surfaces that carry sharing", () => {
  const chat = readFileSync(
    join(process.cwd(), "src/routes/_authenticated/ocade.index.tsx"),
    "utf8",
  );
  const page = readFileSync(join(process.cwd(), "src/routes/share.$token.tsx"), "utf8");
  const robots = readFileSync(join(process.cwd(), "src/routes/robots[.]txt.ts"), "utf8");

  it("does not publish anything just by opening the dialog", () => {
    const body = chat.slice(
      chat.indexOf("function ShareDialog("),
      chat.indexOf("function DeleteAllDialog("),
    );
    const effect = body.slice(
      body.indexOf("useEffect(() => {"),
      body.indexOf("async function publish("),
    );
    /*
     * The effect that runs on open READS. A `shareConversation` call in it
     * would mean checking whether a conversation is shared shares it — the
     * worst possible reading of the word, and an easy line to add by accident
     * when "show the link" and "make the link" sit next to each other.
     */
    expect(effect).toContain("currentShareToken(");
    expect(effect).not.toContain("shareConversation(");
  });

  it("refuses an incognito conversation without asking the server", () => {
    const body = chat.slice(
      chat.indexOf("function ShareDialog("),
      chat.indexOf("function DeleteAllDialog("),
    );
    expect(body).toMatch(/!conversation!\.incognito/);
    expect(body).toMatch(/An incognito conversation cannot be shared/);
  });

  it("keeps a shared conversation out of search results two ways", () => {
    /*
     * A share link is UNLISTED — its security is that nobody can guess the
     * token — so indexing turns "anyone with the link" into "anyone who
     * searches". `robots.txt` is read before the page; the meta tag covers a
     * crawler that fetched the page anyway.
     */
    expect(page).toMatch(/name: "robots", content: "noindex/);
    expect(page).toMatch(/noarchive/);
    expect(robots).toContain('"Disallow: /share"');
  });

  it("does not render the transcript on the server", () => {
    // Server-rendering it would put somebody's conversation into the HTML of a
    // response, where a proxy, a log or a cache could hold it.
    expect(page).toMatch(/ssr:\s*false/);
  });

  it("says the same thing for a revoked, expired and invented link", () => {
    const gone = page.slice(page.indexOf('state.status === "gone"'));
    expect(gone).toMatch(/unshared/);
    expect(gone).toMatch(/expired/);
    expect(gone).toMatch(/never have been a share link/);
  });

  it("offers no way to reply, react to, or continue somebody else's conversation", () => {
    for (const absent of ["textarea", "onReact", "MessageActions", "Send"]) {
      expect(page).not.toContain(absent);
    }
  });
});
