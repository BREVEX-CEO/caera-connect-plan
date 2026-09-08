import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  INCOGNITO_CLAIMS,
  INCOGNITO_SUMMARY,
  INCOGNITO_TITLE,
  mayPersist,
  mayRemember,
} from "../incognito";

/**
 * A conversation that leaves nothing behind — PLAN.md §8.
 *
 * The dangerous failure here is not a crash. It is a privacy mode that is
 * partly true: a conversation kept out of the sidebar whose messages are in the
 * vault, or one that is not written down and is quietly used to update what
 * OCADE remembers about the person having it. Somebody relying on the promise
 * would have no way to tell.
 *
 * So the tests below are about the WRITES, and about the claims: every sentence
 * in `INCOGNITO_CLAIMS` is a promise a reader might act on, and the last group
 * checks the code that would have to be wrong for one of them to be false.
 */

const read = (path: string) => readFileSync(path, "utf8");

/** The file with its prose removed — a comment must not satisfy a check. */
const readCode = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the two rules", () => {
  it("permits writing and remembering for an ordinary conversation", () => {
    expect(mayPersist(false)).toBe(true);
    expect(mayRemember(false)).toBe(true);
  });

  it("permits neither for an incognito one", () => {
    expect(mayPersist(true)).toBe(false);
    expect(mayRemember(true)).toBe(false);
  });
});

describe("what the product promises", () => {
  it("says nothing is stored, synchronised, listed or remembered", () => {
    const kept = INCOGNITO_CLAIMS.kept.join(" ").toLowerCase();
    expect(kept).toMatch(/saved on this device/);
    expect(kept).toMatch(/synchronised/);
    expect(kept).toMatch(/history/);
    expect(kept).toMatch(/will not remember/);
  });

  it("does not claim to be anonymity, and names the provider", () => {
    /*
     * The one sentence on the screen that could get somebody into trouble if
     * it were left out. A person who believes "incognito" means the request
     * never leaves the machine may type something into an online conversation
     * that they would not have.
     */
    const limits = INCOGNITO_CLAIMS.notKept.join(" ").toLowerCase();
    expect(limits).toMatch(/provider/);
    expect(limits).toMatch(/its own records/);
    expect(limits).toMatch(/does not hide/);
    expect(limits).toMatch(/does not erase/);
  });

  it("says it ends with the tab, so nobody looks for it later", () => {
    expect(INCOGNITO_SUMMARY.toLowerCase()).toMatch(/ends when you close this tab/);
  });

  it("has a title that reads as a state rather than as a name somebody chose", () => {
    expect(INCOGNITO_TITLE).toEqual("Incognito conversation");
  });
});

describe("the writes the promises depend on", () => {
  it("the chat store refuses to write before it chooses a destination", () => {
    /*
     * Order matters and is asserted: the refusal has to come BEFORE the branch
     * that picks vault or cloud, or a future mode added above it would write.
     */
    const source = readCode("src/lib/ocade-chat-store.ts");
    const guard = source.indexOf("mayPersist");
    const privateSync = source.indexOf('input.chatsMode === "private_sync"');
    expect(guard, "the chat store does not consult the incognito rule").toBeGreaterThan(-1);
    expect(guard).toBeLessThan(privateSync);
  });

  it("the runtime refuses to learn before it counts the work", () => {
    /*
     * `noteWork` is itself a record of the conversation having happened, so
     * the refusal has to come before it.
     *
     * SLICED TO THE CALLBACK, not searched across the file. The first version
     * of this check looked for `mayRemember` anywhere in the source, and it
     * passed with the guard deleted — the IMPORT still matched. A check an
     * import can satisfy is the same defect as one a comment can satisfy, and
     * both have now been found in this repository.
     */
    const source = readCode("src/lib/runtime/use-ocade-runtime.ts");
    const learn = source.slice(source.indexOf("const learn = useCallback("));
    const body = learn.slice(0, learn.indexOf("considerSessionMemory"));
    const guard = body.indexOf("mayRemember(");
    const note = body.indexOf("noteWork(surface");
    expect(guard, "the runtime does not consult the incognito rule").toBeGreaterThan(-1);
    expect(guard).toBeLessThan(note);
  });

  it("the chat screen never creates a conversation record for one", () => {
    const source = readCode("src/routes/_authenticated/ocade.index.tsx");
    const ensure = source.slice(
      source.indexOf("async function ensureActive"),
      source.indexOf("async function togglePin"),
    );
    // The incognito branch returns before `createConversationLocally`, which
    // writes a record to the vault and queues it for the server.
    const branch = ensure.indexOf("nextIsIncognito");
    const create = ensure.indexOf("createConversationLocally");
    expect(branch).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(create);
  });

  it("the chat screen does not read memory into one either", () => {
    const source = readCode("src/routes/_authenticated/ocade.index.tsx");
    const memory = source.slice(
      source.indexOf("memoryContext: () => {"),
      source.indexOf("onApprovalNeeded:"),
    );
    expect(memory).toContain("conversation.incognito");
    expect(memory.indexOf("conversation.incognito")).toBeLessThan(
      memory.indexOf("localMemoryContext"),
    );
  });

  it("every persist call in the chat screen passes the conversation's own flag", () => {
    /*
     * The guard lives in the store, so a forgotten flag would silently WRITE.
     * Counting them is what makes adding a tenth call site fail here rather
     * than in production.
     */
    const source = readCode("src/routes/_authenticated/ocade.index.tsx");
    // Split rather than match a balanced brace: the call sites differ in
    // length, and a capped regex silently found five of the seven.
    const calls = source
      .split("persistChatMessage({")
      .slice(1)
      .map((segment) => segment.slice(0, segment.indexOf("});") + 3));
    expect(calls.length, "no persist calls were found, so this check is vacuous").toBeGreaterThan(
      5,
    );
    const unflagged = calls.filter((call) => !/incognito:/.test(call));
    // One call site is the BRANCH path, which refuses an incognito source
    // outright rather than copying its messages into a new conversation.
    expect(unflagged).toHaveLength(1);
    expect(unflagged[0]).toContain("created.id");
  });

  it("branching an incognito conversation is refused with the reason", () => {
    const source = readCode("src/routes/_authenticated/ocade.index.tsx");
    const fork = source.slice(
      source.indexOf("async function forkBeforeUser"),
      source.indexOf("async function forkBeforeUser") + 1200,
    );
    expect(fork).toContain("conversation.incognito");
    expect(fork.indexOf("conversation.incognito")).toBeLessThan(fork.indexOf("createConversation"));
  });
});

describe("the chat store, exercised", () => {
  it("stores nothing and says so", async () => {
    const put = vi.fn();
    vi.doMock("@/lib/storage/resolver", () => ({
      resolveAdapter: async () => ({ put }),
      getModeFor: async () => "private_sync",
    }));
    const { persistChatMessage } = await import("../../ocade-chat-store");
    const result = await persistChatMessage({
      userId: "u1",
      chatsMode: "private_sync",
      conversationId: "c1",
      role: "user",
      content: "something private",
      incognito: true,
    });
    expect(result.stored).toEqual("not_stored");
    expect(put, "an incognito message reached the storage adapter").not.toHaveBeenCalled();
    // The record still comes back: the message is real, it is on screen, and
    // it is nowhere else.
    expect(result.record.content).toEqual("something private");
    vi.doUnmock("@/lib/storage/resolver");
  });
});
