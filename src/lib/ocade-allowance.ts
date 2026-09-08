/**
 * OCADE entitlements and device limits.
 *
 * Rules encoded here:
 *  - Free is an account plan, not a lapsed subscription: it does not expire.
 *  - A paid plan differs from Free by CAPACITY and by device allowance; the
 *    capacity itself is the commercial usage authority's business, not this
 *    module's.
 *  - After a paid period ends, local data and local inference remain
 *    available. A user is never locked out of their own local data, and never
 *    loses Offline Intelligence to a billing event.
 *
 * Pure and deterministic so it is fully unit-testable without a database.
 */

import { PLANS as PRICING_PLANS, type PlanId as PricingPlanId } from "./payments/pricing";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Plan identity, duration and device limits come from the pricing config.
 *
 * They used to be restated here, which meant two files had to agree about how
 * long a plan lasts and how many devices it approves — and only one of them
 * carried the prices, so a change to either could silently disagree with the
 * other. `payments/pricing.ts` is the single source; this module owns the
 * ALLOWANCE ARITHMETIC and nothing else.
 */
export type PlanId = PricingPlanId;

export interface PlanDef {
  id: PlanId;
  label: string;
  /** Null for a plan that does not expire. */
  durationDays: number | null;
  desktopDevices: number;
  mobileDevices: number;
}

const DAY_MS = 24 * HOUR_MS;

export const PLANS: Record<PlanId, PlanDef> = Object.fromEntries(
  PRICING_PLANS.map((plan) => [
    plan.id,
    {
      id: plan.id,
      label: plan.name,
      durationDays: plan.periodMs === null ? null : Math.round(plan.periodMs / DAY_MS),
      desktopDevices: plan.desktopDevices,
      mobileDevices: plan.mobileDevices,
    },
  ]),
) as Record<PlanId, PlanDef>;

/* ----------------------------------------------------------- entitlement -- */

export interface Entitlement {
  planId: PlanId;
  startedAt: Date;
  /** Explicit end; when absent it is derived from the plan duration. */
  expiresAt?: Date;
}

export interface EntitlementState {
  active: boolean;
  /** Null when the plan does not expire. */
  expiresAt: Date | null;
  /** Always true — local access survives expiry (decision #37). */
  localInferenceAvailable: boolean;
  localDataAvailable: boolean;
  localExportAvailable: boolean;
  desktopDevices: number;
  mobileDevices: number;
}

/**
 * When this entitlement ends.
 *
 * A plan with no period does not end, which is reported as `null` rather than
 * as a date far in the future. A sentinel date would eventually arrive, and
 * arriving is precisely what a free account must never do.
 */
export function expiryOf(e: Entitlement): Date | null {
  if (e.expiresAt) return e.expiresAt;
  const plan = PLANS[e.planId];
  if (plan.durationDays === null) return null;
  return new Date(e.startedAt.getTime() + plan.durationDays * 24 * HOUR_MS);
}

/**
 * Resolve what the user may do right now. Local capabilities are unconditional:
 * a lapsed plan never locks a user out of their own device or data.
 */
export function entitlementState(e: Entitlement | null, now: Date = new Date()): EntitlementState {
  if (!e) {
    /*
     * No subscription row. That is a Free account, not a lapsed one — so the
     * device allowance comes from the Free plan rather than from a paid plan's
     * numbers, which is what this used to hand out.
     */
    const free = PLANS.free;
    return {
      active: true,
      expiresAt: null,
      localInferenceAvailable: true,
      localDataAvailable: true,
      localExportAvailable: true,
      desktopDevices: free.desktopDevices,
      mobileDevices: free.mobileDevices,
    };
  }
  const expiresAt = expiryOf(e);
  const active = expiresAt === null || now.getTime() < expiresAt.getTime();
  const plan = PLANS[e.planId];
  return {
    active,
    expiresAt,
    localInferenceAvailable: true,
    localDataAvailable: true,
    localExportAvailable: true,
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
