/**
 * OCADE provider server functions — preferences, connection tests, diagnostics.
 *
 * Secrets never cross the client boundary: OPENAI_API_KEY is read only inside
 * handler bodies from process.env. Ollama local bridge tests happen in the
 * browser (the local URL is unreachable from the server); the browser calls
 * logProviderEvent to persist the diagnostic result.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROVIDERS = ["lovable_gateway", "openai_direct", "ollama_local", "caera_native"] as const;

const prefsInput = z.object({
  routing: z.enum(["auto", ...PROVIDERS]).optional(),
  privacyPref: z.enum(["local_first", "balanced", "cloud_ok"]).optional(),
  costPref: z.enum(["cheapest", "balanced", "best_quality"]).optional(),
  speedPref: z.enum(["fastest", "balanced", "best_quality"]).optional(),
  visionRequired: z.boolean().optional(),
  sessionOverrideModel: z.string().max(200).nullable().optional(),
  ollamaBridgeUrl: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .refine(
      (v) =>
        !v || /^https?:\/\/(localhost|127\.0\.0\.1|[0-9.]+|[a-zA-Z0-9.-]+)(:\d+)?(\/.*)?$/.test(v),
      { message: "Bridge URL must be http(s)://host[:port]" },
    ),
  openaiDirectEnabled: z.boolean().optional(),
});

export const getProviderPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ocade_provider_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data) return data;
    // Ensure a row exists so the UI has stable defaults.
    const { data: created } = await context.supabase
      .from("ocade_provider_prefs")
      .insert({ user_id: context.userId })
      .select("*")
      .single();
    return created;
  });

export const saveProviderPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => prefsInput.parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { user_id: context.userId };
    if (data.routing !== undefined) patch.routing = data.routing;
    if (data.privacyPref !== undefined) patch.privacy_pref = data.privacyPref;
    if (data.costPref !== undefined) patch.cost_pref = data.costPref;
    if (data.speedPref !== undefined) patch.speed_pref = data.speedPref;
    if (data.visionRequired !== undefined) patch.vision_required = data.visionRequired;
    if (data.sessionOverrideModel !== undefined)
      patch.session_override_model = data.sessionOverrideModel;
    if (data.ollamaBridgeUrl !== undefined) patch.ollama_bridge_url = data.ollamaBridgeUrl;
    if (data.openaiDirectEnabled !== undefined)
      patch.openai_direct_enabled = data.openaiDirectEnabled;
    const { error, data: row } = await context.supabase
      .from("ocade_provider_prefs")
      .upsert(patch as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    // Provider-switch is auditable operational activity.
    if (data.routing !== undefined) {
      await context.supabase.from("ocade_provider_events").insert({
        user_id: context.userId,
        event_kind: "provider_switch",
        provider: data.routing,
        detail: { routing: data.routing } as never,
      });
    }
    if (data.ollamaBridgeUrl !== undefined) {
      await context.supabase.from("ocade_provider_events").insert({
        user_id: context.userId,
        event_kind: "bridge_url_set",
        provider: "ollama_local",
        detail: { has_url: !!data.ollamaBridgeUrl } as never,
      });
    }
    return row;
  });

/* -------------------- Connection tests -------------------- */

/** Test Lovable AI Gateway with a minimal server-side call. */
export const testLovableGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      await recordEvent(
        context.supabase,
        context.userId,
        "connection_test",
        "lovable_gateway",
        null,
        false,
        0,
        {
          reason: "missing_key",
        },
      );
      return { ok: false as const, reason: "LOVABLE_API_KEY is not configured.", latencyMs: 0 };
    }
    const started = Date.now();
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/models", {
        headers: { "Lovable-API-Key": key },
      });
      const latencyMs = Date.now() - started;
      const ok = res.ok;
      const bodySnippet = ok ? "" : (await res.text()).slice(0, 300);
      await recordEvent(
        context.supabase,
        context.userId,
        "connection_test",
        "lovable_gateway",
        null,
        ok,
        latencyMs,
        {
          status: res.status,
          body: bodySnippet,
        },
      );
      return {
        ok,
        latencyMs,
        status: res.status,
        reason: ok ? "Gateway reachable." : `HTTP ${res.status}: ${bodySnippet}`,
      };
    } catch (e) {
      const latencyMs = Date.now() - started;
      const reason = e instanceof Error ? e.message : String(e);
      await recordEvent(
        context.supabase,
        context.userId,
        "connection_test",
        "lovable_gateway",
        null,
        false,
        latencyMs,
        {
          error: reason,
        },
      );
      return { ok: false as const, latencyMs, reason };
    }
  });

