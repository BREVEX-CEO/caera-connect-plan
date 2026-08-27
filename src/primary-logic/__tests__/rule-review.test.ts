/**
 * A permission rule is a small program somebody writes about their own safety,
 * and both ways it fails are silent.
 *
 * A malformed rule matches nothing while looking right, so they believe they
 * granted something they did not. An unreachable rule is shadowed by a broader
 * one consulted first, so they are asked forever and never learn why. Neither
 * raises an error; both produce a person who concludes the feature is broken.
 */

import { describe, expect, it } from "vitest";

import {
  findDuplicateRules,
  findShadowedRules,
  validateRule,
  type ReviewableRule,
} from "../permissions/ruleReview";

const allow = (rule: string): ReviewableRule => ({ rule, behavior: "allow" });
const ask = (rule: string): ReviewableRule => ({ rule, behavior: "ask" });
const deny = (rule: string): ReviewableRule => ({ rule, behavior: "deny" });

describe("rules that would never match", () => {
  it("accepts the ordinary shapes", () => {
    for (const rule of ["Bash", "Bash(git status)", "Bash(npm run:*)", "file_trash(~/Downloads/*)"]) {
      expect(validateRule(rule), rule).toBeNull();
    }
  });

  it("catches unbalanced brackets", () => {
    expect(validateRule("Bash(git status")?.reason).toMatch(/brackets do not balance/);
  });

  it("catches anything trailing the pattern, which is silently dropped", () => {
    expect(validateRule("Bash(git) status")?.reason).toMatch(/ignored/);
  });

  it("catches an empty pattern, which is not the same as no pattern", () => {
    expect(validateRule("Bash()")?.reason).toMatch(/brackets are empty/);
  });

  it("catches a lone star, and says what to write instead", () => {
    const problem = validateRule("Bash(*)");
    expect(problem?.reason).toMatch(/same as naming the tool/);
    expect(problem?.fix).toBe("Write Bash on its own if that is what you meant.");
  });

  it("catches invisible characters that survive a paste", () => {
    // A zero-width space between the words. The field looks correct.
    const pasted = `Bash(git​status)`;
    expect(validateRule(pasted)?.reason).toMatch(/cannot be seen/);
  });

  it("refuses an empty rule without pretending there is a fix", () => {
    const problem = validateRule("   ");
    expect(problem?.reason).toMatch(/needs a tool name/);
    expect(problem?.fix).toBeNull();
  });
});

describe("rules that can never be reached", () => {
  it("reports an allow under a tool-wide refusal", () => {
    const rules = [deny("Bash"), allow("Bash(git status)")];
    const [shadow] = findShadowedRules(rules);
    expect(shadow.rule.rule).toBe("Bash(git status)");
    expect(shadow.reason).toMatch(/blocked entirely/);
  });

  it("reports an allow under a tool-wide question", () => {
    const [shadow] = findShadowedRules([ask("Bash"), allow("Bash(npm run:*)")]);
    expect(shadow.reason).toMatch(/always asks/);
    expect(shadow.fix).toMatch(/Remove the rule that always asks/);
  });

  it("does not call a tool-wide rule shadowed by another tool-wide rule", () => {
    // Two blanket rules are a contradiction precedence resolves, not a dead rule.
    expect(findShadowedRules([deny("Bash"), allow("Bash")])).toEqual([]);
  });

  it("leaves an ask under a tool-wide ask alone, because it still fires", () => {
    // Only ALLOW is made pointless by a blanket ask; a narrower ask is redundant
    // but harmless, and warning about it would be noise.
    expect(findShadowedRules([ask("Bash"), ask("Bash(git push)")])).toEqual([]);
  });

  it("does not confuse one tool with another", () => {
    expect(findShadowedRules([deny("Bash"), allow("file_read(~/notes)")])).toEqual([]);
  });

  it("says nothing about rules that all work", () => {
    expect(findShadowedRules([allow("Bash(git status)"), deny("Bash(rm:*)")])).toEqual([]);
  });
});

describe("the same rule twice", () => {
  it("is reported, whatever behaviours were attached", () => {
    expect(findDuplicateRules([allow("Bash(git status)"), deny("Bash(git status)")])).toEqual([
      "bash(git status)",
    ]);
  });

  it("ignores case and surrounding space, because a person would", () => {
    expect(findDuplicateRules([allow("Bash(ls)"), allow("  bash(ls)  ")])).toHaveLength(1);
  });

  it("says nothing when every rule is distinct", () => {
    expect(findDuplicateRules([allow("Bash(ls)"), allow("Bash(pwd)")])).toEqual([]);
  });
});
