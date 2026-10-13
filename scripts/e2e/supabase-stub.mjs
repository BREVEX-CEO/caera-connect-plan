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
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

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
/** Accounts Supabase Auth refuses to sign in or refresh (auth.users.banned_until in the future). */
const banned = new Set();
/** accessToken -> "aal1" | "aal2": what that session proved. */
const tokenAal = new Map();
/** refreshToken -> { userId, aal } */
const refreshes = new Map();
/** userId -> TOTP factors, secrets included (never sent back after enrollment). */
const factors = new Map();
/** challengeId -> { factorId, userId, expiresAt } */
const challenges = new Map();
/** accessToken -> session id (the JWT's `session_id`). */
const tokenSession = new Map();
/** session id -> { createdAt, agent }: what auth.sessions knows about each sign-in. */
const sessionFacts = new Map();
/** The browser making the current request, for a session it opens. */
let requestAgent = "";
/** userId -> { endsAt, revoked } : public.ocade_unlimited_grants, the open one (20261003090000). */
const unlimitedGrants = new Map();
/** auth code -> { challenge, email }: a provider sign-in (PKCE) waiting to be exchanged once. */
const pkceCodes = new Map();
/** hashed_token -> { email, expiresAt }: one-time sign-ins from generateLink, used once. */
const oneTimeSignIns = new Map();
/** "session_id:proved_at" pairs already spent (private.ocade_spent_proofs). */
const spentProofs = new Set();
/** The assurance of the session making the current request. */
let requestAal = "aal1";
/** The token of the session making the current request (the one an emergency sign-out spares). */
let requestToken = "";

/*
 * THE STAFF AUTHORITY (public.ocade_staff), with the rules the migration
 * enforces. The rules themselves are proven against PostgreSQL in
 * staff-authority.test.ts; this exists so the consoles can be driven in a
 * real browser against the same refusals in the same words.
 */
/** userId -> { role, granted, denied } */
const staffRoles = new Map();
/** Accounts whose access was removed: signing in again must not hand it back. */
const formerStaff = new Set();
const staffInvites = [];
const supportCases = [];
const adminActions = [];
/** userId -> { hashes: Map<hash, used>, failed } — the recovery sheet, as the database holds it. */
const recoverySheets = new Map();
/** What the server recorded as notifications, for `/__fixture/notifications`. */
const recordedNotifications = [];
/** endpoint -> { endpoint, user_id, p256dh, auth, failures, last_sent_at }: browsers that turned notifications on. */
const pushSubscriptions = new Map();
/** What the stand-in push service at /__push/<name> received, for `/__fixture/pushes`. */
const pushesReceived = [];
const ALL_PERMISSIONS = [
  "customers.read",
  "usage.read",
  "devices.read",
  "devices.manage",
  "tasks.read",
  "security.read",
  "sessions.manage",
  "grants.manage",
  "execution.manage",
  "health.read",
  "audit.read",
  "staff.manage",
  "cases.read",
  "cases.manage",
  "usage.manage",
  "accounts.manage",
  "accounts.delete",
];
const ROLE_PERMISSIONS = {
  primary_owner: ALL_PERMISSIONS,
  backup_owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(
    (p) => p !== "staff.manage" && p !== "cases.manage" && p !== "accounts.delete",
  ),
  support: ["customers.read", "devices.read", "tasks.read", "cases.read"],
  billing: ["customers.read", "usage.read", "grants.manage", "usage.manage"],
  operations: ["devices.read", "devices.manage", "tasks.read", "health.read", "execution.manage"],
  read_only: [
    "customers.read",
    "usage.read",
    "devices.read",
    "tasks.read",
    "health.read",
    "audit.read",
  ],
};
/** An address's prefix names its role: owner, backup, admin, support, billing, ops, readonly. */
const ROLE_BY_PREFIX = {
  owner: "primary_owner",
  backup: "backup_owner",
  admin: "admin",
  support: "support",
  billing: "billing",
  ops: "operations",
  readonly: "read_only",
};
const roleOf = (id) => staffRoles.get(id)?.role ?? null;
/** What the role and overrides hold (ocade_my_staff's list). */
const holds = (id, permission) => {
  const member = staffRoles.get(id);
  return (
    Boolean(member) &&
    (ROLE_PERMISSIONS[member.role].includes(permission) || member.granted.includes(permission)) &&
    !member.denied.includes(permission)
  );
};
/**
 * Was a factor of this account added after the current session began
 * (public.ocade_factor_added_since_sign_in, 20261001095000)? Only answered
 * ones count unless `unverifiedToo`.
 */
const factorAddedSinceSignIn = (unverifiedToo = false) => {
  const id = tokenSession.get(requestToken);
  const began = sessionFacts.get(id)?.createdAt ?? 0;
  const owner = sessions.get(requestToken);
  return (factors.get(owner) ?? []).some(
    (f) => (unverifiedToo || f.status === "verified") && Date.parse(f.created_at) > began,
  );
};
/** private.ocade_staff_has: held, on a session that added no factor since it began (20261003090000). */
const staffHas = (id, permission) => holds(id, permission) && !factorAddedSinceSignIn();
/** private.ocade_usage_unlimited: an owner, or an open grant that has not ended. */
const unlimitedOf = (id) => {
  const role = roleOf(id);
  if (role === "primary_owner" || role === "backup_owner") return { why: "owner", ends_at: null };
  const grant = unlimitedGrants.get(id);
  if (grant && (!grant.endsAt || Date.parse(grant.endsAt) > Date.now())) {
    return { why: "grant", ends_at: grant.endsAt };
  }
  return null;
};
const record = (actor, action, reason, target_user = null, subject = null) =>
  adminActions.push({
    id: randomUUID(),
    created_at: new Date().toISOString(),
    actor,
    action,
    reason,
    target_user,
    subject,
  });

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
    factors: (factors.get(id) ?? []).map(publicFactor),
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
/** An address starting "admin" is an operator; "+mfa" in it means a second factor was used. */
const assuranceOf = (email) => (email.includes("+mfa") ? "aal2" : "aal1");

/** Seconds a TOTP challenge stays answerable; OCADE_STUB_CHALLENGE_SECONDS shortens it for the expiry check. */
const CHALLENGE_SECONDS = Number(process.env.OCADE_STUB_CHALLENGE_SECONDS ?? 300);

const publicFactor = ({ secret: _secret, lastStep: _step, ...visible }) => visible;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(bytes) {
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  return bits
    .match(/.{1,5}/g)
    .map((chunk) => BASE32[parseInt(chunk.padEnd(5, "0"), 2)])
    .join("");
}

function fromBase32(text) {
  let bits = "";
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  }
  return Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s): exactly what an authenticator app computes. */
