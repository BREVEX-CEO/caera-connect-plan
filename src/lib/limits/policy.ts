/**
 * The one place OCADE decides whether something may run again yet.
 *
 * WHY ONE PLACE
 * -------------
 * Before this, "how often may this happen" was answered in three different
 * shapes: a cooldown constant in the OTP module, an attempt counter on the
 * verify screen, and nothing at all on the expensive paths — research
 * retrieval, model preparation, subscription reads. Three shapes means three
 * behaviours under pressure and three things to fix when one of them is wrong.
 *
 * WHAT THE DONOR CONTRIBUTED, AND WHAT IT DID NOT
 * -----------------------------------------------
 * The donor's limiter was built around a hosted plan: it read quota headers off
 * an API response and displayed a subscription's remaining allowance. OCADE has
 * no such API and no such plan, so the accounting is local.
 *
 * What survives is the part that is about people rather than about billing:
 *
 *   - Windows measured in hours with an explicit reset instant, so a person can
 *     be told *when*, not just *no*.
 *   - The early-warning rule, which is the genuinely clever piece. It warns on
 *     utilization AND time together — 90% used is unremarkable at the end of a
 *     window and alarming twenty minutes in — so the warning arrives while
 *     there is still something the person can do about it.
 *   - Three-state decisions (`allowed`, `allowed_warning`, `rejected`) rather
 *     than a boolean, so a surface can show a warning without blocking.
 *
 * WHY THE WINDOWS ARE 5h / 8h / 28h
 * ---------------------------------
 * They nest deliberately. Five hours is a working session — the burst limit,
 * which stops one runaway loop from consuming everything. Eight hours is a
 * working day. Twenty-eight hours is a day plus a margin, so somebody who works
 * late and starts early is not told they have already used tomorrow. A single
 * window cannot do all three: a burst limit generous enough for a day's work
 * does not stop a runaway, and a daily limit tight enough to matter blocks a
 * legitimate long session.
 *
 * ALL THREE ARE CHECKED, AND THE TIGHTEST ANSWER WINS.
 */

export type LimitWindowId = "burst" | "day" | "rolling";

export interface LimitWindow {
  id: LimitWindowId;
  /** Window length in milliseconds. */
  durationMs: number;
  /** How many actions the window allows. */
  quota: number;
  /** What a person is told this window is. Never "the 5h window". */
  label: string;
}

export const HOUR = 60 * 60 * 1000;

/**
 * A warning threshold: fire when this much is used AND this little time has
 * passed.
 *
 * The pairing is the point. Ninety per cent used with the window nearly over is
 * a person who paced themselves; ninety per cent used in the first fifth of it
 * is a person who is about to be stopped and does not know it.
 */
export interface WarningThreshold {
  utilization: number;
  timePct: number;
}

export interface LimitPolicy {
  windows: LimitWindow[];
  warnings: Partial<Record<LimitWindowId, WarningThreshold[]>>;
}

/**
 * The default policy. Quotas are deliberately generous: OCADE runs on the
 * person's own device and costs nobody anything per call, so these exist to
 * catch runaway loops and abuse, not to ration a product that is free.
 */
export const DEFAULT_POLICY: LimitPolicy = {
  windows: [
    { id: "burst", durationMs: 5 * HOUR, quota: 600, label: "this session" },
    { id: "day", durationMs: 8 * HOUR, quota: 900, label: "today" },
    { id: "rolling", durationMs: 28 * HOUR, quota: 2_000, label: "the last day" },
  ],
  warnings: {
    burst: [{ utilization: 0.9, timePct: 0.72 }],
    day: [
      { utilization: 0.75, timePct: 0.6 },
      { utilization: 0.5, timePct: 0.35 },
    ],
    rolling: [{ utilization: 0.8, timePct: 0.5 }],
  },
};

/** One recorded action: when it happened, and how much it counted for. */
export interface LimitEvent {
  at: number;
  cost: number;
}

export interface LimitState {
  events: LimitEvent[];
}

export function emptyLimitState(): LimitState {
  return { events: [] };
}

export interface WindowStatus {
  id: LimitWindowId;
  label: string;
  used: number;
  quota: number;
  /** 0–1. Clamped, so a state carried across a quota change cannot exceed 1. */
  utilization: number;
  /** When this window's oldest counted action falls out of it. */
  resetsAt: number;
  /** Seconds until this window can accept another action. 0 when it can now. */
  retryAfterSeconds: number;
}

export type LimitOutcome = "allowed" | "allowed_warning" | "rejected";

export interface LimitDecision {
  outcome: LimitOutcome;
  /** The window that produced the outcome. Null when everything is quiet. */
  window: WindowStatus | null;
  /** Every window, for a usage surface. */
  windows: WindowStatus[];
  /** Seconds to wait. 0 unless rejected. */
  retryAfterSeconds: number;
  /**
   * What to tell the person, or null when there is nothing to say.
   *
   * Never names a window by its duration: "you have used most of this session's
   * allowance" is actionable, "5h window at 91%" is a dashboard reading.
   */
  message: string | null;
}

