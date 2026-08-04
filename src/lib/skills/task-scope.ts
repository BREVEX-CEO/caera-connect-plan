/**
 * Scoped task approval.
 *
 * The user approves a TASK once — "tidy up my invoices folder" — and OCADE runs
 * it without prompting at every step. Repeated prompts are not extra safety:
 * they train people to click Approve without reading, which is strictly worse
 * than one clear decision up front.
 *
 * What keeps that safe is that a scope is genuinely bounded:
 *  - only the capabilities named at approval time;
 *  - only the apps and paths named at approval time;
 *  - only until it expires, is completed, or is cancelled;
 *  - and anything outside it ESCALATES rather than being silently allowed.
 *
 * Protected actions can never be inside a scope, no matter what was approved.
 */
import { riskOf, type CompanionAction } from "@/lib/native/companion-bridge";

/** Scopes are short-lived by default: an approval should not outlive its task. */
export const SCOPE_TTL_MS = 30 * 60 * 1000;
const SAFE_SCOPE_ID = /^[a-z0-9][a-z0-9._-]*$/i;
const SCOPE_STATUSES = new Set<ScopeStatus>(["active", "completed", "cancelled", "expired"]);

export type ScopeStatus = "active" | "completed" | "cancelled" | "expired";

export interface TaskScope {
  id: string;
  /** What the user agreed to, in their words. */
  summary: string;
  /** Capability ids this scope permits, e.g. "file.open". */
  capabilities: string[];
  /** Apps this scope may touch. Empty means none. */
  apps: string[];
  /** Path prefixes this scope may touch. Empty means none. */
  paths: string[];
  grantedAt: Date;
  expiresAt: Date;
  status: ScopeStatus;
  /** Steps performed under this scope, for the receipt. */
  steps: number;
}

export function createTaskScope(input: {
  id: string;
  summary: string;
  capabilities: string[];
  apps?: string[];
  paths?: string[];
  now?: Date;
  ttlMs?: number;
}): TaskScope {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? SCOPE_TTL_MS;
  if (!Number.isFinite(now.getTime())) {
    throw new Error("A task approval requires a valid grant time.");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > SCOPE_TTL_MS) {
    throw new Error("A task approval duration must be positive and no longer than 30 minutes.");
  }
  if (!SAFE_SCOPE_ID.test(input.id) || input.id.length > 200) {
    throw new Error("A task approval requires a safe bounded id.");
  }
  if (!input.summary.trim() || input.summary.length > 1_000) {
    throw new Error("A task approval requires a bounded summary.");
  }
  if (
    !Array.isArray(input.capabilities) ||
    input.capabilities.length === 0 ||
    input.capabilities.some((value) => !SAFE_SCOPE_ID.test(value))
  ) {
    throw new Error("A task approval requires at least one valid capability.");
  }
  return {
    id: input.id,
    summary: input.summary,
    capabilities: [...new Set(input.capabilities)],
    apps: [...new Set(input.apps ?? [])],
    paths: [...new Set(input.paths ?? [])],
    grantedAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
    status: "active",
    steps: 0,
  };
}

