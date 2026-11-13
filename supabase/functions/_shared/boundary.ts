import { highIncluded } from "./workers-ai.ts";
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
  HIGH_ONLINE_MODEL,
  plannerModel,
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
 * `docs/ARCHITECTURE.md` names all three and makes the second and third OPTIONAL, so the
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
const CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_WORKERS_AI_TOKEN") ?? "";
// Billing eligibility and inference use separately scoped credentials; neither substitutes for the other.
const CF_BILLING_TOKEN = Deno.env.get("CLOUDFLARE_BILLING_READ_TOKEN") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? DEFAULT_ONLINE_MODEL;
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

/*
 * Why the platform ends this worker (its wall clock, CPU or memory limit; Supabase Edge
 * Functions "Background Tasks"): the evidence for a planner turn that was cut off mid-stream
 * (plan.md 19.4, `planner_stream_incomplete`). The platform's own reason word only.
 */
addEventListener("beforeunload", (event) => {
  const reason = (event as unknown as { detail?: { reason?: unknown } }).detail?.reason;
  console.log("ocade.worker_unload", JSON.stringify({ reason: String(reason).slice(0, 40) }));
});

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
    CONFIGURED_SLOTS.length > 0,
  ),
  providerSlots: CONFIGURED_SLOTS,
  quotaReturnsAt: new Map(),
  withoutThinking: new Set(),
  // A real limit the provider named: logged for the operator (ids and numbers only, never a key).
  discoveredLimit(limit) {
    console.log("ocade.provider_limit", JSON.stringify(limit));
  },
  // Why a provider turn failed: model, key slot and an enumerated kind only.
  providerIssue(issue) {
    console.log("ocade.provider_issue", JSON.stringify(issue));
  },
  highAvailable: async (signal) =>
    Boolean(CF_TOKEN) && (await highIncluded(CF_ACCOUNT, CF_BILLING_TOKEN, signal)),
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
  finalizePermit({ userId, permit }) {
    // One use, charged here the moment the answer is complete. The browser's
    // own finalize then finds it settled; its "release" can no longer refund it.
    return settle("ocade_finalize_generation_permit", {
      p_user_id: userId,
      p_idempotency_key: permit.idempotencyKey,
      p_cost_hundredths: 100,
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
  async callProvider({ model, body, signal, slot }) {
    if (model === HIGH_ONLINE_MODEL) {
      // Recheck immediately before every dispatch, including retries. Never trust browser flags.
      if (!CF_TOKEN || !(await highIncluded(CF_ACCOUNT, CF_BILLING_TOKEN, signal))) {
        return new Response(null, { status: 412 });
      }
      return fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/v1/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
          redirect: "error",
        },
      );
    }
    // An allowlisted planner; which one serves is the handler's choice (deps.model).
    if (!plannerModel(model)) return new Response(null, { status: 400 });
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        // The slot the handler chose. The key itself never leaves this file,
        // and never appears in a log line, a response or an error.
        headers: { "Content-Type": "application/json", "x-goog-api-key": PROVIDER_KEYS[slot] },
        body: JSON.stringify(body),
        redirect: "error",
        signal,
      },
    );
  },
};
