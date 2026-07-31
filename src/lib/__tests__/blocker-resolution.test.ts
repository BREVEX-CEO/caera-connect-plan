import { describe, expect, it } from "vitest";
import {
  BLOCKER_RESOLUTION_STRATEGIES,
  classifyHardwareOrToolingBlocker,
  retainBlockerAssessment,
  type BlockerAssessment,
  type BlockerAssessmentStore,
  type BlockerAttempt,
  type RetainedBlockerAssessment,
} from "../blocker-resolution";

const NOW = new Date("2026-07-30T17:40:00.000Z");

function attempt(
  strategyId: BlockerAttempt["strategyId"],
  outcome: BlockerAttempt["outcome"] = "FAILED",
): BlockerAttempt {
  return {
    strategyId,
    outcome,
    reason: `${strategyId} evaluated against the requirement`,
    evidence: {
      sha256: strategyId.charCodeAt(0).toString(16).padStart(2, "0").repeat(32),
      observedAt: "2026-07-30T17:39:00.000Z",
      source: `evidence/${strategyId}.json`,
      verifier: "independent-verifier",
    },
    ...(strategyId === "one_step_human_action"
      ? {
          outcome: "EXTERNAL_ACTION" as const,
          ownerAction: {
            category: "signing" as const,
            owner: "release-owner",
            instruction: "Provide the production signing identity through the secure broker.",
          },
        }
      : {}),
  };
}

function assessment(overrides: Partial<BlockerAssessment> = {}): BlockerAssessment {
  return {
    id: "blocker-1",
    tenantId: "tenant-a",
    requirementId: "AZ-429",
    owner: "readiness-owner",
    attempts: BLOCKER_RESOLUTION_STRATEGIES.map((strategy) => attempt(strategy.id)),
    ...overrides,
  };
}

describe("CXR-09 systematic blocker reduction", () => {
  it("classifies a blocker external only after all ten ordered alternatives have evidence", () => {
    expect(classifyHardwareOrToolingBlocker(assessment(), { now: NOW })).toMatchObject({
      classification: "EXTERNALLY_BLOCKED",
      ownerAction: {
        category: "signing",
        owner: "release-owner",
      },
    });
  });

  it("selects the first available alternative and refuses an external claim", () => {
    const attempts = BLOCKER_RESOLUTION_STRATEGIES.map((strategy) => attempt(strategy.id));
    attempts[2] = attempt("emulator_or_simulator", "AVAILABLE");
    attempts[4] = attempt("existing_owned_device", "AVAILABLE");
    expect(classifyHardwareOrToolingBlocker(assessment({ attempts }), { now: NOW })).toMatchObject({
      classification: "RESOLVABLE",
      recommendedStrategy: "emulator_or_simulator",
    });
  });

  it.each([
    ["missing strategy", (items: BlockerAttempt[]) => items.slice(1)],
    [
      "duplicate strategy",
      (items: BlockerAttempt[]) => [...items, attempt("portable_runtime", "FAILED")],
    ],
    [
      "failed acceptance evidence",
      (items: BlockerAttempt[]) =>
        items.map((item, index) =>
          index === 3 ? { ...item, evidence: { ...item.evidence, sha256: "bad" } } : item,
        ),
    ],
    [
      "stale evidence",
      (items: BlockerAttempt[]) =>
        items.map((item, index) =>
          index === 4
            ? { ...item, evidence: { ...item.evidence, observedAt: "2026-05-01T00:00:00.000Z" } }
            : item,
        ),
    ],
    [
      "future evidence",
      (items: BlockerAttempt[]) =>
        items.map((item, index) =>
          index === 5
            ? { ...item, evidence: { ...item.evidence, observedAt: "2026-07-30T18:40:00.000Z" } }
            : item,
        ),
    ],
    [
      "non-independent evidence",
      (items: BlockerAttempt[]) =>
        items.map((item, index) =>
          index === 6
            ? { ...item, evidence: { ...item.evidence, verifier: "readiness-owner" } }
            : item,
        ),
    ],
  ])("keeps %s unverified", (_label, mutate) => {
    const attempts = mutate(
      BLOCKER_RESOLUTION_STRATEGIES.map((strategy) => attempt(strategy.id)),
    ) as BlockerAttempt[];
    expect(
      classifyHardwareOrToolingBlocker(assessment({ attempts }), { now: NOW }).classification,
    ).toBe("UNVERIFIED");
  });

  it("rejects external-action shortcuts before the tenth strategy", () => {
    const attempts = BLOCKER_RESOLUTION_STRATEGIES.map((strategy) => attempt(strategy.id));
    attempts[1] = {
      ...attempts[1],
      outcome: "EXTERNAL_ACTION",
      ownerAction: {
        category: "credential",
        owner: "somebody",
        instruction: "Do setup.",
      },
    };
    expect(
      classifyHardwareOrToolingBlocker(assessment({ attempts }), { now: NOW }).classification,
    ).toBe("UNVERIFIED");
  });

  it("rejects a vague, missing or unsupported final owner action", () => {
    for (const final of [
      { ...attempt("one_step_human_action"), ownerAction: undefined },
      {
        ...attempt("one_step_human_action"),
        ownerAction: { category: "money" as never, owner: "owner", instruction: "Pay." },
      },
      {
        ...attempt("one_step_human_action"),
        ownerAction: { category: "legal" as const, owner: "", instruction: "" },
      },
    ]) {
      const attempts = BLOCKER_RESOLUTION_STRATEGIES.map((strategy) => attempt(strategy.id));
      attempts[9] = final;
      expect(
        classifyHardwareOrToolingBlocker(assessment({ attempts }), { now: NOW }).classification,
      ).toBe("UNVERIFIED");
    }
  });

  it("honours cancellation before assessment", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      classifyHardwareOrToolingBlocker(assessment(), { now: NOW, signal: controller.signal }),
    ).toThrow(/cancelled/i);
  });

  it("retains verified classifications through a tenant-scoped idempotent store", async () => {
    const data = new Map<string, readonly RetainedBlockerAssessment[]>();
    const store: BlockerAssessmentStore = {
      load: async (tenantId) => data.get(tenantId) ?? [],
      save: async (tenantId, records) => {
        data.set(tenantId, structuredClone(records));
      },
    };
    const input = assessment();
    const classification = classifyHardwareOrToolingBlocker(input, { now: NOW });
    await expect(retainBlockerAssessment(store, input, classification, NOW)).resolves.toMatchObject(
      {
        retainedAt: NOW.toISOString(),
        classification: { classification: "EXTERNALLY_BLOCKED" },
      },
    );
    await expect(retainBlockerAssessment(store, input, classification, NOW)).rejects.toThrow(
      /idempotent/i,
    );
    expect(data.get("tenant-b")).toBeUndefined();
  });

  it("never retains an unverified assessment as completion evidence", async () => {
    const store: BlockerAssessmentStore = {
      load: async () => [],
      save: async () => undefined,
    };
    const input = assessment({ attempts: [] });
    const classification = classifyHardwareOrToolingBlocker(input, { now: NOW });
    await expect(retainBlockerAssessment(store, input, classification, NOW)).rejects.toThrow(
      /unverified/i,
    );
  });
});
