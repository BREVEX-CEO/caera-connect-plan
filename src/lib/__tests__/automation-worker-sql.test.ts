import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260724211500_ocade_automation_worker.sql",
  "utf8",
);
const rollback = readFileSync(
  "supabase/rollback/20260724211500_ocade_automation_worker_rollback.sql",
  "utf8",
);
const verification = readFileSync(
  "supabase/verification/20260724211500_ocade_automation_worker_verify.sql",
  "utf8",
);

describe("automation worker migration", () => {
  it("is explicitly ready-to-apply and transactional", () => {
    expect(migration).toMatch(/READY TO APPLY — not applied by Codex/);
    expect(migration).toMatch(/\bBEGIN;/);
    expect(migration).toMatch(/\bCOMMIT;/);
  });

  it("persists immutable worker input, ownership, heartbeat, cancellation and resume state", () => {
    for (const column of [
      "execution_steps",
      "worker_id",
      "claim_token",
      "claimed_at",
      "heartbeat_at",
      "lease_expires_at",
      "cancel_requested_at",
      "pause_requested_at",
      "approval_expires_at",
      "deadline_at",
      "next_step_index",
    ]) {
      expect(migration).toContain(column);
    }
  });

  it("allows success receipts only when execution and verification both passed", () => {
    expect(migration).toMatch(/status <> 'succeeded' OR \(execution_ok AND verified\)/);
    expect(migration).toMatch(/UNIQUE \(run_id, phase, step_index, attempt\)/);
    expect(migration).toMatch(/UNIQUE \(run_id, operation_id, attempt\)/);
    expect(migration).toMatch(/phase TEXT NOT NULL CHECK \(phase IN \('execute','rollback'\)\)/);
  });

  it("removes direct run updates and exposes owner SELECT plus constrained INSERT", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "own_automation_runs"/);
    expect(migration).toMatch(/CREATE POLICY "own_automation_runs_select"[\s\S]*FOR SELECT/);
    expect(migration).toMatch(/CREATE POLICY "own_automation_runs_insert"[\s\S]*FOR INSERT/);
    expect(migration).not.toMatch(/CREATE POLICY "own_automation_runs_update"/);
  });

  it("enqueues and advances schedules in one database transaction", () => {
    const enqueueFunction =
      /CREATE OR REPLACE FUNCTION public\.ocade_enqueue_automation_run[\s\S]*?\n\$\$;/.exec(
        migration,
      )?.[0] ?? "";
    expect(enqueueFunction).toMatch(/FOR UPDATE/);
    expect(enqueueFunction).toMatch(/INSERT INTO public\.ocade_automation_runs/);
    expect(enqueueFunction).toMatch(/UPDATE public\.ocade_automations/);
    expect(enqueueFunction).toMatch(
      /status IN \('pending','awaiting_approval','running','paused'\)/,
    );
    expect(migration).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.ocade_automation_runs FROM authenticated/,
    );
  });

  it("claims only eligible pending work and creates a fresh token atomically", () => {
    const claimFunction =
      /CREATE OR REPLACE FUNCTION public\.ocade_claim_automation_run[\s\S]*?\n\$\$;/.exec(
        migration,
      )?.[0] ?? "";
    expect(claimFunction).toMatch(/UPDATE public\.ocade_automation_runs/);
    expect(claimFunction).toMatch(/status = 'running'/);
    expect(claimFunction).toMatch(/claim_token = gen_random_uuid\(\)/);
    expect(claimFunction).toMatch(/lease_expires_at = now\(\) \+ interval '2 minutes'/);
    expect(claimFunction).toMatch(/r\.status = 'pending'/);
    expect(claimFunction).toMatch(/r\.cancel_requested_at IS NULL/);
    expect(claimFunction).toMatch(/r\.pause_requested_at IS NULL/);
    expect(claimFunction).toMatch(/r\.approval_expires_at > now\(\)/);
    expect(claimFunction).toMatch(/r\.deadline_at IS NULL OR r\.deadline_at > now\(\)/);
    expect(claimFunction).toMatch(/r\.next_attempt_at IS NULL OR r\.next_attempt_at <= now\(\)/);
  });

  it("cannot finalize success before every step has a verified receipt", () => {
    expect(migration).toMatch(
      /p_status <> 'succeeded'[\s\S]*next_step_index >= jsonb_array_length\(execution_steps\)/,
    );
  });

  it("uses database-owned lease expiry for heartbeats and stale recovery", () => {
    expect(migration).toMatch(
      /ocade_heartbeat_automation_run[\s\S]*lease_expires_at = now\(\) \+ interval '2 minutes'/,
    );
    expect(migration).toMatch(
      /ocade_recover_stale_automation_runs[\s\S]*lease_expires_at <= now\(\)/,
    );
    expect(migration).toMatch(
      /status IN \('pending','running'\)[\s\S]*status = 'pending'[\s\S]*lease_expires_at IS NULL[\s\S]*lease_expires_at <= now\(\)[\s\S]*deadline_at <= now\(\)/,
    );
  });

  it("keeps running rows non-terminal until a worker confirms cancellation", () => {
    const cancelFunction =
      /CREATE OR REPLACE FUNCTION public\.ocade_request_automation_cancel[\s\S]*?\n\$\$;/.exec(
        migration,
      )?.[0] ?? "";
    expect(cancelFunction).toMatch(
      /CASE WHEN status IN \('pending','awaiting_approval','paused'\) THEN 'cancelled' ELSE status END/,
    );
    expect(cancelFunction).toMatch(/cancel_requested_at = now\(\)/);
    expect(cancelFunction).toContain("cancellation_requested");
  });

  it("persists pause, resume, and approval-expiry transitions", () => {
    expect(migration).toContain("ocade_suspend_automation_run");
    expect(migration).toContain("ocade_request_automation_pause");
    expect(migration).toContain("ocade_resume_automation_run");
    expect(migration).toContain("ocade_expire_automation_approval");
    expect(migration).toContain("approval_expired");
    expect(migration).toContain("'expired', v_expired");
    expect(migration).toMatch(/status = 'paused'/);
    expect(migration).toMatch(/status = 'awaiting_approval'/);
  });

  it("pins SECURITY DEFINER search paths and denies PUBLIC and anon execution", () => {
    const functionCount = (migration.match(/SECURITY DEFINER/g) ?? []).length;
    const searchPathCount = (migration.match(/SET search_path = public, pg_temp/g) ?? []).length;
    expect(functionCount).toBe(14);
    expect(searchPathCount).toBe(14);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.ocade_claim_automation_run\(UUID, TEXT\) FROM PUBLIC, anon/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.ocade_claim_automation_run\(UUID, TEXT\) TO authenticated/,
    );
  });
});

