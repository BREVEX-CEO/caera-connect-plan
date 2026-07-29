import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface IntegrationAudit {
  phase: number;
  status: string;
  nonRuntimeModules: Array<{
    path: string;
    classification: string;
    reason: string;
  }>;
  knownRuntimeBoundaries: Array<{
    id: string;
    classification: string;
    nextPhase?: number;
    reason: string;
  }>;
  claims: Record<string, boolean>;
}

const audit = JSON.parse(
  readFileSync("release/OCADE_INTEGRATION_AUDIT.json", "utf8"),
) as IntegrationAudit;

describe("Phase 19 integration honesty audit", () => {
  it("passes the machine-readable cross-surface gate", () => {
    const output = execFileSync(process.execPath, ["scripts/check-ocade-integration.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("OCADE integration honesty gate:");
    expect(output).toContain("PHASE 19 AUDITED");
  });

  it("does not turn source-only seams into runtime claims", () => {
    expect(audit.phase).toBe(19);
    expect(audit.status).toBe("partial_stage_2_pending");
    // Was 11; rehearsal, shadow-execution and learning-replay were wired into a
    // routed surface (PreflightPanel), then answer-composition and cited-answer
    // into AnswerQualityPanel — all on /ocade/studio — so they are no longer
    // non-runtime orphans. Back up to 9: the orphan scan only covered
    // lib/{artifacts,chat,media,mobile,research,skills}, so everything in
    // lib/providers was invisible to it. Widening the scan exposed three
    // genuine orphans — the multimodal and app-coverage registries and the
    // free-tool adapters — which are now declared rather than unseen. Then back
    // to 8: local-job-plan was wired into LocalJobPlanPanel on /ocade/studio,
    // which also un-orphaned hardware-profile, its only consumer. Then 7:
    // app-coverage-registry was wired into AppCoveragePanel, giving its honest
    // BLOCKED state a surface to be stated on. Then 6: the VoiceProvider
    // contract was corrected to make synthesize/transcribe optional — no
    // browser engine can return audio bytes — so the real system speech
    // provider registers without stubs, and the route registers it.
    expect(audit.nonRuntimeModules).toHaveLength(5);
    expect(audit.nonRuntimeModules.some((entry) => entry.path === "src/lib/media/inspect.ts")).toBe(
      false,
    );
    expect(audit.nonRuntimeModules.every((entry) => entry.reason.length >= 20)).toBe(true);
    expect(Object.values(audit.claims)).toEqual([false, false, false, false, false]);
  });

  it("keeps the fail-closed mobile native bridge assigned to the relay phase", () => {
    const mobile = audit.knownRuntimeBoundaries.find(
      (boundary) => boundary.id === "mobile-native-plugin",
    );
    expect(mobile).toMatchObject({
      classification: "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
      nextPhase: 34,
    });
  });
});
