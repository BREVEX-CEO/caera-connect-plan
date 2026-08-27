/**
 * Two imported rules that both exist because a model believes what it is shown.
 *
 * A transcript carries artefacts of how the last run ended. Tool arguments
 * carry the model's own formatting. Neither is a bug at the moment it is
 * created; both become one when the next turn reads them literally.
 */

import { describe, expect, it } from "vitest";

import { describeInterruption, repairForResume } from "../query/resume";
import {
  coerceArguments,
  coerceDeclared,
  semanticBoolean,
  semanticNumber,
} from "../text/semanticValues";
import type { QueryMessage } from "../query/deps";

const user = (content: string): QueryMessage => ({ role: "user", content });
const assistant = (content: string): QueryMessage => ({ role: "assistant", content });
const toolResult = (name: string): QueryMessage => ({
  role: "user",
  content: `Result of ${name}: done`,
});

describe("carrying on from a transcript", () => {
  it("drops the empty turn a stopped stream leaves behind", () => {
    const repaired = repairForResume([user("Do it"), assistant("")]);
    expect(repaired.messages).toEqual([user("Do it")]);
    expect(repaired.removed).toBe(1);
  });

  it("treats a whitespace-only answer as empty too", () => {
    expect(repairForResume([user("Do it"), assistant("   \n ")]).removed).toBe(1);
  });

  it("drops tool results left stranded at the very start", () => {
    const repaired = repairForResume([toolResult("file_read"), user("Now what?")]);
    expect(repaired.messages).toEqual([user("Now what?")]);
  });

  it("keeps a result in the middle, because its request is right there", () => {
    const messages = [user("Read it"), assistant("Reading."), toolResult("file_read")];
    expect(repairForResume(messages).messages).toHaveLength(3);
  });

  it("says when work was in flight", () => {
    const repaired = repairForResume([user("Do it"), assistant("On it."), toolResult("file_read")]);
    expect(repaired.interruption).toBe("mid_turn");
    expect(describeInterruption(repaired.interruption)).toMatch(/carry on/);
  });

  it("says when the question was never answered", () => {
    const repaired = repairForResume([assistant("Hello."), user("Do it")]);
    expect(repaired.interruption).toBe("awaiting_reply");
    expect(describeInterruption(repaired.interruption)).toMatch(/Send it again/);
  });

  it("says nothing about a conversation that simply finished", () => {
    const repaired = repairForResume([user("Do it"), assistant("Done.")]);
    expect(repaired.interruption).toBe("none");
    expect(describeInterruption(repaired.interruption)).toBeNull();
    expect(repaired.removed).toBe(0);
  });

  it("survives an empty transcript", () => {
    expect(repairForResume([])).toEqual({ messages: [], interruption: "none", removed: 0 });
  });
});

describe("arguments the model quoted", () => {
  it("reads the exact string literals and nothing else", () => {
    expect(semanticBoolean("false")).toBe(false);
    expect(semanticBoolean("true")).toBe(true);
    // Not JavaScript truthiness: Boolean("false") is true, which is the bug.
    expect(semanticBoolean("FALSE")).toBe("FALSE");
    expect(semanticBoolean("")).toBe("");
    expect(semanticBoolean(0)).toBe(0);
  });

  it("converts a quoted number and refuses a plausible-looking non-number", () => {
    expect(semanticNumber("30")).toBe(30);
    expect(semanticNumber("-5")).toBe(-5);
    expect(semanticNumber("3.14")).toBe(3.14);
    // Number("") is 0 and Number(null) is 0. Both would hide a broken call.
    expect(semanticNumber("")).toBe("");
    expect(semanticNumber(null)).toBeNull();
    expect(semanticNumber("30px")).toBe("30px");
  });

  it("only touches arguments the tool declares as a boolean or a number", () => {
    const coerced = coerceArguments(
      { allowOcr: "false", limit: "30", query: "false", name: "chrome" },
      { allowOcr: "boolean", limit: "number", query: "string", name: "string" },
    );
    expect(coerced).toEqual({ allowOcr: false, limit: 30, query: "false", name: "chrome" });
  });

  it("returns the same object when there was nothing to change", () => {
    const args = { path: "/home/ada", recursive: true };
    expect(coerceArguments(args, { path: "string", recursive: "boolean" })).toBe(args);
  });

  it("leaves an undeclared argument alone", () => {
    expect(coerceDeclared("false", undefined)).toBe("false");
  });

  it("would have prevented the two reads that go wrong in production", () => {
    /*
     * `args.allowOcr !== false` is TRUE for the string "false", so a model
     * asking for OCR off got it on. `args.wait === true` is FALSE for "true",
     * so a model asking to wait never did.
     */
    const { allowOcr, wait } = coerceArguments(
      { allowOcr: "false", wait: "true" },
      { allowOcr: "boolean", wait: "boolean" },
    ) as { allowOcr: unknown; wait: unknown };
    expect(allowOcr !== false).toBe(false);
    expect(wait === true).toBe(true);
  });
});
