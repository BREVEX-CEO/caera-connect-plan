import { describe, expect, it } from "vitest";
import {
  STAKEHOLDER_RESEARCH_DIMENSIONS,
  assessStakeholderResearchProgramme,
  retainStakeholderResearchEvidence,
  validateStakeholderResearchEvidence,
  type StakeholderResearchEvidence,
  type StakeholderResearchStore,
} from "../stakeholder-research";

const NOW = new Date("2026-07-30T17:45:00.000Z");

function evidence(
  overrides: Partial<StakeholderResearchEvidence> = {},
): StakeholderResearchEvidence {
  return {
    evidenceId: "evidence-1",
    tenantId: "tenant-a",
    dimension: "interviews",
    participantPseudonym: "participant-001",
    participantType: "external_human",
    consentReceiptSha256: "a".repeat(64),
    evidenceSha256: "b".repeat(64),
    occurredAt: "2026-07-30T17:40:00.000Z",
    researcherId: "researcher",
    reviewerId: "reviewer",
    observationAuthorised: true,
    withdrawalSupported: true,
    rawContentRetained: false,
    protectedDataRetained: false,
    coverageTags: ["small-business", "keyboard-user", "region-in"],
    ...overrides,
  };
}

describe("AZ-009 through AZ-015 stakeholder research intake", () => {
  it("accepts current consented pseudonymous external-human evidence", () => {
    expect(validateStakeholderResearchEvidence(evidence(), { now: NOW })).toMatchObject({
      valid: true,
    });
  });

  it("never accepts a synthetic fixture as production research", () => {
    const fixture = evidence({ participantType: "synthetic_fixture" });
    expect(validateStakeholderResearchEvidence(fixture, { now: NOW })).toMatchObject({
      valid: false,
      code: "synthetic_not_production",
    });
    expect(
      validateStakeholderResearchEvidence(fixture, {
        now: NOW,
        allowSyntheticFixture: true,
      }),
    ).toMatchObject({ valid: true });
    expect(assessStakeholderResearchProgramme([fixture], { now: NOW })).toMatchObject({
      productionReady: false,
      distinctExternalParticipants: 0,
    });
  });

  it.each([
    ["email", { participantPseudonym: "person@example.com" }, "identity_or_pii"],
    ["phone", { participantPseudonym: "+1 202 555 0199" }, "identity_or_pii"],
    ["missing consent", { consentReceiptSha256: "bad" }, "privacy_or_consent"],
    ["raw retention", { rawContentRetained: true as never }, "privacy_or_consent"],
    ["protected retention", { protectedDataRetained: true as never }, "privacy_or_consent"],
    ["no withdrawal", { withdrawalSupported: false }, "privacy_or_consent"],
    ["self review", { reviewerId: "researcher" }, "independent_review"],
    ["stale", { occurredAt: "2025-01-01T00:00:00.000Z" }, "stale_or_future"],
    ["future", { occurredAt: "2026-07-30T18:45:00.000Z" }, "stale_or_future"],
    ["unknown dimension", { dimension: "sales_pitch" as never }, "coverage"],
    ["PII coverage tag", { coverageTags: ["person@example.com"] }, "coverage"],
  ])("refuses %s", (_label, override, code) => {
    expect(validateStakeholderResearchEvidence(evidence(override), { now: NOW })).toMatchObject({
      valid: false,
      code,
    });
  });

  it("retains valid evidence idempotently and only inside its tenant", async () => {
    const records = new Map<string, readonly StakeholderResearchEvidence[]>();
    const store: StakeholderResearchStore = {
      load: async (tenantId) => records.get(tenantId) ?? [],
      save: async (tenantId, next) => {
        records.set(tenantId, structuredClone(next));
      },
    };
    const record = evidence();
    await expect(retainStakeholderResearchEvidence(store, record, { now: NOW })).resolves.toEqual(
      record,
    );
    await expect(retainStakeholderResearchEvidence(store, record, { now: NOW })).rejects.toThrow(
      /idempotent/i,
    );
    expect(records.get("tenant-b")).toBeUndefined();
  });

  it("honours cancellation before retaining participant evidence", async () => {
    const controller = new AbortController();
    controller.abort();
    const store: StakeholderResearchStore = {
      load: async () => [],
      save: async () => undefined,
    };
    await expect(
      retainStakeholderResearchEvidence(store, evidence(), {
        now: NOW,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reports all seven dimensions externally blocked when no humans were observed", () => {
    expect(assessStakeholderResearchProgramme([], { now: NOW })).toEqual({
      productionReady: false,
      classification: "EXTERNALLY_BLOCKED",
      distinctExternalParticipants: 0,
      missingDimensions: STAKEHOLDER_RESEARCH_DIMENSIONS.map((dimension) => dimension.key),
      reason:
        "Authorised external-human interviews and observations remain an owner-coordinated action.",
    });
  });

  it("requires five distinct external participants in every dimension", () => {
    const records = STAKEHOLDER_RESEARCH_DIMENSIONS.flatMap((dimension, dimensionIndex) =>
      Array.from({ length: 5 }, (_, participantIndex) =>
        evidence({
          evidenceId: `${dimension.key}-${participantIndex}`,
          dimension: dimension.key,
          participantPseudonym: `participant-${dimensionIndex}-${participantIndex}`,
          evidenceSha256: (dimensionIndex + 1).toString(16).padStart(2, "0").repeat(32),
        }),
      ),
    );
    expect(assessStakeholderResearchProgramme(records, { now: NOW })).toMatchObject({
      productionReady: true,
      classification: "REAL_PARTICIPANT_EVIDENCE_COMPLETE",
      distinctExternalParticipants: 35,
      missingDimensions: [],
    });

    const duplicated = records.map((record) =>
      record.dimension === "accessibility"
        ? { ...record, participantPseudonym: "one-accessibility-participant" }
        : record,
    );
    expect(assessStakeholderResearchProgramme(duplicated, { now: NOW })).toMatchObject({
      productionReady: false,
      missingDimensions: ["accessibility"],
    });
  });
});