function totp(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", fromBase32(secret)).update(message).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

function shapedJwt(
  userId,
  email,
  aal = assuranceOf(email),
  provedAt = Math.floor(Date.now() / 1000),
  sessionId = "session-current",
) {
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
    aal,
    // Supabase reports when each method was proved, in seconds; a refresh keeps them.
    amr:
      aal === "aal2"
        ? [
            { method: "password", timestamp: provedAt },
            { method: "totp", timestamp: provedAt },
          ]
        : [{ method: "password", timestamp: provedAt }],
    // Real tokens carry this, and Advanced reads it to tell "this device" from
    // the others. Without it every session looks like somebody else's.
    session_id: sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.stub-signature-not-a-signature`;
}

function openSession(
  email,
  aal = assuranceOf(email),
  provedAt = Math.floor(Date.now() / 1000),
  sessionId = randomUUID(),
) {
  const id = idForEmail(email);
  emails.set(id, email);
  const named = ROLE_BY_PREFIX[email.split(/[-+@]/)[0]];
  if (named && !staffRoles.has(id) && !formerStaff.has(id)) {
    staffRoles.set(id, { role: named, granted: [], denied: [] });
  }
  // A verified address with an open invitation: it becomes access, once.
  const invite = staffInvites.find(
    (row) =>
      row.email === email.toLowerCase() &&
      !row.accepted_at &&
      !row.withdrawn_at &&
      Date.parse(row.expires_at) > Date.now(),
  );
  if (invite && !staffRoles.has(id)) {
    staffRoles.set(id, { role: invite.role, granted: [], denied: [] });
    invite.accepted_at = new Date().toISOString();
    invite.accepted_by = id;
    record(invite.invited_by, "staff_invite_accepted", "The invited address was verified.", id);
  }
  const accessToken = shapedJwt(id, email, aal, provedAt, sessionId);
  sessions.set(accessToken, id);
  tokenAal.set(accessToken, aal);
  tokenSession.set(accessToken, sessionId);
  if (!sessionFacts.has(sessionId)) {
    sessionFacts.set(sessionId, { createdAt: Date.now(), agent: requestAgent });
  }
  const refreshToken = `stub-refresh-${randomUUID()}`;
  refreshes.set(refreshToken, { userId: id, aal, provedAt, sessionId });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refreshToken,
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
  // `%term%` only, which is what the operator search sends.
  ilike: (a, b) =>
    String(a ?? "")
      .toLowerCase()
      .includes(b.replace(/%/g, "").toLowerCase()),
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
    if (key === "or") {
      // `or=(a.op.x,b.op.y)`: any clause holds. The operator search is the only user.
      const clauses = raw.replace(/^\(|\)$/g, "").split(",");
      if (
        !clauses.some((clause) =>
          matches(row, [
            [
              clause.split(".")[0],
              // A quoted value (a timestamp) is compared without its quotes, as PostgREST does.
              clause.slice(clause.indexOf(".") + 1).replace(/^(\w+)\."(.*)"$/, "$1.$2"),
            ],
          ]),
        )
      ) {
        return false;
      }
      continue;
    }
    const [operator, ...rest] = raw.split(".");
    const value = rest.join(".");
    if (operator === "not") {
      // `not.is.null` and `not.in.(…)` are the negations the product uses.
      const [inner, innerValue] = rest;
      if (inner === "in") {
        const listed = rest
          .slice(1)
          .join(".")
          .replace(/^\(|\)$/g, "")
          .split(",");
        if (listed.includes(String(row[key]))) return false;
        continue;
      }
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

/**
 * An account's agreement to online use (20261013091000). Accounts start having agreed,
 * as an existing customer has; the record RPC changes it. Kept apart from the profile
 * rows so no other read of a profile changes.
 */
const consents = new Map();
function consentOf(id) {
  if (!consents.has(id)) {
    consents.set(id, {
      online_ai_consent_at: "2026-10-13T00:00:00.000Z",
      online_ai_consent_version: "2026-10-13",
    });
  }
  return consents.get(id);
}

function handleRpc(name, args, userId) {
  const now = Date.now();
  const refuse = (message, code = "42501") => ({ __error: { code, message } });
  /** A privileged change: the permission, then a second factor this session. */
  const requireStaff = (permission, action) =>
    !staffHas(userId, permission)
      ? refuse("Not found")
      : requestAal !== "aal2"
        ? refuse(`Confirm the code from your authenticator app to ${action}.`)
        : null;
  const short = (reason) =>
    String(reason ?? "").trim().length < 10
      ? refuse("Say why, in at least ten characters.", "22023")
      : null;
  const endSessions = (users, spareSession = null, only = null) => {
    const ended = new Set();
    for (const [token, owner] of [...sessions]) {
      const id = tokenSession.get(token);
      if (!users.has(owner) || id === spareSession || (only && id !== only)) continue;
      sessions.delete(token);
      tokenAal.delete(token);
      ended.add(id);
      // Its browsers' notifications go with it (the foreign key).
      for (const [endpoint, row] of pushSubscriptions) {
        if (row.session_id === id) pushSubscriptions.delete(endpoint);
      }
    }
    for (const [token, held] of [...refreshes]) {
      if (!users.has(held.userId) || held.sessionId === spareSession) continue;
      if (only && held.sessionId !== only) continue;
      refreshes.delete(token);
    }
    return ended.size;
  };
  const callerSession = tokenSession.get(requestToken) ?? null;
  const session = windowFor("session", now);
  const week = windowFor("week", now);

  switch (name) {
    case "ocade_record_online_ai_consent": {
      const consent = consentOf(userId);
      consent.online_ai_consent_at = args.p_given ? new Date().toISOString() : null;
      consent.online_ai_consent_version = args.p_given ? args.p_version : null;
      return consent.online_ai_consent_at;
    }

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
    case "ocade_my_entitlement_grant": {
      // Without a grant the account is on Free, which is what the allowance tests want.
      const who = name === "ocade_my_entitlement_grant" ? userId : args.target_user;
      const live = (jarvisTables.ocade_entitlement_grants ?? []).find(
        (g) => g.user_id === who && !g.revoked_at && Date.parse(g.ends_at) > Date.now(),
      );
      return live
        ? [
            {
              tier: live.tier,
              starts_at: live.starts_at,
              ends_at: live.ends_at,
              reason: live.reason,
            },
          ]
        : null;
    }

    // The same refusals as the SQL (proven against PostgreSQL in staff-authority.test.ts).
    case "ocade_grant_entitlement": {
      if (!staffHas(userId, "grants.manage")) {
        return {
          __error: { code: "42501", message: "Only support admins may grant an entitlement." },
        };
      }
      if (args.target_user === userId || !(args.days >= 1 && args.days <= 366)) {
        return { __error: { code: "42501", message: "That entitlement cannot be granted." } };
      }
      const row = {
        id: randomUUID(),
        user_id: args.target_user,
        granted_by: userId,
        tier: args.grant_tier,
        reason: args.grant_reason,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + args.days * 86_400_000).toISOString(),
        revoked_at: null,
      };
      (jarvisTables.ocade_entitlement_grants ??= []).push(row);
      return row;
    }
    case "ocade_revoke_entitlement": {
      if (!staffHas(userId, "grants.manage")) {
        return {
          __error: { code: "42501", message: "Only support admins may revoke an entitlement." },
        };
      }
      const grant = (jarvisTables.ocade_entitlement_grants ?? []).find(
        (g) => g.id === args.grant_id,
      );
      if (!grant || grant.revoked_at) return false;
      grant.revoked_at = new Date().toISOString();
      return true;
    }

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
      if (
        sessionLimit !== null &&
        sessionLimit !== undefined &&
        used + reserved > sessionLimit &&
        !unlimitedOf(userId)
      ) {
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
        // The windows it reserved in, so settling after a rollover charges those (F-140).
        sessionStart: session.startsAt,
        weekStart: week.startsAt,
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
      // A retried settlement answers what was charged, and charges nothing more (F-140).
      if (permit.charged !== undefined)
        return [{ outcome: "succeeded", charged_hundredths: permit.charged }];
      if (permit.settled) return [{ outcome: "released", charged_hundredths: 0 }];
      /*
       * FREE IS EXACTLY ONE USE, CLAMPED HERE AS THE MIGRATION CLAMPS IT.
       *
       * `ocade_finalize_generation_permit` prices by the tier stored on the
       * permit — `CASE WHEN tier = 'free' THEN 100` — because on Free a use IS
       * the unit and a fraction of one does not exist. Without the same clamp
       * the stub charged the weighted measurement, 0.25 of a use, and the
       * allowance appeared to go down by a quarter per request.
       */
      // As the migration: Free is one use, anything else at least a quarter of one.
      let charged =
        permit.tier === "free" ? 100 : Math.max(25, Number(args.p_cost_hundredths) || 0);
      // As 20261013090000: a JARVIS turn that starts a task (cost 0 from the boundary), or
      // one while a task is open or just finished (150 at most), is part of that task.
      if (permit.surface === "jarvis") {
        const bound = (id) => rows(userId, "__permits").filter((p) => p.taskId === id).length;
        const task = (jarvisTables.jarvis_tasks ?? [])
          .filter(
            (t) =>
              t.user_id === userId &&
              (["running", "waiting", "taken_over"].includes(t.status) ||
                (t.finished_at && Date.now() - Date.parse(t.finished_at) < 600_000)) &&
              bound(t.id) < 150,
          )
          .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
        if (Number(args.p_cost_hundredths) === 0 || task) charged = 0;
        if (task && Number(args.p_cost_hundredths) !== 0) permit.taskId = task.id;
      }
      const difference = charged - permit.reserved;
      addUsage(userId, kindFor(permit.surface, "session"), permit.sessionStart, difference);
      addUsage(userId, kindFor(permit.surface, "week"), permit.weekStart, difference);
      permit.settled = true;
      permit.charged = charged;
      return [{ outcome: "succeeded", charged_hundredths: charged }];
    }

    case "ocade_release_generation_permit": {
      const permit = rows(userId, "__permits").find(
        (entry) => entry.idempotencyKey === args.p_idempotency_key,
      );
      if (!permit || permit.settled) return false;
      addUsage(userId, kindFor(permit.surface, "session"), permit.sessionStart, -permit.reserved);
      addUsage(userId, kindFor(permit.surface, "week"), permit.weekStart, -permit.reserved);
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

    case "ocade_count_mfa_recovery_codes": {
      const sheet = recoverySheets.get(userId);
      const all = [...(sheet?.hashes.values() ?? [])];
      return {
        remaining: all.filter((used) => !used).length,
        total: all.length,
        generated_at: sheet ? sheet.at : null,
      };
    }

    case "ocade_replace_mfa_recovery_codes":
      recoverySheets.set(userId, {
        hashes: new Map(args.p_code_hashes.map((hash) => [hash, false])),
        failed: 0,
        at: new Date(now).toISOString(),
      });
      return args.p_code_hashes.length;

    // Single use, and five wrong guesses lock it, as the database function does.
    case "ocade_consume_mfa_recovery_code": {
      const sheet = recoverySheets.get(userId) ?? { hashes: new Map(), failed: 0 };
      recoverySheets.set(userId, sheet);
      if (sheet.failed >= 5) return "locked";
      if (sheet.hashes.get(args.p_code_hash) !== false) {
        sheet.failed += 1;
        return sheet.failed >= 5 ? "locked" : "rejected";
      }
      sheet.hashes.set(args.p_code_hash, true);
      sheet.failed = 0;
      return "consumed";
    }

    case "ocade_revoke_other_account_sessions":
      // The server names the session to keep; without one, every session goes.
      return endSessions(new Set([args.p_user_id ?? userId]), args.p_keep_session_id ?? null);

    case "ocade_revoke_account_session":
      return endSessions(new Set([args.p_user_id]), null, args.p_session_id);

    case "ocade_list_account_sessions": {
      const target = args.p_user_id ?? userId;
      const seen = new Map();
      for (const [token, owner] of sessions) {
        if (owner !== target) continue;
        const id = tokenSession.get(token);
        if (!id || seen.has(id)) continue;
        const facts = sessionFacts.get(id) ?? { createdAt: now, agent: "" };
        seen.set(id, {
          session_id: id,
          created_at: new Date(facts.createdAt).toISOString(),
          last_seen_at: new Date(now).toISOString(),
          expires_at: null,
          assurance: tokenAal.get(token) ?? "aal1",
          user_agent: facts.agent,
          ip_address: null,
        });
      }
      return [...seen.values()];
    }

    case "ocade_spend_proof": {
      // public.ocade_spend_proof (20261011100000): one proof, one sensitive action.
      const claims = JSON.parse(
        Buffer.from(requestToken.split(".")[1] ?? "", "base64url").toString() || "{}",
      );
      const provedAt = Math.max(...(claims.amr ?? []).map((entry) => entry.timestamp));
      if (!claims.session_id || !Number.isFinite(provedAt)) return false;
      const proof = `${claims.session_id}:${provedAt}`;
      if (spentProofs.has(proof)) return false;
      spentProofs.add(proof);
      return true;
    }

    case "ocade_factor_added_since_sign_in":
      return factorAddedSinceSignIn(args.p_unverified_too === true);

    case "ocade_two_step_set_up_in_this_sign_in": {
      // public.ocade_two_step_set_up_in_this_sign_in (20261001095200).
      const began = sessionFacts.get(tokenSession.get(requestToken))?.createdAt ?? Infinity;
      const verified = (factors.get(userId) ?? []).filter((f) => f.status === "verified");
      return verified.length > 0 && verified.every((f) => Date.parse(f.created_at) > began);
    }

    case "ocade_session_meets_second_factor": {
      // What PostgREST's pre-request check does: an enrolled account's
      // password-only session is refused before the call runs.
      const enrolled = (factors.get(userId) ?? []).some((f) => f.status === "verified");
      if (requestAal !== "aal2" && enrolled) {
        return {
          __error: {
            code: "42501",
            message: "This account needs its second factor for this session.",
            hint: "factor_required",
          },
        };
      }
      return true;
    }

    case "ocade_session_is_live":
      return true;

    case "has_role":
      return args._role === "admin"
        ? ["primary_owner", "backup_owner", "admin"].includes(roleOf(args._user_id)) &&
            (userId === "anonymous" || !factorAddedSinceSignIn())
        : rows(args._user_id, "user_roles").some((row) => row.role === args._role);

    case "ocade_staff_can":
      return (
        staffHas(userId, args.p_permission) &&
        (roleOf(userId) === "primary_owner" || requestAal === "aal2")
      );

    case "ocade_my_staff": {
      const member = staffRoles.get(userId);
      if (!member) return [];
      return [
        {
          role: member.role,
          permissions: ALL_PERMISSIONS.filter((permission) => holds(userId, permission)),
          second_factor: requestAal === "aal2",
        },
      ];
    }

    case "ocade_staff_role_defaults":
      return staffHas(userId, "staff.manage") &&
        (roleOf(userId) === "primary_owner" || requestAal === "aal2")
        ? Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({ role, permissions }))
        : [];

    case "ocade_staff_grant": {
      const denied = requireStaff("staff.manage", "change who operates OCADE");
      if (denied) return denied;
      if (!Object.values(ROLE_BY_PREFIX).includes(args.p_role) || args.p_role === "primary_owner") {
        return refuse("That is not a staff role.", "22023");
      }
      if (short(args.p_reason)) return short(args.p_reason);
      if (args.p_role === "backup_owner" && roleOf(userId) !== "primary_owner") {
        return refuse("Only the Primary Owner names a Backup Owner.");
      }
      const address = String(args.p_email).trim().toLowerCase();
      const target = [...emails].find(([, email]) => email.toLowerCase() === address)?.[0];
      if (!target) {
        for (const row of staffInvites) {
          if (row.email === address && !row.accepted_at && !row.withdrawn_at) {
            row.withdrawn_at = new Date(now).toISOString();
          }
        }
        staffInvites.push({
          id: randomUUID(),
          email: address,
          role: args.p_role,
          invited_by: userId,
          created_at: new Date(now).toISOString(),
          expires_at: new Date(now + 14 * 86_400_000).toISOString(),
          accepted_at: null,
          accepted_by: null,
          withdrawn_at: null,
        });
        record(userId, "staff_invite", String(args.p_reason).trim());
        return { status: "invited" };
      }
      if (target === userId) return refuse("Nobody changes their own access.");
      if (roleOf(target) === "primary_owner") {
        return refuse("The Primary Owner's access is changed only by handing ownership over.");
      }
      if (roleOf(target) === "backup_owner" && roleOf(userId) !== "primary_owner") {
        return refuse("Only the Primary Owner changes the Backup Owner.");
      }
      staffRoles.set(target, {
        granted: [],
        denied: [],
        ...staffRoles.get(target),
        role: args.p_role,
      });
      formerStaff.delete(target);
      record(userId, "staff_grant", String(args.p_reason).trim(), target);
      return { status: "granted", user_id: target };
    }

    case "ocade_staff_set_permissions": {
      const denied = requireStaff("staff.manage", "change who operates OCADE");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      if (args.p_user === userId) return refuse("Nobody changes their own access.");
      const member = staffRoles.get(args.p_user);
      if (!member) return false;
      if (
        member.role === "primary_owner" ||
        (member.role === "backup_owner" && roleOf(userId) !== "primary_owner")
      ) {
        return refuse("Only the Primary Owner changes an owner's access.");
      }
      member.granted = args.p_granted ?? [];
      member.denied = args.p_denied ?? [];
      record(userId, "staff_permissions", String(args.p_reason).trim(), args.p_user);
      return true;
    }

    case "ocade_staff_revoke": {
      const denied = requireStaff("staff.manage", "change who operates OCADE");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      const role = roleOf(args.p_user);
      if (!role) return false;
      if (role === "primary_owner") {
        return refuse("The Primary Owner is removed only by handing ownership over.");
      }
      if (role === "backup_owner" && roleOf(userId) !== "primary_owner") {
        return refuse("Only the Primary Owner removes the Backup Owner.");
      }
      staffRoles.delete(args.p_user);
      formerStaff.add(args.p_user);
      record(userId, "staff_revoke", String(args.p_reason).trim(), args.p_user);
      return true;
    }

    case "ocade_staff_withdraw_invite": {
      const denied = requireStaff("staff.manage", "change who operates OCADE");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      const invite = staffInvites.find(
        (row) => row.id === args.p_invite && !row.accepted_at && !row.withdrawn_at,
      );
      if (!invite) return false;
      invite.withdrawn_at = new Date(now).toISOString();
      record(userId, "staff_invite_withdrawn", String(args.p_reason).trim(), null, invite.id);
      return true;
    }

    case "ocade_staff_transfer_ownership": {
      const denied = requireStaff("staff.manage", "hand over ownership");
      if (denied) return denied;
      if (roleOf(userId) !== "primary_owner") {
        return refuse("Only the Primary Owner hands over ownership.");
      }
      if (roleOf(args.p_to) !== "backup_owner") {
        return refuse("Ownership goes to an Owner. Make them an Owner first.", "22023");
      }
      if (short(args.p_reason)) return short(args.p_reason);
      staffRoles.get(userId).role = "backup_owner";
      Object.assign(staffRoles.get(args.p_to), { role: "primary_owner", denied: [] });
      record(userId, "owner_transfer", String(args.p_reason).trim(), args.p_to);
      if (args.p_stay_owner === false) {
        staffRoles.delete(userId);
        record(userId, "staff_revoke", "Left the staff when handing over ownership.", userId);
      }
      return true;
    }

    case "ocade_account_unlimited": {
      const found = unlimitedOf(args.target_user);
      return found ? [found] : [];
    }

    case "ocade_grant_unlimited":
    case "ocade_revoke_unlimited": {
      const denied = requireStaff("grants.manage", "change unlimited use");
      if (denied) return denied;
      const mine = roleOf(userId);
      if (mine !== "primary_owner" && mine !== "backup_owner") {
        return refuse("Only an owner changes unlimited use.");
      }
      if (short(args.p_reason)) return short(args.p_reason);
      if (name === "ocade_revoke_unlimited") {
        if (!unlimitedGrants.delete(args.p_user)) return false;
        record(userId, "unlimited_revoked", String(args.p_reason).trim(), args.p_user);
        return true;
      }
      if (args.p_user === userId) return refuse("Nobody grants themselves.");
      if (["primary_owner", "backup_owner"].includes(roleOf(args.p_user))) {
        return refuse("An owner already has unlimited use.", "22023");
      }
      if (!emails.has(args.p_user)) return refuse("No such account.", "P0002");
      const until = args.p_until ? Date.parse(args.p_until) : null;
      if (until !== null && (until < now + 5 * 60_000 || until > now + 3660 * 86_400_000)) {
        return refuse(
          "End it between five minutes and ten years from now, or not at all.",
          "22023",
        );
      }
      unlimitedGrants.set(args.p_user, {
        endsAt: until === null ? null : new Date(until).toISOString(),
      });
      record(userId, "unlimited_granted", String(args.p_reason).trim(), args.p_user);
      return randomUUID();
    }

    case "ocade_staff_end_all_sessions": {
      const denied = requireStaff("staff.manage", "sign every staff member out");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      const ended = endSessions(new Set(staffRoles.keys()), callerSession);
      record(userId, "staff_sessions_ended", String(args.p_reason).trim());
      return ended;
    }

    case "ocade_staff_end_customer_sessions": {
      const denied = requireStaff("sessions.manage", "end a customer's sessions");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      if (["primary_owner", "backup_owner"].includes(roleOf(args.p_user))) {
        return refuse("An owner's sessions are ended by the owner.");
      }
      const ended = endSessions(new Set([args.p_user]));
      record(userId, "customer_sessions_ended", String(args.p_reason).trim(), args.p_user);
      return ended;
    }

    case "ocade_staff_adjust_usage":
    case "ocade_staff_suspend_account":
    case "ocade_staff_begin_account_deletion": {
      const [permission, action] = {
        ocade_staff_adjust_usage: ["usage.manage", "change a customer's usage"],
        ocade_staff_suspend_account: ["accounts.manage", "suspend an account"],
        ocade_staff_begin_account_deletion: ["accounts.delete", "delete an account"],
      }[name];
      const denied = requireStaff(permission, action);
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      const target = args.p_user;
      if (target === userId) return refuse("Nobody does this to their own account.");
      if (["primary_owner", "backup_owner"].includes(roleOf(target))) {
        return refuse("An owner's account is changed by the owner.");
      }
      if (roleOf(target) && !["primary_owner", "backup_owner"].includes(roleOf(userId))) {
        return refuse("A member of staff is changed by an owner.");
      }
      if (!emails.has(target)) return refuse("No such account.", "P0002");
      const reason = String(args.p_reason).trim();
      const stop = () => {
        banned.add(target);
        endSessions(new Set([target]));
        for (const device of jarvisTables.jarvis_devices ?? []) {
          if (device.user_id === target && !device.revoked_at) {
            Object.assign(device, { revoked_at: new Date(now).toISOString(), public_key: null });
          }
        }
        for (const task of jarvisTables.jarvis_tasks ?? []) {
          if (
            task.user_id === target &&
            ["running", "waiting", "taken_over"].includes(task.status)
          ) {
            Object.assign(task, { status: "stopped", blocker: "The account was suspended." });
          }
        }
      };
      if (name === "ocade_staff_adjust_usage") {
        const kind = kindFor(args.p_surface, args.p_window_kind);
        const startsAt = args.p_window_kind === "week" ? week.startsAt : session.startsAt;
        addUsage(target, kind, startsAt, Number(args.p_delta_hundredths));
        record(userId, "usage_adjusted", reason, target);
        return usedIn(target, kind, startsAt);
      }
      if (name === "ocade_staff_suspend_account") {
        if (args.p_suspend) stop();
        else banned.delete(target);
        record(userId, args.p_suspend ? "account_suspended" : "account_restored", reason, target);
        return true;
      }
      if (roleOf(target)) return refuse("Remove their staff role before deleting the account.");
      if (
        String(args.p_email ?? "")
          .trim()
          .toLowerCase() !== emails.get(target).toLowerCase()
      ) {
        return refuse("Type the account's email address exactly to delete it.", "22023");
      }
      stop();
      record(userId, "account_deletion_started", reason, target);
      return true;
    }

    case "ocade_staff_reset_second_factor": {
      const denied = requireStaff("sessions.manage", "turn off a customer's two-step verification");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      if (args.p_user === userId) {
        return refuse("Nobody turns off their own two-step verification this way.");
      }
      if (["primary_owner", "backup_owner"].includes(roleOf(args.p_user))) {
        return refuse("An owner's two-step verification is changed by the owner.");
      }
      if (!emails.has(args.p_user)) return false;
      endSessions(new Set([args.p_user]));
      recoverySheets.delete(args.p_user);
      record(userId, "second_factor_reset", String(args.p_reason).trim(), args.p_user);
      return true;
    }

    case "ocade_case_open": {
      const denied = requireStaff("cases.manage", "open a support case");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      const hours = Number(args.p_hours);
      if (!Number.isInteger(hours) || hours < 1 || hours > 72) {
        return refuse("A case lasts between 1 and 72 hours.", "22023");
      }
      if (args.p_customer === userId) {
        return refuse("A case is about somebody else's account.", "22023");
      }
      // As the migration (F-014): one of this customer's conversations, read by one named reader.
      if (
        !rows(args.p_customer, "ocade_conversations").some((row) => row.id === args.p_conversation)
      ) {
        return refuse("Choose one of this customer's conversations.", "22023");
      }
      const reader = args.p_assignee ?? userId;
      if (reader === args.p_customer || !holds(reader, "cases.read")) {
        return refuse("The person reading must be staff who may read cases.", "22023");
      }
      const id = randomUUID();
      supportCases.push({
        id,
        customer: args.p_customer,
        opened_by: userId,
        assignee: reader,
        conversation: args.p_conversation,
        reason: String(args.p_reason).trim(),
        opened_at: new Date(now).toISOString(),
        expires_at: new Date(now + hours * 3_600_000).toISOString(),
        closed_at: null,
      });
      record(userId, "case_open", String(args.p_reason).trim(), args.p_customer, id);
      return id;
    }

    case "ocade_case_conversations": {
      const denied = requireStaff("cases.manage", "open a support case");
      if (denied) return denied;
      record(userId, "case_read", "Listed conversation titles to open a case.", args.p_customer);
      return rows(args.p_customer, "ocade_conversations")
        .slice(0, 50)
        .map(({ id, title }) => ({ id, title }));
    }

    case "ocade_case_close": {
      const denied = requireStaff("cases.manage", "close a support case");
      if (denied) return denied;
      if (short(args.p_reason)) return short(args.p_reason);
      const open = supportCases.find((row) => row.id === args.p_case && !row.closed_at);
      if (!open) return false;
      open.closed_at = new Date(now).toISOString();
      record(userId, "case_close", String(args.p_reason).trim(), open.customer, open.id);
      return true;
    }

    case "ocade_case_messages": {
      if (
        !staffHas(userId, "cases.read") ||
        (roleOf(userId) !== "primary_owner" && requestAal !== "aal2")
      ) {
        return refuse("Not found");
      }
      const open = supportCases.find(
        (row) => row.id === args.p_case && !row.closed_at && Date.parse(row.expires_at) > now,
      );
      if (!open || open.assignee !== userId || open.conversation !== args.p_conversation) {
        return refuse("This case is closed, has expired or is not yours to read.");
      }
      record(
        userId,
        "case_read",
        "Read a conversation under an open case.",
        open.customer,
        open.id,
      );
      return rows(open.customer, "ocade_messages")
        .filter((row) => row.conversation_id === args.p_conversation)
        .map(({ role, content, created_at }) => ({ role, content, created_at }));
    }

    /* The operator's device removal, with the refusals the function makes. */
    /* The JARVIS stops: global, Device Agent, phones. */
    case "ocade_read_service_controls":
      if (!staffHas(userId, "execution.manage") && !staffHas(userId, "health.read")) {
        return refuse("Only support admins may read service controls.");
      }
      return serviceControls;

    case "ocade_set_service_control": {
      if (!staffHas(userId, "execution.manage")) {
        return refuse("Only support admins may change a service control.");
      }
      if (requestAal !== "aal2") {
        return refuse("Changing a service control needs a recent second factor.");
      }
      if (String(args.change_reason ?? "").trim().length < 10) {
        return refuse("Say why, in at least ten characters.");
      }
      const control = serviceControls.find((row) => row.key === args.control_key);
      if (!control) return refuse("Unknown service control.");
      Object.assign(control, {
        paused: args.pause,
        reason: String(args.change_reason).trim(),
        changed_by: userId,
        changed_at: new Date(now).toISOString(),
      });
      return control;
    }

    case "ocade_admin_remove_device": {
      if (!staffHas(userId, "devices.manage")) {
        return refuse("Only support admins may remove a device.");
      }
      if (requestAal !== "aal2") {
        return refuse("Removing a device needs a recent second factor.");
      }
      if (String(args.remove_reason ?? "").trim().length < 10) {
        return refuse("Say why, in at least ten characters.");
      }
      const device = (jarvisTables.jarvis_devices ?? []).find(
        (row) => row.id === args.device && !row.revoked_at,
      );
      if (!device) return false;
      device.revoked_at = new Date(now).toISOString();
      device.public_key = null;
      for (const task of jarvisTables.jarvis_tasks ?? []) {
        if (
          task.device_id === device.id &&
          ["running", "waiting", "taken_over"].includes(task.status)
        ) {
          Object.assign(task, {
            status: "stopped",
            blocker: "The device was removed.",
            live_frame: null,
          });
        }
      }
      return true;
    }

    case "ocade_record_notification": {
      // One record per event, as the database's unique key makes it.
      const same = recordedNotifications.find(
        (row) => row.user_id === args.p_user_id && row.idempotency_key === args.p_idempotency_key,
      );
      if (same) return same.id;
      const row = {
        id: randomUUID(),
        user_id: args.p_user_id,
        category: args.p_category,
        title: args.p_title,
        body: args.p_body,
        deep_link: args.p_deep_link ?? null,
        idempotency_key: args.p_idempotency_key,
        delivery: args.p_delivery ?? {},
      };
      recordedNotifications.push(row);
      return row.id;
    }

    case "ocade_set_notification_delivery": {
      if (userId !== "anonymous") return refuse("permission denied for function");
      const row = recordedNotifications.find((entry) => entry.id === args.p_id);
      if (row) row.delivery = { ...row.delivery, [args.p_channel]: args.p_state };
      return null;
    }

    case "ocade_push_subscribe": {
      if (userId === "anonymous") return refuse("Sign in to turn on notifications.");
      if (
        !/^(https:\/\/|http:\/\/127\.0\.0\.1:)/.test(String(args.p_endpoint ?? "")) ||
        !/^[A-Za-z0-9_-]{80,100}$/.test(String(args.p_p256dh ?? "")) ||
        !/^[A-Za-z0-9_-]{16,32}$/.test(String(args.p_auth ?? ""))
      ) {
        return refuse("That is not a browser's notification address.", "22023");
      }
      const held = pushSubscriptions.get(args.p_endpoint);
      // Moves to another account only when the same browser (the same keys) asks.
      if (held && (held.p256dh !== args.p_p256dh || held.auth !== args.p_auth)) {
        return refuse("That is not a browser's notification address.", "22023");
      }
      pushSubscriptions.set(args.p_endpoint, {
        endpoint: args.p_endpoint,
        user_id: userId,
        session_id: tokenSession.get(requestToken) ?? "session-current",
        p256dh: args.p_p256dh,
        auth: args.p_auth,
        failures: 0,
        last_sent_at: null,
      });
      return null;
    }

    case "ocade_push_unsubscribe": {
      const held = pushSubscriptions.get(args.p_endpoint);
      if (held && held.user_id === userId) pushSubscriptions.delete(args.p_endpoint);
      return null;
    }

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
/** Tasks already charged their one use (`ocade_jarvis_task_charges`). */
const taskCharges = new Set();
/** Planner turns answered per script trigger, for the timing report (`GET /__fixture/jarvis-script`). */
const plannerTurns = {};
/** A real model for unscripted requests, only when a staging key is given; capped per run. */
const LIVE_GEMINI_KEY = process.env.OCADE_LIVE_GEMINI_KEY ?? "";
const LIVE_MAX_CALLS = Number(process.env.OCADE_LIVE_MAX_CALLS) || 400;
let liveCalls = 0;
/** Whether the live model answers now: only a journey that asks for it gets one. */
let liveModel = false;
/** How long charging an answer takes, set by /__fixture/slow-settlement. */
let settleDelayMs = 0;

/** The next scripted step for this conversation, or null for an ordinary answer. */
function jarvisStep(messages) {
  if (!jarvisScript) return null;
  let typed = -1;
  messages.forEach((message, index) => {
    const content = String(message.content);
    // Tool results and mid-task words are not a new request.
    if (
      message.role === "user" &&
      !content.startsWith("Result of ") &&
      !content.startsWith("While you were working")
    ) {
      typed = index;
    }
  });
  if (typed < 0 || !String(messages[typed].content).includes(jarvisScript.trigger)) return null;
  const after = messages.slice(typed + 1);
  const taken = after.filter(
    (m) => m.role === "assistant" && String(m.content).startsWith("Called "),
  ).length;
  const step = jarvisScript.steps[taken];
  plannerTurns[jarvisScript.trigger] = (plannerTurns[jarvisScript.trigger] ?? 0) + 1;
  if (!step) return { text: "Nothing more to do." };
  // A control named rather than referenced: a browser element, or an app control (ui_act).
  const named = step.args?.name && (step.tool === "browser" || step.args.action === "ui_act");
  if (!named) return step;
  // The newest result of that kind that carries an observation: a declined or
  // refused step returns none, and the page it left is still the one on screen.
  // Read from the text itself: a long observation reaches the model shortened, and a shortened
  // result is not JSON. An app control's id starts with "u", a page's with "o".
  const kind = step.args.action === "ui_act" ? "u" : "o";
  const wanted = JSON.stringify(step.args.name);
  let observationId = null;
  let ref = null;
  for (const message of [...after].reverse()) {
    const text = String(message.content).replace(/\\"/g, '"');
    if (message.role !== "user" || !text.startsWith(`Result of ${step.tool}`)) continue;
    observationId = new RegExp(`"observationId":"(${kind}\\d+)"`).exec(text)?.[1] ?? null;
    if (!observationId) continue;
    for (const element of text.match(/\{[^{}]*\}/g) ?? []) {
      if (element.includes(`"name":${wanted}`)) {
        ref = /"ref":"([^"]+)"/.exec(element)?.[1] ?? null;
        if (ref) break;
      }
    }
    break;
  }
  const { name: _name, ...rest } = step.args;
  return {
    tool: step.tool,
    args: { ...rest, ref: ref ?? "e0", observationId: observationId ?? `${kind}0` },
  };
}

/** The JARVIS stops, one set for the whole service as in production. */
const serviceControls = ["jarvis_execution", "jarvis_agent", "jarvis_android"].map((key) => ({
  key,
  paused: false,
  reason: null,
  changed_by: null,
  changed_at: new Date().toISOString(),
}));

/** What only the service role reads: the staff tables, never reachable with a session. */
const STAFF_STORES = {
  ocade_staff: () =>
    [...staffRoles].map(([user_id, member]) => ({
      user_id,
      created_at: "2026-09-01T00:00:00Z",
      ...member,
    })),
  ocade_staff_invites: () => staffInvites,
  ocade_support_cases: () => supportCases,
  ocade_admin_actions: () => adminActions,
};

/** JARVIS rows, shared across accounts and filtered per session (see the handler). */
const jarvisTables = {};

/** Column defaults the migration gives JARVIS rows. */
const JARVIS_DEFAULTS = {
  jarvis_devices: {
    name: "New device",
    capabilities: {},
    revoked_at: null,
    last_seen_at: null,
    kind: "agent",
    last_request_ms: 0,
    background_enabled: false,
  },
  jarvis_tasks: {
    status: "running",
    current_step: 0,
    plan: [],
    browser_mode: "isolated",
    live_frame: null,
  },
  jarvis_activity: { status: "note", confirmed: false, action: null, result: null },
  jarvis_permissions: { device_id: null },
  jarvis_schedules: {
    device_id: null,
    repeat: "none",
    time_zone: "UTC",
    active: true,
    last_run_at: null,
    last_outcome: null,
  },
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
  // The bytes as sent, for the one caller that is not text (an encrypted push).
  const pieces = [];
  request.on("data", (chunk) => {
    pieces.push(chunk);
    body += chunk;
  });
  request.on("end", () => {
    const rawBody = Buffer.concat(pieces);
    const send = (status, payload, headers = {}) => {
      const text = payload === undefined ? "" : JSON.stringify(payload);
      response.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-expose-headers": "content-range",
        ...headers,
      });
      response.end(text);
    };

    if (request.method === "OPTIONS") return send(204);
    requestToken = (request.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    requestAgent = String(request.headers["user-agent"] ?? "");
    requestAal = tokenAal.get(requestToken) ?? "aal1";

    // What PostgREST's pre-request check does with a token whose session was ended.
    if (
      url.pathname.startsWith("/rest/v1/") &&
      requestToken.endsWith(".stub-signature-not-a-signature") &&
      !sessions.has(requestToken)
    ) {
      // Said out loud: a journey that meets this unexpectedly should see why.
      process.stdout.write(`session-ended 401 ${request.method} ${url.pathname}
`);
      return send(401, {
        code: "PT401",
        message: "This session has been signed out.",
        hint: "session_ended",
      });
    }

    if (url.pathname === "/__fixture/notifications") return send(200, recordedNotifications);
    if (url.pathname === "/__fixture/pushes") return send(200, pushesReceived);
    if (url.pathname === "/__fixture/push-subscriptions")
      return send(200, [...pushSubscriptions.values()]);
    /*
     * A STAND-IN PUSH SERVICE. It keeps exactly what a real one would relay —
     * the encrypted body and OCADE's VAPID header — so a journey can decrypt
     * it with the browser key it registered and see what the person would.
     * `/__push/gone-…` answers 410, as a service does for an expired browser.
     */
    const pushed = /^\/__push\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (pushed && request.method === "POST") {
      pushesReceived.push({
        name: pushed[1],
        authorization: request.headers.authorization ?? "",
        encoding: request.headers["content-encoding"] ?? "",
        urgency: request.headers.urgency ?? "",
        body: Buffer.from(rawBody).toString("base64url"),
      });
      return send(pushed[1].startsWith("gone-") ? 410 : 201, {});
    }
    // An account that already has two-step on, without driving an authenticator.
    if (url.pathname === "/__fixture/enroll-factor") {
      const { userId: target } = JSON.parse(body || "{}");
      factors.set(target, [
        ...(factors.get(target) ?? []),
        { id: randomUUID(), status: "verified", factor_type: "totp", friendly_name: "Phone" },
      ]);
      return send(200, { ok: true });
    }
    if (url.pathname === "/__fixture/audit") return send(200, adminActions);

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
      if (request.method === "GET")
        return send(200, {
          ...(onlineBoundary.lastRequest ?? {}),
          agentTurns: onlineBoundary.lastAgentTurns ?? [],
        });
      onlineBoundary.status = Number(JSON.parse(body || "{}").status ?? 200);
      return send(200, { ok: true });
    }

    if (url.pathname === "/__fixture/due-schedules") {
      const due = new Date(Date.now() - 60_000).toISOString();
      const waiting = (jarvisTables.jarvis_schedules ?? []).filter((row) => row.active !== false);
      for (const row of waiting) row.next_at = due;
      return send(200, { due: waiting.length });
    }

    if (url.pathname === "/__fixture/age-tasks") {
      const silent = new Date(Date.now() - 10 * 60_000).toISOString();
      const aged = (jarvisTables.jarvis_tasks ?? []).filter((task) => task.status === "running");
      for (const task of aged) task.updated_at = silent;
      return send(200, { aged: aged.length });
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
      if (request.method === "GET") return send(200, plannerTurns);
      jarvisScript = JSON.parse(body || "null");
      return send(200, { ok: true });
    }

    if (url.pathname === "/__fixture/usage") {
      // An account's usage ledger and charged tasks, for a journey's failure detail.
      const user = url.searchParams.get("user") ?? "";
      return send(200, {
        usage: rows(user, "__usage"),
        charged: (jarvisTables.jarvis_tasks ?? [])
          .filter((task) => task.user_id === user && taskCharges.has(task.id))
          .map((task) => task.id),
      });
    }

    if (url.pathname === "/__fixture/live-model") {
      liveModel = JSON.parse(body || "{}").on === true;
      return send(200, { on: liveModel, available: Boolean(LIVE_GEMINI_KEY) });
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

    if (url.pathname === "/__fixture/slow-settlement") {
      // POST {"ms":3000}: charging an answer takes as long as a slow network makes it.
      settleDelayMs = Number(JSON.parse(body || "{}").ms) || 0;
      return send(200, { ok: true, settleDelayMs });
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

    /*
     * GOOGLE, STOOD IN FOR. The provider's consent is skipped: the person is
     * sent straight back with a one-time code, kept against the PKCE
     * challenge the browser sent, exactly as the real exchange requires.
     */
    if (url.pathname === "/auth/v1/authorize") {
      /*
       * Like Supabase: back only to a URL on the allow list, matched exactly (the
       * project lists bare callbacks, no wildcards), otherwise to the Site URL. Taking
       * any `redirect_to` hid that `?next=` on the callback sent people to the Site URL.
       */
      const asked = url.searchParams.get("redirect_to") ?? "";
      const allowed = ["http://127.0.0.1:8788"].flatMap((origin) => [
        `${origin}/auth/callback`,
        `${origin}/reset-password`,
      ]);
      const back = new URL(allowed.includes(asked) ? asked : "http://127.0.0.1:8788/");
      const code = randomUUID();
      pkceCodes.set(code, {
        challenge: url.searchParams.get("code_challenge") ?? "",
        method: url.searchParams.get("code_challenge_method") ?? "",
        email: `google-${Date.now()}@ocade.test`,
      });
      back.searchParams.set("code", code);
      response.writeHead(302, { location: back.toString() });
      return response.end();
    }

    if (url.pathname === "/auth/v1/token") {
      const parsed = JSON.parse(body || "{}");
      const grant = url.searchParams.get("grant_type");
      const asking =
        grant === "refresh_token"
          ? refreshes.get(parsed.refresh_token)?.userId
          : grant === "pkce"
            ? idForEmail(pkceCodes.get(String(parsed.auth_code ?? ""))?.email ?? "")
            : idForEmail(String(parsed.email ?? "proof@ocade.test"));
      if (banned.has(asking))
        return send(400, { error_code: "user_banned", msg: "User is banned" });
      if (grant === "pkce") {
        const held = pkceCodes.get(String(parsed.auth_code ?? ""));
        pkceCodes.delete(String(parsed.auth_code ?? ""));
        const proof = createHash("sha256")
          .update(String(parsed.code_verifier ?? ""))
          .digest("base64url");
        if (!held || held.method.toLowerCase() !== "s256" || proof !== held.challenge) {
          return send(400, {
            error_code: "bad_code_verifier",
            msg: "code challenge does not match previously saved code verifier",
          });
        }
        return send(200, openSession(held.email));
      }
      if (grant === "refresh_token") {
        const held = refreshes.get(parsed.refresh_token);
        if (!held) {
          return send(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        }
        refreshes.delete(parsed.refresh_token);
        return send(
          200,
          openSession(emails.get(held.userId), held.aal, held.provedAt, held.sessionId),
        );
      }
      // One password the stub refuses, so a wrong one can be proved refused.
      if (grant === "password" && parsed.password === "wrong-password") {
        return send(400, {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        });
      }
      // A session whose last proof is an hour old: what "Confirm it's you" exists for.
      if (grant === "password" && parsed.password === "stale-proof") {
        const email = parsed.email ?? "proof@ocade.test";
        return send(
          200,
          openSession(email, assuranceOf(email), Math.floor(Date.now() / 1000) - 3600),
        );
      }
      return send(200, openSession(parsed.email ?? "proof@ocade.test"));
    }

    if (url.pathname === "/auth/v1/signup") {
      const parsed = JSON.parse(body || "{}");
      return send(200, openSession(parsed.email ?? "proof@ocade.test"));
    }

    const adminFactor = /^\/auth\/v1\/admin\/users\/([0-9a-f-]+)\/factors\/([^/]+)$/.exec(
      url.pathname,
    );
    if (adminFactor && request.method === "DELETE") {
      if (sessions.has(requestToken)) return send(403, { message: "not the service role" });
      const [, id, factorId] = adminFactor;
      factors.set(
        id,
        (factors.get(id) ?? []).filter((factor) => factor.id !== factorId),
      );
      return send(200, { id: factorId });
    }
    const adminUser = /^\/auth\/v1\/admin\/users\/([0-9a-f-]+)(\/factors)?$/.exec(url.pathname);
    if (adminUser && request.method === "GET") {
      // The service key only: a session token is a customer's, and gets nothing here.
      if (sessions.has(requestToken)) return send(403, { message: "not the service role" });
      const [, id, wantsFactors] = adminUser;
      if (wantsFactors) return send(200, (factors.get(id) ?? []).map(publicFactor));
      return send(200, {
        ...userRecord(id, emails.get(id) ?? ""),
        last_sign_in_at: emails.has(id) ? new Date().toISOString() : null,
        banned_until: banned.has(id) ? "2126-01-01T00:00:00Z" : null,
      });
    }
    if (adminUser && !adminUser[2] && request.method === "DELETE") {
      if (sessions.has(requestToken)) return send(403, { message: "not the service role" });
      const id = adminUser[1];
      // The identity, its sessions and everything that cascades from it.
      for (const [token, owner] of [...sessions]) if (owner === id) sessions.delete(token);
      for (const [token, held] of [...refreshes]) if (held.userId === id) refreshes.delete(token);
      tables.delete(id);
      emails.delete(id);
      banned.delete(id);
      return send(200, {});
    }

    if (url.pathname === "/auth/v1/admin/generate_link" && request.method === "POST") {
      if (sessions.has(requestToken)) return send(403, { message: "not the service role" });
      const parsed = JSON.parse(body || "{}");
      const email = String(parsed.email ?? "").toLowerCase();
      const id = idForEmail(email);
      const hashed = randomBytes(28).toString("hex");
      oneTimeSignIns.set(hashed, { email, expiresAt: Date.now() + 3_600_000 });
      return send(200, {
        ...userRecord(id, email),
        action_link: `${url.origin}/auth/v1/verify?token=${hashed}&type=magiclink`,
        email_otp: "",
        hashed_token: hashed,
        verification_type: "magiclink",
        redirect_to: "",
      });
    }

    if (url.pathname === "/auth/v1/user") {
      const userId = callerFrom(request, body);
      if (!userId) return send(401, { message: "no session" });
      return send(200, userRecord(userId, emails.get(userId) ?? "proof@ocade.test"));
    }

    if (url.pathname === "/auth/v1/logout") {
      const header = request.headers.authorization ?? "";
      const token = header.replace(/^Bearer\s+/i, "");
      // A browser's notifications end with its session, as the foreign key makes them.
      const ended = tokenSession.get(token);
      for (const [endpoint, row] of pushSubscriptions) {
        if (ended && row.session_id === ended && row.user_id === sessions.get(token)) {
          pushSubscriptions.delete(endpoint);
        }
      }
      // The whole session ends, as auth.sessions does: every token and refresh it gave out.
      for (const [held] of [...sessions]) {
        if (held === token || (ended && tokenSession.get(held) === ended)) sessions.delete(held);
      }
      for (const [refresh, held] of [...refreshes]) {
        if (ended && held.sessionId === ended) refreshes.delete(refresh);
      }
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
      if (parsed.token_hash) {
        // Once, and a NEW session: what the console redeems.
        const held = oneTimeSignIns.get(String(parsed.token_hash));
        oneTimeSignIns.delete(String(parsed.token_hash));
        if (!held || held.expiresAt < Date.now()) {
          return send(403, {
            error_code: "otp_expired",
            msg: "Email link is invalid or has expired",
          });
        }
        return send(200, openSession(held.email, assuranceOf(held.email), undefined, randomUUID()));
      }
      if (String(parsed.token) !== OTP_CODE) {
        return send(403, { error_code: "otp_invalid", msg: "Token is invalid" });
      }
      const identity = parsed.email ?? "proof@ocade.test";
      return send(200, openSession(identity));
    }

    const factorPath = /^\/auth\/v1\/factors(?:\/([^/]+))?(?:\/(challenge|verify))?$/.exec(
      url.pathname,
    );
    if (factorPath) {
      const userId = callerFrom(request, "");
      if (!userId) return send(401, { error_code: "no_authorization", msg: "no session" });
      const [, factorId, step] = factorPath;
      const own = factors.get(userId) ?? [];
      factors.set(userId, own);
      const parsed = JSON.parse(body || "{}");
      if (!factorId && request.method === "POST") {
        const name = String(parsed.friendly_name ?? "");
        if (own.some((f) => f.friendly_name === name)) {
          return send(422, {
            error_code: "mfa_factor_name_conflict",
            msg: `A factor with the friendly name "${name}" for this user already exists`,
          });
        }
        const secret = base32(randomBytes(20));
        const issuer = String(parsed.issuer || "localhost");
        own.push({
          id: randomUUID(),
          friendly_name: name,
          factor_type: "totp",
          status: "unverified",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          secret,
          lastStep: -1,
        });
        const factor = own[own.length - 1];
        const label = encodeURIComponent(`${issuer}:${emails.get(userId) ?? ""}`);
        return send(200, {
          id: factor.id,
          type: "totp",
          friendly_name: name,
          totp: {
            qr_code:
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/></svg>',
            secret,
            uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`,
          },
        });
      }
      const factor = own.find((f) => f.id === factorId);
      if (!factor)
        return send(404, { error_code: "mfa_factor_not_found", msg: "Factor not found" });
      if (request.method === "DELETE") {
        if (factor.status === "verified" && requestAal !== "aal2") {
          return send(422, {
            error_code: "insufficient_aal",
            msg: "AAL2 required to unenroll verified factor",
          });
        }
        factors.set(
          userId,
          own.filter((f) => f !== factor),
        );
        return send(200, { id: factor.id });
      }
      if (step === "challenge") {
        const id = randomUUID();
        const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_SECONDS;
        challenges.set(id, { factorId, userId, expiresAt });
        return send(200, { id, type: "totp", expires_at: expiresAt });
      }
      if (step === "verify") {
        const challenge = challenges.get(parsed.challenge_id);
        challenges.delete(parsed.challenge_id);
        if (!challenge || challenge.factorId !== factorId || challenge.userId !== userId) {
          return send(422, { error_code: "mfa_challenge_expired", msg: "Challenge not found" });
        }
        if (challenge.expiresAt * 1000 < Date.now()) {
          return send(422, { error_code: "mfa_challenge_expired", msg: "Challenge has expired" });
        }
        const now = Math.floor(Date.now() / 30_000);
        const matched = [now - 1, now, now + 1].find(
          (counter) => totp(factor.secret, counter) === String(parsed.code ?? ""),
        );
        // An already-used (or older) code is refused: a replayed code proves nothing.
        if (matched === undefined || matched <= factor.lastStep) {
          return send(422, {
            error_code: "mfa_verification_failed",
            msg: "Invalid TOTP code entered",
          });
        }
        factor.lastStep = matched;
        factor.status = "verified";
        factor.updated_at = new Date().toISOString();
        return send(
          200,
          openSession(
            emails.get(userId) ?? "proof@ocade.test",
            "aal2",
            Math.floor(Date.now() / 1000),
            tokenSession.get(requestToken),
          ),
        );
      }
      return send(405, { msg: "method not allowed" });
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
      if (rpc[1] === "ocade_finalize_generation_permit" && settleDelayMs > 0) {
        const charge = () => send(200, handleRpc(rpc[1], args, userId ?? "anonymous"));
        return void setTimeout(charge, settleDelayMs);
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
    if (table && table[1] === "ocade_push_subscriptions") {
      if (sessions.has(requestToken)) {
        return send(403, {
          code: "42501",
          message: "permission denied for table ocade_push_subscriptions",
        });
      }
      const params = [...url.searchParams.entries()];
      const found = [...pushSubscriptions.values()].filter((row) => matches(row, params));
      if (request.method === "GET")
        return send(
          200,
          found.map((row) => project(row, url.searchParams.get("select"))),
        );
      if (request.method === "DELETE") {
        for (const row of found) pushSubscriptions.delete(row.endpoint);
        return send(200, found);
      }
      if (request.method === "PATCH") {
        const patch = JSON.parse(body || "{}");
        for (const row of found) Object.assign(row, patch);
        return send(200, found);
      }
    }
    if (table && (table[1].startsWith("jarvis_") || table[1] === "ocade_entitlement_grants")) {
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
      if (request.method === "HEAD") {
        return send(200, undefined, { "content-range": `*/${found().length}` });
      }
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
          const was = row.status;
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
          // As 20261013090000: a task the server records completed is one use, once.
          if (
            name === "jarvis_tasks" &&
            row.status === "completed" &&
            was !== "completed" &&
            !taskCharges.has(row.id)
          ) {
            taskCharges.add(row.id);
            for (const kind of ["session", "week"]) {
              addUsage(
                row.user_id,
                kindFor("jarvis", kind),
                windowFor(kind, Date.now()).startsAt,
                100,
              );
            }
          }
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
      // The service role reads every account's profile and roles, as the operator screen needs.
      const stored =
        name === "ocade_service_controls"
          ? serviceControls
          : userId === "anonymous" && name in STAFF_STORES
            ? STAFF_STORES[name]()
            : userId === "anonymous" &&
                (name === "ocade_conversations" || name === "ocade_messages")
              ? [...tables.values()].flatMap((owned) => owned[name] ?? [])
              : userId === "anonymous" && (name === "profiles" || name === "user_roles")
                ? name === "profiles"
                  ? [...emails].map(([id, email]) => ({
                      id,
                      email,
                      display_name: null,
                      created_at: "2026-09-01T00:00:00Z",
                      ...rows(id, "profiles")[0],
                    }))
                  : [...tables.values()].flatMap((owned) => owned.user_roles ?? [])
                : name === "profiles" && (select ?? "").includes("online_ai_consent")
                  ? [{ id: userId, ...consentOf(userId) }]
                  : rows(userId, name);
      const single = (request.headers.accept ?? "").includes("vnd.pgrst.object");

      // A signed-in session never reads a staff table directly, exactly as the grants say.
      if (userId !== "anonymous" && name in STAFF_STORES) {
        return send(403, { code: "42501", message: `permission denied for table ${name}` });
      }
      if (request.method === "HEAD") {
        const counted = stored.filter((row) => matches(row, params));
        return send(200, undefined, { "content-range": `*/${counted.length}` });
      }
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

      // Before any write, so a refused POST or PATCH really writes nothing (F-033).
      if (refusals.table === name && (!refusals.method || refusals.method === request.method)) {
        return send(500, { message: `the stub was told to refuse ${request.method} on ${name}` });
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
          // The service role names the account a row belongs to.
          (userId === "anonymous" && row.user_id ? rows(row.user_id, name) : stored).push(created);
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

    const serverDoor = url.pathname === "/functions/v1/ocade-intelligence-service";
    if (url.pathname === "/functions/v1/ocade-intelligence" || serverDoor) {
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
        // Browsers bring a session; OCADE's own server brings a server key and
        // names the person it works for, and never a session.
        authorized: serverDoor
          ? request.headers.apikey === "sb_secret_loopback_stub" &&
            /^[0-9a-f-]{36}$/.test(request.headers["x-ocade-user"] ?? "") &&
            !request.headers.authorization
          : /^Bearer\s+\S+$/i.test(request.headers.authorization ?? ""),
        door: serverDoor ? "server" : "browser",
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
        // The time the model was told it is, which the prompt ends with.
        clock:
          /The time now is [^\n]*/.exec(
            String(
              (parsed.messages ?? []).find((message) => message?.role === "system")?.content ?? "",
            ),
          )?.[0] ?? null,
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
      // The last agent turn too: a web search sent after it would hide what the agent last saw.
      if (!parsed.research) onlineBoundary.lastAgentTurns = onlineBoundary.lastRequest.turns;
      if (!onlineBoundary.lastRequest.authorized) {
        return send(401, { error: "authentication_required" });
      }
      if (!parsed.permit?.id || parsed.permit.source !== "server") {
        return send(400, { error: "invalid_request" });
      }
      if (onlineBoundary.status !== 200) {
        return send(onlineBoundary.status, { error: "provider_unavailable" });
      }
      // Settled here when an answer arrives, as the boundary settles it (boundary.ts).
      const caller = serverDoor
        ? request.headers["x-ocade-user"]
        : sessions.get((request.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
      const settleAsBoundary = (startsTask) => {
        if (!caller || !parsed.permit?.idempotencyKey) return;
        handleRpc(
          "ocade_finalize_generation_permit",
          {
            p_user_id: caller,
            p_idempotency_key: parsed.permit.idempotencyKey,
            p_cost_hundredths: startsTask && parsed.surface === "jarvis" ? 0 : 100,
          },
          caller,
        );
      };
      // As the boundary: nothing is sent for an account that has not agreed to online use.
      const agreed = caller && consentOf(caller);
      if (
        !agreed ||
        !agreed.online_ai_consent_at ||
        agreed.online_ai_consent_version !== "2026-10-13"
      ) {
        return send(403, { error: "online_not_consented" });
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
        settleAsBoundary(calls.some((call) => call.name === "start_task"));
        response.end();
        return;
      }
      /*
       * A REAL MODEL, WHEN A STAGING KEY IS GIVEN (OCADE_LIVE_GEMINI_KEY).
       *
       * Unscripted requests then go through OCADE's own boundary code
       * (edge-handler.ts, as deployed) to Gemini, so a journey proves planning by
       * a real model. Permits are the stub's; the key stays in this process; at
       * most OCADE_LIVE_MAX_CALLS calls (default 400) are made, then 429.
       */
      if (LIVE_GEMINI_KEY && liveModel) {
        if (++liveCalls > LIVE_MAX_CALLS) return send(429, { error: "live_call_cap" });
        plannerTurns.gemini = liveCalls;
        void (async () => {
          const { handleOnlineIntelligence } =
            await import("../../src/lib/intelligence/edge-handler.ts");
          const live = await handleOnlineIntelligence(
            new Request(`http://127.0.0.1:${PORT}${url.pathname}`, {
              method: "POST",
              headers: Object.entries(request.headers).filter(
                ([name, value]) =>
                  typeof value === "string" && !/^(host|content-length)$/.test(name),
              ),
              body,
            }),
            {
              allowedOrigins: new Set([request.headers.origin ?? ""]),
              providerReady: true,
              model: process.env.OCADE_LIVE_GEMINI_MODEL || undefined,
              verifyJwt: async (token) =>
                sessions.has(token) ? { userId: sessions.get(token) } : null,
              verifyService: async (req) =>
                serverDoor && onlineBoundary.lastRequest.authorized
                  ? { userId: req.headers.get("x-ocade-user") }
                  : null,
              claimPermit: async () => ({ ok: true }),
              finalizePermit: async ({ startsTask }) => settleAsBoundary(startsTask),
              callProvider: ({ model, body: providerBody, signal }) =>
                fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
                  {
                    method: "POST",
                    headers: {
                      "content-type": "application/json",
                      "x-goog-api-key": LIVE_GEMINI_KEY,
                    },
                    body: JSON.stringify(providerBody),
                    signal,
                  },
                ).then(async (answer) => {
                  // Google's own reason for a refusal (which quota, and when to retry), never
                  // the key: what tells a per-minute limit from a per-day one.
                  if (!answer.ok) {
                    const said = await answer
                      .clone()
                      .json()
                      .catch(() => ({}));
                    const details = (said.error?.details ?? [])
                      .map(
                        (d) => d.violations?.map((v) => v.quotaId).join(",") ?? d.retryDelay ?? "",
                      )
                      .filter(Boolean)
                      .join(" ");
                    // Which kind of call was refused (a grounded web search or an agent turn), and
                    // how big it was: a per-minute token limit and an unavailable tool look alike.
                    const kind = providerBody.tools?.some((tool) => tool.google_search)
                      ? "research"
                      : "agent";
                    console.log(
                      `live provider ${answer.status} (${kind}, ${JSON.stringify(providerBody).length} chars): ${String(said.error?.status ?? "")} ${String(said.error?.message ?? "").slice(0, 200)} ${details}`.slice(
                        0,
                        500,
                      ),
                    );
                  }
                  return answer;
                }),
            },
          );
          // Each answer's status in the log; a refusal's own words, never the key, beside it.
          console.log(`live model answered ${live.status}`);
          if (!live.ok)
            console.log(`live model refusal: ${(await live.clone().text()).slice(0, 300)}`);
          response.writeHead(live.status, Object.fromEntries(live.headers));
          for await (const chunk of live.body ?? []) response.write(chunk);
          response.end();
        })().catch((error) => {
          console.error(`live model request failed: ${error.message}`);
          if (!response.headersSent) send(502, { error: "live_model_failed" });
          else response.end();
        });
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
