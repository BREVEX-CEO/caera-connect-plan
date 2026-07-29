import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPUTER_USE_SETTINGS,
  computerUseChannelDecision,
  computerUsePermissionDecision,
  effectiveComputerUseChannels,
  normalizeComputerUseSettings,
  persistComputerUseSettings,
} from "../computer-use-settings";

describe("Computer Use settings invariants", () => {
  it("starts disabled and keeps protected-input refusal immutable", () => {
    expect(DEFAULT_COMPUTER_USE_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_COMPUTER_USE_SETTINGS.protectedInputs).toBe(true);
    expect(DEFAULT_COMPUTER_USE_SETTINGS.defaultPermission).toBe("ask_every_mutation");
  });

  it("never trusts malformed storage or a stored request to disable protected inputs", () => {
    expect(
      normalizeComputerUseSettings({
        enabled: "yes",
        webControl: true,
        protectedInputs: false,
        defaultPermission: "anything_goes",
        allowanceMinutes: 999_999,
      }),
    ).toEqual({
      ...DEFAULT_COMPUTER_USE_SETTINGS,
      webControl: true,
    });
  });

  it("makes every control channel ineffective while the master switch is off", () => {
    const effective = effectiveComputerUseChannels({
      ...DEFAULT_COMPUTER_USE_SETTINGS,
      enabled: false,
      webControl: true,
      thisComputer: true,
      pairedDevices: true,
      backgroundTasks: true,
      remoteSessions: true,
    });
    expect(Object.values(effective).every((value) => value === false)).toBe(true);
  });

  it("fails closed at the execution boundary for master and channel switches", () => {
    expect(computerUseChannelDecision("thisComputer")).toMatch(/Computer Use is off/i);
    expect(
      computerUseChannelDecision("webControl", {
        ...DEFAULT_COMPUTER_USE_SETTINGS,
        enabled: true,
      }),
    ).toMatch(/Web Control is off/i);
    expect(
      computerUseChannelDecision("webControl", {
        ...DEFAULT_COMPUTER_USE_SETTINGS,
        enabled: true,
        webControl: true,
      }),
    ).toBeNull();
  });

  it("enforces Blocked and Read-only without treating other defaults as authority", () => {
    expect(
      computerUsePermissionDecision("read_only", {
        ...DEFAULT_COMPUTER_USE_SETTINGS,
        defaultPermission: "blocked",
      }),
    ).toMatch(/Blocked/i);
    expect(
      computerUsePermissionDecision("confirm", {
        ...DEFAULT_COMPUTER_USE_SETTINGS,
        defaultPermission: "read_only",
      }),
    ).toMatch(/Read-only/i);
    expect(
      computerUsePermissionDecision("read_only", {
        ...DEFAULT_COMPUTER_USE_SETTINGS,
        defaultPermission: "read_only",
      }),
    ).toBeNull();
    expect(
      computerUsePermissionDecision("confirm", {
        ...DEFAULT_COMPUTER_USE_SETTINGS,
        defaultPermission: "ask_risky",
      }),
    ).toBeNull();
  });

  it("reports storage failure instead of claiming the settings were saved", () => {
    const result = persistComputerUseSettings(DEFAULT_COMPUTER_USE_SETTINGS, {
      setItem() {
        throw new Error("quota");
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected storage failure.");
    expect(result.error).toMatch(/could not be saved/i);
  });
});
