import { describe, it, expect } from "vitest";
import { splitIntoPassages, describePassage } from "../retrieval/passages";
import { tokenise, rankPassages } from "../retrieval/bm25";
import {
  selectRelevantPassages,
  describeRetrieval,
  RETRIEVAL_BUDGET_CHARS,
} from "../retrieval/select";
import { buildDocumentContext, DOCUMENT_CONTEXT_MAX_CHARS } from "../retrieval/document-context";
import type { IndexedSource } from "../ocade-citations";

/**
 * Reading a document by searching it.
 *
 * The measurement this exists to fix, taken from the engine's own counters on
 * the reference machine: a 20,000-character log became 5,654 tokens and took
 * 458.4 SECONDS to evaluate, after which producing the answer took 3.8. Almost
 * all of that was spent re-reading lines the answer never used.
 *
 * So the assertion that matters most is the first one below: given the same
 * document and the same question, the needle must survive the cut. A retriever
 * that is fast and drops the answer is worse than no retriever, because the
 * model then answers confidently from the wrong lines.
 */

/* The document from the runtime evidence run, rebuilt exactly. */
const lines: string[] = [];
for (let i = 1; i <= 220; i += 1) {
  lines.push(
    i === 147
      ? `Line ${i}: The maintenance access code for the north gate is 742913.`
      : `Line ${i}: routine inventory entry, nothing of note, item ${1000 + i} checked and returned to stock.`,
  );
}
const LOG = lines.join("\n");
const QUESTION = "what is the maintenance access code for the north gate?";

describe("the needle survives the cut", () => {
  it("keeps the one line that answers the question", () => {
    const result = selectRelevantPassages(QUESTION, [{ id: "S1", name: "log.txt", text: LOG }]);
    const sent = result.selected.map((row) => row.passage.text).join("\n");
    expect(sent).toContain("742913");
  });

  it("sends a small fraction of what it was given", () => {
    const result = selectRelevantPassages(QUESTION, [{ id: "S1", name: "log.txt", text: LOG }]);
    expect(result.charsAvailable).toBeGreaterThan(19_000);
    expect(result.charsSelected).toBeLessThanOrEqual(RETRIEVAL_BUDGET_CHARS);
    // The reading cost falls with the character count, so this ratio is the
    // speed-up: roughly a fifth of the document, and a fifth of the wait.
    expect(result.charsSelected / result.charsAvailable).toBeLessThan(0.25);
  });

  it("can still say where the answer came from", () => {
    // A passage that has lost its position can only be cited as "somewhere in
    // this file", which is the same as not citing it.
    const result = selectRelevantPassages(QUESTION, [{ id: "S1", name: "log.txt", text: LOG }]);
    const needle = result.selected.find((row) => row.passage.text.includes("742913"));
    expect(needle).toBeDefined();
    expect(needle!.passage.startLine).toBeLessThanOrEqual(147);
    expect(needle!.passage.endLine).toBeGreaterThanOrEqual(147);
    expect(needle!.locator).toMatch(/lines? \d+/);
  });

  it("says plainly that it searched rather than read the whole thing", () => {
    const result = selectRelevantPassages(QUESTION, [{ id: "S1", name: "log.txt", text: LOG }]);
    // The exact sentence, not a substring: this is the claim the user reads, and
    // both numbers in it have to be the real ones.
    expect(describeRetrieval(result)).toBe(
      `Searched ${result.totalPassages} document sections and used the best ${result.selected.length}.`,
    );
    expect(result.sentWhole).toBe(false);
    expect(result.weakMatch).toBe(false);
  });
});

describe("a short document is never searched", () => {
  it("is sent whole, because searching it could only lose something", () => {
    const short = "Alpha line.\nBeta line.\nThe answer is 42.";
    const result = selectRelevantPassages("what is the answer?", [
      { id: "S1", name: "note.txt", text: short },
    ]);
    expect(result.sentWhole).toBe(true);
    expect(result.selected.map((r) => r.passage.text).join("\n")).toContain("42");
    expect(describeRetrieval(result)).toBeNull();
  });
});

