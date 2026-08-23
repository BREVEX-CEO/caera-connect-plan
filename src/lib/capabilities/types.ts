/**
 * One vocabulary for "can OCADE actually do this right now?".
 *
 * Every surface used to answer that question its own way: chat asked the local
 * engine hook, Work asked the companion bridge, Studio hard-coded optimism,
 * and billing pages implied a paid tier existed. The result was a product that
 * could look connected in one room and unavailable in the next, for the same
 * underlying fact.
 *
 * This module holds the vocabulary and the shape. Deciding a status from real
 * signals happens in `registry.ts`; gathering those signals happens in
 * `use-capabilities.ts`. Nothing here invents a status — a capability with no
 * evidence resolves to UNAVAILABLE, never READY.
 */

export type CapabilityStatus =
  /** Verified usable now. */
  | "READY"
  /** Doing something on the user's behalf at this moment. */
  | "WORKING"
  /** Queued or blocked on something that is expected to arrive. */
  | "WAITING"
  /** Held pending an explicit human decision. */
  | "NEEDS_APPROVAL"
  /** Would work, but the network or the host it needs is unreachable. */
  | "OFFLINE"
  /** Working with reduced capability, and the reduction is known. */
  | "DEGRADED"
  /** Tried and failed. Carries a reason. */
  | "FAILED"
  /** Cannot exist in this environment at all (e.g. a PTY in a browser tab). */
  | "UNAVAILABLE"
  /** Could exist here, but nothing has been configured or connected. */
  | "NOT_CONFIGURED"
  /** Deliberately not built yet. Never a failure. */
  | "COMING_SOON";

export const CAPABILITY_STATUSES: readonly CapabilityStatus[] = [
  "READY",
  "WORKING",
  "WAITING",
  "NEEDS_APPROVAL",
  "OFFLINE",
  "DEGRADED",
  "FAILED",
  "UNAVAILABLE",
  "NOT_CONFIGURED",
  "COMING_SOON",
] as const;

/** Statuses a user may reasonably read as "I can use this now". */
export function isUsable(status: CapabilityStatus): boolean {
  return status === "READY" || status === "WORKING" || status === "DEGRADED";
}

/** Statuses the user can act on themselves. */
export function isActionable(status: CapabilityStatus): boolean {
  return (
    status === "NOT_CONFIGURED" ||
    status === "NEEDS_APPROVAL" ||
    status === "FAILED" ||
    status === "OFFLINE"
  );
}

export type CapabilityId =
  | "localAI"
  | "browser"
  | "computerControl"
  | "voice"
  | "vision"
  | "privateSync"
  | "monitors"
  | "automationRunner"
  | "codeTerminal"
  | "payments"
  | "desktopInstaller";

export interface CapabilityReport {
  id: CapabilityId;
  /** User-facing name. Never a provider or model name. */
  label: string;
  status: CapabilityStatus;
  /** One sentence, plainly true. Shown next to the badge. */
  detail: string;
  /** What the user can do about it, when there is something. */
  action?: { label: string; to?: string; href?: string };
  /** Where the status came from, for the health page and bug reports. */
  evidence?: string;
}

export const CAPABILITY_ORDER: readonly CapabilityId[] = [
  "localAI",
  "privateSync",
  "browser",
  "computerControl",
  "codeTerminal",
  "voice",
  "vision",
  "automationRunner",
  "monitors",
  "payments",
  "desktopInstaller",
] as const;
