/**
 * One permission and risk layer, for Chat and for Cowork.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO
 * ----------------------------------------
 * Cowork's `approvalPolicy` read, in full:
 *
 *     if (ALWAYS_ASK.has(toolName)) return "ask";
 *     void risk; void mode;
 *     return "auto";
 *
 * It took a risk band and a mode and discarded both. Every tool on the machine
 * — deleting files, typing into windows, running shell commands — ran without a
 * question, and one hard-coded name was the entire safety model. Chat had no
 * permission layer at all, because Chat had no tools; the moment Chat gets
 * tools, "no layer" stops being a description and becomes a hole.
 *
 * The imported primary logic carries a real one: permission modes, rules with
 * exact / prefix / wildcard matching, a dangerous-pattern table, destructive-
 * command warnings, and denial tracking. This module is the adapter between
 * that engine and OCADE's tool registry. The rules, the matching and the
 * pattern tables are the donor's; what is OCADE's is the mapping from a tool
 * call to the string those rules match against, and the surface rules below.
 *
 * THE ONE THING THIS LAYER WILL NOT DO
 * ------------------------------------
 * It never returns `allow` for a call it could not read. An argument shape it
 * does not recognise on a mutating tool resolves to `ask`, not to `allow`,
 * because "I could not tell what this would do" is a reason to check, never a
 * reason to proceed. Silence is not consent, including the compiler's.
 */

import {
  matchWildcardPattern,
  parsePermissionRule,
  type ShellPermissionRule,
} from "@/primary-logic/permissions/shellRuleMatching";
import { permissionRuleValueFromString } from "@/primary-logic/permissions/permissionRuleParser";
import {
  DANGEROUS_BASH_PATTERNS,
  CROSS_PLATFORM_CODE_EXEC,
} from "@/primary-logic/permissions/dangerousPatterns";
import { getDestructiveCommandWarning } from "@/primary-logic/commands/destructiveCommandWarning";
import {
  createDenialTrackingState,
  recordDenial,
  recordSuccess,
  shouldFallbackToPrompting,
  type DenialTrackingState,
} from "@/primary-logic/permissions/denialTracking";
import type { PermissionBehavior } from "@/primary-logic/permissions/types";
import type { ToolDefinition } from "@/lib/agent/tool-registry";

/**
 * How much OCADE may do without asking.
 *
 * These are the donor's modes, named for what a person would say rather than
 * for an internal state. The donor also carried `bypassPermissions`, which
 * disables the layer wholesale. OCADE does not offer it: a switch whose only
 * effect is "stop checking" is a switch that exists to be regretted, and the
 * cases it was for are covered by `trusted` plus explicit allow rules.
 */
export type PermissionMode =
  /** Ask before anything that changes the machine. The default. */
  | "guarded"
  /** Edits to files and documents go through; the rest still asks. */
  | "acceptEdits"
  /** Anything not explicitly denied goes through. Still honours deny rules. */
  | "trusted"
  /** Nothing runs. Used while a plan is being reviewed. */
  | "plan";

export const PERMISSION_MODES: readonly PermissionMode[] = [
  "guarded",
  "acceptEdits",
  "trusted",
  "plan",
];

