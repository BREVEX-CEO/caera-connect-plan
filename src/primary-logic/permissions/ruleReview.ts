/**
 * Telling somebody their rule is wrong before it disappoints them.
 *
 * Ported from the archive's `settings/permissionValidation.ts` and
 * `shadowedRuleDetection.ts`.
 *
 * WHY A RULE NEEDS REVIEWING AT ALL
 * ---------------------------------
 * A permission rule is a small program the user writes about their own safety,
 * and the two ways it goes wrong are both silent. It can be MALFORMED, in which
 * case it matches nothing and the user believes they have granted something
 * they have not. Or it can be UNREACHABLE, shadowed by a broader rule consulted
 * first -- writing `Bash(git status)` to allow one command while a plain `Bash`
 * deny sits above it means being asked forever and never learning why.
 *
 * Neither produces an error. Both produce a person who concludes the feature
 * does not work.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor carried rule sources -- project settings, enterprise policy, CLI
 * arguments -- and much of its shadow logic was about which source may shadow
 * which. Every OCADE rule is the user's own, written on this device, so that
 * dimension is gone and what remains is the part about the rules themselves.
 * The donor's precedence is kept exactly: deny, then ask, then allow.
 */

import { permissionRuleValueFromString } from './permissionRuleParser.js'
import type { PermissionBehavior } from './types.js'

export type ReviewableRule = {
  rule: string
  behavior: PermissionBehavior
}

export type RuleProblem = {
  /** What is wrong, in words the person can act on. */
  reason: string
  /** What to do about it. Null when the rule simply cannot be saved. */
  fix: string | null
}

/**
 * Characters that would make a rule match nothing, invisibly.
 *
 * Control codes, the soft hyphen, the zero-width and bidirectional marks, and
 * the byte-order mark. All of them survive a copy and paste from a web page and
 * none of them can be seen in the field afterwards, so a rule carrying one
 * looks exactly right and matches exactly nothing.
 */
/*
 * The control characters are the point: this exists to find them. `no-control-regex`
 * is right almost everywhere and wrong in the one place whose job is detection.
 */
// eslint-disable-next-line no-control-regex
const UNTYPEABLE = /[\u0000-\u001f\u007f\u00ad\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/

/**
 * Is this rule well-formed enough to ever match?
 *
 * Returns null when the rule is fine. Deliberately strict about the things that
 * fail SILENTLY and permissive about everything else: a tool name that does not
 * exist yet is not an error, because a rule written before an update should
 * still be there after it.
 */
export function validateRule(rule: string): RuleProblem | null {
  const trimmed = rule.trim()
  if (!trimmed) {
    return { reason: 'A rule needs a tool name.', fix: null }
  }
  if (UNTYPEABLE.test(trimmed)) {
    return {
      reason: 'That rule contains characters that cannot be seen, so it would never match.',
      fix: 'Retype it rather than pasting it.',
    }
  }

  const opened = (trimmed.match(/\(/g) ?? []).length
  const closed = (trimmed.match(/\)/g) ?? []).length
  if (opened !== closed) {
    return {
      reason: 'The brackets do not balance, so OCADE cannot tell where the pattern ends.',
      fix: 'Write it as Tool(pattern) -- for example Bash(git status).',
    }
  }
  if (opened > 0 && !trimmed.endsWith(')')) {
    return {
      reason: 'Anything after the closing bracket is ignored, so this would match the tool alone.',
      fix: 'Put the pattern inside the brackets and end the rule there.',
    }
  }

  const value = permissionRuleValueFromString(trimmed)
  if (!value.toolName.trim()) {
    return { reason: 'A rule needs a tool name before the brackets.', fix: null }
  }

  /*
   * THE NEXT TWO ARE CHECKED ON THE RAW TEXT, NOT ON THE PARSED RULE.
   *
   * The imported parser already collapses `Bash()` and `Bash(*)` to the bare
   * tool name — they are, correctly, the same rule as `Bash`. So by the time
   * the parse is available the evidence is gone, and a validator asking the
   * parse would never fire. What the person typed is what needs the remark.
   */
  const emptyBrackets = /\(\s*\)$/.test(trimmed)
  if (emptyBrackets) {
    return {
      reason: 'The brackets are empty, so this matches the tool alone rather than a pattern.',
      fix: 'Either remove the brackets or put a pattern inside them.',
    }
  }
  const loneStar = /\(\s*\*\s*\)$/.test(trimmed)
  if (loneStar) {
    return {
      reason: 'A pattern of just * is the same as naming the tool with no brackets.',
      fix: `Write ${value.toolName} on its own if that is what you meant.`,
    }
  }
  return null
}

export type ShadowedRule = {
  rule: ReviewableRule
  /** The broader rule that is consulted first. */
  shadowedBy: ReviewableRule
  reason: string
  fix: string
}

/**
 * Rules that can never apply, because a broader one is consulted first.
 *
 * The order the permission layer uses is deny, then ask, then allow. So a
 * tool-wide deny makes every narrower rule for that tool unreachable, and a
 * tool-wide ask makes every narrower ALLOW unreachable -- the person is asked
 * before the allow is ever consulted.
 *
 * A tool-wide rule is not itself shadowed by another tool-wide rule: that is a
 * contradiction the precedence resolves, not a rule that never fires.
 */
export function findShadowedRules(rules: readonly ReviewableRule[]): ShadowedRule[] {
  const parsed = rules.map((rule) => ({
    rule,
    value: permissionRuleValueFromString(rule.rule.trim()),
  }))

  const toolWide = (behavior: PermissionBehavior) =>
    parsed.filter(
      (entry) => entry.rule.behavior === behavior && entry.value.ruleContent === undefined,
    )

  const denies = toolWide('deny')
  const asks = toolWide('ask')
  const shadowed: ShadowedRule[] = []

  for (const entry of parsed) {
    // Only a rule with a pattern can be shadowed; a tool-wide rule is decided
    // by precedence rather than made unreachable by it.
    if (entry.value.ruleContent === undefined) continue

    const deny = denies.find((d) => d.value.toolName === entry.value.toolName)
    if (deny) {
      shadowed.push({
        rule: entry.rule,
        shadowedBy: deny.rule,
        reason: `${entry.value.toolName} is blocked entirely, so this rule is never reached.`,
        fix: `Remove the rule blocking ${entry.value.toolName}, or delete this one.`,
      })
      continue
    }

    if (entry.rule.behavior !== 'allow') continue
    const ask = asks.find((a) => a.value.toolName === entry.value.toolName)
    if (ask) {
      shadowed.push({
        rule: entry.rule,
        shadowedBy: ask.rule,
        reason: `${entry.value.toolName} always asks, so this rule never allows anything.`,
        fix: `Remove the rule that always asks about ${entry.value.toolName}, or delete this one.`,
      })
    }
  }

  return shadowed
}

/** Rule text present more than once, whatever the behaviours attached to it. */
export function findDuplicateRules(rules: readonly ReviewableRule[]): string[] {
  const seen = new Map<string, number>()
  for (const { rule } of rules) {
    const key = rule.trim().toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key)
}
