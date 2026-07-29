import { describe, it, expect } from "vitest";
import {
  buildSourceIndex,
  citationInstruction,
  parseCitations,
  stripCitationMarkers,
  hasCitations,
  describeLocator,
  locateSnippet,
} from "../ocade-citations";
import { extractDocument } from "../ocade-documents";

const readable = extractDocument({
  name: "notes.md",
  sizeBytes: 40,
  content: "# Budget\nThe quarterly total is 42000.\nSigned off by finance.",
});
const csv = extractDocument({ name: "rows.csv", sizeBytes: 20, content: "name,qty\nbolt,9" });
const pdf = extractDocument({ name: "report.pdf", sizeBytes: 900 });
const image = extractDocument({ name: "shot.png", mime: "image/png", sizeBytes: 10 });

describe("buildSourceIndex", () => {
  it("assigns stable ordered ids", () => {
    const idx = buildSourceIndex([readable, csv, pdf]);
    expect(idx.map((s) => s.id)).toEqual(["S1", "S2", "S3"]);
    expect(idx[0].name).toBe("notes.md");
  });

  it("marks unreadable sources and keeps the honest reason", () => {
    const idx = buildSourceIndex([pdf, image]);
    expect(idx[0].readable).toBe(false);
    expect(idx[0].unreadableReason).toBeTruthy();
    expect(idx[1].readable).toBe(false);
  });

  it("gives tabular sources a sheet locator", () => {
    const idx = buildSourceIndex([csv]);
    expect(idx[0].locator.sheet).toBe("rows.csv");
  });
});

describe("citationInstruction", () => {
  it("offers only readable sources for citation", () => {
    const instruction = citationInstruction(buildSourceIndex([readable, pdf]));
    expect(instruction).toContain("S1 = notes.md");
    expect(instruction).not.toContain("report.pdf");
    expect(instruction).toMatch(/never invent a source id/i);
  });

  it("is empty when nothing was readable", () => {
    expect(citationInstruction(buildSourceIndex([pdf, image]))).toBe("");
  });
});

describe("parseCitations", () => {
  const idx = buildSourceIndex([readable, csv, pdf]);

  it("maps markers back to real sources", () => {
    const cites = parseCitations("The total is 42000 [S1] and stock is 9 [S2].", idx);
    expect(cites).toHaveLength(2);
    expect(cites[0].name).toBe("notes.md");
    expect(cites[1].name).toBe("rows.csv");
  });

  it("drops fabricated ids the model invented", () => {
    expect(parseCitations("Made up [S99].", idx)).toHaveLength(0);
  });

  it("never cites a source OCADE could not actually read", () => {
    // S3 is the PDF, which needs a decoder pack.
    expect(parseCitations("From the report [S3].", idx)).toHaveLength(0);
  });

  it("de-duplicates repeated markers", () => {
    expect(parseCitations("[S1] and again [S1]", idx)).toHaveLength(1);
  });

  it("attaches a snippet from the real source text", () => {
    const [c] = parseCitations("See [S1]", idx);
    expect(c.snippet).toContain("Budget");
  });
});

describe("stripCitationMarkers", () => {
  it("removes markers and tidies spacing", () => {
    expect(stripCitationMarkers("Total is 42000 [S1].")).toBe("Total is 42000.");
  });
  it("leaves prose without markers untouched", () => {
    expect(stripCitationMarkers("No sources here")).toBe("No sources here");
  });
});

describe("hasCitations", () => {
  const idx = buildSourceIndex([readable]);
  it("is true only for valid markers", () => {
    expect(hasCitations("x [S1]", idx)).toBe(true);
    expect(hasCitations("x [S7]", idx)).toBe(false);
    expect(hasCitations("plain answer", idx)).toBe(false);
  });
});

describe("locators", () => {
  it("describes each locator kind", () => {
    expect(describeLocator({ page: 3 })).toBe("page 3");
    expect(describeLocator({ sheet: "Budget" })).toBe("sheet Budget");
    expect(describeLocator({ line: 12 })).toBe("line 12");
    expect(describeLocator({})).toBeNull();
  });

  it("locates a quoted snippet to a 1-based line", () => {
    expect(locateSnippet(readable.text, "quarterly total")).toBe(2);
    expect(locateSnippet(readable.text, "not present")).toBeNull();
    expect(locateSnippet(null, "x")).toBeNull();
  });
});

