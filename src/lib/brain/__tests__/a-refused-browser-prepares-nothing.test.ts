import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A browser over the account's device limit cannot be given an offline allowance, so it
 * can never answer offline. It used to download and warm the engine anyway (seen on the
 * preview, 2026-10-03: the engine loading while registration answered "device limit").
 */
const identity = vi.hoisted(() => ({ problem: null as string | null, fails: false }));
vi.mock("@/lib/commercial/device-identity", () => ({
  ensureCurrentDeviceIdentity: vi.fn(async () => {
    if (identity.fails) throw new Error("refused");
    return null;
  }),
  deviceRegistrationProblem: () => identity.problem,
}));

import { offlineAllowedHere } from "../use-installation";

beforeEach(() => {
  identity.problem = null;
  identity.fails = false;
});

describe("preparing Offline Intelligence in this browser", () => {
  it("does not start where OCADE refused the browser an offline allowance", async () => {
    identity.problem = "device_limit";
    identity.fails = true;
    expect(await offlineAllowedHere()).toBe(false);
  });

  it("goes ahead when registration only failed for now, or there is no network", async () => {
    identity.problem = "unavailable";
    identity.fails = true;
    expect(await offlineAllowedHere()).toBe(true);
    identity.problem = null;
    identity.fails = false;
    expect(await offlineAllowedHere()).toBe(true);
  });
});