/** Test OpenAI direct — never returns the key, only status. */
export const testOpenAIDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      await recordEvent(
        context.supabase,
        context.userId,
        "connection_test",
        "openai_direct",
        null,
        false,
        0,
        {
          reason: "missing_key",
        },
      );
      return {
        ok: false as const,
        reason:
          "OPENAI_API_KEY is not configured. Add it in project secrets to enable OpenAI Direct.",
        latencyMs: 0,
        setupRequired: true as const,
      };
    }
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - started;
      const ok = res.ok;
      const bodySnippet = ok ? "" : (await res.text()).slice(0, 300);
      await recordEvent(
        context.supabase,
        context.userId,
        "connection_test",
        "openai_direct",
        null,
        ok,
        latencyMs,
        {
          status: res.status,
          body: bodySnippet,
        },
      );
      let modelCount = 0;
      if (ok) {
        try {
          const j = (await res.json()) as { data?: unknown[] };
          modelCount = Array.isArray(j.data) ? j.data.length : 0;
        } catch {
          /* ignore */
        }
      }
      return {
        ok,
        latencyMs,
        status: res.status,
        modelCount,
        reason: ok
          ? `OpenAI reachable. ${modelCount} models available.`
          : `HTTP ${res.status}: ${bodySnippet}`,
      };
    } catch (e) {
      const latencyMs = Date.now() - started;
      const reason = e instanceof Error ? e.message : String(e);
      await recordEvent(
        context.supabase,
        context.userId,
        "connection_test",
        "openai_direct",
        null,
        false,
        latencyMs,
        {
          error: reason,
        },
      );
      return { ok: false as const, latencyMs, reason };
    }
  });

/** Record a diagnostic event (used by client-side Ollama tests). */
export const logProviderEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        eventKind: z.enum([
          "connection_test",
          "usage",
          "error",
          "provider_switch",
          "bridge_url_set",
        ]),
        provider: z.enum(PROVIDERS),
        model: z.string().max(200).nullable().optional(),
        ok: z.boolean().nullable().optional(),
        latencyMs: z.number().int().nonnegative().nullable().optional(),
        detail: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(i),
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

/** Aggregate usage + recent errors for the diagnostics panel. */
export const getUsageDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: usage }, { data: events }] = await Promise.all([
      context.supabase
        .from("ocade_messages")
        .select("model_id, provider_id, created_at")
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(500),
      context.supabase
        .from("ocade_provider_events")
        .select("id, event_kind, provider, model, ok, latency_ms, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const byModel = new Map<string, number>();
    for (const m of usage ?? []) {
      const key = String(m.model_id ?? "unknown");
      byModel.set(key, (byModel.get(key) ?? 0) + 1);
    }
    return {
      assistantMessages: usage?.length ?? 0,
      byModel: Array.from(byModel.entries()).map(([model, count]) => ({ model, count })),
      recentEvents: events ?? [],
    };
  });

async function recordEvent(
  supabase: unknown,
  userId: string,
  eventKind: string,
  provider: string,
  model: string | null,
  ok: boolean,
  latencyMs: number,
  detail: Record<string, unknown>,
) {
  const sb = supabase as {
    from: (t: string) => { insert: (r: Record<string, unknown>) => Promise<unknown> };
  };
  await sb.from("ocade_provider_events").insert({
    user_id: userId,
    event_kind: eventKind,
    provider,
    model,
    ok,
    latency_ms: latencyMs,
    detail,
  });
}
