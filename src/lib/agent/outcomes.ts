/**
 * The eight ways a tool call can end, and nothing else.
 *
 * WHY A CLOSED SET
 * ----------------
 * An agent loop decides what to do next from what just happened. When "it
 * failed" is a free-text string, that decision becomes a guess: retrying a
 * permission refusal is pointless, retrying a transient timeout is correct, and
 * a loop that cannot tell them apart does the wrong one half the time — usually
 * forever, because nothing about repeating a blocked call changes the block.
 *
 * So every adapter returns exactly one of these, and the loop's retry policy is
 * written against the enum rather than against prose.
 *
 * `state_changed` is the one people leave out, and it is the one that matters
 * most on a real computer: the call did not fail, the world moved underneath
 * it. The right response is not to retry and not to give up — it is to observe
 * again and re-plan against what is there now.
 */

export type OutcomeKind =
  | "success"
  | "retryable_failure"
  | "blocked"
  | "permission_required"
  | "cancelled"
  | "unsupported"
  | "state_changed"
  | "offline";

export interface ToolOutcome<T = unknown> {
  kind: OutcomeKind;
  /** Present only on success. */
  data?: T;
  /** A sentence a person could act on. Never an error code alone. */
  detail: string;
  /**
   * Independent confirmation that the world actually changed as intended.
   *
   * `undefined` means the action had nothing to verify (a read). `false` means
   * the adapter looked and the expected change was NOT observed — which is the
   * case the product rule cares about, because it is the one where reporting
   * "Done" would be a lie.
   */
  verified?: boolean;
  /** What the adapter observed after acting, for the model's next turn. */
  observation?: unknown;
  elapsedMs?: number;
}

export function ok<T>(data: T, detail: string, extra?: Partial<ToolOutcome<T>>): ToolOutcome<T> {
  return { kind: "success", data, detail, ...extra };
}

export function fail(kind: Exclude<OutcomeKind, "success">, detail: string): ToolOutcome<never> {
  return { kind, detail };
}

/**
 * Whether trying the SAME call again could plausibly succeed.
 *
 * `state_changed` is deliberately false: the call may well succeed after a
 * fresh observation, but repeating it against a stale plan is exactly the
 * mistake this taxonomy exists to prevent. The loop re-observes first.
 */
export function isRetryable(kind: OutcomeKind): boolean {
  return kind === "retryable_failure" || kind === "offline";
}

/** Whether the loop should stop and hand back to the user. */
export function isTerminal(kind: OutcomeKind): boolean {
  return (
    kind === "blocked" ||
    kind === "permission_required" ||
    kind === "cancelled" ||
    kind === "unsupported"
  );
}

/** How many times one identical call may be attempted before the loop stops. */
export const MAX_ATTEMPTS_PER_CALL = 2;
/** How many tool calls one user request may make before checking back in. */
export const MAX_STEPS_PER_TASK = 12;

/**
 * Detect a loop repeating itself.
 *
 * Not a counter but a signature: the same tool with the same arguments failing
 * the same way twice is a loop that has stopped learning, and the honest move
 * is to tell the user what is in the way rather than to keep pulling the
 * handle.
 */
export function signatureOf(tool: string, args: unknown, kind: OutcomeKind): string {
  return `${tool}::${stableStringify(args)}::${kind}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}