/**
 * REGRESSION GUARD.
 *
 * The chat once built its source index by hand with `locator: {}` hardcoded.
 * Everything still "worked" — citations rendered, markers parsed — but the
 * locator was always empty, so a citation could name the file and never say
 * WHERE in it the answer came from. `describeLocator` silently returned null
 * for every source.
 *
 * These pin that a real locator survives the round trip.
 */
describe("citations keep a real position, not an empty locator", () => {
  it("derives a line locator for a plain text document", () => {
    const result = extractDocument({
      name: "notes.txt",
      mime: "text/plain",
      sizeBytes: 40,
      content: "first line\nsecond line\nthird line",
    });
    const [source] = buildSourceIndex([result]);
    expect(source.locator).not.toEqual({});
    expect(describeLocator(source.locator)).not.toBeNull();
  });

  it("a citation resolved from an indexed source carries that locator", () => {
    const result = extractDocument({
      name: "notes.txt",
      mime: "text/plain",
      sizeBytes: 40,
      content: "alpha\nbravo\ncharlie",
    });
    const sources = buildSourceIndex([result]);
    const [citation] = parseCitations("The answer is bravo [S1].", sources);
    expect(citation).toBeDefined();
    expect(citation.name).toBe("notes.txt");
    expect(citation.sourceId).toBe("S1");
    // The whole point: the citation carries a real position, not `{}`.
    expect(describeLocator(citation.locator)).toBeTruthy();
  });

  it("an empty locator would have produced no description — the old bug", () => {
    // Documents the exact failure mode so it is recognisable if it returns.
    expect(describeLocator({})).toBeNull();
  });

  it("marks an unreadable source as such instead of silently indexing it", () => {
    const result = extractDocument({
      name: "photo.heic",
      mime: "image/heic",
      sizeBytes: 1000,
    });
    const [source] = buildSourceIndex([result]);
    if (result.status !== "ok") {
      expect(source.readable).toBe(false);
      expect(source.unreadableReason).toBeTruthy();
    }
  });
});

/**
 * Citation evidence must relate to the CLAIM, not to the document's opening
 * line. The previous behaviour showed `firstMeaningfulLine` for every citation,
 * so the "evidence" was the same text regardless of what was cited.
 */
describe("citation evidence follows the quoted claim", () => {
  const doc = extractDocument({
    name: "policy.txt",
    mime: "text/plain",
    sizeBytes: 200,
    content: [
      "Company handbook introduction.",
      "Employees accrue 20 days of leave per year.",
      "Expenses must be filed within 30 days.",
    ].join("\n"),
  });
  const sources = buildSourceIndex([doc]);

  it("uses the quoted phrase and locates its line", () => {
    const [c] = parseCitations(
      'The policy says "Expenses must be filed within 30 days" [S1].',
      sources,
    );
    expect(c.snippet).toBe("Expenses must be filed within 30 days");
    expect(c.locator.line).toBe(3);
  });

  it("picks the line matching THIS claim, not the first line", () => {
    const [c] = parseCitations('You get "20 days of leave per year" [S1].', sources);
    expect(c.locator.line).toBe(2);
    expect(c.snippet).not.toContain("introduction");
  });

  /** An invented quote must never be presented as evidence. */
  it("ignores a quote that is NOT present in the source", () => {
    const [c] = parseCitations('It says "unlimited vacation for everyone" [S1].', sources);
    // Falls back to real source text rather than echoing the fabrication.
    expect(c.snippet).not.toBe("unlimited vacation for everyone");
    expect(c.snippet).toBe("Company handbook introduction.");
    // And the locator stays the source default — not a position invented to
    // make the fabricated quote look located.
    expect(c.locator).toEqual(sources[0].locator);
  });

  it("falls back to the first meaningful line when nothing was quoted", () => {
    const [c] = parseCitations("The handbook covers this [S1].", sources);
    expect(c.snippet).toBe("Company handbook introduction.");
  });

  it("does not borrow a quote from a different sentence", () => {
    const [c] = parseCitations(
      'Someone said "Expenses must be filed within 30 days". A separate point [S1].',
      sources,
    );
    // The quote belongs to the previous sentence, so it must not be attributed.
    expect(c.snippet).toBe("Company handbook introduction.");
  });
});
