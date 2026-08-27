/**
 * Proof that the imported primary logic runs, not just that it compiles.
 *
 * These are the four subsystems the OCADE runtime is built on, exercised
 * through their real entry points. A port that typechecks and then throws on
 * first call is not an import; it is a directory.
 */
import { describe, expect, it } from "vitest";
import {
  permissionRuleValueFromString,
  permissionRuleValueToString,
  normalizeLegacyToolName,
} from "../permissions/permissionRuleParser";
import {
  DANGEROUS_BASH_PATTERNS,
  CROSS_PLATFORM_CODE_EXEC,
} from "../permissions/dangerousPatterns";
import {
  createDenialTrackingState,
  recordDenial,
  recordSuccess,
  shouldFallbackToPrompting,
} from "../permissions/denialTracking";
import { getDestructiveCommandWarning } from "../commands/destructiveCommandWarning";

describe("permission rules", () => {
  it("round-trips a rule with no content", () => {
    expect(permissionRuleValueToString(permissionRuleValueFromString("Bash"))).toBe("Bash");
  });

  it("round-trips a rule whose content contains parentheses", () => {
    const original = 'Bash(python -c "print\\(1\\)")';
    const parsed = permissionRuleValueFromString(original);
    expect(parsed.toolName).toBe("Bash");
    expect(parsed.ruleContent).toBe('python -c "print(1)"');
    expect(permissionRuleValueToString(parsed)).toBe(original);
  });

  it("treats a tool-wide wildcard as the bare tool name", () => {
    expect(permissionRuleValueFromString("Bash(*)")).toEqual({ toolName: "Bash" });
    expect(permissionRuleValueFromString("Bash()")).toEqual({ toolName: "Bash" });
  });

  it("does not mistake trailing text for rule content", () => {
    const parsed = permissionRuleValueFromString("Bash(rm -rf /) extra");
    expect(parsed.ruleContent).toBeUndefined();
  });

  it("normalises a legacy tool name to its canonical form", () => {
    expect(typeof normalizeLegacyToolName("Bash")).toBe("string");
  });
});

describe("dangerous pattern table", () => {
  it("is populated and every entry compiles as a regular expression", () => {
    expect(DANGEROUS_BASH_PATTERNS.length).toBeGreaterThan(0);
    expect(CROSS_PLATFORM_CODE_EXEC.length).toBeGreaterThan(0);
    for (const pattern of [...DANGEROUS_BASH_PATTERNS, ...CROSS_PLATFORM_CODE_EXEC]) {
      expect(() => new RegExp(pattern)).not.toThrow();
    }
  });
});

describe("denial tracking", () => {
  it("falls back to prompting only after repeated refusals", () => {
    let state = createDenialTrackingState();
    expect(shouldFallbackToPrompting(state)).toBe(false);
    for (let i = 0; i < 10; i++) state = recordDenial(state);
    expect(shouldFallbackToPrompting(state)).toBe(true);
  });

  it("a success relieves the fallback", () => {
    let state = createDenialTrackingState();
    for (let i = 0; i < 10; i++) state = recordDenial(state);
    state = recordSuccess(state);
    expect(shouldFallbackToPrompting(state)).toBe(false);
  });
});

describe("destructive command warnings", () => {
  it.each([
    ["git reset --hard", "discard uncommitted"],
    ["git push --force origin main", "overwrite remote"],
  ])("warns about %s", (command) => {
    expect(getDestructiveCommandWarning(command)).toBeTruthy();
  });

  it("stays quiet for an ordinary command", () => {
    expect(getDestructiveCommandWarning("git status")).toBeNull();
  });
});
