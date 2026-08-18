/**
 * OCADE local-provider metadata functions.
 *
 * AI inference is local-only. This module never reads an AI-provider API key,
 * never forwards a prompt and never calls a public AI endpoint. Supabase is
 * used only for authenticated local-engine preference/audit metadata.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOCAL_PROVIDERS = ["local_runtime", "ollama_local"] as const;

function isPrivateBridgeUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return true;
    }
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    const m = host.match(/^172\.(\d{1,3})\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
    return false;
  } catch {
    return false;
  }
}

const prefsInput = z.object({
  routing: z.enum(["auto", "local_only", ...LOCAL_PROVIDERS]).optional(),
  ollamaBridgeUrl: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .refine(isPrivateBridgeUrl, { message: "Local bridge URL must use loopback or a private LAN host." }),
});

export const getProviderPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ocade_provider_prefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    if (!data) return null;
    return {
      ...data,
      routing: data.routing === "ollama_local" ? "ollama_local" : "local_only",
      session_override_model: null,
      openai_direct_enabled: false,
    };
  });

export const saveProviderPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => prefsInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch = {
      user_id: context.userId,
      routing: data.routing === "ollama_local" ? "ollama_local" : "local_only",
      session_override_model: null,
      openai_direct_enabled: false,
      ...(data.ollamaBridgeUrl !== undefined ? { ollama_bridge_url: data.ollamaBridgeUrl } : {}),
    };
    const { data: row, error } = await context.supabase
      .from("ocade_provider_prefs")
      .upsert(patch as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row;
  });

export const logProviderEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        eventKind: z.enum(["connection_test", "usage", "error", "provider_switch", "bridge_url_set"]),
        provider: z.enum(LOCAL_PROVIDERS),
        model: z.string().max(200).nullable().optional(),
        ok: z.boolean().nullable().optional(),
        latencyMs: z.number().int().nonnegative().nullable().optional(),
        detail: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ocade_provider_events").insert({
      user_id: context.userId,
      event_kind: data.eventKind,
      provider: data.provider,
      model: data.model ?? null,
      ok: data.ok ?? null,
      latency_ms: data.latencyMs ?? null,
      detail: (data.detail ?? {}) as never,
    });
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const getUsageDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: events, error } = await context.supabase
      .from("ocade_provider_events")
      .select("id, event_kind, provider, model, ok, latency_ms, detail, created_at")
      .in("provider", [...LOCAL_PROVIDERS])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Response(error.message, { status: 500 });
    return {
      assistantMessages: 0,
      byModel: [],
      recentEvents: events ?? [],
      evidence: "Local-engine diagnostics only; chat bodies are not read here.",
    };
  });
