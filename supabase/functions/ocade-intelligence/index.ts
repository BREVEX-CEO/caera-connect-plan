import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import { handleOnlineIntelligence } from "../../../src/lib/intelligence/edge-handler.ts";
import {
  DEFAULT_ONLINE_MODEL,
  PROVIDER_KEY_ENVIRONMENT,
  PROVIDER_KEY_SLOTS,
  type ProviderKeySlot,
} from "../../../src/lib/intelligence/online-models.ts";

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
/*
 * EXACTLY THREE KEY SLOTS, AND ONLY THE ONES THAT ARE SET.
 *
 * `docs/TRD.md` names all three and makes the second and third OPTIONAL, so the
 * list is built from what the deployment actually holds: a project with one key
 * must not have failover invented for it, and a project with three must not
 * have the third ignored. The keys stay in this module and never travel — the
 * handler is told WHICH SLOT to use and nothing more, so the policy lives in
 * one tested place and the secrets live in none of it.
 *
 * THREE NAMES, AND NO FOURTH. `PLAN.md` Phase 6 says "exactly three Supabase
 * Edge Function secrets", so the unprefixed `GEMINI_API_KEY` alias an earlier
 * deployment set is no longer read. A fourth accepted name is a fourth place a
 * key can be set, and the one nobody rotates.
 */
const PROVIDER_KEYS: Record<ProviderKeySlot, string> = {
  primary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.primary) ?? "",
  secondary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.secondary) ?? "",
  tertiary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.tertiary) ?? "",
};
const CONFIGURED_SLOTS = PROVIDER_KEY_SLOTS.filter((slot) => PROVIDER_KEYS[slot].length > 0);
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? DEFAULT_ONLINE_MODEL;
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
      SUPABASE_URL &&
      SUPABASE_PUBLISHABLE_KEY &&
      SUPABASE_SERVICE_ROLE_KEY &&
      CONFIGURED_SLOTS.length > 0,
    ),
    providerSlots: CONFIGURED_SLOTS,
    /*
     * One structured health line per request -- PLAN.md Phase 16.
     *
     * `console.log` is the Edge Function's log, which is where an operator
     * already looks and which Supabase already retains; adding a logging
     * service here would be a second place to leak from for no extra answer.
     * The record is built by `operation-health.ts` and carries enumerated
     * values only: no prompt, no key, no user id, no message. `ocade.health`
     * is the prefix to query on.
     */
    observe: (record) => console.log("ocade.health", JSON.stringify(record)),
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
    callProvider({ model, body, signal, slot }) {
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          // The slot the handler chose. The key itself never leaves this file,
          // and never appears in a log line, a response or an error.
          headers: { "Content-Type": "application/json", "x-goog-api-key": PROVIDER_KEYS[slot] },
          body: JSON.stringify(body),
          signal,
        },
      );
    },
  }),
);
