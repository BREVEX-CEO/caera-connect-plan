/**
 * OCADE local-provider server functions.
 *
 * AI inference is local-only. This module never reads a public AI API key and
 * never calls an AI-provider endpoint. Supabase is used only for authenticated
 * preference/audit metadata; prompts and completions are not handled here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOCAL_PROVIDERS = ["local_runtime", "ollama_local"] as const;

const prefsInput = z.object({
  routing: z.enum(["auto", "local_only", ...LOCAL_PROVIDERS]).optional(),
  ollamaBridgeUrl: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .refine(
      (value) =>
        !value || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value),
      { message: "The local engine URL must use loopback or a private-network address." },
    ),
});

export const getProviderPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ocade_provider_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data) {
      return {
        ...data,
        // Stale historical remote choices are never returned as executable routing.
        routing: data.routing === "ollama_local" ? "ollama_local" : "local_only",
        session_override_model: null,
        openai_direct_enabled: false,
      };
    }
    const { data: created, error } = await context.supabase
      .from("ocade_provider_prefs")
      .insert({ user_id: context.userId, routing: "local_only", openai_direct_enabled: false })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return created;
  });

export const saveProviderPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => prefsInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      user_id: context.userId,
      routing: data.routing === "ollama_local" ? "ollama_local" : "local_only",
      session_override_model: null,
      openai_direct_enabled: false,
    };
    if (data.ollamaBridgeUrl !== undefined) patch.ollama_bridge_url = data.ollamaBridgeUrl;
    const { data: row, error } = await context.supabase
      .from("ocade_provider_prefs")
      .upsert(patch as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    await context.supabase.from("ocade_provider_events").insert({
      user_id: context.userId,
      event_kind: "provider_switch",
      provider: "local_runtime",
      detail: { routing: patch.routing, ai_boundary: "local_only" } as never,
    });
    return row;
  });

/**
 * Backward-compatible tombstones for old UI bundles. They perform no network
 * request and cannot enable a remote provider.
 */
export const testLovableGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    ok: false as const,
    reason: "Remote AI provider testing has been removed. OCADE AI is local-only.",
    latencyMs: 0,
    setupRequired: true as const,
  }));

export const testOpenAIDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    ok: false as const,
    reason: "Direct remote AI routing has been removed. OCADE AI is local-only.",
    latencyMs: 0,
    setupRequired: true as const,
  }));

export const logProviderEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({
      eventKind: z.enum(["connection_test", "usage", "error", "provider_switch", "bridge_url_set"]),
      provider: z.enum(LOCAL_PROVIDERS),
      model: z.string().max(200).nullable().optional(),
      ok: z.boolean().nullable().optional(),
      latencyMs: z.number().int().nonnegative().nullable().optional(),
      detail: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("ocade_provider_events").insert({
      user_id: context.userId,
      event_kind: data.eventKind,
      provider: data.provider,
      model: data.model ?? null,
      ok: data.ok ?? null,
      latency_ms: data.latencyMs ?? null,
      detail: (data.detail ?? {}) as never,
    });
    return { ok: true as const };
  });

export const getUsageDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: events } = await context.supabase
      .from("ocade_provider_events")
      .select("id, event_kind, provider, model, ok, latency_ms, detail, created_at")
      .in("provider", [...LOCAL_PROVIDERS])
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      assistantMessages: 0,
      byModel: [],
      recentEvents: events ?? [],
      evidence: "Provider diagnostics include local-engine events only; chat bodies are not read here.",
    };
  });
