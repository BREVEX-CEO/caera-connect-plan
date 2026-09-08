import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  append,
  verifyChain,
  exportChain,
  importChain,
  chainLimits,
  GENESIS,
  type LedgerEntry,
} from "../edge/ledger";

/**
 * The chain is only worth having if tampering is detected.
 *
 * Every test below performs an edit somebody would actually attempt on a
 * disputed transcript — changing what was said, inserting a turn that was never
 * there, deleting one that was, reordering two — and requires the ledger to
 * notice. A ledger that reported "intact" for any of these would be actively
 * harmful: it would lend the authority of cryptography to a forged record.
 */

async function build(...turns: Array<[LedgerEntry["role"], string]>) {
  const chain: LedgerEntry[] = [];
  const messages: string[] = [];
  for (const [role, content] of turns) {
    chain.push(await append(chain, { role, content, at: new Date("2026-08-07T09:00:00Z") }));
    messages.push(content);
  }
  return { chain, messages };
}

describe("an untouched conversation verifies", () => {
  it("reports intact and counts the turns", async () => {
    const { chain, messages } = await build(
      ["user", "what is in my contract?"],
      ["assistant", "Section 8 covers termination."],
    );
    const verdict = await verifyChain(chain, messages);
    expect(verdict.intact).toBe(true);
    expect(verdict.faults).toEqual([]);
    expect(verdict.checked).toBe(2);
    expect(verdict.summary).toMatch(/2 turns are intact/);
  });

  it("starts from the genesis marker", async () => {
    const { chain } = await build(["user", "hello"]);
    expect(chain[0].previous).toBe(GENESIS);
  });

  it("links each entry to the one before it", async () => {
    const { chain } = await build(["user", "a"], ["assistant", "b"], ["user", "c"]);
    expect(chain[1].previous).toBe(chain[0].hash);
    expect(chain[2].previous).toBe(chain[1].hash);
  });

  it("stores fingerprints, not the messages", async () => {
    // A ledger that duplicated the text would be a second copy of the data the
    // user is trying to control.
    const { chain } = await build(["user", "my medical history is private"]);
    expect(JSON.stringify(chain)).not.toMatch(/medical/);
  });

  it("handles an empty conversation without claiming anything", async () => {
    const verdict = await verifyChain([]);
    expect(verdict.intact).toBe(true);
    expect(verdict.summary).toMatch(/no entries/i);
  });
});

describe("tampering is caught", () => {
  it("catches an edited message", async () => {
    const { chain, messages } = await build(
      ["user", "approve the £5,000 payment"],
      ["assistant", "Approved."],
    );
    // The transcript now says something different from what was recorded.
    const forged = [...messages];
    forged[0] = "approve the £50,000 payment";

    const verdict = await verifyChain(chain, forged);
    expect(verdict.intact).toBe(false);
    expect(verdict.faults.map((f) => f.kind)).toContain("content_mismatch");
  });

  it("catches an entry rewritten to match a new message", async () => {
    /*
     * The smarter forgery: change the message AND the recorded digest, so they
     * agree with each other. The entry's own hash no longer matches its
     * contents, and the chain says so.
     */
    const { chain } = await build(["user", "a"], ["assistant", "b"]);
    const tampered = structuredClone(chain) as LedgerEntry[];
    tampered[0].contentSha256 = "f".repeat(64);

    const verdict = await verifyChain(tampered);
    expect(verdict.intact).toBe(false);
    expect(verdict.faults.map((f) => f.kind)).toContain("altered_entry");
  });

  it("catches a rewritten entry even when its own hash is recomputed", async () => {
    /*
     * The best forgery available without redoing the whole file: rewrite entry
     * 0 and fix its hash. Entry 1 still points at the OLD hash, so the link
     * breaks. This is the property the whole chain exists for.
     */
    const { chain } = await build(["user", "a"], ["assistant", "b"], ["user", "c"]);
    const tampered = structuredClone(chain) as LedgerEntry[];
    const rebuilt = await append([], {
      role: "user",
      content: "something else entirely",
      at: new Date("2026-08-07T09:00:00Z"),
    });
    tampered[0] = rebuilt;

    const verdict = await verifyChain(tampered);
    expect(verdict.intact).toBe(false);
    expect(verdict.faults.map((f) => f.kind)).toContain("broken_link");
  });

  it("catches a deleted turn", async () => {
    const { chain } = await build(["user", "a"], ["assistant", "b"], ["user", "c"]);
    const tampered = [chain[0], chain[2]];
    const verdict = await verifyChain(tampered);
    expect(verdict.intact).toBe(false);
    // Both signals fire: the position is wrong and the link no longer matches.
    expect(verdict.faults.map((f) => f.kind)).toContain("out_of_order");
    expect(verdict.faults.map((f) => f.kind)).toContain("broken_link");
  });

  it("catches an inserted turn", async () => {
    const { chain } = await build(["user", "a"], ["assistant", "b"]);
    const inserted = await append([chain[0]], {
      role: "assistant",
      content: "a reply that never happened",
      at: new Date("2026-08-07T09:00:00Z"),
    });
    const verdict = await verifyChain([chain[0], inserted, chain[1]]);
    expect(verdict.intact).toBe(false);
  });

  it("catches reordered turns", async () => {
    const { chain } = await build(["user", "a"], ["assistant", "b"]);
    const verdict = await verifyChain([chain[1], chain[0]]);
    expect(verdict.intact).toBe(false);
    expect(verdict.faults.map((f) => f.kind)).toContain("out_of_order");
  });

  it("reports every fault, not only the first", async () => {
    // The shape of the tampering — one edit versus a rewritten second half —
    // is what somebody examining a disputed transcript needs to see.
    const { chain } = await build(["user", "a"], ["assistant", "b"], ["user", "c"]);
    const tampered = structuredClone(chain) as LedgerEntry[];
    tampered[1].contentSha256 = "1".repeat(64);
    tampered[2].contentSha256 = "2".repeat(64);
    const verdict = await verifyChain(tampered);
    expect(verdict.faults.length).toBeGreaterThanOrEqual(2);
  });

  it("says where the record stops being trustworthy", async () => {
    const { chain } = await build(["user", "a"], ["assistant", "b"], ["user", "c"]);
    const tampered = structuredClone(chain) as LedgerEntry[];
    tampered[1].contentSha256 = "1".repeat(64);
    const verdict = await verifyChain(tampered);
    expect(verdict.summary).toMatch(/consistent up to turn 1/);
  });

  it("never calls an unverifiable entry intact", async () => {
    // A digest that could not be computed is unknown, not fine.
    const bogus: LedgerEntry[] = [
      {
        index: 0,
        role: "user",
        contentSha256: "unavailable:no-web-crypto",
        at: "2026-08-07T09:00:00Z",
        previous: GENESIS,
        hash: "unavailable:no-web-crypto",
      },
    ];
    const verdict = await verifyChain(bogus);
    expect(verdict.intact).toBe(false);
    expect(verdict.faults[0].kind).toBe("unverifiable");
  });
});