function validScope(scope: TaskScope, now: Date): boolean {
  const grantedAt = scope.grantedAt instanceof Date ? scope.grantedAt.getTime() : Number.NaN;
  const expiresAt = scope.expiresAt instanceof Date ? scope.expiresAt.getTime() : Number.NaN;
  return (
    Number.isFinite(now.getTime()) &&
    SAFE_SCOPE_ID.test(scope.id) &&
    scope.id.length <= 200 &&
    typeof scope.summary === "string" &&
    scope.summary.trim().length > 0 &&
    scope.summary.length <= 1_000 &&
    Array.isArray(scope.capabilities) &&
    scope.capabilities.length > 0 &&
    scope.capabilities.every((value) => typeof value === "string" && SAFE_SCOPE_ID.test(value)) &&
    Array.isArray(scope.apps) &&
    scope.apps.every((value) => typeof value === "string" && value.trim().length > 0) &&
    Array.isArray(scope.paths) &&
    scope.paths.every((value) => typeof value === "string" && normalisePath(value) !== null) &&
    Number.isFinite(grantedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt > grantedAt &&
    expiresAt - grantedAt <= SCOPE_TTL_MS &&
    SCOPE_STATUSES.has(scope.status) &&
    Number.isSafeInteger(scope.steps) &&
    scope.steps >= 0
  );
}

/** Expire a scope that has run out of time. Pure. */
export function expireScopeIfDue(scope: TaskScope, now: Date = new Date()): TaskScope {
  if (scope.status !== "active") return scope;
  return now.getTime() >= scope.expiresAt.getTime() ? { ...scope, status: "expired" } : scope;
}

export type ScopeDecision =
  { allow: true; scope: TaskScope } | { allow: false; escalate: boolean; reason: string };

/**
 * Normalise a path for prefix comparison.
 *
 * Backslashes become forward slashes and the result is lower-cased, so a
 * Windows path granted as `C:/Work` still matches `c:\work\invoices\a.pdf`.
 * `..` segments are rejected outright rather than resolved: a scope check that
 * tries to be clever about traversal is a scope check waiting to be bypassed.
 */
function normalisePath(p: string): string | null {
  const s = p.replace(/\\/g, "/").trim();
  if (!s) return null;
  if (s.split("/").includes("..")) return null;
  return s.toLowerCase();
}

function withinPaths(target: string, allowed: string[]): boolean {
  const t = normalisePath(target);
  if (t === null) return false;
  return allowed.some((a) => {
    const base = normalisePath(a);
    if (base === null) return false;
    // Require a segment boundary so "/workshop" is not matched by "/work".
    return t === base || t.startsWith(base.endsWith("/") ? base : `${base}/`);
  });
}

/**
 * Decide whether an action is covered by an approved scope.
 *
 * `escalate: true` means "ask the user about this specific step" — the task is
 * legitimate but has reached beyond what was agreed. `escalate: false` means
 * refuse outright: no additional approval can make it acceptable.
 */
export function checkScope(
  action: CompanionAction,
  scope: TaskScope | null,
  now: Date = new Date(),
): ScopeDecision {
  // Protected input is refused regardless of any approval that exists.
  if (riskOf(action) === "prohibited") {
    return {
      allow: false,
      escalate: false,
      reason:
        "This step involves protected information. No approval can cover it — please enter it yourself.",
    };
  }

  if (!scope) {
    return { allow: false, escalate: true, reason: "This task hasn't been approved yet." };
  }

  if (!validScope(scope, now)) {
    return {
      allow: false,
      escalate: false,
      reason: "This task approval is malformed or invalid, so it was refused.",
    };
  }

  const current = expireScopeIfDue(scope, now);
  if (current.status !== "active") {
    return {
      allow: false,
      escalate: true,
      reason:
        current.status === "expired"
          ? "The approval for this task has expired. Approve it again to continue."
          : `This task was ${current.status}.`,
    };
  }

  if (!current.capabilities.includes(action.kind)) {
    return {
      allow: false,
      escalate: true,
      reason: `“${current.summary}” didn't include permission to ${action.kind.replace(".", " ")}.`,
    };
  }

  if (action.kind === "app.open" && !current.apps.includes(action.appId)) {
    return {
      allow: false,
      escalate: true,
      reason: `Opening ${action.appId} wasn't part of what you approved.`,
    };
  }

  if (action.kind === "file.open" && !withinPaths(action.path, current.paths)) {
    return {
      allow: false,
      escalate: true,
      reason: "That file is outside the folders you approved for this task.",
    };
  }

  return { allow: true, scope: current };
}

/** Count a completed step, for the receipt at the end. */
export function recordStep(scope: TaskScope): TaskScope {
  return { ...scope, steps: scope.steps + 1 };
}

export function completeScope(scope: TaskScope): TaskScope {
  return { ...scope, status: "completed" };
}

export function cancelScope(scope: TaskScope): TaskScope {
  return { ...scope, status: "cancelled" };
}

/** Plain summary of what the user is being asked to approve. */
export function describeScope(scope: TaskScope): string {
  const parts = [`${scope.capabilities.length} kinds of action`];
  if (scope.apps.length > 0)
    parts.push(`${scope.apps.length} app${scope.apps.length === 1 ? "" : "s"}`);
  if (scope.paths.length > 0)
    parts.push(`${scope.paths.length} folder${scope.paths.length === 1 ? "" : "s"}`);
  const minutes = Math.round((scope.expiresAt.getTime() - scope.grantedAt.getTime()) / 60000);
  return `${parts.join(", ")}, for ${minutes} minutes. OCADE will ask again for anything else.`;
}
