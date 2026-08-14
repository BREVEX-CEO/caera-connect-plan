/**
 * Fail-closed policy for internal-alpha and controlled-beta expansion.
 *
 * The database stores reviewable launch-gate rows. This module is the shared
 * decision owner used by the server mutation before a feature flag can expand.
 * A local test receipt is never promoted to live cohort evidence: operators
 * must attach an independently reviewable evidence URL to every required gate.
 */

export const ROLLOUT_STAGES = ["demo", "private_alpha", "beta", "ga"] as const;
export type RolloutStage = (typeof ROLLOUT_STAGES)[number];

export type LaunchGateStatus =
  "not_started" | "in_progress" | "pending_review" | "evidence_required" | "complete" | "waived";

export type RolloutLaunchGate = {
  key: string;
  status: LaunchGateStatus;
  blocker: boolean;
  owner: string | null;
  reviewer: string | null;
  evidence_url: string | null;
  applicable_modules: string[];
};

export const ALPHA_ENTRY_GATE_KEYS = [
  "privacy_policy",
  "provider_disclosure",
  "secret_management",
  "incident_response",
] as const;

export const ALPHA_EXIT_GATE_KEYS = [
  "alpha_cohort",
  "alpha_task_library",
  "alpha_endurance_recovery",
  "alpha_performance",
  "alpha_usability",
  "alpha_security_review",
  "alpha_exit_review",
] as const;

export const BETA_EXIT_GATE_KEYS = [
  "beta_enrolment",
  "beta_telemetry_consent",
  "beta_coverage_limits",
  "beta_exit_review",
] as const;

export const CONTROLLED_ROLLOUT_GATE_KEYS = [
  ...ALPHA_EXIT_GATE_KEYS,
  ...BETA_EXIT_GATE_KEYS,
] as const;

export type RolloutRefusalCode =
  | "stage_skip"
  | "coverage_missing"
  | "gate_missing"
  | "gate_incomplete"
  | "gate_evidence_missing"
  | "gate_review_conflict";

export type RolloutRefusal = {
  code: RolloutRefusalCode;
  message: string;
  gateKey?: string;
};

export type RolloutDecision =
  | {
      allowed: true;
      fromStage: RolloutStage;
      toStage: RolloutStage;
      checkedGateKeys: string[];
    }
  | {
      allowed: false;
      fromStage: RolloutStage;
      toStage: RolloutStage;
      checkedGateKeys: string[];
      refusals: RolloutRefusal[];
    };

export type RolloutAdvanceInput = {
  fromStage: RolloutStage | null;
  toStage: RolloutStage;
  enabled: boolean;
  applicableModules: string[];
  gates: RolloutLaunchGate[];
};

const stageIndex = (stage: RolloutStage): number => ROLLOUT_STAGES.indexOf(stage);

function hasCoverageToken(modules: string[], prefix: "capability:" | "platform:"): boolean {
  return modules.some(
    (module) => module.toLowerCase().startsWith(prefix) && module.length > prefix.length,
  );
}

function gateApplies(gate: RolloutLaunchGate, modules: string[]): boolean {
  if (gate.applicable_modules.length === 0 || modules.length === 0) return true;
  const selected = new Set(modules.map((module) => module.toLowerCase()));
  return gate.applicable_modules.some((module) => selected.has(module.toLowerCase()));
}

function requiredGateKeys(
  stage: RolloutStage,
  gates: RolloutLaunchGate[],
  modules: string[],
): string[] {
  if (stage === "demo") return [];
  if (stage === "private_alpha") return [...ALPHA_ENTRY_GATE_KEYS];
  if (stage === "beta") return [...ALPHA_ENTRY_GATE_KEYS, ...ALPHA_EXIT_GATE_KEYS];

  const applicableBlockers = gates
    .filter((gate) => gate.blocker && gateApplies(gate, modules))
    .map((gate) => gate.key);
  return [
    ...new Set([
      ...ALPHA_ENTRY_GATE_KEYS,
      ...ALPHA_EXIT_GATE_KEYS,
      ...BETA_EXIT_GATE_KEYS,
      ...applicableBlockers,
    ]),
  ];
}

function validateGate(gateKey: string, gates: RolloutLaunchGate[]): RolloutRefusal[] {
  const gate = gates.find((candidate) => candidate.key === gateKey);
  if (!gate) {
    return [
      {
        code: "gate_missing",
        gateKey,
        message: `Required rollout gate "${gateKey}" is not installed.`,
      },
    ];
  }
  if (gate.status !== "complete") {
    return [
      {
        code: "gate_incomplete",
        gateKey,
        message: `Required rollout gate "${gateKey}" is ${gate.status}; a waiver is not controlled-rollout evidence.`,
      },
    ];
  }
  if (!gate.evidence_url) {
    return [
      {
        code: "gate_evidence_missing",
        gateKey,
        message: `Required rollout gate "${gateKey}" has no independently reviewable evidence URL.`,
      },
    ];
  }
  if (
    !gate.owner ||
    !gate.reviewer ||
    gate.owner.trim().toLowerCase() === gate.reviewer.trim().toLowerCase()
  ) {
    return [
      {
        code: "gate_review_conflict",
        gateKey,
        message: `Required rollout gate "${gateKey}" needs distinct owner and reviewer identities.`,
      },
    ];
  }
  return [];
}

