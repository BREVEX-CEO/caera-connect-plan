import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(`supabase/migrations/${name}`, "utf8");

describe("live Supabase hardening migrations", () => {
  it("removes anonymous access and moves RLS-only definer helpers out of public", () => {
    const sql = migration("20260824112227_live_supabase_security_hardening.sql");

    expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS private");
    expect(sql).toContain(
      "ALTER FUNCTION public.msg_is_thread_member(UUID, UUID) SET SCHEMA private",
    );
    expect(sql).toContain("ALTER EXTENSION pg_trgm SET SCHEMA extensions");
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(sql).toMatch(
      /CREATE POLICY "No client access to payment webhook events"[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/,
    );
  });

  it("caches auth helpers and creates only missing foreign-key indexes", () => {
    const sql = migration("20260824112646_rls_and_foreign_key_performance.sql");

    expect(sql).toContain("ALTER FUNCTION public.revoke_device_for_current_user(UUID) SECURITY INVOKER");
    expect(sql).toContain("'auth.uid()', '(select auth.uid())'");
    expect(sql).toContain("index_row.indisvalid");
    expect(sql).toContain(
      "index_key.ordinality <= cardinality(constraint_row.conkey)",
    );
  });

  it("consolidates permissive policies without discarding any original predicate", () => {
    const sql = migration("20260824112850_consolidate_permissive_rls_policies.sql");

    expect(sql).toContain("string_agg(");
    expect(sql).toContain("' OR ' ORDER BY p.polname");
    expect(sql).toContain("FOR SELECT TO authenticated");
    expect(sql).toContain("FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)");
  });

  it("qualifies automation ids that collide with RETURNS TABLE output names", () => {
    const sql = migration("20260824113306_fix_automation_enqueue_ambiguity.sql");

    expect(sql).toContain("FROM public.ocade_automations AS automation");
    expect(sql).toContain("WHERE automation.id = p_automation_id");
    expect(sql).toContain("UPDATE public.ocade_automations AS automation");
    expect(sql).not.toMatch(/\n\s*WHERE id = p_automation_id/);
  });
});
