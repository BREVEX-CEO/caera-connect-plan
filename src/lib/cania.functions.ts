/**
 * CANIA server functions — saved topics, alert preferences, per-user settings.
 * All handlers require the current user; RLS enforces isolation.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECTION_ID = z.string().min(1).max(64);

/* ------------------ Saved topics ------------------ */

export const listSavedTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cania_saved_topics")
      .select("id, section, label, query, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const saveTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        section: SECTION_ID,
        label: z.string().min(1).max(120),
        query: z.string().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cania_saved_topics")
      .insert({
        user_id: context.userId,
        section: data.section,
        label: data.label,
        query: data.query ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cania_saved_topics")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* ------------------ Alerts ------------------ */

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cania_alert_prefs")
      .select("id, section, label, channel, enabled, criteria, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });
    return data ?? [];
  });

export const saveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        section: SECTION_ID,
        label: z.string().min(1).max(120),
        channel: z.enum(["in_app", "email", "push"]).default("in_app"),
        enabled: z.boolean().default(true),
        criteria: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cania_alert_prefs")
      .insert({
        user_id: context.userId,
        section: data.section,
        label: data.label,
        channel: data.channel,
        enabled: data.enabled,
        criteria: (data.criteria ?? {}) as never,
      })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

export const updateAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean().optional(),
        channel: z.enum(["in_app", "email", "push"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.channel !== undefined) patch.channel = data.channel;
    const { error } = await context.supabase
      .from("cania_alert_prefs")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cania_alert_prefs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* ------------------ Settings ------------------ */

export const getCaniaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("cania_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data) return data;
    const { data: created } = await context.supabase
      .from("cania_settings")
      .insert({ user_id: context.userId })
      .select("*")
      .single();
    return created;
  });

export const saveCaniaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        countryCode: z.string().length(2).nullable().optional(),
        region: z.string().max(120).nullable().optional(),
        timezone: z.string().max(80).nullable().optional(),
        primaryCurrency: z.string().length(3).nullable().optional(),
        secondaryCurrency: z.string().length(3).nullable().optional(),
        units: z.enum(["metric", "imperial"]).optional(),
        locationPermission: z.enum(["unknown", "granted", "denied", "prompt_pending"]).optional(),
        approxLat: z.number().min(-90).max(90).nullable().optional(),
        approxLon: z.number().min(-180).max(180).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { user_id: context.userId };
    if (data.countryCode !== undefined) patch.country_code = data.countryCode;
    if (data.region !== undefined) patch.region = data.region;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.primaryCurrency !== undefined) patch.primary_currency = data.primaryCurrency;
    if (data.secondaryCurrency !== undefined) patch.secondary_currency = data.secondaryCurrency;
    if (data.units !== undefined) patch.units = data.units;
    if (data.locationPermission !== undefined) patch.location_permission = data.locationPermission;
    if (data.approxLat !== undefined) patch.approx_lat = data.approxLat;
    if (data.approxLon !== undefined) patch.approx_lon = data.approxLon;
    const { data: row, error } = await context.supabase
      .from("cania_settings")
      .upsert(patch as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });
