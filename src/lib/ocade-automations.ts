/**
 * OCADE automations and scheduling (Plan §33, decision #16-automations).
 *
 * V1 scope: manual runs, time-scheduled/recurring runs, and simple conditional
 * triggers. Every automation is dry-runnable, gated by the same risk tiers as
 * direct actions, cancellable, and produces an auditable run record.
 *
 * Safety: an automation can NEVER perform a prohibited (protected-credential)
 * action, and destructive/irreversible steps always require explicit approval —
 * an automation cannot silently self-authorise.
 *
 * Pure and deterministic; scheduling takes an explicit `now` so it is testable.
 */
import { riskOf, type ActionRisk, type CompanionAction } from "./native/companion-bridge";

export type TriggerKind = "manual" | "interval" | "daily" | "condition";

export type AutomationTrigger =
  | { kind: "manual" }
  | { kind: "interval"; everyMinutes: number }
  | { kind: "daily"; atHourUtc: number; atMinuteUtc?: number }
  | { kind: "condition"; expression: string };

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: CompanionAction[];
  /** Require a human decision before the run executes. */
  requiresApproval: boolean;
  /** Preview only — compute the plan, change nothing. */
  dryRun: boolean;
  maxAttempts: number;
}

export type RunStatus =
  | "pending"
  | "awaiting_approval"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "blocked";

/**
 * Statuses that mean a run still occupies the automation.
 *
 * A run in any of these is "in flight": it has not reached a terminal state, so
 * starting another run of the same automation would double-execute the work.
 */
export const IN_FLIGHT_STATUSES: RunStatus[] = [
  "pending",
  "awaiting_approval",
  "running",
  "paused",
];

/** True while a run still occupies its automation. */
export function isInFlight(status: RunStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

/** True once a run has finished for good, whatever the outcome. */
export function isTerminal(status: RunStatus): boolean {
  return !isInFlight(status);
}

export interface RunStep {
  action: CompanionAction;
  risk: ActionRisk;
  /** Redacted, human-readable description for preview + audit. */
  summary: string;
  requiresConfirmation: boolean;
  /** Optional conservative estimate used to refuse work that cannot fit. */
  estimatedDurationMs?: number;
  /** Prepared inverse action. Omitted when automatic rollback is unavailable. */
  rollbackAction?: CompanionAction;
  rollbackSummary?: string;
}

export interface RunPlan {
  automationId: string;
  steps: RunStep[];
  /** Highest risk across all steps. */
  highestRisk: ActionRisk;
  /** True when any step can never be executed. */
  blocked: boolean;
  blockedReason?: string;
  requiresApproval: boolean;
}

function summarise(action: CompanionAction): string {
  switch (action.kind) {
    case "screen.read":
      return "Read the visible screen";
    case "window.list":
      return "List open windows";
    case "window.focus":
      return `Focus window "${action.target}"`;
    case "window.arrange":
      return `Arrange window (${action.layout})`;
    case "app.open":
      return `Open application "${action.appId}"`;
    case "file.open":
      return `Open "${action.path}"`;
    case "text.type":
      return "Type approved text";
    case "clipboard.read":
      return "Read the clipboard";
    case "clipboard.write":
      return "Write to the clipboard";
    default:
      return "Unknown action";
  }
}

const RISK_ORDER: ActionRisk[] = ["read_only", "low", "confirm", "high", "prohibited"];

function maxRisk(a: ActionRisk, b: ActionRisk): ActionRisk {
  return RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b;
}

/**
 * Build the execution plan. Always safe to call — it changes nothing and is the
 * basis for both dry-run preview and the approval prompt.
 */
export function planRun(automation: Automation): RunPlan {
  const steps: RunStep[] = automation.actions.map((action) => {
    const risk = riskOf(action);
    return {
      action,
      risk,
      summary: summarise(action),
      requiresConfirmation: risk === "confirm" || risk === "high",
    };
  });

  const highestRisk = steps.reduce<ActionRisk>((acc, s) => maxRisk(acc, s.risk), "read_only");
  const blocked = steps.length === 0 || highestRisk === "prohibited";

  return {
    automationId: automation.id,
    steps,
    highestRisk,
    blocked,
    blockedReason:
      steps.length === 0
        ? "This automation has no steps, so there is nothing to execute."
        : highestRisk === "prohibited"
          ? "This automation includes a step involving protected information, which OCADE can never perform automatically."
          : undefined,
    // An automation can't self-authorise: anything above low risk needs approval.
    requiresApproval:
      automation.requiresApproval || highestRisk === "confirm" || highestRisk === "high",
  };
}

/** Initial status for a run, derived from its plan. */
export function initialStatus(plan: RunPlan, dryRun: boolean): RunStatus {
  if (plan.blocked) return "blocked";
  if (dryRun) return "succeeded";
  return plan.requiresApproval ? "awaiting_approval" : "pending";
}

/* ------------------------------------------------------------ scheduling -- */

const MIN_MS = 60 * 1000;

/**
 * Next due time for a trigger. Manual and condition triggers are not
 * time-scheduled and return null.
 */
export function nextRunAt(
  trigger: AutomationTrigger,
  from: Date,
  lastRunAt?: Date | null,
): Date | null {
  switch (trigger.kind) {
    case "manual":
    case "condition":
      return null;
    case "interval": {
      const every = Math.max(1, Math.floor(trigger.everyMinutes)) * MIN_MS;
      const base = lastRunAt ? lastRunAt.getTime() : from.getTime();
      let next = base + every;
      // Never return a time in the past — catch up to the next future slot.
      if (next <= from.getTime()) {
        const missed = Math.ceil((from.getTime() - next) / every);
        next += missed * every;
        if (next <= from.getTime()) next += every;
      }
      return new Date(next);
    }
    case "daily": {
      const h = Math.min(23, Math.max(0, Math.floor(trigger.atHourUtc)));
      const m = Math.min(59, Math.max(0, Math.floor(trigger.atMinuteUtc ?? 0)));
      const candidate = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, m, 0, 0),
      );
      if (candidate.getTime() <= from.getTime()) {
        candidate.setUTCDate(candidate.getUTCDate() + 1);
      }
      return candidate;
    }
  }
}

