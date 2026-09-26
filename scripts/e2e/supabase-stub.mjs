/**
 * A Supabase-shaped server on loopback, so the signed-in product can be proved
 * in a real browser.
 *
 * WHY IT EXISTS. The signed-in half of OCADE — Chat, history, the allowance,
 * Settings — cannot be exercised at all without a session, and this sandbox
 * has no egress to the hosted project. Without it, every browser proof would
 * stop at the sign-in screen.
 *
 * WHAT IT IS GOOD FOR: the application's own wiring. A person sends a message,
 * a permit is taken, a row is written, a reload reads it back, and the screen
 * reflects it. Every link of that chain is OCADE's, and every one of them is
 * real here.
 *
 * WHAT IT MUST NEVER BE READ AS:
 *
 *   - ROW-LEVEL SECURITY. Nothing here enforces a policy. RLS is proven
 *     against real PostgreSQL with the policies applied, in the database
 *     tests.
 *   - THE LEDGER'S CONCURRENCY. The allowance arithmetic is mirrored, not the
 *     locking. Two devices racing for the last use is a PostgreSQL question
 *     and is answered there.
 *   - THE PROVIDER. It models the Edge Function's SSE shape so the online path
 *     can be driven end to end; it is not Gemini, and an answer from it proves
 *     transport, not intelligence.
 *
 * It replaces a 2,075-line donor stub that modelled organizations, support
 * articles, status incidents and conversation sharing — products that no
 * longer exist.
 *
 * Usage: node scripts/e2e/supabase-stub.mjs [port]
 */
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const PORT = Number(process.argv[2] ?? 54321);

/** Active devices per kind, per account — the same two the trigger enforces. */
const DEVICE_CAP = 2;

/* ----------------------------------------------------------------- state -- */

/** tables[userId] = { tableName: rows[] }. One account, one set of rows. */
const tables = new Map();
/** accessToken -> userId */
const sessions = new Map();
/** userId -> email */
const emails = new Map();

function idForEmail(address) {
  // Derived rather than random, so the same address is the same account across
  // a restart — which is what somebody signing back in expects.
  const digest = createHash("sha256").update(address.toLowerCase()).digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

function tablesFor(userId) {
  if (!tables.has(userId)) tables.set(userId, {});
  return tables.get(userId);
}

function rows(userId, name) {
  const owned = tablesFor(userId);
  owned[name] ??= [];
  return owned[name];
}

function userRecord(id, email) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email,
    phone: "",
    email_confirmed_at: new Date(0).toISOString(),
    confirmed_at: new Date(0).toISOString(),
    created_at: new Date(0).toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
  };
}

/**
 * A JWT-SHAPED access token, because the server middleware refuses anything
 * else before it ever reaches this stub.
 *
 * Three base64url segments with a real `sub`, and a signature that is not one:
 * nothing here verifies it, and nothing here should be mistaken for something
 * that does. The middleware's own check — three segments, then ask the auth
 * server who this is — is what the shape exists to satisfy.
 */