export function evaluateRolloutAdvance(input: RolloutAdvanceInput): RolloutDecision {
  const fromStage = input.fromStage ?? "demo";
  const refusals: RolloutRefusal[] = [];
  const advancement = stageIndex(input.toStage) - stageIndex(fromStage);

  // Rollback to a narrower cohort is always available, including during a gate
  // outage. Expansion can be frozen without trapping operators in the wider
  // cohort.
  if (advancement < 0) {
    return { allowed: true, fromStage, toStage: input.toStage, checkedGateKeys: [] };
  }

  // Advancing more than one stage is not allowed, even while disabled, because
  // it would erase the reviewable progression path.
  if (advancement > 1) {
    refusals.push({
      code: "stage_skip",
      message: `Rollout cannot skip from ${fromStage} to ${input.toStage}.`,
    });
  }

  if (input.enabled && input.toStage !== "demo") {
    if (
      !hasCoverageToken(input.applicableModules, "capability:") ||
      !hasCoverageToken(input.applicableModules, "platform:")
    ) {
      refusals.push({
        code: "coverage_missing",
        message:
          "Enabled rollout requires at least one capability:* and one platform:* coverage limit.",
      });
    }
  }

  const checkedGateKeys =
    input.enabled && input.toStage !== "demo"
      ? requiredGateKeys(input.toStage, input.gates, input.applicableModules)
      : [];
  for (const gateKey of checkedGateKeys) refusals.push(...validateGate(gateKey, input.gates));

  if (refusals.length > 0) {
    return {
      allowed: false,
      fromStage,
      toStage: input.toStage,
      checkedGateKeys,
      refusals,
    };
  }
  return { allowed: true, fromStage, toStage: input.toStage, checkedGateKeys };
}

export const PRIVACY_SAFE_MISSION_FIELDS = [
  "receiptId",
  "cohortInstallHash",
  "capability",
  "platform",
  "appVersion",
  "startedAt",
  "finishedAt",
  "outcome",
  "crashCount",
  "recoveryVerified",
  "rollbackVerified",
  "telemetryConsent",
] as const;

export type ControlledMissionReceipt = {
  receiptId: string;
  cohortInstallHash: string;
  capability: string;
  platform: string;
  appVersion: string;
  startedAt: string;
  finishedAt: string;
  outcome: "verified" | "failed" | "cancelled" | "recovered";
  crashCount: number;
  recoveryVerified: boolean;
  rollbackVerified: boolean;
  telemetryConsent: "none" | "failures_only" | "failures_and_performance";
};

export type MissionReceiptValidation = {
  ok: boolean;
  issues: string[];
};

export function validateControlledGateAttestation(
  gate: Pick<RolloutLaunchGate, "key" | "status" | "owner" | "reviewer" | "evidence_url">,
): string[] {
  if (
    !CONTROLLED_ROLLOUT_GATE_KEYS.includes(
      gate.key as (typeof CONTROLLED_ROLLOUT_GATE_KEYS)[number],
    )
  ) {
    return [];
  }
  if (gate.status === "waived") {
    return ["Controlled-rollout evidence gates cannot be waived."];
  }
  if (gate.status !== "complete") return [];

  const issues: string[] = [];
  if (!gate.evidence_url)
    issues.push("Completion requires an independently reviewable evidence URL.");
  if (!gate.owner || !gate.reviewer) {
    issues.push("Completion requires both an owner and a reviewer.");
  } else if (gate.owner.trim().toLowerCase() === gate.reviewer.trim().toLowerCase()) {
    issues.push("The owner and reviewer must be different people.");
  }
  return issues;
}

export function validatePrivacySafeMissionReceipt(
  value: Record<string, unknown>,
): MissionReceiptValidation {
  const issues: string[] = [];
  const allowed = new Set<string>(PRIVACY_SAFE_MISSION_FIELDS);
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (extra.length > 0) issues.push(`Unexpected privacy-sensitive fields: ${extra.join(", ")}`);

  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(String(value.receiptId ?? ""))) {
    issues.push("receiptId must be an opaque identifier");
  }
  if (!/^[a-f0-9]{32,128}$/.test(String(value.cohortInstallHash ?? ""))) {
    issues.push("cohortInstallHash must be a one-way hexadecimal install hash");
  }
  if (!String(value.capability ?? "").trim() || !String(value.platform ?? "").trim()) {
    issues.push("capability and platform are required");
  }
  const startedAt = Date.parse(String(value.startedAt ?? ""));
  const finishedAt = Date.parse(String(value.finishedAt ?? ""));
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    issues.push("mission timestamps must be valid and ordered");
  }
  if (!Number.isInteger(value.crashCount) || Number(value.crashCount) < 0) {
    issues.push("crashCount must be a non-negative integer");
  }
  if (!["verified", "failed", "cancelled", "recovered"].includes(String(value.outcome))) {
    issues.push("outcome is invalid");
  }
  if (
    !["none", "failures_only", "failures_and_performance"].includes(String(value.telemetryConsent))
  ) {
    issues.push("telemetryConsent is invalid");
  }
  return { ok: issues.length === 0, issues };
}
