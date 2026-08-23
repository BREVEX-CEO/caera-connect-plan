/**
 * OCADE entitlements and device limits (Plan §33/§38).
 *
 * Rules encoded here:
 *  - On-device processing is unlimited and never metered.
 *  - Every plan (2-day / 8-day / 1-month / 1-year) grants the same core
 *    entitlements and differs by DURATION (and price); 2 desktop + 2 mobile.
 *  - After expiry, local data and local inference remain available. A user is
 *    never locked out of their own local data.
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
export type PlanId = Exclude<PricingPlanId, "demo">;

export interface PlanDef {
  id: PlanId;
  label: string;
  durationDays: number;
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
  expiresAt: Date;
  /** Always true — local access survives expiry (decision #37). */
  localInferenceAvailable: boolean;
  localDataAvailable: boolean;
  localExportAvailable: boolean;
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
