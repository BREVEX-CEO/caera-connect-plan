import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrations = [
  "20260722090000_ocade_projects_outputs_memory",
  "20260722100000_ocade_subscriptions_usage",
  "20260722110000_ocade_automations",
  "20260724211500_ocade_automation_worker",
  "20260730190000_ocade_controlled_rollout_gates",
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const applyOrder = read("supabase/APPLY_ORDER.md");
const projects = read(`supabase/migrations/${migrations[0]}.sql`);
const usage = read(`supabase/migrations/${migrations[1]}.sql`);
const automations = read(`supabase/migrations/${migrations[2]}.sql`);
const worker = read(`supabase/migrations/${migrations[3]}.sql`);
const controlledRollout = read(`supabase/migrations/${migrations[4]}.sql`);
const projectsRollback = read(`supabase/rollback/${migrations[0]}_rollback.sql`);
const workerRollback = read(`supabase/rollback/${migrations[3]}_rollback.sql`);
const projectsVerify = read(`supabase/verification/${migrations[0]}_verify.sql`);
const workerVerify = read(`supabase/verification/${migrations[3]}_verify.sql`);
const usageFunctions = read("src/lib/ocade-usage.functions.ts");
const chatRoute = read("src/routes/api/ocade.chat.ts");

describe("OCADE Supabase application package", () => {
  it("lists every unapplied migration in dependency order with rollback and verification", () => {
    let previous = -1;
    for (const migration of migrations) {
      const current = applyOrder.indexOf(`${migration}.sql`);
      expect(current, `${migration} is missing from APPLY_ORDER.md`).toBeGreaterThan(previous);
      previous = current;
      expect(existsSync(`supabase/rollback/${migration}_rollback.sql`)).toBe(true);
      expect(existsSync(`supabase/verification/${migration}_verify.sql`)).toBe(true);
    }
    expect(applyOrder).toMatch(/five are the only UNAPPLIED migrations/i);
    expect(applyOrder).toMatch(/\(5\s*→\s*4\s*→\s*3\s*→\s*2\s*→\s*1\)/);
  });

  it("makes each unapplied migration atomic and labels the package honestly", () => {
    for (const migration of [projects, usage, automations, worker, controlledRollout]) {
      expect(migration).toMatch(/\bBEGIN;\s/);
      expect(migration).toMatch(/\sCOMMIT;\s*$/);
      expect(migration).toMatch(/READY TO APPLY/);
    }
    expect(applyOrder).toMatch(/READY TO APPLY THROUGH LOVABLE/);
    expect(applyOrder).toMatch(/Nothing here has been applied/);
  });

  it("declares deterministic table privileges instead of relying on database defaults", () => {
    for (const table of [
      "ocade_projects",
      "ocade_project_items",
      "ocade_outputs",
      "ocade_memory",
    ]) {
      expect(projects).toMatch(
        new RegExp(`REVOKE ALL ON (?:TABLE )?public\\.${table} FROM PUBLIC, anon`),
      );
      expect(projects).toMatch(
        new RegExp(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON (?:TABLE )?public\\.${table} TO authenticated`,
        ),
      );
      expect(projects).toMatch(
        new RegExp(`GRANT ALL ON (?:TABLE )?public\\.${table} TO service_role`),
      );
    }
    for (const table of ["ocade_subscriptions", "ocade_cloud_usage"]) {
      expect(usage).toMatch(
        new RegExp(`REVOKE ALL ON (?:TABLE )?public\\.${table} FROM PUBLIC, anon`),
      );
      expect(usage).toMatch(
        new RegExp(`GRANT SELECT ON (?:TABLE )?public\\.${table} TO authenticated`),
      );
      expect(usage).toMatch(
        new RegExp(`GRANT ALL ON (?:TABLE )?public\\.${table} TO service_role`),
      );
    }
    expect(automations).toMatch(
      /REVOKE ALL ON (?:TABLE )?public\.ocade_automations FROM PUBLIC, anon/,
    );
    expect(automations).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON (?:TABLE )?public\.ocade_automations TO authenticated/,
    );
    expect(automations).toMatch(
      /REVOKE ALL ON (?:TABLE )?public\.ocade_automation_runs FROM PUBLIC, anon/,
    );
    expect(automations).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON (?:TABLE )?public\.ocade_automation_runs TO authenticated/,
    );
  });

  it("enforces parent ownership for every cross-table project relationship", () => {
    expect(projects).toMatch(
      /CREATE POLICY "own_conversations"[\s\S]*project_id IS NULL[\s\S]*FROM public\.ocade_projects/,
    );
    expect(projects).toMatch(/CREATE POLICY "own_messages"[\s\S]*FROM public\.ocade_conversations/);
    expect(projects).toMatch(/CREATE POLICY "own_project_items"[\s\S]*FROM public\.ocade_projects/);
    expect(projects).toMatch(
      /CREATE POLICY "own_outputs"[\s\S]*project_id IS NULL[\s\S]*FROM public\.ocade_projects[\s\S]*conversation_id IS NULL[\s\S]*FROM public\.ocade_conversations/,
    );
    expect(projects).toMatch(
      /CREATE POLICY "own_memory"[\s\S]*scope = 'user'[\s\S]*FROM public\.ocade_projects/,
    );
    expect(projectsVerify).toContain("parent_owned");
    expect(projectsRollback).toMatch(
      /CREATE POLICY "own_conversations"[\s\S]*auth\.uid\(\) = user_id/,
    );
    expect(projectsRollback).toMatch(/CREATE POLICY "own_messages"[\s\S]*auth\.uid\(\) = user_id/);
  });

  it("prevents cross-owner automation run references in both migration stages", () => {
    expect(automations).toMatch(
      /CREATE POLICY "own_automation_runs"[\s\S]*FROM public\.ocade_automations/,
    );
    expect(worker).toMatch(
      /CREATE POLICY "own_automation_runs_insert"[\s\S]*FROM public\.ocade_automations/,
    );
  });

  it("keeps step receipts append-only for every application role", () => {
    expect(worker).toMatch(
      /REVOKE ALL ON TABLE public\.ocade_automation_step_receipts\s+FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(worker).toMatch(
      /GRANT SELECT ON TABLE public\.ocade_automation_step_receipts\s+TO authenticated, service_role/,
    );
    expect(worker).not.toMatch(
      /GRANT ALL ON TABLE public\.ocade_automation_step_receipts TO service_role/,
    );
    expect(workerVerify).toContain("information_schema.role_table_grants");
    expect(workerVerify).toContain("privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')");
  });

  it("verifies all thirteen worker RPC grants by exact function name", () => {
    const functions = [
      "ocade_claim_automation_run",
      "ocade_heartbeat_automation_run",
      "ocade_append_automation_receipt",
      "ocade_complete_automation_run",
      "ocade_requeue_automation_run",
      "ocade_suspend_automation_run",
      "ocade_request_automation_pause",
      "ocade_expire_automation_approval",
      "ocade_resume_automation_run",
      "ocade_decide_automation_run",
      "ocade_request_automation_cancel",
      "ocade_cancel_all_automation_runs",
      "ocade_recover_stale_automation_runs",
    ];
    for (const name of functions) {
      expect(workerVerify).toContain(`'${name}'`);
    }
    expect(workerVerify).not.toMatch(/proname LIKE 'ocade_%automation_run%'/);
  });

  it("restores the base run policy and privileges when the worker migration is rolled back", () => {
    expect(workerRollback).toMatch(
      /CREATE POLICY "own_automation_runs"[\s\S]*FROM public\.ocade_automations/,
    );
    expect(workerRollback).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON (?:TABLE )?public\.ocade_automation_runs TO authenticated/,
    );
  });

  it("calls the service-role-only allowance RPC through the server-only admin client", () => {
    for (const source of [usageFunctions, chatRoute]) {
      expect(source).toContain('await import("@/integrations/supabase/client.server")');
      expect(source).toMatch(/supabaseAdmin\.rpc\(\s*"ocade_consume_cloud_use"/);
    }
    expect(usageFunctions).not.toMatch(/context\.supabase[\s\S]{0,200}"ocade_consume_cloud_use"/);
    expect(chatRoute).not.toMatch(/(?<!Admin)\.rpc\(\s*"ocade_consume_cloud_use"/);
  });
});