describe("a ledger travels and comes back", () => {
  it("round-trips through export and import", async () => {
    const { chain, messages } = await build(["user", "a"], ["assistant", "b"]);
    const imported = importChain(exportChain(chain));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect((await verifyChain(imported.chain, messages)).intact).toBe(true);
  });

  it("refuses a file that is not a ledger", () => {
    const result = importChain(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not an OCADE/i);
  });

  it("refuses unreadable input rather than throwing", () => {
    const result = importChain("<<<not json>>>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not a readable/i);
  });

  it("refuses a future format instead of guessing", () => {
    const result = importChain(
      JSON.stringify({ format: "ocade-ledger", version: 99, entries: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/version 99/);
  });

  it("refuses entries of the wrong shape", () => {
    // Accepting a malformed file and then reporting "intact" because there was
    // nothing to check would be worse than having no ledger at all.
    const result = importChain(
      JSON.stringify({ format: "ocade-ledger", version: 1, entries: [{ nope: true }] }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("the claim is bounded honestly", () => {
  it("says it proves consistency, not authorship", () => {
    const limits = chainLimits().join(" ");
    expect(limits).toMatch(/not who wrote it/i);
    // The honest admission: this is tamper-evident, not tamper-proof.
    expect(limits).toMatch(/rewrite the whole file/i);
  });
});

describe("the integrity panel is wired honestly", () => {
  const PANEL = readFileSync("src/components/ocade/chat/ConversationIntegrity.tsx", "utf8");
  /*
   * The signed-in chat is the only surface that renders the panel, behind the
   * diagnostics switch. The wiring assertions below therefore point at it, and
   * the properties they check — verify against real plaintext, re-verify when
   * refs change, clear the chain with the messages — are exactly as
   * load-bearing there.
   */
  const CHAT = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");

  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  it("verifies on open rather than behind a button", () => {
    /*
     * A panel showing a green tick until you asked it to check would report the
     * ABSENCE of a check as a pass — the specific dishonesty this whole area
     * exists to avoid.
     */
    const c = code(PANEL);
    expect(c).toMatch(/useEffect\(\(\) => \{\s*void check\(\);/);
    // And it starts as null, not as intact.
    expect(c).toMatch(/useState<LedgerVerdict \| null>\(null\)/);
  });

  it("checks the digests against the real messages, not only each other", () => {
    // Without the plaintext the panel proves internal consistency while saying
    // nothing about whether the chain still describes what is on screen.
    expect(code(PANEL)).toMatch(/verifyChain\(chain, messages\)/);
    expect(code(CHAT)).toMatch(/messages=\{messages\.map\(\(m\) => m\.content\)\}/);
  });

  it("records the question as well as the answer", () => {
    // A fork is identified by the question it followed; recording only answers
    // leaves every branch point unlabelled.
    const c = code(CHAT);
    expect(c).toMatch(
      /role: "user",[\s\S]{0,120}appendLedger|appendLedger\([\s\S]{0,120}role: "user"/,
    );
  });

  it("clears the record whenever the conversation changes", () => {
    /*
     * Leaving the chain behind would have the panel verifying a conversation
     * that is no longer on screen and reporting it intact — a confident claim
     * about something that does not exist.
     *
     * ONE reset path, keyed on the conversation id, rather than a handler per
     * control. Selecting another chat, starting a new one and being switched
     * by any other route all end at the same effect, so no control can be
     * added later that clears the messages and forgets the chain.
     */
    const c = code(CHAT);
    const marker = /useEffect\(\(\) => \{\s*ledgerRef\.current = \[\];/;
    expect(c).toMatch(marker);
    const body = c.slice(c.search(marker), c.search(marker) + 700);
    expect(body).toMatch(/treeRef\.current = emptyTree\(\)/);
    expect(body, "the reset is keyed on the conversation, not on one button").toMatch(
      /\}, \[conversation\.id\]\)/,
    );
  });

  it("tells the panel to re-verify when the refs change", () => {
    // Refs do not trigger a render; a stale "intact" is the worst thing to be
    // confidently wrong about.
    expect(code(CHAT)).toMatch(/setLedgerVersion\(\(v\) => v \+ 1\)/);
    expect(code(CHAT)).toMatch(/key=\{ledgerVersion\}/);
  });

  it("shows the bound on the claim in the same panel", () => {
    expect(code(PANEL)).toMatch(/chainLimits\(\)/);
  });
});
