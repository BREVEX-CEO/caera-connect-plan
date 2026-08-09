/**
 * OCADE entitlements, cloud allowance and device limits (Plan §33/§38,
 * decisions #11, #12, #35–#37).
 *
 * Rules encoded here:
 *  - LOCAL processing is UNLIMITED and never consumes allowance.
 *  - OCADE CLOUD consumes 28 uses per rolling-aligned 8-hour window.
 *  - Failed, cancelled and system-retried requests do NOT consume allowance.
 *  - Every plan (2-day / 8-day / 1-month / 1-year) grants the same core
 *    entitlements and differs by DURATION (and price); 2 desktop + 2 mobile.
 *  - After expiry, local data AND local inference remain available; only cloud
 *    and premium platform services switch off. A user is never locked out of
 *    their own local data.
 *
 * Pure and deterministic so it is fully unit-testable without a database.
 */

import {
  PLANS as PRICING_PLANS,
  CLOUD_ALLOWANCE as PRICING_CLOUD_ALLOWANCE,
  type PlanId as PricingPlanId,
} from "./payments/pricing";

/** Re-exported so callers have one import for the allowance rules. */
export const CLOUD_ALLOWANCE = PRICING_CLOUD_ALLOWANCE;
export const WINDOW_HOURS = 8;
const HOUR_MS = 60 * 60 * 1000;
const WINDOW_MS = WINDOW_HOURS * HOUR_MS;

/**
 * Plan identity, duration and device limits come from the pricing config.
 *
 * They used to be restated here, which meant two files had to agree about how
 * long a plan lasts and how many devices it approves — and only one of them
 * carried the prices, so a change to either could silently disagree with the
 * other. `payments/pricing.ts` is the single source; this module owns the
 * ALLOWANCE ARITHMETIC and nothing else.
 */
export type PlanId = Exclude<PricingPlanId, "demo">;

export interface PlanDef {
  id: PlanId;
  label: string;
  durationDays: number;
  /** Same for every plan by decision #36. */
  cloudAllowancePerWindow: number;
  desktopDevices: number;
  mobileDevices: number;
}

const DAY_MS = 24 * HOUR_MS;

export const PLANS: Record<PlanId, PlanDef> = Object.fromEntries(
  PRICING_PLANS.filter((plan) => plan.id !== "demo").map((plan) => [
    plan.id,
    {
      id: plan.id as PlanId,
      label: plan.name,
      durationDays: Math.round(plan.durationMs / DAY_MS),
      cloudAllowancePerWindow: plan.cloudAllowance,
      desktopDevices: plan.desktopDevices,
      mobileDevices: plan.mobileDevices,
    },
  ]),
) as Record<PlanId, PlanDef>;

/* ------------------------------------------------------------- windowing -- */

export interface AllowanceWindow {
  start: Date;
  end: Date;
}

/**
 * Fixed 8-hour windows aligned to UTC midnight (00:00 / 08:00 / 16:00) so the
 * reset time is predictable and identical across devices.
 */
export function currentWindow(now: Date = new Date()): AllowanceWindow {
  const ms = now.getTime();
  if (!Number.isFinite(ms)) {
    throw new Error("A valid time is required to calculate cloud allowance.");
  }
  const startMs = Math.floor(ms / WINDOW_MS) * WINDOW_MS;
  return { start: new Date(startMs), end: new Date(startMs + WINDOW_MS) };
}

export interface AllowanceState {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
  exhausted: boolean;
}

export function allowanceState(
  usedInWindow: number,
  now: Date = new Date(),
  limit: number = CLOUD_ALLOWANCE,
): AllowanceState {
  const w = currentWindow(now);
  const validLimit = Number.isSafeInteger(limit) && limit > 0;
  const safeLimit = validLimit ? limit : CLOUD_ALLOWANCE;
  const validUsage = Number.isSafeInteger(usedInWindow) && usedInWindow >= 0;
  const used = validUsage && validLimit ? Math.min(usedInWindow, safeLimit) : safeLimit;
  const remaining = Math.max(0, safeLimit - used);
  return {
    limit: safeLimit,
    used,
    remaining,
    resetsAt: w.end,
    exhausted: remaining === 0,
  };
}

/* ------------------------------------------------------------- consuming -- */

export type RequestOutcome = "success" | "failed" | "cancelled" | "system_retry";
export type EngineLocality = "local" | "cloud";

/**
 * Only a SUCCESSFUL CLOUD request consumes allowance. Local is unlimited;
 * failures, user cancellations and system-initiated retries are never charged.
 */
export function consumesAllowance(locality: EngineLocality, outcome: RequestOutcome): boolean {
  if (locality === "local") return false;
  return outcome === "success";
}

export type CloudDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: "allowance_exhausted" | "subscription_expired";
      reason: string;
      resetsAt?: Date;
    };