function shapedJwt(userId, email) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: userId,
    email,
    role: "authenticated",
    aud: "authenticated",
    aal: "aal1",
    // Real tokens carry this, and Advanced reads it to tell "this device" from
    // the others. Without it every session looks like somebody else's.
    session_id: "session-current",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.stub-signature-not-a-signature`;
}

function openSession(email) {
  const id = idForEmail(email);
  emails.set(id, email);
  const accessToken = shapedJwt(id, email);
  sessions.set(accessToken, id);
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `stub-refresh-${randomUUID()}`,
    user: userRecord(id, email),
  };
}

/** The account this request is acting for. Service-role calls name it in args. */
function callerFrom(request, body) {
  const header = request.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (sessions.has(token)) return sessions.get(token);
  try {
    const parsed = JSON.parse(body || "{}");
    if (typeof parsed.p_user_id === "string") return parsed.p_user_id;
  } catch {
    /* Not a JSON body; fall through. */
  }
  return null;
}

/* ------------------------------------------------------------- PostgREST -- */

/** Numbers compare as numbers; timestamps and text compare as their ISO/text order. */
function compare(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

const OPERATORS = {
  eq: (a, b) => String(a) === b,
  neq: (a, b) => String(a) !== b,
  gt: (a, b) => a !== null && a !== undefined && compare(a, b) > 0,
  gte: (a, b) => a !== null && a !== undefined && compare(a, b) >= 0,
  lt: (a, b) => a !== null && a !== undefined && compare(a, b) < 0,
  lte: (a, b) => a !== null && a !== undefined && compare(a, b) <= 0,
  is: (a, b) => (b === "null" ? a === null || a === undefined : String(a) === b),
  in: (a, b) =>
    b
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((value) => value.replace(/^"|"$/g, ""))
      .includes(String(a)),
  not: () => true,
};

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns", "count"].includes(key)) {
      continue;
    }
    const [operator, ...rest] = raw.split(".");
    const value = rest.join(".");
    if (operator === "not") {
      // `not.is.null` is the only negation the product uses.
      const [inner, innerValue] = rest;
      if (
        inner === "is" &&
        innerValue === "null" &&
        (row[key] === null || row[key] === undefined)
      ) {
        return false;
      }
      continue;
    }
    const test = OPERATORS[operator];
    if (!test) continue;
    if (!test(row[key], value)) return false;
  }
  return true;
}

function project(row, select) {
  if (!select || select === "*") return row;
  const columns = select
    .split(",")
    .map((entry) => entry.trim().split("(")[0].trim())
    .filter(Boolean);
  const out = {};
  for (const column of columns) out[column] = row[column] ?? null;
  return out;
}

function applyOrder(list, order) {
  if (!order) return list;
  const [column, direction] = order.split(".");
  const ascending = direction !== "desc";
  return [...list].sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (left === right) return 0;
    return (left > right ? 1 : -1) * (ascending ? 1 : -1);
  });
}

/* --------------------------------------------------------------- the RPCs -- */

/** The session window: six hours twenty-eight minutes, as the policy says. */
const SESSION_WINDOW_MS = (6 * 60 + 28) * 60 * 1000;

function windowFor(kind, now) {
  const length = kind === "session" ? SESSION_WINDOW_MS : 7 * 24 * 60 * 60 * 1000;
  const startsAt = Math.floor(now / length) * length;
  return { startsAt, endsAt: startsAt + length };
}

function usageRows(userId) {
  return rows(userId, "__usage");
}

function usedIn(userId, kind, startsAt) {
  const row = usageRows(userId).find((entry) => entry.kind === kind && entry.startsAt === startsAt);
  return row?.usedHundredths ?? 0;
}

function addUsage(userId, kind, startsAt, hundredths) {
  const list = usageRows(userId);
  const row = list.find((entry) => entry.kind === kind && entry.startsAt === startsAt);
  if (row) row.usedHundredths = Math.max(0, row.usedHundredths + hundredths);
  else list.push({ kind, startsAt, usedHundredths: Math.max(0, hundredths) });
}

/** Each surface spends its own windows, as the migration's window kinds do. */
const kindFor = (surface, kind) => (surface === "jarvis" ? `jarvis_${kind}` : kind);

function handleRpc(name, args, userId) {
  const now = Date.now();
  const session = windowFor("session", now);
  const week = windowFor("week", now);

  switch (name) {
    case "ocade_delete_all_library_items": {
      const held = rows(userId, "ocade_library_items");
      const removed = held.length;
      for (const row of held) objects.delete(row.storage_path);
      tablesFor(userId).ocade_library_items = [];
      return removed;
    }

    case "ocade_delete_messages_from": {
      /*
       * Edit, Regenerate and Retry drop a question and every turn after it, and
       * the browser used to do that with one delete call per row. One statement
       * replaced them, so a stub that only answered table writes would leave
       * every edit refusing itself — which is exactly what it did, and the
       * journey caught it.
       *
       * Modelled as the database does it: the caller's own rows, this
       * conversation, at or after the moment.
       */
      const held = rows(userId, "ocade_messages");
      const from = Date.parse(args.p_from);
      const keep = held.filter(
        (row) =>
          !(row.conversation_id === args.p_conversation_id && Date.parse(row.created_at) >= from),
      );
      tablesFor(userId).ocade_messages = keep;
      return held.length - keep.length;
    }

    case "register_browser_device_for_current_user": {
      /*
       * The one transactional registration, modelled the way the database does
       * it. The browser no longer inserts a device and a grant itself, so a
       * stub that still only answered table writes would leave every offline
       * proof registering nothing and meeting a refusal it could not explain.
       *
       * Three behaviours matter here and all three are the product's: an
       * existing grant returns its device, a revoked one returns null and is
       * NOT re-admitted, and the cap refuses with 23514 before anything is
       * written — which is what the browser turns into "this account already
       * answers offline on as many devices as it allows".
       */
      const devices = rows(userId, "devices");
      const grants = rows(userId, "browser_grants");
      const install = args._browser_install_id;
      const existing = [...grants].reverse().find((grant) => grant.browser_install_id === install);
      if (existing) {
        const device = devices.find((candidate) => candidate.id === existing.device_id);
        if (existing.revoked_at || !device || device.revoked_at) return null;
        device.last_active_at = new Date().toISOString();
        existing.last_seen_at = device.last_active_at;
        return device.id;
      }
      const active = devices.filter(
        (candidate) => candidate.kind === args._kind && !candidate.revoked_at,
      );
      if (active.length >= DEVICE_CAP) {
        return {
          __error: {
            code: "23514",
            message: `Device cap reached for kind ${args._kind}: maximum ${DEVICE_CAP} active per account.`,
          },
        };
      }
      const created = {
        id: crypto.randomUUID(),
        user_id: userId,
        kind: args._kind,
        name: args._name,
        user_agent: args._user_agent,
        last_active_at: new Date().toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
      };
      devices.push(created);
      grants.push({
        id: crypto.randomUUID(),
        user_id: userId,
        device_id: created.id,
        browser_install_id: install,
        origin: args._origin,
        user_agent: args._user_agent,
        revoked_at: null,
        created_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
      return created.id;
    }

    case "revoke_device_for_current_user": {
      const devices = rows(userId, "devices");
      const device = devices.find((candidate) => candidate.id === args._device_id);
      if (!device) return false;
      const at = new Date().toISOString();
      device.revoked_at = device.revoked_at ?? at;
      for (const grant of rows(userId, "browser_grants")) {
        if (grant.device_id === device.id) grant.revoked_at = grant.revoked_at ?? at;
      }
      return true;
    }

    case "ocade_active_entitlement_grant":
    case "ocade_my_entitlement_grant":
      // No grant: the account is on Free, which is what the allowance tests want.
      return null;

    case "ocade_read_commercial_usage":
      return [
        {
          window_kind: "session",
          window_start: new Date(session.startsAt).toISOString(),
          reset_at: new Date(session.endsAt).toISOString(),
          used_hundredths: usedIn(userId, kindFor(args.p_surface, "session"), session.startsAt),
          reserved_hundredths: 0,
        },
        {
          window_kind: "week",
          window_start: new Date(week.startsAt).toISOString(),
          reset_at: new Date(week.endsAt).toISOString(),
          used_hundredths: usedIn(userId, kindFor(args.p_surface, "week"), week.startsAt),
          reserved_hundredths: 0,
        },
      ];

    case "jarvis_purge_expired_activity": {
      const cutoff = now - 90 * 24 * 60 * 60 * 1000;
      const before = (jarvisTables.jarvis_activity ?? []).length;
      jarvisTables.jarvis_activity = (jarvisTables.jarvis_activity ?? []).filter(
        (row) => row.user_id !== args.p_user_id || Date.parse(row.created_at) >= cutoff,
      );
      for (const task of jarvisTables.jarvis_tasks ?? []) {
        if (task.user_id === args.p_user_id && Date.parse(task.updated_at) < now - 3_600_000) {
          task.live_frame = null;
        }
      }
      return before - jarvisTables.jarvis_activity.length;
    }

    case "ocade_read_offline_usage":
      return [];

    case "ocade_expire_commercial_permits":
      return 0;

    case "ocade_acquire_generation_permit": {
      const permits = rows(userId, "__permits");
      const existing = permits.find((permit) => permit.idempotencyKey === args.p_idempotency_key);
      if (existing) {
        return [
          {
            permit_id: existing.id,
            outcome: existing.settled ? "duplicate_completed" : "granted",
            reserved_hundredths: existing.reserved,
            session_reset_at: new Date(session.endsAt).toISOString(),
            week_reset_at: new Date(week.endsAt).toISOString(),
          },
        ];
      }

      const reserved = Number(args.p_reserved_hundredths) || 0;
      const sessionLimit = args.p_session_limit_hundredths;
      const surface = args.p_surface;
      const used = usedIn(userId, kindFor(surface, "session"), session.startsAt);
      if (sessionLimit !== null && sessionLimit !== undefined && used + reserved > sessionLimit) {
        return [
          {
            permit_id: null,
            outcome: "session_exhausted",
            reserved_hundredths: 0,
            session_reset_at: new Date(session.endsAt).toISOString(),
            week_reset_at: new Date(week.endsAt).toISOString(),
          },
        ];
      }

      const permit = {
        id: randomUUID(),
        idempotencyKey: args.p_idempotency_key,
        reserved,
        // The tier is stored at acquire because finalize prices by it, exactly
        // as the migration does.
        tier: args.p_tier,
        surface,
        settled: false,
      };
      permits.push(permit);
      addUsage(userId, kindFor(surface, "session"), session.startsAt, reserved);
      addUsage(userId, kindFor(surface, "week"), week.startsAt, reserved);
      return [
        {
          permit_id: permit.id,
          outcome: "granted",
          reserved_hundredths: reserved,
          session_reset_at: new Date(session.endsAt).toISOString(),
          week_reset_at: new Date(week.endsAt).toISOString(),
        },
      ];
    }

    case "ocade_claim_generation_transport":
      return true;

    case "ocade_finalize_generation_permit": {
      const permit = rows(userId, "__permits").find(
        (entry) => entry.idempotencyKey === args.p_idempotency_key,
      );
      if (!permit) return [{ outcome: "missing", charged_hundredths: 0 }];
      /*
       * FREE IS EXACTLY ONE USE, CLAMPED HERE AS THE MIGRATION CLAMPS IT.
       *
       * `ocade_finalize_generation_permit` prices by the tier stored on the
       * permit — `CASE WHEN tier = 'free' THEN 100` — because on Free a use IS
       * the unit and a fraction of one does not exist. Without the same clamp
       * the stub charged the weighted measurement, 0.25 of a use, and the
       * allowance appeared to go down by a quarter per request.
       */
      const charged = permit.tier === "free" ? 100 : Number(args.p_cost_hundredths) || 0;
      const difference = charged - permit.reserved;
      addUsage(userId, kindFor(permit.surface, "session"), session.startsAt, difference);
      addUsage(userId, kindFor(permit.surface, "week"), week.startsAt, difference);
      permit.settled = true;
      return [{ outcome: "succeeded", charged_hundredths: charged }];
    }

    case "ocade_release_generation_permit": {
      const permit = rows(userId, "__permits").find(
        (entry) => entry.idempotencyKey === args.p_idempotency_key,
      );
      if (!permit || permit.settled) return false;
      addUsage(userId, kindFor(permit.surface, "session"), session.startsAt, -permit.reserved);
      addUsage(userId, kindFor(permit.surface, "week"), week.startsAt, -permit.reserved);
      permit.settled = true;
      return true;
    }

    case "ocade_consume_commercial_work": {
      const startsAt = Date.parse(args.p_window_start);
      const cost = Number(args.p_cost_hundredths) || 0;
      const limit = args.p_limit_hundredths;
      const used = usedIn(userId, args.p_window_kind, startsAt);
      if (limit !== null && limit !== undefined && used + cost > limit) {
        return { __error: { code: "23514", message: "allowance exhausted" } };
      }
      addUsage(userId, args.p_window_kind, startsAt, cost);
      return null;
    }

    case "ocade_release_commercial_work":
      addUsage(
        userId,
        args.p_window_kind,
        Date.parse(args.p_window_start),
        -(Number(args.p_cost_hundredths) || 0),
      );
      return null;

    case "ocade_count_mfa_recovery_codes":
      return 0;

    case "ocade_list_account_sessions":
      /*
       * Two, because the interesting case is the second one: a person can only
       * discover a session they did not start if the list shows more than
       * "this device".
       */
      return [
        {
          session_id: "session-current",
          created_at: new Date(now - 3_600_000).toISOString(),
          last_seen_at: new Date(now - 60_000).toISOString(),
          expires_at: null,
          assurance: "aal1",
          user_agent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0",
          ip_address: null,
        },
        {
          session_id: "session-other",
          created_at: new Date(now - 86_400_000).toISOString(),
          last_seen_at: new Date(now - 7_200_000).toISOString(),
          expires_at: null,
          assurance: "aal1",
          user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605",
          ip_address: null,
        },
      ];

    case "ocade_session_is_live":
      return true;

    case "ocade_record_notification":
      return null;

    case "ocade_save_notification_preferences": {
      /*
       * WRITES THE ROW, because the property under test is that the choice is
       * the ACCOUNT'S: a stub that acknowledged a save and stored nothing would
       * make "survives a refresh" fail for a reason that is not the product's.
       */
      const held = rows(userId, "ocade_notification_preferences");
      const revision = (held[0]?.revision ?? 0) + 1;
      const row = {
        user_id: userId,
        mute_optional: args.p_mute_optional,
        quiet_hours: args.p_quiet_hours,
        categories: args.p_categories,
        revision,
      };
      tablesFor(userId).ocade_notification_preferences = [row];
      return revision;
    }

    default:
      return { __unmodelled: name };
  }
}

/* ------------------------------------------------------------- the server -- */

/** The scripted JARVIS steps set by `/__fixture/jarvis-script`, or null. */
let jarvisScript = null;

/** The next scripted step for this conversation, or null for an ordinary answer. */
function jarvisStep(messages) {
  if (!jarvisScript) return null;
  let typed = -1;
  messages.forEach((message, index) => {
    if (message.role === "user" && !String(message.content).startsWith("Result of ")) typed = index;
  });
  if (typed < 0 || !String(messages[typed].content).includes(jarvisScript.trigger)) return null;
  const after = messages.slice(typed + 1);
  const taken = after.filter(
    (m) => m.role === "assistant" && String(m.content).startsWith("Called "),
  ).length;
  const step = jarvisScript.steps[taken];
  if (!step) return { text: "Nothing more to do." };
  if (!step.args?.name) return step;
  // The newest browser result that carries an observation: a declined or
  // refused step returns none, and the page it left is still the one on screen.
  let observation = null;
  for (const message of [...after].reverse()) {
    const text = String(message.content);
    if (message.role !== "user" || !text.startsWith("Result of browser")) continue;
    try {
      observation = JSON.parse(text.slice(text.indexOf("{"))).observation ?? null;
    } catch {
      observation = null;
    }
    if (observation) break;
  }
  const element = observation?.elements?.find((e) => e.name === step.args.name);
  const { name: _name, ...rest } = step.args;
  return {
    tool: step.tool,
    args: { ...rest, ref: element?.ref ?? "e0", observationId: observation?.observationId ?? "o0" },
  };
}

/** JARVIS rows, shared across accounts and filtered per session (see the handler). */
const jarvisTables = {};

/** Column defaults the migration gives JARVIS rows. */
const JARVIS_DEFAULTS = {
  jarvis_devices: { name: "New device", capabilities: {}, revoked_at: null, last_seen_at: null },
  jarvis_tasks: {
    status: "running",
    current_step: 0,
    plan: [],
    browser_mode: "isolated",
    live_frame: null,
  },
  jarvis_activity: { status: "note", confirmed: false, action: null, result: null },
  jarvis_permissions: { device_id: null },
};

/** What the online boundary answers with next, and what it last received. */
const onlineBoundary = { status: 200, lastRequest: null };

/** The only code `/auth/v1/verify` accepts. Nothing is sent anywhere. */
const OTP_CODE = "123456";

/** One write the stub has been told to refuse. `/__fixture/refuse` sets it. */
const refusals = { table: null, method: null };

/** What `/auth/v1/settings` reports. `/__fixture/auth-providers` changes it. */
const authProviders = { google: true, email: true };

/**
 * The private bucket, in memory.
 *
 * Enough to prove the product's half of the contract: a row and an object are
 * created together, a link is minted per request rather than being a permanent
 * public URL, and a delete removes both. It models no policy — the RLS that
 * keeps one account out of another's objects is proven against real PostgreSQL
 * in `library-schema.test.ts`, which is the only place it can be.
 *
 * Bodies are accumulated as text by this stub, so the proofs upload text.
 */
const objects = new Map();

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    const send = (status, payload, headers = {}) => {
      const text = payload === undefined ? "" : JSON.stringify(payload);
      response.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "access-control-expose-headers": "content-range",
        ...headers,
      });
      response.end(text);
    };

    if (request.method === "OPTIONS") return send(204);

    /* --- fixtures -------------------------------------------------------- */

    if (url.pathname === "/__fixture/online-boundary") {
      /*
       * What the online boundary should do next, and what it last saw.
       *
       * POST sets a status the boundary answers with — 503 for an unavailable
       * provider, 429 for a project quota — so the browser's TRUTHFUL FAILURE
       * can be proved without breaking anything real. GET returns the last
       * request body the boundary received, which is how the journey checks
       * that the browser carried a permit rather than merely believing it had.
       */
      if (request.method === "GET") return send(200, onlineBoundary.lastRequest ?? {});
      onlineBoundary.status = Number(JSON.parse(body || "{}").status ?? 200);
      return send(200, { ok: true });
    }

    if (url.pathname === "/__fixture/jarvis-script") {
      /*
       * THE STEPS THE STUB "MODEL" TAKES FOR A JARVIS TASK.
       *
       * POST {trigger, steps}: when the person's message contains `trigger`, the
       * boundary answers each turn with the next step — a tool call or text.
       * A browser step naming an element by `name` is resolved to the ref in
       * the latest observation the browser returned, so the proof runs through
       * the real device, the real page and the real observation. It proves the
       * loop, the permits and the device path; it proves nothing about a model.
       */
      jarvisScript = JSON.parse(body || "null");
      return send(200, { ok: true });
    }

    if (url.pathname === "/__fixture/auth-providers") {
      /*
       * Which providers the project reports at `/auth/v1/settings`.
       *
       * The sign-in screen asks the project rather than a build flag, so this
       * is how a journey proves the screen follows the answer: turn a provider
       * off here, reload, and the way in that no longer exists is gone from
       * the page rather than present and refusing.
       */
      Object.assign(authProviders, JSON.parse(body || "{}"));
      return send(200, { ok: true, external: authProviders });
    }

    if (url.pathname === "/__fixture/refuse") {
      /*
       * MAKE ONE WRITE FAIL, SO A FAILURE CAN BE PROVED RATHER THAN ASSUMED.
       *
       * A screen that removes a message optimistically and swallows the
       * database's refusal looks identical to one that worked — until a reload
       * brings back private text somebody deleted. There is no way to see that
       * from outside without making the write actually fail, which is what this
       * is for. POST {"table":"ocade_messages","method":"DELETE"} refuses the
       * next matching request; POST {} clears it.
       */
      const next = JSON.parse(body || "{}");
      refusals.table = next.table ?? null;
      refusals.method = next.method ?? null;
      return send(200, { ok: true, refusing: refusals.table });
    }

    if (url.pathname === "/__fixture/spend-allowance") {
      /*
       * Spend an account's session allowance down to whatever is asked for,
       * so exhaustion can be proved without sending twenty-eight messages.
       *
       * It writes the LEDGER, not the product: everything the browser then
       * does — the refusal, the sentence, the untouched transcript — is
       * OCADE's own behaviour reacting to an allowance that is genuinely gone.
       */
      const parsed = JSON.parse(body || "{}");
      const userId = idForEmail(parsed.email ?? "proof@ocade.test");
      const session = windowFor("session", Date.now());
      const week = windowFor("week", Date.now());
      const remaining = Number(parsed.remainingUses ?? 0);
      const capHundredths = Number(parsed.allowanceUses ?? 28) * 100;
      // One surface at a time: spending JARVIS's allowance leaves Chat's alone.
      const surface = parsed.surface === "jarvis" ? "jarvis" : "chat";
      const others = (tablesFor(userId).__usage ?? []).filter(
        (row) => (surface === "jarvis") !== row.kind.startsWith("jarvis_"),
      );
      tablesFor(userId).__usage = [
        ...others,
        {
          kind: kindFor(surface, "session"),
          startsAt: session.startsAt,
          usedHundredths: capHundredths - remaining * 100,
        },
        { kind: kindFor(surface, "week"), startsAt: week.startsAt, usedHundredths: 0 },
      ];
      return send(200, { ok: true, userId });
    }

    /* --- auth ------------------------------------------------------------ */

    if (url.pathname === "/auth/v1/token") {
      const parsed = JSON.parse(body || "{}");
      const grant = url.searchParams.get("grant_type");
      if (grant === "refresh_token") {
        const email = emails.get(sessions.get(parsed.refresh_token)) ?? "proof@ocade.test";
        return send(200, openSession(email));
      }
      // One password the stub refuses, so a wrong one can be proved refused.
      if (grant === "password" && parsed.password === "wrong-password") {
        return send(400, {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        });
      }
      return send(200, openSession(parsed.email ?? "proof@ocade.test"));
    }

    if (url.pathname === "/auth/v1/signup") {
      const parsed = JSON.parse(body || "{}");
      return send(200, openSession(parsed.email ?? "proof@ocade.test"));
    }

    if (url.pathname === "/auth/v1/user") {
      const userId = callerFrom(request, body);
      if (!userId) return send(401, { message: "no session" });
      return send(200, userRecord(userId, emails.get(userId) ?? "proof@ocade.test"));
    }

    if (url.pathname === "/auth/v1/logout") {
      const header = request.headers.authorization ?? "";
      sessions.delete(header.replace(/^Bearer\s+/i, ""));
      return send(204);
    }

    if (url.pathname === "/auth/v1/.well-known/jwks.json") {
      // No keys, so the client falls back to asking this server who the holder
      // is — which is the path a hosted project takes for a legacy HS256 key.
      return send(200, { keys: [] });
    }

    if (url.pathname === "/auth/v1/settings") {
      return send(200, { external: authProviders });
    }

    if (url.pathname === "/auth/v1/otp") {
      /*
       * A code was requested. No code is generated and none is delivered —
       * `OTP_CODE` is the one this stub accepts, and it is a constant so the
       * journey can type it. What IS real is everything OCADE does around it:
       * the throttle, the cooldown, the navigation to the code screen.
       */
      if (!authProviders.email) {
        return send(422, { error_code: "provider_disabled", msg: "Signups not allowed for otp" });
      }
      return send(200, {});
    }

    if (url.pathname === "/auth/v1/verify") {
      const parsed = JSON.parse(body || "{}");
      if (String(parsed.token) !== OTP_CODE) {
        return send(403, { error_code: "otp_invalid", msg: "Token is invalid" });
      }
      const identity = parsed.email ?? "proof@ocade.test";
      return send(200, openSession(identity));
    }

    if (url.pathname === "/auth/v1/factors") {
      // No enrolled factor: the assurance gate must leave this account alone.
      return send(200, { all: [], totp: [] });
    }

    /* --- private object storage ------------------------------------------ */

    const sign = /^\/storage\/v1\/object\/sign\/library\/(.+)$/.exec(url.pathname);
    if (sign && request.method === "POST") {
      const path = decodeURIComponent(sign[1]);
      if (!objects.has(path)) return send(404, { message: "Object not found" });
      return send(200, {
        signedURL: `/object/library/${path}?token=stub-${Date.now()}`,
      });
    }

    const download = /^\/storage\/v1\/object\/library\/(.+)$/.exec(url.pathname);
    if (download && request.method === "GET") {
      const path = decodeURIComponent(download[1]);
      const held = objects.get(path);
      if (held === undefined) return send(404, { message: "Object not found" });
      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "access-control-allow-origin": "*",
      });
      response.end(held);
      return;
    }

    if (download && request.method === "POST") {
      objects.set(decodeURIComponent(download[1]), body);
      return send(200, { Key: `library/${decodeURIComponent(download[1])}` });
    }

    if (url.pathname === "/storage/v1/object/library" && request.method === "DELETE") {
      const { prefixes = [] } = JSON.parse(body || "{}");
      for (const prefix of prefixes) objects.delete(prefix);
      return send(
        200,
        prefixes.map((name) => ({ name })),
      );
    }

    /* --- rpc ------------------------------------------------------------- */

    const rpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (rpc) {
      const args = JSON.parse(body || "{}");
      const userId = callerFrom(request, body);
      if (process.env.OCADE_STUB_TRACE) {
        process.stdout.write(`rpc ${rpc[1]} ${JSON.stringify(args)}\n`);
      }
      const result = handleRpc(rpc[1], args, userId ?? "anonymous");
      if (result && typeof result === "object" && "__error" in result) {
        return send(400, result.__error);
      }
      if (result && typeof result === "object" && "__unmodelled" in result) {
        return send(404, {
          message: `the stub does not model rpc ${result.__unmodelled}`,
        });
      }
      return send(200, result);
    }

    /* --- tables ---------------------------------------------------------- */

    const table = /^\/rest\/v1\/([a-z0-9_]+)$/.exec(url.pathname);
    if (table && table[1].startsWith("jarvis_")) {
      /*
       * JARVIS TABLES ARE ONE SHARED STORE, FILTERED THE WAY RLS FILTERS.
       *
       * A paired device reaches its rows through the service role, with no
       * account session at all, so per-account buckets cannot model it. A
       * session sees and writes only its own rows; the service role sees all.
       * This mirrors the policy for the proof; the policy itself is proven
       * against PostgreSQL in jarvis-schema-against-postgres.test.ts.
       */
      const name = table[1];
      const header = (request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const sessionUser = sessions.get(header) ?? null;
      const store = (jarvisTables[name] ??= []);
      const params = [...url.searchParams.entries()];
      const select = url.searchParams.get("select");
      const single = (request.headers.accept ?? "").includes("vnd.pgrst.object");
      const scoped = (row) => !sessionUser || row.user_id === sessionUser;
      const found = () =>
        applyOrder(
          store.filter((row) => scoped(row) && matches(row, params)),
          url.searchParams.get("order"),
        ).slice(0, Number(url.searchParams.get("limit") ?? 0) || undefined);
      const answer = (list, status = 200) => {
        const projected = list.map((row) => project(row, select));
        return send(status, single ? (projected[0] ?? null) : projected);
      };
      if (request.method === "GET") return answer(found());
      if (request.method === "POST") {
        const payload = JSON.parse(body || "{}");
        const incoming = Array.isArray(payload) ? payload : [payload];
        if (sessionUser && incoming.some((row) => row.user_id && row.user_id !== sessionUser)) {
          return send(403, {
            code: "42501",
            message: "new row violates row-level security policy",
          });
        }
        const at = new Date().toISOString();
        const written = incoming.map((row) => {
          const created = {
            id: randomUUID(),
            created_at: at,
            updated_at: at,
            ...JARVIS_DEFAULTS[name],
            ...row,
            user_id: row.user_id ?? sessionUser,
          };
          store.push(created);
          return created;
        });
        return answer(written, 201);
      }
      if (request.method === "PATCH") {
        const patch = JSON.parse(body || "{}");
        const changed = found();
        for (const row of changed) {
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
          if (
            name === "jarvis_tasks" &&
            ["stopped", "blocked", "failed", "completed"].includes(row.status)
          ) {
            row.live_frame = null;
          }
        }
        return answer(changed);
      }
      if (request.method === "DELETE") {
        const removed = found();
        jarvisTables[name] = store.filter((row) => !removed.includes(row));
        return answer(removed);
      }
    }

    if (table) {
      const name = table[1];
      const userId = callerFrom(request, body) ?? "anonymous";
      const params = [...url.searchParams.entries()];
      const select = url.searchParams.get("select");
      const stored = rows(userId, name);
      const single = (request.headers.accept ?? "").includes("vnd.pgrst.object");

      if (request.method === "GET") {
        if (process.env.OCADE_STUB_TRACE) {
          process.stdout.write(`get ${name} ${url.search} rows=${stored.length}\n`);
        }
        let found = stored.filter((row) => matches(row, params));
        found = applyOrder(found, url.searchParams.get("order"));
        const limit = Number(url.searchParams.get("limit") ?? 0);
        if (limit > 0) found = found.slice(0, limit);
        const projected = found.map((row) => project(row, select));
        if (single) return send(200, projected[0] ?? null);
        return send(200, projected, { "content-range": `0-${projected.length}/${found.length}` });
      }

      if (request.method === "POST") {
        const payload = JSON.parse(body || "{}");
        const incoming = Array.isArray(payload) ? payload : [payload];
        /*
         * The account's device cap, which production enforces in a trigger and
         * this stub used not to have at all. Without it the browser could
         * register devices forever here and meet a refusal only in production,
         * which is the one place nobody can reproduce it.
         */
        if (name === "devices") {
          for (const row of incoming) {
            const active = stored.filter(
              (candidate) => candidate.kind === row.kind && !candidate.revoked_at,
            );
            if (active.length >= DEVICE_CAP) {
              return send(400, {
                code: "23514",
                message: `Device cap reached for kind ${row.kind}: maximum ${DEVICE_CAP} active per account.`,
              });
            }
          }
        }
        const written = incoming.map((row) => {
          const onConflict = url.searchParams.get("on_conflict");
          const existing = onConflict
            ? stored.find((candidate) => candidate[onConflict] === row[onConflict])
            : undefined;
          if (existing) {
            Object.assign(existing, row, { updated_at: new Date().toISOString() });
            return existing;
          }
          const created = {
            id: row.id ?? randomUUID(),
            user_id: row.user_id ?? userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            archived: false,
            pinned: false,
            ...(name === "ocade_conversations" ? { surface: "chat" } : {}),
            ...row,
          };
          stored.push(created);
          return created;
        });
        const projected = written.map((row) => project(row, select));
        return send(201, single ? (projected[0] ?? null) : projected);
      }

      if (request.method === "PATCH") {
        const patch = JSON.parse(body || "{}");
        const changed = stored.filter((row) => matches(row, params));
        for (const row of changed)
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
        const projected = changed.map((row) => project(row, select));
        return send(200, single ? (projected[0] ?? null) : projected);
      }

      if (refusals.table === name && (!refusals.method || refusals.method === request.method)) {
        return send(500, { message: `the stub was told to refuse ${request.method} on ${name}` });
      }

      if (request.method === "DELETE") {
        const removed = stored.filter((row) => matches(row, params));
        const kept = stored.filter((row) => !matches(row, params));
        tablesFor(userId)[name] = kept;
        const projected = removed.map((row) => project(row, select));
        return send(200, single ? (projected[0] ?? null) : projected, {
          "content-range": `*/${removed.length}`,
        });
      }
    }

    /* --- the online intelligence boundary -------------------------------- */

    if (url.pathname === "/functions/v1/ocade-intelligence") {
      /*
       * The Edge Function's own event shape, so the online path can be driven
       * end to end. It is not Gemini: an answer from here proves the browser's
       * transport, the permit ordering and the transcript, and nothing about
       * the model.
       *
       * It enforces the two things the real boundary enforces that the BROWSER
       * is responsible for getting right — a bearer token and a permit in the
       * body — because a stub that accepts anything cannot prove the client
       * sent anything.
       */
      const parsed = (() => {
        try {
          return JSON.parse(body || "{}");
        } catch {
          return {};
        }
      })();
      onlineBoundary.lastRequest = {
        authorized: /^Bearer\s+\S+$/i.test(request.headers.authorization ?? ""),
        permitId: parsed.permit?.id ?? null,
        generationId: parsed.generationId ?? null,
        idempotencyKey: parsed.idempotencyKey ?? null,
        surface: parsed.surface ?? null,
        permitSource: parsed.permit?.source ?? null,
        // What the browser said it was attaching, so a journey can prove a
        // file reached the boundary rather than only the Library.
        attachments: (parsed.attachments ?? []).map((attachment) => ({
          name: attachment?.name ?? null,
          mime: attachment?.mime ?? null,
          carries: attachment?.image ? "image" : attachment?.text ? "text" : "nothing",
          text: typeof attachment?.text === "string" ? attachment.text.slice(0, 200) : null,
        })),
        research: parsed.research === true,
        systemPrompts: (parsed.messages ?? [])
          .filter((message) => message?.role === "system")
          .map((message) => String(message.content).slice(0, 200)),
        /*
         * THE EXACT CONVERSATION, IN ORDER.
         *
         * Recording only the system prompts was enough to miss the defect that
         * mattered most here: the current question was appended to a transcript
         * that already contained it, so every request sent the last thing the
         * person typed TWICE. Nothing on screen shows that, and no check here
         * could see it. The sequence is what proves it.
         */
        turns: (parsed.messages ?? []).map((message) => ({
          role: message?.role ?? null,
          content: String(message?.content ?? "").slice(0, 200),
        })),
      };
      if (!onlineBoundary.lastRequest.authorized) {
        return send(401, { error: "authentication_required" });
      }
      if (!parsed.permit?.id || parsed.permit.source !== "server") {
        return send(400, { error: "invalid_request" });
      }
      if (onlineBoundary.status !== 200) {
        return send(onlineBoundary.status, { error: "provider_unavailable" });
      }
      const scripted = parsed.surface === "jarvis" ? jarvisStep(parsed.messages ?? []) : null;
      if (scripted) {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        });
        const emit = (event) => response.write(`data: ${JSON.stringify(event)}\n\n`);
        emit({ type: "status", backend: "online", state: "streaming" });
        const calls = scripted.tool
          ? [{ id: "provider-tool-0", name: scripted.tool, arguments: scripted.args ?? {} }]
          : [];
        for (const call of calls) emit({ type: "tool_call", call });
        if (scripted.text) emit({ type: "token", text: scripted.text });
        emit({
          type: "final",
          response: {
            text: scripted.text ?? "",
            toolCalls: calls,
            toolResults: [],
            backend: "online",
            stopReason: calls.length ? "tool_use" : "end_turn",
          },
        });
        response.end();
        return;
      }
      /*
       * THE ANSWER REPEATS WHAT THE FILE SAID.
       *
       * A journey can otherwise only prove an attachment reached the boundary,
       * not that it could have influenced the reply. Echoing a fragment makes
       * "the file changed the answer" observable on screen, which is what
       * PLAN.md Phase 4's gate actually asks for.
       */
      const attached = (parsed.attachments ?? []).find(
        (attachment) => typeof attachment?.text === "string" && attachment.text.length > 0,
      );
      // A grounded answer carries its sources, the way the boundary appends them.
      const sourced =
        parsed.research === true
          ? "\n\nSources\n\n- [Example source](https://example.com/a)\n"
          : "";
      const answer = attached
        ? `This is a stubbed OCADE answer for the browser proof. From ${attached.name}: ${String(
            attached.text,
          )
            .split("\n")
            .slice(0, 2)
            .join(" / ")
            .slice(0, 120)}`
        : "This is a stubbed OCADE answer for the browser proof.";
      // Not `body`: that name is the REQUEST body in this scope, and shadowing
      // it put `JSON.parse(body)` above into a temporal dead zone — every
      // boundary request then parsed as {} and was refused as invalid.
      const streamed = `${answer}${sourced}`;
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      });
      const emit = (event) => response.write(`data: ${JSON.stringify(event)}\n\n`);
      emit({ type: "status", backend: "online", state: "streaming" });
      for (const word of streamed.split(" ")) emit({ type: "token", text: `${word} ` });
      emit({
        type: "final",
        response: {
          text: answer,
          toolCalls: [],
          toolResults: [],
          backend: "online",
          stopReason: "end_turn",
        },
      });
      response.end();
      return;
    }

    send(404, { message: `the stub does not model ${request.method} ${url.pathname}` });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`supabase stub on http://127.0.0.1:${PORT}\n`);
});