describe("when the search finds nothing", () => {
  it("admits it instead of presenting an unrelated passage as the relevant one", () => {
    // Every passage scores zero. Returning the top of that list would be
    // handing over an arbitrary paragraph while implying it answers the
    // question — the exact dishonesty this whole layer has to avoid.
    const filler = Array.from(
      { length: 400 },
      (_, i) => `Row ${i}: widget ${i} shipped to depot ${i % 7}.`,
    ).join("\n");
    const result = selectRelevantPassages("photosynthesis chlorophyll wavelength", [
      { id: "S1", name: "shipping.txt", text: filler },
    ]);
    expect(result.noMatch).toBe(true);
    expect(describeRetrieval(result)).toContain("Nothing in the attached text matched");
    // It still sends something rather than nothing: the opening of a file
    // usually carries its title and headers.
    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.selected[0].passage.startLine).toBe(1);
  });
});

describe("when the search finds only part of the question", () => {
  it("reports a weak match and names what was not found", () => {
    // One incidental word matches and the rest of the question does not. The
    // count alone ("used the best 5") would read as success, so the sentence has
    // to carry the qualification with it.
    const filler = Array.from(
      { length: 400 },
      (_, i) => `Row ${i}: pallet ${i} moved between depots.`,
    ).join("\n");
    const result = selectRelevantPassages("refund policy for a damaged pallet", [
      { id: "S1", name: "pallets.txt", text: filler },
    ]);
    expect(result.noMatch).toBe(false);
    expect(result.weakMatch).toBe(true);
    expect(result.matchedTerms).toEqual(["pallet"]);
    expect(result.missingTerms).toEqual(expect.arrayContaining(["refund", "policy", "damaged"]));
    const sentence = describeRetrieval(result);
    expect(sentence).toContain("Only part of your question was found");
    expect(sentence).toContain("refund");
  });

  it("does not qualify a match that covers most of the question", () => {
    const result = selectRelevantPassages(QUESTION, [{ id: "S1", name: "log.txt", text: LOG }]);
    expect(result.weakMatch).toBe(false);
    expect(describeRetrieval(result)).not.toContain("Only part");
  });

  it("claims nothing about terms when the document was short enough to send whole", () => {
    // No search ran, so reporting matched or missing terms would describe a
    // search that never happened.
    const result = selectRelevantPassages("anything at all", [
      { id: "S1", name: "note.txt", text: "one line" },
    ]);
    expect(result.sentWhole).toBe(true);
    expect(result.matchedTerms).toEqual([]);
    expect(result.missingTerms).toEqual([]);
    expect(result.weakMatch).toBe(false);
  });
});

describe("passages", () => {
  it("never cuts a line in half", () => {
    // A cut inside a line splits a table row or a statement, and both halves
    // become unmatchable.
    const text = Array.from({ length: 200 }, (_, i) => `line ${i} with some content here`).join(
      "\n",
    );
    for (const passage of splitIntoPassages(text, { maxChars: 200 })) {
      for (const line of passage.text.split("\n")) {
        if (line.trim()) expect(line).toMatch(/^line \d+ with some content here$/);
      }
    }
  });

  it("keeps a line longer than the whole budget rather than dropping it", () => {
    // Minified JSON and single-line CSV exports look like this. Losing them
    // silently would be the worst failure: the document appears to have been read.
    const giant = "x".repeat(5000);
    const passages = splitIntoPassages(`intro\n${giant}\noutro`, { maxChars: 900 });
    expect(passages.some((p) => p.text === giant)).toBe(true);
  });

  it("overlaps, so a fact spanning a cut is not lost from both sides", () => {
    const text = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join("\n");
    const passages = splitIntoPassages(text, { maxChars: 60, overlapLines: 1 });
    expect(passages.length).toBeGreaterThan(1);
    for (let i = 1; i < passages.length; i += 1) {
      expect(passages[i].startLine).toBeLessThanOrEqual(passages[i - 1].endLine);
    }
  });

  it("reports its position in words a citation can use", () => {
    expect(describePassage({ text: "x", startLine: 5, endLine: 5 })).toBe("line 5");
    expect(describePassage({ text: "x", startLine: 5, endLine: 9 })).toBe("lines 5-9");
  });

  it("returns nothing for an empty document rather than one empty passage", () => {
    expect(splitIntoPassages("")).toEqual([]);
    expect(splitIntoPassages("   \n  \n ")).toEqual([]);
  });
});

