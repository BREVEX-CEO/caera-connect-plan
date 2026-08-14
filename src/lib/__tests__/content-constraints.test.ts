import { describe, it, expect } from "vitest";
import {
  parseConstraints,
  checkContent,
  countWords,
  countItems,
  contentOf,
  correctionPrompt,
} from "@/lib/work/content-constraints";

/**
 * The measured failure: 175 words reported as a 200-word essay.
 *
 * Every mechanical receipt in that run was correct and the output was still
 * wrong, because no step was responsible for the property the user actually
 * stated. These cases are that property.
 */
describe("reading a countable constraint out of an instruction", () => {
  it("reads the phrasing that actually failed", () => {
    const found = parseConstraints("Open Notepad and write a 200-word essay about fast cars");
    expect(found).toEqual([
      { unit: "word", kind: "about", count: 200, source: "200-word" },
    ]);
  });

  it.each([
    ["write 500 words about bees", "word", "about", 500],
    ["give me exactly 12 lines", "line", "exactly", 12],
    ["at least 300 words please", "word", "atLeast", 300],
    ["no more than 5 bullets", "item", "atMost", 5],
    ["under 280 characters", "character", "atMost", 280],
    ["list five items", "item", "about", 5],
  ])("reads %j", (request, unit, kind, count) => {
    const [first] = parseConstraints(request);
    expect(first).toMatchObject({ unit, kind, count });
  });

  it("prefers the explicit bound over the bare number in the same phrase", () => {
    // "at least 200 words" must not ALSO register as an approximate 200, or a
    // 300-word answer would satisfy one reading and fail the other.
    const found = parseConstraints("write at least 200 words");
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("atLeast");
  });

  it("finds nothing in an instruction that states no length", () => {
    expect(parseConstraints("open notepad and write an essay about fast cars")).toEqual([]);
    expect(parseConstraints("what is on my screen")).toEqual([]);
    // A number that is not a quantity of output.
    expect(parseConstraints("open chrome and go to wikipedia")).toEqual([]);
  });
});

describe("checking produced content against the constraint", () => {
  const essay = (words: number) => Array.from({ length: words }, () => "word").join(" ");

  it("fails the exact miss that shipped", () => {
    const constraints = parseConstraints("write a 200-word essay about fast cars");
    const check = checkContent(essay(175), constraints);
    expect(check.ok).toBe(false);
    expect(check.shortfall).toContain("175 words");
    expect(check.shortfall).toContain("200-word");
  });

  it("passes a length a person would call correct", () => {
    // "A 200-word essay" is a request for about two hundred words. Treating it
    // as strict would re-prompt over text that is already right.
    const constraints = parseConstraints("write a 200-word essay");
    expect(checkContent(essay(196), constraints).ok).toBe(true);
    expect(checkContent(essay(209), constraints).ok).toBe(true);
  });

  it("gives 'exactly' no tolerance at all", () => {
    const constraints = parseConstraints("write exactly 20 words");
    expect(checkContent(essay(20), constraints).ok).toBe(true);
    expect(checkContent(essay(19), constraints).ok).toBe(false);
  });

  it("honours one-sided bounds in the right direction", () => {
    expect(checkContent(essay(400), parseConstraints("at least 300 words")).ok).toBe(true);
    expect(checkContent(essay(200), parseConstraints("at least 300 words")).ok).toBe(false);
    expect(checkContent(essay(50), parseConstraints("no more than 100 words")).ok).toBe(true);
    expect(checkContent(essay(150), parseConstraints("no more than 100 words")).ok).toBe(false);
  });

  it("is vacuously satisfied when nothing was asked for", () => {
    expect(checkContent("anything at all", []).ok).toBe(true);
  });
});

describe("counting the way a person would", () => {
  it("treats hyphenated compounds and contractions as one word", () => {
    expect(countWords("state-of-the-art cars aren't cheap")).toBe(4);
  });

  it("does not score markdown punctuation as content", () => {
    expect(countWords("- one\n- two\n- three")).toBe(3);
  });

  it("counts bulleted entries rather than lines when both are present", () => {
    expect(countItems("1. alpha\n2. beta\n3. gamma")).toBe(3);
  });
});

describe("which tool arguments carry authored content", () => {
  it("finds the text a constraint should be measured against", () => {
    expect(contentOf("type_text", { text: "hello there" })).toEqual({
      field: "text",
      value: "hello there",
    });
    expect(contentOf("workspace_write", { name: "a.txt", content: "body" })?.field).toBe("content");
  });

  it("ignores calls that author nothing", () => {
    expect(contentOf("app_open", { name: "Notepad" })).toBeNull();
    expect(contentOf("screen_observe", {})).toBeNull();
    expect(contentOf("type_text", { text: "   " })).toBeNull();
  });
});

describe("the correction sent back to the model", () => {
  it("names the measurement and the direction, not just 'try again'", () => {
    const constraints = parseConstraints("write a 200-word essay about fast cars");
    const produced = Array.from({ length: 175 }, () => "word").join(" ");
    const prompt = correctionPrompt(
      "write a 200-word essay about fast cars",
      produced,
      checkContent(produced, constraints),
    );
    expect(prompt).toContain("175 words and needs to be 200");
    expect(prompt).toContain("longer");
    expect(prompt).toContain("25");
    expect(prompt).toContain("ONLY the corrected text");
  });
});