export interface ToolCallLike {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * A rule as the user wrote it, in the donor's `Tool(content)` syntax.
 *
 * Examples: `Bash(git status)`, `Bash(npm run:*)`, `file_write(~/Documents/*)`,
 * `screen_observe`. Content matching supports exact, `prefix:*` and `*`
 * wildcards, all from the imported matcher.
 */
export interface StoredRule {
  rule: string;
  behavior: PermissionBehavior;
}

export interface PermissionContext {
  mode: PermissionMode;
  rules: readonly StoredRule[];
  denials: DenialTrackingState;
}

export type PermissionOutcome = "allow" | "ask" | "deny";

export interface PermissionDecision {
  outcome: PermissionOutcome;
  /**
   * Why, in a sentence a person can act on. Shown verbatim in the approval
   * card and in the activity log, so it never names an internal mode or rule
   * source the user has not seen.
   */
  reason: string;
  /** A destructive-command note, when the imported table recognises one. */
  warning: string | null;
  /** The rule that decided it, when a rule did. Lets the UI say which. */
  matchedRule: string | null;
}

export function createPermissionContext(
  mode: PermissionMode = "guarded",
  rules: readonly StoredRule[] = [],
): PermissionContext {
  return { mode, rules, denials: createDenialTrackingState() };
}

/** Record that the user refused a call; repeated refusals re-enable prompting. */
export function noteDenied(context: PermissionContext): PermissionContext {
  return { ...context, denials: recordDenial(context.denials) };
}

/** Record that a call was approved and completed. */
export function noteApproved(context: PermissionContext): PermissionContext {
  return { ...context, denials: recordSuccess(context.denials) };
}

/**
 * The string a rule's content is matched against for a given call.
 *
 * For a shell tool it is the command itself, because that is what the user
 * means when they write `Bash(git status)`. For everything else it is the
 * primary subject of the call — the path, the URL, the application name —
 * since a rule about `file_delete` is almost always a rule about *which files*.
 *
 * Returning null means "this call has no stable subject", and a null subject
 * can only ever match a tool-wide rule. It never matches a content rule by
 * accident, which is the failure mode that would quietly widen an allow-list.
 */
export function subjectOf(call: ToolCallLike): string | null {
  const args = call.arguments ?? {};
  for (const key of [
    "command",
    "script",
    "path",
    "file",
    "filePath",
    "url",
    "name",
    "app",
    "query",
  ]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** True when the call carries something that will be executed as a command. */
function commandOf(call: ToolCallLike): string | null {
  const args = call.arguments ?? {};
  for (const key of ["command", "script", "shell"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function ruleMatches(parsed: ShellPermissionRule, subject: string): boolean {
  switch (parsed.type) {
    case "exact":
      return parsed.command === subject;
    case "prefix":
      return subject === parsed.prefix || subject.startsWith(`${parsed.prefix} `);
    case "wildcard":
      return matchWildcardPattern(parsed.pattern, subject);
  }
}

interface RuleHit {
  behavior: PermissionBehavior;
  rule: string;
}

function findRule(
  call: ToolCallLike,
  rules: readonly StoredRule[],
  behavior: PermissionBehavior,
): RuleHit | null {
  const subject = subjectOf(call);
  for (const entry of rules) {
    if (entry.behavior !== behavior) continue;
    const value = permissionRuleValueFromString(entry.rule);
    if (value.toolName !== call.name) continue;
    // A rule with no content is tool-wide and matches every call to that tool.
    if (!value.ruleContent) return { behavior, rule: entry.rule };
    if (subject === null) continue;
    if (ruleMatches(parsePermissionRule(value.ruleContent), subject)) {
      return { behavior, rule: entry.rule };
    }
  }
  return null;
}

/**
 * Whether a command looks like one of the shapes the imported table flags.
 *
 * The patterns are the donor's and they are string sources, not compiled
 * expressions, so they are compiled once here and cached for the process.
 */
const DANGEROUS = [...DANGEROUS_BASH_PATTERNS, ...CROSS_PLATFORM_CODE_EXEC].map(
  (source) => new RegExp(source),
);

function looksDangerous(command: string): boolean {
  return DANGEROUS.some((pattern) => pattern.test(command));
}

/**
 * Decide what happens to one tool call.
 *
 * Order matters and is not arbitrary: deny beats everything, then plan mode
 * stops the world, then an explicit ask overrides an automatic allow, then
 * rules, then the read-only shortcut, then risk. A user who wrote a deny rule
 * has said something more specific than any mode, so no mode may override it.
 */
export function decide(
  call: ToolCallLike,
  tool: ToolDefinition | null,
  context: PermissionContext,
): PermissionDecision {
  const command = commandOf(call);
  const warning = command ? getDestructiveCommandWarning(command) : null;

  const denied = findRule(call, context.rules, "deny");
  if (denied) {
    return {
      outcome: "deny",
      reason: "You have blocked this action.",
      warning,
      matchedRule: denied.rule,
    };
  }

  if (!tool) {
    return {
      outcome: "deny",
      reason: "OCADE does not have that action.",
      warning,
      matchedRule: null,
    };
  }

  if (context.mode === "plan") {
    if (!tool.mutating) {
      return { outcome: "allow", reason: "Looking only.", warning, matchedRule: null };
    }
    return {
      outcome: "deny",
      reason: "Nothing runs while you are reviewing the plan.",
      warning,
      matchedRule: null,
    };
  }

  const asked = findRule(call, context.rules, "ask");
  if (asked) {
    return {
      outcome: "ask",
      reason: "You asked to be checked with on this.",
      warning,
      matchedRule: asked.rule,
    };
  }

  const allowed = findRule(call, context.rules, "allow");
  if (allowed) {
    return {
      outcome: "allow",
      reason: "You allowed this before.",
      warning,
      matchedRule: allowed.rule,
    };
  }

  /*
   * Reading is free. This is the line that makes observe-act-observe possible:
   * a loop that had to ask before every look would teach the user to approve
   * without reading, which costs more safety than it buys.
   */
  if (!tool.mutating) {
    return { outcome: "allow", reason: "Looking only.", warning, matchedRule: null };
  }

  /*
   * Two independent signals, and both must ask.
   *
   * `looksDangerous` is the donor's pattern table — the shapes that destroy
   * data or execute fetched code. `warning` is its destructive-command table,
   * which knows narrower things: `git reset --hard` matches no dangerous
   * pattern, and it still throws away work the user cannot get back. Consulting
   * only the first table let `git reset --hard` run silently under `trusted`,
   * which is precisely the loss the tables exist to prevent.
   */
  if (command && (looksDangerous(command) || warning)) {
    return {
      outcome: "ask",
      reason: warning ?? "This command can do damage that cannot be undone.",
      warning,
      matchedRule: null,
    };
  }

  /*
   * A high-risk action asks in every mode short of an explicit rule. `trusted`
   * means "I do not want to be asked about routine things"; nobody means it to
   * include the irreversible ones, and a mode is too blunt an instrument to
   * carry that consent.
   */
  if (tool.risk === "high") {
    return {
      outcome: "ask",
      reason: warning ?? "This cannot be undone.",
      warning,
      matchedRule: null,
    };
  }

  /*
   * Repeated refusals mean the automatic answer is wrong for this person right
   * now. The donor's tracker exists for exactly this, and honouring it is what
   * keeps a permissive mode from becoming an argument the user cannot win.
   */
  if (shouldFallbackToPrompting(context.denials)) {
    return {
      outcome: "ask",
      reason: "You have turned several of these down, so OCADE is checking again.",
      warning,
      matchedRule: null,
    };
  }

  if (context.mode === "trusted") {
    return {
      outcome: "allow",
      reason: "Running without asking, as you set.",
      warning,
      matchedRule: null,
    };
  }

  if (context.mode === "acceptEdits" && (tool.domain === "files" || tool.domain === "content")) {
    return {
      outcome:
        tool.risk === "read" || tool.risk === "low" || tool.risk === "medium" ? "allow" : "ask",
      reason: "Edits go through without asking, as you set.",
      warning,
      matchedRule: null,
    };
  }

  return {
    outcome: "ask",
    reason: warning ?? "This changes something on your device.",
    warning,
    matchedRule: null,
  };
}

/**
 * The rule OCADE would write if the user picks "always allow" on this call.
 *
 * Scoped to the subject rather than the tool wherever there is one: agreeing to
 * `git status` is not agreeing to every shell command, and an approval dialog
 * that quietly means the latter is a dialog that lied.
 */
export function alwaysAllowRule(call: ToolCallLike): string {
  const subject = subjectOf(call);
  return subject ? `${call.name}(${subject.replace(/([()])/g, "\\$1")})` : call.name;
}
