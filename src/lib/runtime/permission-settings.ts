/**
 * Where the permission layer gets its mode and its rules.
 *
 * This deliberately reads the Computer Use policy the user already set rather
 * than introducing a second permission control. Two settings that both mean
 * "how much may OCADE do without asking" is a bug even when both are correct,
 * because the user changes one and the other silently disagrees.
 *
 * Rules are separate and additive: the mode says how permissive OCADE is in
 * general, a rule says something specific about one action, and a specific
 * statement always beats a general one.
 */

import {
  loadComputerUseSettings,
  type ComputerUsePermission,
  type StorageReader,
  type StorageWriter,
} from "@/lib/computer-use-settings";
import {
  createPermissionContext,
  type PermissionContext,
  type PermissionMode,
  type StoredRule,
} from "./permissions";
import type { PermissionBehavior } from "@/primary-logic/permissions/types";

export const PERMISSION_RULES_KEY = "ocade:permission-rules:v1";

/**
 * The Computer Use policy, expressed as a runtime permission mode.
 *
 * `blocked` and `read_only` both become `plan`, which is the mode in which
 * nothing that changes the machine runs. That is what both settings mean; they
 * differ only in how the UI explains them.
 */
const MODE_FOR: Record<ComputerUsePermission, PermissionMode> = {
  blocked: "plan",
  read_only: "plan",
  ask_every_mutation: "guarded",
  bounded_workflow: "guarded",
  ask_risky: "acceptEdits",
  session_allowance: "trusted",
  time_limited: "trusted",
  always_selected_low_risk: "trusted",
};

export function modeFor(permission: ComputerUsePermission): PermissionMode {
  return MODE_FOR[permission] ?? "guarded";
}

const BEHAVIORS: readonly PermissionBehavior[] = ["allow", "deny", "ask"];

export function normalizeRules(value: unknown): StoredRule[] {
  if (!Array.isArray(value)) return [];
  const out: StoredRule[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const rule = typeof record.rule === "string" ? record.rule.trim() : "";
    const behavior = record.behavior;
    if (!rule) continue;
    if (typeof behavior !== "string" || !BEHAVIORS.includes(behavior as PermissionBehavior))
      continue;
    const key = `${behavior}:${rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ rule, behavior: behavior as PermissionBehavior });
  }
  return out;
}

export function loadRules(
  storage: StorageReader | null = typeof window === "undefined" ? null : window.localStorage,
): StoredRule[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PERMISSION_RULES_KEY);
    return raw ? normalizeRules(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/**
 * Whether the rules reached the device.
 *
 * It used to return nothing and swallow the failure, which was right for a
 * background write and wrong the moment a person could see the result: a full
 * or blocked store would discard a safety rule and show them a saved one.
 * It still never throws — a settings write must not break the turn somebody is
 * in — but now it says what happened.
 */
export type SaveRulesResult = { ok: true } | { ok: false; error: string };

export function saveRules(
  rules: readonly StoredRule[],
  storage: StorageWriter | null = typeof window === "undefined" ? null : window.localStorage,
): SaveRulesResult {
  if (!storage) {
    return { ok: false, error: "This browser will not let OCADE store settings on this device." };
  }
  try {
    storage.setItem(PERMISSION_RULES_KEY, JSON.stringify(normalizeRules(rules)));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && /quota/i.test(error.message)
          ? "There is no room left on this device to store the rule."
          : "The rule could not be stored on this device.",
    };
  }
}

/** Add a rule, replacing any existing rule with the same text. */
export function withRule(
  rules: readonly StoredRule[],
  rule: string,
  behavior: PermissionBehavior,
): StoredRule[] {
  return [...rules.filter((entry) => entry.rule !== rule), { rule, behavior }];
}

/** The live permission context, read from the user's own settings. */
export function currentPermissionContext(
  storage: (StorageReader & StorageWriter) | null = typeof window === "undefined"
    ? null
    : window.localStorage,
): PermissionContext {
  const settings = loadComputerUseSettings(storage);
  /*
   * Computer Use switched off is not the same as a permissive mode with no
   * tools: it means the user said no to machine control, so the mode that
   * refuses every mutation is the correct reading of that switch.
   */
  const mode = settings.enabled ? modeFor(settings.defaultPermission) : "plan";
  return createPermissionContext(mode, loadRules(storage));
}
