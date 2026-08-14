import { describe, expect, it } from "vitest";
import {
  ALPHA_ENTRY_GATE_KEYS,
  ALPHA_EXIT_GATE_KEYS,
  BETA_EXIT_GATE_KEYS,
  evaluateRolloutAdvance,
  validateControlledGateAttestation,
  validatePrivacySafeMissionReceipt,
  type RolloutLaunchGate,
} from "../launch/controlled-rollout";

const completeGate = (key: string, over: Partial<RolloutLaunchGate> = {}): RolloutLaunchGate => ({
  key,
  status: "complete",
  blocker: true,
  owner: "release-owner",
  reviewer: "independent-reviewer",
  evidence_url: `https://evidence.example/${key}`,
  applicable_modules: [],
  ...over,
});

const gatesFor = (keys: readonly string[]): RolloutLaunchGate[] =>
  keys.map((key) => completeGate(key));
const coverage = ["capability:chat", "platform:web"];

describe("controlled rollout stage decisions", () => {
  it("allows a disabled Demo flag without manufacturing cohort evidence", () => {
    expect(
      evaluateRolloutAdvance({
        fromStage: null,
        toStage: "demo",
        enabled: false,
        applicableModules: [],
        gates: [],
      }),
    ).toEqual({
      allowed: true,
      fromStage: "demo",
      toStage: "demo",
      checkedGateKeys: [],
    });
  });

  it("refuses a stage skip even when the flag is disabled", () => {
    const decision = evaluateRolloutAdvance({
      fromStage: "demo",
      toStage: "beta",
      enabled: false,
      applicableModules: coverage,
      gates: [],
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.refusals.map((r) => r.code)).toContain("stage_skip");
  });

  it("requires explicit capability and platform limits for an enabled cohort", () => {
    const decision = evaluateRolloutAdvance({
      fromStage: "demo",
      toStage: "private_alpha",
      enabled: true,
      applicableModules: ["capability:chat"],
      gates: gatesFor(ALPHA_ENTRY_GATE_KEYS),
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed)
      expect(decision.refusals.map((r) => r.code)).toContain("coverage_missing");
  });

  it("allows private alpha only after the entry gates carry independent evidence", () => {
    expect(
      evaluateRolloutAdvance({
        fromStage: "demo",
        toStage: "private_alpha",
        enabled: true,
        applicableModules: coverage,
        gates: gatesFor(ALPHA_ENTRY_GATE_KEYS),
      }).allowed,
    ).toBe(true);
  });

  it("blocks beta until every alpha exit gate is complete", () => {
    const gates = gatesFor([...ALPHA_ENTRY_GATE_KEYS, ...ALPHA_EXIT_GATE_KEYS]);
    gates.find((gate) => gate.key === "alpha_endurance_recovery")!.status = "pending_review";
    const decision = evaluateRolloutAdvance({
      fromStage: "private_alpha",
      toStage: "beta",
      enabled: true,
      applicableModules: coverage,
      gates,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.refusals).toContainEqual(
        expect.objectContaining({
          code: "gate_incomplete",
          gateKey: "alpha_endurance_recovery",
        }),
      );
    }
  });

  it("does not accept a waiver as beta evidence", () => {
    const gates = gatesFor([...ALPHA_ENTRY_GATE_KEYS, ...ALPHA_EXIT_GATE_KEYS]);
    gates.find((gate) => gate.key === "alpha_security_review")!.status = "waived";
    const decision = evaluateRolloutAdvance({
      fromStage: "private_alpha",
      toStage: "beta",
      enabled: true,
      applicableModules: coverage,
      gates,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.refusals).toContainEqual(
        expect.objectContaining({ gateKey: "alpha_security_review", code: "gate_incomplete" }),
      );
    }
  });

  it("requires evidence and separation between owner and reviewer", () => {
    const gates = gatesFor(ALPHA_ENTRY_GATE_KEYS);
    gates[0].evidence_url = null;
    gates[1].reviewer = gates[1].owner;
    const decision = evaluateRolloutAdvance({
      fromStage: "demo",
      toStage: "private_alpha",
      enabled: true,
      applicableModules: coverage,
      gates,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.refusals.map((r) => r.code)).toEqual(
        expect.arrayContaining(["gate_evidence_missing", "gate_review_conflict"]),
      );
    }
  });

  it("requires beta exit evidence and every applicable blocker before GA", () => {
    const gates = gatesFor([
      ...ALPHA_ENTRY_GATE_KEYS,
      ...ALPHA_EXIT_GATE_KEYS,
      ...BETA_EXIT_GATE_KEYS,
      "backups",
    ]);
    gates.find((gate) => gate.key === "backups")!.status = "in_progress";
    const decision = evaluateRolloutAdvance({
      fromStage: "beta",
      toStage: "ga",
      enabled: true,
      applicableModules: coverage,
      gates,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.refusals).toContainEqual(
        expect.objectContaining({ gateKey: "backups", code: "gate_incomplete" }),
      );
    }
  });

  it("always permits rollback to a narrower cohort during a gate outage", () => {
    expect(
      evaluateRolloutAdvance({
        fromStage: "beta",
        toStage: "private_alpha",
        enabled: true,
        applicableModules: [],
        gates: [],
      }).allowed,
    ).toBe(true);
  });
});

describe("controlled gate attestations", () => {
  it("refuses waiver and incomplete completion metadata only for rollout evidence gates", () => {
    expect(
      validateControlledGateAttestation({
        key: "alpha_security_review",
        status: "waived",
        owner: null,
        reviewer: null,
        evidence_url: null,
      }),
    ).toContain("Controlled-rollout evidence gates cannot be waived.");
    expect(
      validateControlledGateAttestation({
        key: "alpha_security_review",
        status: "complete",
        owner: "same",
        reviewer: "SAME",
        evidence_url: null,
      }),
    ).toHaveLength(2);
    expect(
      validateControlledGateAttestation({
        key: "privacy_policy",
        status: "waived",
        owner: null,
        reviewer: null,
        evidence_url: null,
      }),
    ).toEqual([]);
  });
});

describe("privacy-safe alpha mission receipts", () => {
  const receipt = {
    receiptId: "receipt_12345",
    cohortInstallHash: "a".repeat(64),
    capability: "chat",
    platform: "windows",
    appVersion: "0.1.0",
    startedAt: "2026-07-30T10:00:00.000Z",
    finishedAt: "2026-07-30T12:00:00.000Z",
    outcome: "recovered",
    crashCount: 1,
    recoveryVerified: true,
    rollbackVerified: true,
    telemetryConsent: "failures_only",
  };

  it("accepts the bounded receipt without personal or task-content fields", () => {
    expect(validatePrivacySafeMissionReceipt(receipt)).toEqual({ ok: true, issues: [] });
  });

  it("rejects unknown fields, raw identity, invalid time and invalid counters", () => {
    const result = validatePrivacySafeMissionReceipt({
      ...receipt,
      userEmail: "alpha@example.com",
      finishedAt: "2026-07-29T12:00:00.000Z",
      crashCount: -1,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toMatch(/privacy-sensitive fields.*userEmail/i);
    expect(result.issues.join(" ")).toMatch(/timestamps/);
    expect(result.issues.join(" ")).toMatch(/crashCount/);
  });
});