/**
 * A rolling window, not a fixed bucket.
 *
 * A fixed bucket resetting on the hour lets somebody spend a whole quota at
 * 10:59 and another at 11:00, which is exactly the burst the limit exists to
 * prevent. A rolling window costs an array scan and does not have that hole.
 */
function statusFor(
  window: LimitWindow,
  state: LimitState,
  now: number,
  pendingCost: number,
): WindowStatus {
  const cutoff = now - window.durationMs;
  const inWindow = state.events.filter((event) => event.at > cutoff);
  const used = inWindow.reduce((total, event) => total + event.cost, 0);
  const oldest = inWindow.length > 0 ? Math.min(...inWindow.map((event) => event.at)) : now;
  const resetsAt = oldest + window.durationMs;

  /*
   * Retry-After is the moment enough of the oldest events have aged out to make
   * room, not the moment the whole window resets. Telling somebody to wait five
   * hours when they could go again in ninety seconds is a limit that reads as a
   * ban.
   */
  let retryAfterSeconds = 0;
  if (used + pendingCost > window.quota) {
    const needed = used + pendingCost - window.quota;
    let freed = 0;
    const ordered = [...inWindow].sort((a, b) => a.at - b.at);
    for (const event of ordered) {
      freed += event.cost;
      if (freed >= needed) {
        retryAfterSeconds = Math.max(1, Math.ceil((event.at + window.durationMs - now) / 1000));
        break;
      }
    }
    if (retryAfterSeconds === 0) {
      retryAfterSeconds = Math.max(1, Math.ceil((resetsAt - now) / 1000));
    }
  }

  return {
    id: window.id,
    label: window.label,
    used,
    quota: window.quota,
    utilization: Math.min(1, window.quota === 0 ? 1 : used / window.quota),
    resetsAt,
    retryAfterSeconds,
  };
}

/** How much of a window has elapsed, for the early-warning rule. */
function timeProgress(status: WindowStatus, window: LimitWindow, now: number): number {
  const windowStart = status.resetsAt - window.durationMs;
  return Math.max(0, Math.min(1, (now - windowStart) / window.durationMs));
}

export function checkLimit(
  state: LimitState,
  options: { now?: number; cost?: number; policy?: LimitPolicy } = {},
): LimitDecision {
  const policy = options.policy ?? DEFAULT_POLICY;
  const now = options.now ?? Date.now();
  const cost = options.cost ?? 1;

  const windows = policy.windows.map((window) => statusFor(window, state, now, cost));

  const rejected = windows.filter((status) => status.retryAfterSeconds > 0);
  if (rejected.length > 0) {
    /*
     * The tightest window wins, which is the one that will let the person back
     * in soonest — not the one with the longest wait. Reporting the longest
     * would be telling somebody to wait a day when a session limit clears in an
     * hour.
     */
    const soonest = rejected.reduce((a, b) => (a.retryAfterSeconds <= b.retryAfterSeconds ? a : b));
    return {
      outcome: "rejected",
      window: soonest,
      windows,
      retryAfterSeconds: soonest.retryAfterSeconds,
      message: `OCADE has done a lot for you ${soonest.label}. ${describeWait(soonest.retryAfterSeconds)}`,
    };
  }

  for (const window of policy.windows) {
    const status = windows.find((candidate) => candidate.id === window.id);
    if (!status) continue;
    const thresholds = policy.warnings[window.id] ?? [];
    const elapsed = timeProgress(status, window, now);
    const tripped = thresholds.find(
      (threshold) => status.utilization >= threshold.utilization && elapsed <= threshold.timePct,
    );
    if (tripped) {
      return {
        outcome: "allowed_warning",
        window: status,
        windows,
        retryAfterSeconds: 0,
        message: `You have used most of what OCADE allows ${status.label}, and there is a while to go. It will keep working; heavy jobs may pause later.`,
      };
    }
  }

  return { outcome: "allowed", window: null, windows, retryAfterSeconds: 0, message: null };
}

/** Record an action against the limit state. Returns the new state. */
export function recordUse(
  state: LimitState,
  options: { now?: number; cost?: number; policy?: LimitPolicy } = {},
): LimitState {
  const policy = options.policy ?? DEFAULT_POLICY;
  const now = options.now ?? Date.now();
  const longest = Math.max(...policy.windows.map((window) => window.durationMs));
  /*
   * Events older than the longest window can never affect a decision again, so
   * they are dropped on write. Without this the array grows for the life of the
   * install and every check scans all of it.
   */
  const cutoff = now - longest;
  return {
    events: [...state.events.filter((event) => event.at > cutoff), { at: now, cost: options.cost ?? 1 }],
  };
}

function describeWait(seconds: number): string {
  if (seconds <= 60) return "Try again in a moment.";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `Try again in about ${minutes} minutes.`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "Try again in about an hour." : `Try again in about ${hours} hours.`;
}

/**
 * The `Retry-After` value for an HTTP response.
 *
 * Seconds rather than a date, because a date requires the client's clock to
 * agree with the server's and a wrong clock turns a one-minute wait into an
 * hour or into no wait at all.
 */
export function retryAfterHeader(decision: LimitDecision): Record<string, string> {
  return decision.retryAfterSeconds > 0
    ? { "retry-after": String(decision.retryAfterSeconds) }
    : {};
}
