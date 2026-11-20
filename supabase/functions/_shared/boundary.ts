import { highIncluded } from "./workers-ai.ts";
import { ANTHROPIC_VERSION } from "../../../src/lib/intelligence/anthropic.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";
import {
  isServiceKey,
  type CustomerRoute,
  type OnlineHandlerDependencies,
} from "../../../src/lib/intelligence/edge-handler.ts";
import { gatewayAddress, resolvesPublic } from "../../../src/lib/intelligence/gateway-address.ts";
import { SERVICE_USER_HEADER } from "../../../src/lib/intelligence/contract.ts";
import { ONLINE_CONSENT_VERSION } from "../../../src/lib/intelligence/online-consent-version.ts";
import { buildHealthRecord } from "../../../src/lib/telemetry/operation-health.ts";
import {
  HIGH_ONLINE_MODEL,
  keySlots,
  plannerKeys,
  plannerModel,
  plannerProvider,
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
 * THE PLANNER'S PROVIDER, MODEL AND KEYS, AND ONLY THE KEYS THAT ARE SET.
 *
 * Any compatible provider and model (`online-models.ts`): `OCADE_MODEL_PROTOCOL`,
 * `OCADE_MODEL_ENDPOINT`, `OCADE_MODEL` and `OCADE_MODEL_API_KEYS`, else the older Gemini
 * secrets. The list is built from what the deployment actually holds: a project with one key
 * must not have failover invented for it. The keys stay in this module and never travel: the
 * handler is told WHICH SLOT to use and nothing more.
 */
const read = (name: string) => Deno.env.get(name);
const PROVIDER = plannerProvider(read);
const KEYS = plannerKeys(read);
const CONFIGURED_SLOTS = keySlots(KEYS.length);
const PROVIDER_KEYS = new Map(CONFIGURED_SLOTS.map((slot, i) => [slot, KEYS[i]!]));

/*
 * THE OWNER'S REGISTERED KEYS (plan 14B.1A.1; migration 20261118090000). Any number, kept in Vault
 * and read through a server-only function for this deployment's provider host and model, at most
 * once a minute. They follow the environment's keys, as slots named `owner:<label>`. A read that
 * fails keeps the last good list; the keys never leave this file.
 */
const REGISTRY_TTL_MS = 60_000;
let registry: { at: number; keys: Map<string, string> } = { at: 0, keys: new Map() };
async function heldSlots(): Promise<string[]> {
  if (PROVIDER && Date.now() - registry.at > REGISTRY_TTL_MS) {
    const answer = await rpc("ocade_owner_model_keys", {
      p_provider_host: new URL(PROVIDER.endpoint).host,
      p_model: plannerModel(PLANNER_MODEL) ?? "",
    }).catch(() => undefined);
    if (Array.isArray(answer)) {
      registry = {
        at: Date.now(),
        keys: new Map(
          (answer as { label: string; secret: string }[])
            .filter((row) => row.secret && !KEYS.includes(row.secret))
            .map((row) => [`owner:${row.label}`, row.secret]),
        ),
      };
    }
  }
  return [...CONFIGURED_SLOTS, ...registry.keys.keys()];
}
const PLANNER_MODEL = read("OCADE_MODEL") ?? read("GEMINI_MODEL");
const CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_WORKERS_AI_TOKEN") ?? "";
// Billing eligibility and inference use separately scoped credentials; neither substitutes for the other.
const CF_BILLING_TOKEN = Deno.env.get("CLOUDFLARE_BILLING_READ_TOKEN") ?? "";
export const allowedOrigins = new Set(
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

/** One provider host and model: what the capability record is kept for. */
function capabilityKey(model: string): string {
  return `${PROVIDER ? new URL(PROVIDER.endpoint).host : "unconfigured"}/${model}`;
}

/** A server-only database function's answer, or undefined when it could not be read. */
async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
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
  return response.ok ? await response.json().catch(() => undefined) : undefined;
}

/*
 * A CUSTOMER'S KEY STAYS IN THIS FILE (plan 14B.1A.5). Read from Vault for one request through a
 * server-only database function, held against the route object the handler is given, and sent only
 * as a header to the customer's own checked address. Never logged, returned or stored elsewhere.
 */
const CUSTOMER_KEYS = new WeakMap<CustomerRoute, { endpoint: string; key: string }>();

interface ByokRow {
  id: string | null;
  enabled: boolean;
  status: string;
  protocol: "gemini" | "openai" | "anthropic" | "responses";
  endpoint: string;
  model: string;
  sees_images: boolean | null;
  secret: string | null;
}

/** The person's connection: the one named, or the one chosen for a surface (null: none chosen). */
export async function customerRoute(
  userId: string,
  connectionId: string | null,
  surface: "chat" | "jarvis" | null,
  /** A JARVIS turn: the source of the task its permit belongs to, else the current choice. */
  turn?: string,
): Promise<CustomerRoute | null> {
  const answer = turn
    ? await rpc("ocade_byok_route_for_turn", { p_user_id: userId, p_idempotency_key: turn })
    : await rpc("ocade_byok_route", {
        p_user_id: userId,
        p_connection_id: connectionId,
        p_surface: surface,
      });
  // Unreadable is not "none chosen": the caller sends nothing rather than guess OCADE's keys.
  if (!Array.isArray(answer)) throw new Error("byok_unavailable");
  const row = answer[0] as ByokRow | undefined;
  if (!row) return null;
  const route: CustomerRoute = {
    id: row.id,
    enabled: row.enabled,
    status: row.status,
    protocol: row.protocol,
    model: row.model,
    seesImages: row.sees_images,
  };
  if (row.secret) CUSTOMER_KEYS.set(route, { endpoint: row.endpoint, key: row.secret });
  return route;
}

/**
 * One request to a customer's own address, after the address and every IP it resolves to are
 * checked (plan 14B.1B.7). Redirects are refused; the platform checks the certificate.
 */
export async function customerFetch(
  route: CustomerRoute,
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  const held = CUSTOMER_KEYS.get(route);
  const address = held ? gatewayAddress(held.endpoint) : null;
  if (!held || !address?.ok) return new Response(null, { status: 421 });
  const resolve = (host: string, type: "A" | "AAAA") => Deno.resolveDns(host, type);
  if (!(await resolvesPublic(address.host, resolve))) return new Response(null, { status: 421 });
  const headers: Record<string, string> =
    route.protocol === "openai" || route.protocol === "responses"
      ? { Authorization: `Bearer ${held.key}` }
      : route.protocol === "anthropic"
        ? { "x-api-key": held.key, "anthropic-version": ANTHROPIC_VERSION }
        : { "x-goog-api-key": held.key };
  return fetch(`${address.url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "error",
    signal,
  });
}

/** The path a model call takes on a provider's API, by protocol. */
export function modelPath(
  protocol: "gemini" | "openai" | "anthropic" | "responses",
  model: string,
  stream: boolean,
): string {
  if (protocol === "anthropic") return "/messages";
  if (protocol === "responses") return "/responses";
  return protocol === "openai"
    ? "/chat/completions"
    : `/models/${encodeURIComponent(model)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
}

/**
 * A server-only database function that must answer: its refusal comes back as the database's
 * own condition (`check_violation`, `no_data_found`), anything else as unavailable.
 */
export async function rpcOrThrow(name: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
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
  if (response.ok) return answer;
  const sqlState = (answer as { code?: string } | undefined)?.code;
  const code =
    sqlState === "23514"
      ? "check_violation"
      : sqlState === "P0002"
        ? "no_data_found"
        : "unavailable";
  throw Object.assign(new Error(code), { code });
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
    SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SERVICE_ROLE_KEY && PROVIDER,
  ),
  providerSlots: CONFIGURED_SLOTS,
  loadProviderSlots: heldSlots,
  quotaReturnsAt: new Map(),
  keyRefusedUntil: new Map(),
  refused: new Map(),
  // Kept per provider host and model, for every instance (20261117090000).
  capabilities: {
    async load(model) {
      const answer = await rpc("ocade_provider_refusals", { p_model: capabilityKey(model) });
      return Array.isArray(answer) ? answer : [];
    },
    async learn(model, feature) {
      await rpc("ocade_learn_provider_refusal", {
        p_model: capabilityKey(model),
        p_feature: feature,
      });
    },
  },
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
  async memories(userId) {
    const answer = await rpc("ocade_memories_for_turn", { p_user_id: userId });
    return Array.isArray(answer) ? answer.filter((item) => typeof item === "string") : [];
  },
  async recordCall(call) {
    await rpc("ocade_record_model_call", {
      p_user_id: call.userId,
      p_surface: call.surface,
      p_source: call.source,
      p_credential: call.credential,
      p_model: call.model,
      p_input_tokens: call.inputTokens,
      p_output_tokens: call.outputTokens,
    });
  },
  byok: {
    route: (userId, surface, permit) =>
      surface === "jarvis"
        ? customerRoute(userId, null, null, permit.idempotencyKey)
        : customerRoute(userId, null, surface),
    async bind(userId, permit, connectionId) {
      const answer = await rpc("ocade_bind_permit_to_customer_key", {
        p_user_id: userId,
        p_idempotency_key: permit.idempotencyKey,
        p_connection_id: connectionId,
      });
      return answer === true;
    },
    async record(userId, connectionId, status) {
      await rpc("ocade_byok_record", {
        p_user_id: userId,
        p_connection_id: connectionId,
        p_status: status,
        p_sees_images: null,
        p_calls_tools: null,
      });
    },
  },
  model: PLANNER_MODEL,
  protocol: PROVIDER?.protocol,
  // OCADE_MODEL_VISION=yes|no: whether the model takes images; unset, the protocol decides.
  vision: { yes: true, no: false }[Deno.env.get("OCADE_MODEL_VISION")?.trim() ?? ""],
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
  async callProvider({ model, body, signal, slot, customer }) {
    // The customer's own connection: only its key, only its checked address (421: refused there).
    if (customer) {
      if (!plannerModel(model)) return new Response(null, { status: 400 });
      return customerFetch(customer, modelPath(customer.protocol, model, true), body, signal);
    }
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
    // The configured planner; which model serves is the handler's choice (deps.model).
    const key = PROVIDER_KEYS.get(slot) ?? registry.keys.get(slot);
    if (!PROVIDER || !key || !plannerModel(model)) return new Response(null, { status: 400 });
    // The slot the handler chose. The key itself never leaves this file, and never appears in a
    // log line, a response or an error.
    const [url, headers] =
      PROVIDER.protocol === "openai"
        ? [`${PROVIDER.endpoint}/chat/completions`, { Authorization: `Bearer ${key}` }]
        : PROVIDER.protocol === "responses"
          ? [`${PROVIDER.endpoint}/responses`, { Authorization: `Bearer ${key}` }]
          : PROVIDER.protocol === "anthropic"
            ? [
                `${PROVIDER.endpoint}/messages`,
                { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION },
              ]
            : [
                `${PROVIDER.endpoint}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
                { "x-goog-api-key": key },
              ];
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      redirect: "error",
      signal,
    });
  },
};
