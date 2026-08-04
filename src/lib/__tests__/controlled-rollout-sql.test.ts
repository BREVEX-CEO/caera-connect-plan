import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = "20260730190000_ocade_controlled_rollout_gates";
const migration = readFileSync(`supabase/migrations/${base}.sql`, "utf8");
const rollback = readFileSync(`supabase/rollback/${base}_rollback.sql`, "utf8");
const verification = readFileSync(`supabase/verification/${base}_verify.sql`, "utf8");

describe("controlled rollout database guard", () => {
  it("ships as a transactional ready-to-apply migration with eleven evidence gates", () => {
    expect(migration).toMatch(/READY TO APPLY/);
    expect(migration).toMatch(/\bBEGIN;/);
    expect(migration).toMatch(/\bCOMMIT;\s*$/);
    for (const key of [
      "alpha_cohort",
      "alpha_task_library",
      "alpha_endurance_recovery",
      "alpha_performance",
      "alpha_usability",
      "alpha_security_review",
      "alpha_exit_review",
      "beta_enrolment",
      "beta_telemetry_consent",
      "beta_coverage_limits",
      "beta_exit_review",
    ]) {
      expect(migration).toContain(`'${key}'`);
    }
  });

  it("fails closed on stage skipping, missing coverage, waivers and weak evidence", () => {
    expect(migration).toMatch(/cannot skip rollout stages/);
    expect(migration).toMatch(/capability:\*/);
    expect(migration).toMatch(/platform:\*/);
    expect(migration).toMatch(/cannot be waived/);
    expect(migration).toMatch(/distinct owner\/reviewer/);
    expect(migration).toMatch(/status <> 'complete'/);
  });

  it("keeps emergency rollback to a narrower cohort available", () => {
    expect(migration).toMatch(/IF new_rank < old_rank THEN\s+RETURN NEW;/);
  });

  it("refuses rollback that would erase immutable review history", () => {
    expect(rollback).toMatch(/launch_gate_history/);
    expect(rollback).toMatch(/automatic rollback refuses to erase audit evidence/);
    expect(rollback).toMatch(/\bBEGIN;/);
    expect(rollback).toMatch(/\bCOMMIT;/);
  });

  it("self-checks gate count and both enforcement triggers", () => {
    expect(verification).toMatch(/gate_count <> 11/);
    expect(verification).toContain("launch_gate_enforce_controlled_evidence");
    expect(verification).toContain("feature_flags_enforce_controlled_rollout");
    expect(verification).toMatch(/RAISE EXCEPTION/);
  });
});