describe("rollback and verification", () => {
  it("rollback removes every function and receipt data before restoring the original policy", () => {
    for (const name of [
      "ocade_claim_automation_run",
      "ocade_enqueue_automation_run",
      "ocade_heartbeat_automation_run",
      "ocade_append_automation_receipt",
      "ocade_complete_automation_run",
      "ocade_requeue_automation_run",
      "ocade_suspend_automation_run",
      "ocade_request_automation_pause",
      "ocade_resume_automation_run",
      "ocade_expire_automation_approval",
      "ocade_decide_automation_run",
      "ocade_request_automation_cancel",
      "ocade_cancel_all_automation_runs",
      "ocade_recover_stale_automation_runs",
    ]) {
      expect(rollback).toContain(`DROP FUNCTION IF EXISTS public.${name}`);
    }
    expect(rollback).toMatch(/DROP TABLE IF EXISTS public\.ocade_automation_step_receipts/);
    expect(rollback).toMatch(/CREATE POLICY "own_automation_runs"[\s\S]*FOR ALL/);
  });

  it("verification covers RLS, columns, policies, functions, grants and constraints", () => {
    for (const evidence of [
      "rls_enabled",
      "execution_steps",
      "pg_policies",
      "security_definer",
      "public_exec",
      "authenticated_exec",
      "pg_constraint",
    ]) {
      expect(verification).toContain(evidence);
    }
  });
});