describe("ranking", () => {
  it("treats numbers as searchable terms", () => {
    // "742913", "Q4-2026" and "v2.1.3" are exactly what people search their own
    // documents for. A tokeniser that discards digits misses every one.
    expect(tokenise("invoice 742913 for Q4-2026")).toEqual(["invoice", "742913", "q4", "2026"]);
    // A dotted version splits on its punctuation, and the single digits fall to
    // the length filter — a lone "1" matches every numbered list in the file and
    // separates nothing. What survives is "v2", which is enough, BECAUSE THE
    // QUERY IS TOKENISED THE SAME WAY: searching for "v2.1.3" also reduces to
    // "v2" and still finds the line. The next assertion is the one that matters.
    expect(tokenise("release v2.1.3 shipped")).toEqual(["release", "v2", "shipped"]);
  });

  it("finds a version string when the question spells it in full", () => {
    // The property a user actually depends on: typing the exact version they
    // are looking for lands on the line that mentions it.
    const ranked = rankPassages("which release fixed v2.1.3", [
      { text: "v1.9.0 changed the export format", startLine: 1, endLine: 1 },
      { text: "v2.1.3 fixed the retrieval budget", startLine: 2, endLine: 2 },
    ]);
    expect(ranked[0].passage.startLine).toBe(2);
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("drops words that separate nothing, but keeps words that invert meaning", () => {
    expect(tokenise("the cost of the item")).toEqual(["cost", "item"]);
    // "not" and "no" change what a sentence claims; removing them lets a
    // passage match its own opposite.
    expect(tokenise("this is not approved")).toContain("not");
    expect(tokenise("no refund was issued")).toContain("no");
  });

  it("scores a passage with no shared term at exactly zero", () => {
    const ranked = rankPassages("elephant migration", [
      { text: "quarterly revenue rose", startLine: 1, endLine: 1 },
    ]);
    expect(ranked[0].score).toBe(0);
    expect(ranked[0].matched).toEqual([]);
  });

  it("prefers the passage carrying more of the question", () => {
    const ranked = rankPassages("north gate access code", [
      { text: "the south gate was repainted", startLine: 1, endLine: 1 },
      { text: "the north gate access code is 742913", startLine: 2, endLine: 2 },
      { text: "stock was counted", startLine: 3, endLine: 3 },
    ]);
    expect(ranked[0].passage.startLine).toBe(2);
    expect(ranked[0].matched).toEqual(expect.arrayContaining(["north", "gate", "access", "code"]));
  });

  it("does not let a term that appears everywhere decide the winner", () => {
    // "line" is in every passage here and distinguishes nothing; BM25 collapses
    // its weight without anyone having to list it as a stop word.
    const passages = Array.from({ length: 50 }, (_, i) => ({
      text: i === 30 ? "line thirty holds the serial 9981" : `line ${i} holds nothing`,
      startLine: i + 1,
      endLine: i + 1,
    }));
    const ranked = rankPassages("line serial 9981", passages);
    expect(ranked[0].passage.startLine).toBe(31);
  });
});

describe("several documents at once", () => {
  it("spends the budget on whichever file has the answer", () => {
    // A per-document quota would force every file to contribute whether or not
    // it had anything to say, crowding out the one that did.
    const irrelevant = Array.from({ length: 300 }, (_, i) => `Row ${i}: pallet ${i} moved.`).join(
      "\n",
    );
    const relevant = `${Array.from({ length: 200 }, (_, i) => `Note ${i}: routine.`).join("\n")}\nThe refund policy allows fourteen days.`;
    const result = selectRelevantPassages("what is the refund policy?", [
      { id: "S1", name: "pallets.txt", text: irrelevant },
      { id: "S2", name: "policy.txt", text: relevant },
    ]);
    const sent = result.selected.map((r) => r.passage.text).join("\n");
    expect(sent).toContain("fourteen days");
    expect(result.selected.every((r) => r.sourceId === "S2")).toBe(true);
  });

  it("returns passages in reading order, not in score order", () => {
    // Score order reads as a jumble and invites the model to treat a later
    // passage as following an earlier one.
    const text = Array.from({ length: 400 }, (_, i) =>
      i === 10 || i === 300 ? `Line ${i}: the audit finding was severe.` : `Line ${i}: normal.`,
    ).join("\n");
    const result = selectRelevantPassages("audit finding severe", [
      { id: "S1", name: "audit.txt", text },
    ]);
    const starts = result.selected.map((r) => r.passage.startLine);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe("the context OCADE actually sends", () => {
  /** An indexed source in the shape `buildSourceIndex` produces. */
  function readable(id: string, name: string, text: string): IndexedSource {
    return { id, name, kind: "text", readable: true, text, locator: { line: 1 } };
  }

  it("sends retrieved passages, wrapped as untrusted, with their locators", () => {
    const built = buildDocumentContext(QUESTION, [readable("S1", "log.txt", LOG)]);
    expect(built.context).toBeDefined();
    expect(built.context).toContain("742913");
    // The file's content must arrive as quoted data, never as a turn OCADE
    // could mistake for an instruction.
    expect(built.context).toContain("UNTRUSTED CONTENT");
    // A locator travels with each passage, or a citation cannot say where.
    expect(built.context).toMatch(/\(lines? \d+/);
    expect(built.notice).toBe(
      `Searched ${built.retrieval!.totalPassages} document sections and used the best ${built.retrieval!.selected.length}.`,
    );
  });

  it("tells the engine not to claim knowledge of the parts it was not given", () => {
    const built = buildDocumentContext(QUESTION, [readable("S1", "log.txt", LOG)]);
    expect(built.context).toContain("Do not claim knowledge of any other part");
  });

  it("adds no such warning when the document was short enough to send whole", () => {
    const built = buildDocumentContext("what is the answer?", [
      readable("S1", "note.txt", "The answer is 42."),
    ]);
    expect(built.context).toContain("42");
    expect(built.context).not.toContain("Do not claim knowledge of any other part");
    expect(built.notice).toBeNull();
    expect(built.retrieval!.sentWhole).toBe(true);
  });

  it("keeps each unreadable file's own reason instead of dropping it silently", () => {
    const built = buildDocumentContext("summarise these", [
      {
        id: "S1",
        name: "scan.pdf",
        kind: "pdf",
        readable: false,
        unreadableReason: "This PDF is password protected.",
        text: null,
        locator: {},
      },
      { id: "S2", name: "empty.txt", kind: "text", readable: true, text: "   ", locator: {} },
    ]);
    expect(built.context).toBeUndefined();
    expect(built.notice).toContain("scan.pdf");
    expect(built.notice).toContain("password protected");
    expect(built.notice).toContain("empty.txt");
    expect(built.unreadable).toHaveLength(2);
  });

  it("still sends the readable file when another attachment could not be read", () => {
    const built = buildDocumentContext("what is the answer?", [
      readable("S1", "note.txt", "The answer is 42."),
      {
        id: "S2",
        name: "clip.mp4",
        kind: "video",
        readable: false,
        unreadableReason: "OCADE does not transcribe video yet.",
        text: null,
        locator: {},
      },
    ]);
    expect(built.context).toContain("42");
    expect(built.notice).toContain("clip.mp4");
  });

  it("reports nothing at all when there were no attachments", () => {
    const built = buildDocumentContext("hello", []);
    expect(built.context).toBeUndefined();
    expect(built.notice).toBeNull();
    expect(built.retrieval).toBeNull();
    expect(built.unreadable).toEqual([]);
  });

  it("offers only readable sources for citation", () => {
    const built = buildDocumentContext("what is the answer?", [
      readable("S1", "note.txt", "The answer is 42."),
      {
        id: "S2",
        name: "clip.mp4",
        kind: "video",
        readable: false,
        unreadableReason: "OCADE does not transcribe video yet.",
        text: null,
        locator: {},
      },
    ]);
    expect(built.context).toContain("S1 = note.txt");
    expect(built.context).not.toContain("S2 = clip.mp4");
  });

  it("never exceeds the context bound the server enforces", () => {
    const huge = Array.from({ length: 4000 }, (_, i) => `Line ${i}: ${"detail ".repeat(10)}`).join(
      "\n",
    );
    const built = buildDocumentContext("detail", [readable("S1", "huge.txt", huge)]);
    expect(built.context!.length).toBeLessThanOrEqual(DOCUMENT_CONTEXT_MAX_CHARS);
  });
});