export function isDue(automation: Automation, now: Date, lastRunAt?: Date | null): boolean {
  if (!automation.enabled) return false;
  const next = nextRunAt(automation.trigger, lastRunAt ?? now, lastRunAt);
  if (!next) return false;
  return next.getTime() <= now.getTime();
}

/* ---------------------------------------------------------------- retries -- */

export interface AttemptDecision {
  retry: boolean;
  /** Delay before the next attempt, exponential with a ceiling. */
  delayMs: number;
  reason: string;
}

export const MAX_BACKOFF_MS = 15 * MIN_MS;

/**
 * Retry policy. Cancellations and blocked runs are never retried; genuine
 * failures back off exponentially up to the automation's attempt limit.
 */
export function decideRetry(input: {
  status: RunStatus;
  attempt: number;
  maxAttempts: number;
}): AttemptDecision {
  if (input.status === "cancelled") {
    return { retry: false, delayMs: 0, reason: "Cancelled by the user." };
  }
  if (input.status === "blocked") {
    return { retry: false, delayMs: 0, reason: "Blocked by a safety rule." };
  }
  if (input.status !== "failed") {
    return { retry: false, delayMs: 0, reason: "Nothing to retry." };
  }
  if (input.attempt >= input.maxAttempts) {
    return { retry: false, delayMs: 0, reason: `Gave up after ${input.attempt} attempts.` };
  }
  const delayMs = Math.min(MAX_BACKOFF_MS, 2 ** (input.attempt - 1) * MIN_MS);
  return { retry: true, delayMs, reason: `Retrying (attempt ${input.attempt + 1}).` };
}

/* ------------------------------------------------------------- approvals -- */

export type ApprovalDecision = "approved" | "denied";
export const AUTOMATION_APPROVAL_TTL_MS = 30 * 60 * 1000;

export function applyApproval(
  status: RunStatus,
  decision: ApprovalDecision,
): { status: RunStatus; reason: string } {
  if (status !== "awaiting_approval") {
    return { status, reason: "This run was not awaiting approval." };
  }
  return decision === "approved"
    ? { status: "pending", reason: "Approved — queued to run." }
    : { status: "cancelled", reason: "Denied — nothing was run." };
}

/** A run can be cancelled while it is queued, awaiting approval, or running. */
export function canCancel(status: RunStatus): boolean {
  return (
    status === "pending" ||
    status === "awaiting_approval" ||
    status === "running" ||
    status === "paused"
  );
}

export function canPause(status: RunStatus): boolean {
  return status === "pending" || status === "awaiting_approval" || status === "running";
}

export function canResume(status: RunStatus): boolean {
  return status === "paused";
}

/**
 * The result of recording a run request. `executed` is deliberately literal:
 * this layer persists/queues work but does not perform an automation action.
 */
export interface RunEnqueueResult {
  status: RunStatus;
  dryRun: boolean;
  reused: boolean;
  executed: false;
}

export interface RunEnqueueNotice {
  tone: "success" | "info" | "warning" | "error";
  message: string;
}

/** User-facing copy that never mistakes persistence for execution. */
export function describeRunEnqueue(result: RunEnqueueResult): RunEnqueueNotice {
  if (result.status === "blocked") {
    return { tone: "error", message: "Run blocked — no action was executed." };
  }
  if (result.dryRun) {
    return {
      tone: "success",
      message: "Dry-run preview recorded — nothing was executed or changed.",
    };
  }
  if (result.status === "awaiting_approval") {
    return {
      tone: "warning",
      message: result.reused
        ? "This run is already waiting for approval — no duplicate was created and nothing was executed."
        : "Run created — it needs your approval before anything can be queued for execution.",
    };
  }
  if (result.status === "pending") {
    return {
      tone: "info",
      message: result.reused
        ? "This run is already queued — no duplicate was created and no action has executed."
        : "Run queued — no action has executed yet.",
    };
  }
  if (result.status === "running") {
    return {
      tone: "info",
      message: "An existing run is marked running; no duplicate was created.",
    };
  }
  if (result.status === "paused") {
    return {
      tone: "info",
      message: "An existing run is paused; no duplicate was created and no action is executing.",
    };
  }
  return {
    tone: "info",
    message: `Existing run status: ${result.status}. No new run was created.`,
  };
}