/** Gate a cloud request against entitlement + allowance. */
export function canUseCloud(input: {
  entitlementActive: boolean;
  state: AllowanceState;
}): CloudDecision {
  if (!input.entitlementActive) {
    return {
      allowed: false,
      code: "subscription_expired",
      reason: "Your plan has ended. OCADE Local still works — renew to use OCADE Cloud again.",
    };
  }
  if (input.state.exhausted) {
    return {
      allowed: false,
      code: "allowance_exhausted",
      reason:
        "You've used all OCADE Cloud requests for this period. OCADE Local is still unlimited.",
      resetsAt: input.state.resetsAt,
    };
  }
  return { allowed: true };
}

/** Resolve the untrusted database shape used by server cloud gates. */
export function cloudEntitlementActive(
  record: { status?: unknown; expiresAt?: unknown } | null,
  now: Date = new Date(),
): boolean {
  const current = now.getTime();
  if (
    !record ||
    record.status !== "active" ||
    typeof record.expiresAt !== "string" ||
    !Number.isFinite(current)
  ) {
    return false;
  }
  const expiry = Date.parse(record.expiresAt);
  return Number.isFinite(expiry) && expiry > current;
}

/* ----------------------------------------------------------- entitlement -- */

export interface Entitlement {
  planId: PlanId;
  startedAt: Date;
  /** Explicit end; when absent it is derived from the plan duration. */
  expiresAt?: Date;
}

export interface EntitlementState {
  active: boolean;
  expiresAt: Date;
  /** Always true — local access survives expiry (decision #37). */
  localInferenceAvailable: boolean;
  localDataAvailable: boolean;
  localExportAvailable: boolean;
  cloudAvailable: boolean;
  premiumAvailable: boolean;
  desktopDevices: number;
  mobileDevices: number;
}

export function expiryOf(e: Entitlement): Date {
  if (e.expiresAt) return e.expiresAt;
  const plan = PLANS[e.planId];
  return new Date(e.startedAt.getTime() + plan.durationDays * 24 * HOUR_MS);
}

/**
 * Resolve what the user may do right now. Local capabilities are unconditional:
 * a lapsed plan never locks a user out of their own device or data.
 */
export function entitlementState(e: Entitlement | null, now: Date = new Date()): EntitlementState {
  if (!e) {
    return {
      active: false,
      expiresAt: now,
      localInferenceAvailable: true,
      localDataAvailable: true,
      localExportAvailable: true,
      cloudAvailable: false,
      premiumAvailable: false,
      desktopDevices: 2,
      mobileDevices: 2,
    };
  }
  const expiresAt = expiryOf(e);
  const active = now.getTime() < expiresAt.getTime();
  const plan = PLANS[e.planId];
  return {
    active,
    expiresAt,
    localInferenceAvailable: true,
    localDataAvailable: true,
    localExportAvailable: true,
    cloudAvailable: active,
    premiumAvailable: active,
    desktopDevices: plan.desktopDevices,
    mobileDevices: plan.mobileDevices,
  };
}

/* --------------------------------------------------------------- devices -- */

export type DeviceKind = "desktop" | "mobile";

export function canRegisterDevice(input: {
  kind: DeviceKind;
  currentDesktop: number;
  currentMobile: number;
  state: EntitlementState;
}): { allowed: boolean; reason?: string } {
  const limit = input.kind === "desktop" ? input.state.desktopDevices : input.state.mobileDevices;
  const current = input.kind === "desktop" ? input.currentDesktop : input.currentMobile;
  if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(current) || current < 0) {
    return {
      allowed: false,
      reason: "Device limits could not be verified, so registration was refused.",
    };
  }
  if (current >= limit) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limit} ${input.kind} devices. Remove one to add another.`,
    };
  }
  return { allowed: true };
}

/* ------------------------------------------------- offline entitlement --- */

/**
 * Offline grace: a signed entitlement cache stays valid for a bounded period so
 * a temporarily unreachable licence server never locks out a legitimate user.
 */
export const OFFLINE_GRACE_DAYS = 7;

export function offlineEntitlementValid(lastVerifiedAt: Date, now: Date = new Date()): boolean {
  const current = now.getTime();
  const verified = lastVerifiedAt.getTime();
  if (!Number.isFinite(current) || !Number.isFinite(verified) || verified > current) return false;
  return current - verified <= OFFLINE_GRACE_DAYS * 24 * HOUR_MS;
}

/** Format the reset time for display, e.g. "resets at 16:00". */
export function describeAllowance(state: AllowanceState): string {
  if (!state.exhausted) {
    return `${state.remaining} of ${state.limit} OCADE Cloud requests left`;
  }
  const hh = String(state.resetsAt.getUTCHours()).padStart(2, "0");
  return `OCADE Cloud limit reached — resets at ${hh}:00 UTC. OCADE Local is unlimited.`;
}
