import { cloudflareProviderRequest } from "./gateway.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import {
  isServiceKey,
  type OnlineHandlerDependencies,
} from "../../../src/lib/intelligence/edge-handler.ts";
import { SERVICE_USER_HEADER } from "../../../src/lib/intelligence/contract.ts";
import { ONLINE_CONSENT_VERSION } from "../../../src/lib/intelligence/online-consent-version.ts";
import { buildHealthRecord } from "../../../src/lib/telemetry/operation-health.ts";
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
/** Exactly three Google credential slots, read only in this server entry point.
 * The handler receives slot names, not credentials. The server-only gateway helper
 * builds their authenticated request; neither credentials nor payloads are logged.
 * A missing slot is not invented. The legacy unprefixed alias is not accepted.
 * Gateway authentication uses its separate, narrowly scoped server token.
 */
const PROVIDER_KEYS: Record<ProviderKeySlot, string> = {
  primary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.primary) ?? "",
  secondary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.secondary) ?? "",
  tertiary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.tertiary) ?? "",
};
const CONFIGURED_SLOTS = PROVIDER_KEY_SLOTS.filter((slot) => PROVIDER_KEYS[slot].length > 0);
// Legacy explicit model override remains pinned; omit it to use the owner's new route.
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? DEFAULT_ONLINE_MODEL;
const GATEWAY = {
  accountId: Deno.env.get("OCADE_AI_GATEWAY_ACCOUNT_ID") ?? "",
  gatewayId: Deno.env.get("OCADE_AI_GATEWAY_ID") ?? "",
  token: Deno.env.get("OCADE_AI_GATEWAY_TOKEN") ?? "",
};
const GATEWAY_READY =
  cloudflareProviderRequest({
    ...GATEWAY,
    key: "configuration-check",
    model: GEMINI_MODEL,
    body: {},
    signal: new AbortController().signal,
  }) !== null;
const allowedOrigins = new Set(
  (Deno.env.get("OCADE_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

/** Every OCADE server key this project holds: the door for OCADE's own server checks against these. */
const SERVICE_KEYS = [
  ...Object.values(
    (() => {
      try {
        return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    })(),
  ).filter((value): value is string => typeof value === "string"),
  Deno.env.get("SUPABASE_SECRET_KEY") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
].filter(Boolean);

/**
 * Settle a claimed permit and know that it was settled: the database must answer, a transport
 * failure or 5xx is retried twice, and a settlement that still did not land is recorded as a
 * failed `usage_settlement` for the operator instead of passing as done.
 */
async function settle(rpc: string, body: Record<string, unknown>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          ...(!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")
            ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
            : {}),
        },
        body: JSON.stringify(body),
      });
      const answer = await response.json().catch(() => undefined);
      if (response.ok && answer !== undefined) return;
      if (response.status < 500) break; // refused for a reason a retry does not change
    } catch {
      // transport: tried again below
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  observe(
    buildHealthRecord({
      component: "edge_function",
      operation: "usage_settlement",
      outcome: "failed",
      errorClass: "upstream",
      durationMs: 0,
      providerSlot: "none",
      attempts: 3,
    }),
  );
}

/*
 * One structured health line per event -- PLAN.md Phase 16.
 *
 * `console.log` is the Edge Function's log, which is where an operator
 * already looks and which Supabase already retains; adding a logging
 * service here would be a second place to leak from for no extra answer.
 * The record is built by `operation-health.ts` and carries enumerated
 * values only: no prompt, no key, no user id, no message. `ocade.health`
 * is the prefix to query on.
 */
function observe(record: ReturnType<typeof buildHealthRecord>): void {
  console.log("ocade.health", JSON.stringify(record));
}

/** A signed-in person's session, asked of Supabase Auth itself. */
export async function verifyUserJwt(token: string): Promise<{ userId: string } | null> {
  const auth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await auth.auth.getUser(token);
  return error || !data.user ? null : { userId: data.user.id };
}

/** OCADE's own server, naming the person it works for. Only a holder of a server key passes. */
export async function verifyOcadeServer(request: Request): Promise<{ userId: string } | null> {
  const userId = request.headers.get(SERVICE_USER_HEADER) ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  return (await isServiceKey(request.headers.get("apikey"), SERVICE_KEYS)) ? { userId } : null;
}

/** Everything both functions share; each adds only how its caller proves who they are. */
export const boundary: Omit<OnlineHandlerDependencies, "verifyJwt" | "verifyService"> = {
  allowedOrigins,
  providerReady: Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_SERVICE_ROLE_KEY &&
    CONFIGURED_SLOTS.length > 0 &&
    GATEWAY_READY,
  ),
  providerSlots: CONFIGURED_SLOTS,
  observe,
  model: GEMINI_MODEL,
  async consented(userId) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=online_ai_consent_at,online_ai_consent_version`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          ...(!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")
            ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
            : {}),
        },
      },
    );
    // Unreadable is not agreed: nothing is sent on a guess.
    if (!response.ok) return false;
    const rows = (await response.json().catch(() => [])) as {
      online_ai_consent_at?: string;
      online_ai_consent_version?: string;
    }[];
    // Agreed to the words shown now: a new version of them is asked again.
    return (
      Boolean(rows[0]?.online_ai_consent_at) &&
      rows[0]?.online_ai_consent_version === ONLINE_CONSENT_VERSION
    );
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
  finalizePermit({ userId, permit, startsTask }) {
    // One use, charged here the moment the answer is complete. The browser's
    // own finalize then finds it settled; its "release" can no longer refund it.
    // A JARVIS reply that starts a task is part of that task, whose one use is
    // charged only when it completes (20261013090000).
    return settle("ocade_finalize_generation_permit", {
      p_user_id: userId,
      p_idempotency_key: permit.idempotencyKey,
      p_cost_hundredths: startsTask && permit.surface === "jarvis" ? 0 : 100,
    });
  },
  releasePermit({ userId, permit }) {
    // Only this boundary may give back a permit it claimed (20261001094000).
    return settle("ocade_release_generation_permit", {
      p_user_id: userId,
      p_idempotency_key: permit.idempotencyKey,
      p_reason: "transport_ended_without_output",
    });
  },
  callProvider({ model, body, signal, slot }) {
    const request = cloudflareProviderRequest({
      ...GATEWAY,
      model,
      body,
      signal,
      key: PROVIDER_KEYS[slot],
    });
    if (!request) return Promise.resolve(new Response(null, { status: 503 }));
    return fetch(request);
  },
};
