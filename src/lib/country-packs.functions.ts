/**
 * Country-pack server functions.
 *
 * Admin-only writers for country pack versions, sources, events, tests,
 * professional reviews and version promotion. Reads are authenticated.
 *
 * GA promotion is enforced by the `enforce_pack_ga_gate` DB trigger
 * (requires approved review + pilot evidence + all tests passing).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runCalculator, compareExpected } from "./india-calculators";

async function assertAdmin(supabase: { from: (t: string) => any }, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    throw new Response("Forbidden: admin role required", { status: 403 });
  }
}

async function audit(
  supabaseAdmin: any,
  userId: string,
  action: string,
  target: string,
  preview: Record<string, unknown>,
) {
  await supabaseAdmin.from("compliance_audit_log").insert({
    user_id: userId,
    tenant_id: null,
    action,
    feature_id: "admin.country_packs",
    category: "approval",
    preview: { target, ...preview } as never,
  } as never);
}

const updateVersionInput = z.object({
  version_id: z.string().uuid(),
  effective_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  jurisdiction: z.string().max(64).optional(),
  business_types: z.array(z.string().max(64)).max(20).optional(),
  applicability: z.record(z.string(), z.any()).optional(),
  rules: z.record(z.string(), z.any()).optional(),
  changelog: z.string().max(2000).optional(),
  status: z
    .enum(["draft", "in_review", "approved", "pilot", "ga", "stale", "deprecated"])
    .optional(),
  ga_ready: z.boolean().optional(),
  pilot_evidence_url: z.string().url().max(500).nullable().optional(),
  review_required_count: z.number().int().min(1).max(5).optional(),
});

export const updatePackVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateVersionInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { version_id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("country_pack_versions")
      .update(patch as never)
      .eq("id", version_id);
    if (error) return { ok: false as const, message: error.message };
    await audit(supabaseAdmin, context.userId, "country_pack.version.update", version_id, {
      changed_fields: Object.keys(patch),
    });
    return { ok: true as const };
  });

const addSourceInput = z.object({
  version_id: z.string().uuid(),
  rule_key: z.string().min(1).max(200),
  source_type: z.enum([
    "statute",
    "notification",
    "circular",
    "case_law",
    "guidance",
    "form",
    "portal",
    "other",
  ]),
  citation: z.string().min(1).max(500),
  url: z.string().url().max(500).optional(),
  document_ref: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const addRuleSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => addSourceInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rule_sources").insert(data as never);
    if (error) return { ok: false as const, message: error.message };
    await audit(supabaseAdmin, context.userId, "country_pack.source.add", data.version_id, {
      rule_key: data.rule_key,
      source_type: data.source_type,
    });
    return { ok: true as const };
  });

const addReviewInput = z.object({
  version_id: z.string().uuid(),
  reviewer_name: z.string().min(2).max(200),
  reviewer_credential: z.string().min(2).max(120),
  credential_id: z.string().max(120).optional(),
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  scope: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  evidence_url: z.string().url().max(500).optional(),
});

export const addPackReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => addReviewInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pack_reviews")
      .insert({ ...data, reviewer_user_id: context.userId } as never);
    if (error) return { ok: false as const, message: error.message };
    await audit(supabaseAdmin, context.userId, "country_pack.review.submit", data.version_id, {
      decision: data.decision,
      reviewer: data.reviewer_name,
      credential: data.reviewer_credential,
    });
    return { ok: true as const };
  });

const runTestsInput = z.object({ version_id: z.string().uuid() });

export const runVersionTests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => runTestsInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ver, error: vErr } = await supabaseAdmin
      .from("country_pack_versions")
      .select("id, rules")
      .eq("id", data.version_id)
      .maybeSingle();
    if (vErr || !ver) return { ok: false as const, message: "Version not found" };

    const { data: cases, error: cErr } = await supabaseAdmin
      .from("historical_test_cases")
      .select("*")
      .eq("version_id", data.version_id);
    if (cErr) return { ok: false as const, message: cErr.message };

    const results: Array<{
      case_key: string;
      status: "pass" | "fail" | "error";
      diffs: string[];
      actual: any;
    }> = [];

    for (const tc of (cases ?? []) as any[]) {
      let status: "pass" | "fail" | "error" = "pass";
      let diffs: string[] = [];
      let actual: Record<string, unknown> = {};
      try {
        actual = runCalculator(
          tc.calculator,
          (ver.rules ?? {}) as Record<string, unknown>,
          tc.inputs,
        );
        const cmp = compareExpected(tc.expected, actual, Number(tc.tolerance ?? 0));
        status = cmp.pass ? "pass" : "fail";
        diffs = cmp.diffs;
      } catch (e) {
        status = "error";
        diffs = [(e as Error).message];
      }
      results.push({ case_key: tc.case_key, status, diffs, actual });
      await supabaseAdmin
        .from("historical_test_cases")
        .update({
          last_result: { actual, diffs } as never,
          last_status: status,
          last_run_at: new Date().toISOString(),
        } as never)
        .eq("id", tc.id);
    }

    const summary = {
      total: results.length,
      pass: results.filter((r) => r.status === "pass").length,
      fail: results.filter((r) => r.status === "fail").length,
      error: results.filter((r) => r.status === "error").length,
    };

    await audit(supabaseAdmin, context.userId, "country_pack.tests.run", data.version_id, {
      summary,
    });

    return { ok: true as const, summary, results };
  });

const promoteInput = z.object({
  version_id: z.string().uuid(),
  target_status: z.enum(["in_review", "approved", "pilot", "ga", "stale", "deprecated"]),
  ga_ready: z.boolean().optional(),
});

export const promotePackVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => promoteInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.target_status };
    if (data.ga_ready !== undefined) patch.ga_ready = data.ga_ready;
    const { error } = await supabaseAdmin
      .from("country_pack_versions")
      .update(patch as never)
      .eq("id", data.version_id);
    if (error) return { ok: false as const, message: error.message };

    if (data.target_status === "ga") {
      const { data: ver } = await supabaseAdmin
        .from("country_pack_versions")
        .select("pack_id")
        .eq("id", data.version_id)
        .maybeSingle();
      if (ver?.pack_id) {
        await supabaseAdmin
          .from("country_packs")
          .update({ status: "ga" } as never)
          .eq("id", ver.pack_id);
      }
    }
    await audit(
      supabaseAdmin,
      context.userId,
      "country_pack.version.promote",
      data.version_id,
      patch,
    );
    return { ok: true as const };
  });
