import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { looksLikeWriting, routeDirect } from "@/lib/work/fast-router";

/**
 * "open notepad and in notepad type a English porm" — notepad opened TWICE and
 * nothing was ever written.
 *
 * Two independent faults, either of which alone would have produced a working
 * run, which is why it survived until somebody typed it.
 */

const MISSION = readFileSync("src/lib/work/use-mission.ts", "utf8");

describe("a typo in the word that decides everything", () => {
  it("still recognises a writing brief when the content word is misspelled", () => {
    /*
     * The gate demanded an exact `poem`, `essay`, `story`. `porm` failed it, so
     * a writing brief was treated as an open instruction and handed to the
     * model. People typo the very word that decides this, and the decision is
     * too consequential to hinge on spelling.
     */
    expect(looksLikeWriting("a English porm")).toBe(true);
    expect(looksLikeWriting("a eassy about rain")).toBe(true);
    expect(looksLikeWriting("a stroy about a dog")).toBe(true);
  });

  it("treats 'a' or 'an' as a brief, whatever noun follows", () => {
    // The part that catches a content word the list has never heard of.
    // Nobody types an indefinite article as literal content.
    expect(looksLikeWriting("a haiku")).toBe(true);
    expect(looksLikeWriting("an apology to my landlord")).toBe(true);
  });

  it("keeps the quantified-length and topic rules alive", () => {
    /*
     * BOTH OF THESE WERE DEAD AND NOBODY COULD TELL. Shell escaping turned the
     * two word boundaries in their patterns into LITERAL BACKSPACE characters
     * (0x08), so each regex demanded an unprintable control character and could
     * never match anything a person typed. They passed review, they passed
     * every other test, and they did nothing.
     *
     * These cases are chosen so only one rule can fire: neither string contains
     * a content word, so if the rule is broken the case fails.
     */
    expect(looksLikeWriting("100 words on dogs")).toBe(true);
    expect(looksLikeWriting("three sentences")).toBe(true);
    expect(looksLikeWriting("on the topic of rain")).toBe(true);
  });

  it("does not let a quantity word match inside another word", () => {
    // "swords" contains "words". The boundary is what stops it.
    expect(looksLikeWriting("swords")).toBe(false);
  });

  it("does not turn literal text into a brief", () => {
    // The opposite failure: a brief typed literally puts the INSTRUCTION into
    // the document. Bare words with no article stay literal.
    expect(looksLikeWriting("hello")).toBe(false);
    expect(looksLikeWriting("hello world")).toBe(false);
  });

  it("routes the misspelled request to compose, not to the model", () => {
    const route = routeDirect("in notepad type a English porm");
    expect(route?.rule).toBe("write.compose");
    expect(route?.compose?.brief).toBe("a English porm");
    expect(route?.compose?.app).toBe("notepad");
  });

  it("still types quoted text verbatim", () => {
    const route = routeDirect('type "hello world" in notepad');
    expect(route?.rule).toBe("write.literal");
    expect(route?.compose).toBeUndefined();
  });
});

describe("a leftover the router can answer never reaches the model", () => {
  it("the router does answer the leftover, when asked", () => {
    /*
     * This is the half that was missing. The full sentence splits into
     * `app_open notepad` plus "in notepad type a English porm", and that
     * leftover went STRAIGHT to the model -- which had `app_open` in its tools
     * and opened notepad a second time.
     *
     * The router resolves it deterministically. It was simply never asked.
     */
    const full = routeDirect("open notepad and in notepad type a English porm");
    expect(full?.calls?.[0]?.name).toBe("app_open");
    expect(full?.remainder).toBe("in notepad type a English porm");

    const leftover = routeDirect(full!.remainder!);
    expect(leftover?.rule).toBe("write.compose");
    expect(leftover?.compose?.brief).toBe("a English porm");
  });

  it("the mission asks the router before falling back to the model", () => {
    expect(MISSION).toContain("const again = routeDirect(remainingWork)");
  });

  it("re-routes at most once, so a leftover cannot loop", () => {
    // `reroute` is not carried forward: a leftover that itself produces a
    // leftover still ends at the model, and there is no path that repeats.
    expect(MISSION).toContain("remainingWork = null;");
    const block = MISSION.slice(MISSION.indexOf("const again = routeDirect"));
    expect(block.slice(0, 1200)).not.toContain("while (");
  });
});
