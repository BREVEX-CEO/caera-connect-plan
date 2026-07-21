/**
 * FICIA — company / legal identity server functions.
 *
 * Reads: `listMyCompanies`, `getCompany` — RLS-scoped by tenant_members.
 * Writes: `createCompany` (transactional via SECURITY DEFINER RPC),
 *   `updateCompany` (owner-only), `requestAccess`, `respondAccessRequest`.
 * Lookups: `checkLegalId`, `checkSimilarNames` — call SECURITY DEFINER
 *   helpers that only reveal display info.
 *
 * Every regulated mutation appends to `compliance_audit_log`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const branchSchema = z.object({
  label: z.string().min(1).max(120),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  country: z.string().length(2).optional(),
});

const subsidiarySchema = z.object({
  name: z.string().min(1).max(200),
  country: z.string().length(2).optional(),
  registration_number: z.string().max(120).optional(),
  ownership_percent: z.number().min(0).max(100).optional(),
});

const contactSchema = z.object({
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  website: z.string().url().max(300).optional().or(z.literal("")),
});

const addressSchema = z.object({
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  postal_code: z.string().max(30).optional(),
});

const taxIdsSchema = z.object({
  gstin: z.string().max(40).optional(),
  pan: z.string().max(40).optional(),
  vat: z.string().max(40).optional(),
  ein: z.string().max(40).optional(),
  other: z.record(z.string(), z.string().max(80)).optional(),
});

const companyPayloadSchema = z.object({
  name: z.string().min(2).max(200),
  legal_name: z.string().max(200).optional(),
  kind: z.enum(["company", "individual"]).default("company"),
  entity_type: z.string().max(80).optional(),
  country: z.string().length(2),
  region: z.string().max(120).optional(),
  industry: z.string().max(120).optional(),
  currency: z.string().min(3).max(3),
  timezone: z.string().min(2).max(80),
  fiscal_year_start_month: z.number().int().min(1).max(12),
  fiscal_year_end_month: z.number().int().min(1).max(12).optional(),
  accounting_method: z.enum(["accrual", "cash"]).optional(),
  registration_number: z.string().max(120).optional(),
  tax_ids: taxIdsSchema.default({}),
  address: addressSchema.default({}),
  contact: contactSchema.default({}),
  description: z.string().max(2000).optional(),
  branches: z.array(branchSchema).max(50).default([]),
  subsidiaries: z.array(subsidiarySchema).max(50).default([]),
  logo_url: z.string().url().max(500).optional().or(z.literal("")),
});

export const listMyCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tenants")
      .select("id, name, legal_name, kind, country, currency, logo_url, status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { companies: (data ?? []) as any[] };
  });

export const getCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("tenants")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !t) throw new Response("Company not found or access denied", { status: 404 });

    const { data: members } = await context.supabase
      .from("tenant_members")
      .select("user_id, role, created_at")
      .eq("tenant_id", data.id);

    return { company: t as any, members: (members ?? []) as any[] };
  });

export const checkLegalId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      country: z.string().length(2),
      registration_number: z.string().max(120).optional().default(""),
      gstin: z.string().max(40).optional().default(""),
      pan: z.string().max(40).optional().default(""),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("find_conflicting_legal_id", {
      _country: data.country,
      _registration: data.registration_number,
      _gstin: data.gstin,
      _pan: data.pan,
    });
    if (error) return { ok: false as const, message: error.message, conflicts: [] };
    return { ok: true as const, conflicts: (rows ?? []) as Array<{ id: string; name: string; matched: string }> };
  });

export const checkSimilarNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ country: z.string().length(2), name: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("find_similar_company_names", {
      _country: data.country,
      _name: data.name,
    });
    if (error) return { ok: false as const, message: error.message, matches: [] };
    return { ok: true as const, matches: (rows ?? []) as Array<{ id: string; name: string }> };
  });

export const createCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => companyPayloadSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: newId, error } = await supabaseAdmin.rpc("create_company_with_owner", {
      _uid: context.userId,
      _payload: data as any,
    });
    if (error) {
      const msg = error.message || "Failed to create company.";
      if (msg.startsWith("duplicate_legal_id:")) {
        const conflictId = msg.split(":")[1]?.trim() ?? null;
        return { ok: false as const, code: "duplicate_legal_id" as const, conflict_id: conflictId, message: "A company with this official ID already exists." };
      }
      return { ok: false as const, code: "error" as const, message: msg };
    }

    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: newId as string,
      action: "ficia.company.create",
      feature_id: "ficia.company",
      category: "approval",
      preview: {
        name: data.name,
        country: data.country,
        entity_type: data.entity_type ?? null,
        has_registration_number: !!data.registration_number,
      } as never,
    } as never);

    return { ok: true as const, id: newId as string };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().min(2).max(200).optional(),
    legal_name: z.string().max(200).nullable().optional(),
    entity_type: z.string().max(80).nullable().optional(),
    industry: z.string().max(120).nullable().optional(),
    region: z.string().max(120).nullable().optional(),
    currency: z.string().length(3).optional(),
    timezone: z.string().min(2).max(80).optional(),
    fiscal_year_start_month: z.number().int().min(1).max(12).optional(),
    fiscal_year_end_month: z.number().int().min(1).max(12).nullable().optional(),
    accounting_method: z.enum(["accrual", "cash"]).nullable().optional(),
    logo_url: z.string().url().max(500).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    address: addressSchema.optional(),
    contact: contactSchema.optional(),
    branches: z.array(branchSchema).max(50).optional(),
    subsidiaries: z.array(subsidiarySchema).max(50).optional(),
  }),
});

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateInput.parse(i))
  .handler(async ({ data, context }) => {
    // Owner-only enforced by RLS on tenants UPDATE
    const { error } = await context.supabase
      .from("tenants")
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.id,
      action: "ficia.company.update",
      feature_id: "ficia.company",
      category: "approval",
      preview: { changed_fields: Object.keys(data.patch) } as never,
    } as never);
    return { ok: true as const };
  });

const accessRequestInput = z.object({
  tenant_id: z.string().uuid(),
  requested_role: z.enum(["employee", "accountant", "auditor", "consultant", "advisor", "manager"]).default("employee"),
  message: z.string().max(1000).optional(),
});

export const requestCompanyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => accessRequestInput.parse(i))
  .handler(async ({ data, context }) => {
    // Requester can insert own via RLS
    const { error } = await context.supabase.from("access_requests").insert({
      tenant_id: data.tenant_id,
      requester_user_id: context.userId,
      requested_role: data.requested_role,
      message: data.message ?? null,
      status: "pending",
    } as never);
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.access.request",
      feature_id: "ficia.company",
      category: "approval",
      preview: { requested_role: data.requested_role } as never,
    } as never);
    return { ok: true as const };
  });

const respondInput = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export const respondAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => respondInput.parse(i))
  .handler(async ({ data, context }) => {
    // Owner-only via RLS on access_requests UPDATE.
    const { data: req, error: readErr } = await context.supabase
      .from("access_requests")
      .select("*")
      .eq("id", data.request_id)
      .maybeSingle();
    if (readErr || !req) return { ok: false as const, message: "Request not visible." };
    if ((req as any).status !== "pending") return { ok: false as const, message: "Already decided." };

    const { error } = await context.supabase
      .from("access_requests")
      .update({
        status: data.decision,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.request_id);
    if (error) return { ok: false as const, message: error.message };

    if (data.decision === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Insert membership as service role (owner cannot always insert others without hitting tenant_members_owner_insert; but the policy allows).
      await supabaseAdmin.from("tenant_members").insert({
        tenant_id: (req as any).tenant_id,
        user_id: (req as any).requester_user_id,
        role: (req as any).requested_role,
      } as never);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: (req as any).tenant_id,
      action: "ficia.access.decide",
      feature_id: "ficia.company",
      category: "approval",
      preview: {
        request_id: data.request_id,
        requester: (req as any).requester_user_id,
        role: (req as any).requested_role,
        decision: data.decision,
      } as never,
    } as never);

    return { ok: true as const };
  });
