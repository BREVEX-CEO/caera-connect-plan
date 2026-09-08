import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { handleOnlineIntelligence } from "../../../src/lib/intelligence/edge-handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function namedPlatformKey(pluralName: string): string {
  const encoded = Deno.env.get(pluralName);
  if (!encoded) return "";
  try {
    const values = JSON.parse(encoded) as Record<string, unknown>;
    return typeof values.default === "string" ? values.default : "";
  } catch {
    return "";
  }
}

// Hosted projects expose the plural JSON variables for the current key model;
// local/legacy projects expose the JWT-based singular variables. Supporting
// both here keeps the function portable without ever putting either key in a
// browser bundle or source-controlled fallback.
const SUPABASE_PUBLISHABLE_KEY =
  namedPlatformKey("SUPABASE_PUBLISHABLE_KEYS") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  namedPlatformKey("SUPABASE_SECRET_KEYS") ||
  Deno.env.get("SUPABASE_SECRET_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.7-flash";
const allowedOrigins = new Set(
  (Deno.env.get("OCADE_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

Deno.serve((request) =>
  handleOnlineIntelligence(request, {
    allowedOrigins,
    providerReady: Boolean(
      SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SERVICE_ROLE_KEY && GEMINI_API_KEY,
    ),
    model: GEMINI_MODEL,
    async verifyJwt(token) {
      const auth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await auth.auth.getUser(token);
      return error || !data.user ? null : { userId: data.user.id };
    },
    async claimPermit({ userId, permit }) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ocade_claim_generation_transport`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          // New sb_secret keys must not be presented as bearer JWTs. Legacy
          // service-role JWTs still require the header on older projects.
          ...(!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")
            ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_permit_id: permit.id,
          p_generation_id: permit.generationId,
          p_idempotency_key: permit.idempotencyKey,
          p_surface: permit.surface,
        }),
      });
      if (!response.ok) {
        return {
          ok: false as const,
          reason: "The generation permit could not be verified.",
        };
      }
      const value = await response.json().catch(() => false);
      return value === true
        ? { ok: true as const }
        : {
            ok: false as const,
            reason: "The generation permit is invalid or was already used.",
          };
    },
    callProvider({ model, body, signal }) {
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify(body),
          signal,
        },
      );
    },
  }),
);
