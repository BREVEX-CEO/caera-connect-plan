/**
 * A Supabase-shaped server on loopback, for auditing the signed-in product.
 *
 * NOT Supabase. It implements the wire shapes `@supabase/supabase-js` actually
 * sends for auth and for the tables the settings surface touches, backed by an
 * in-memory store. It exists because the signed-in half of OCADE — settings
 * persistence above all — cannot be exercised at all without a session, and no
 * hosted project is reachable from this sandbox.
 *
 * WHAT IT IS GOOD FOR: proving the app's own wiring. A control changes, a
 * request goes out, the row changes, a reload reads it back, and the interface
 * reflects it. That chain is the product's, and every link of it is real here.
 *
 * WHAT IT IS NOT GOOD FOR, and must never be read as: row-level security.
 * Nothing here enforces a policy. RLS is proven where it can be — against real
 * PostgreSQL with the policies applied and queries run as the `authenticated`
 * role — in `db-twin.test.ts`.
 */
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const EMAIL = "audit@ocade.test";

/** The address the modelled provider hands back when nothing else is asked for. */
const OAUTH_EMAIL = "oauth@ocade.test";

/** Authorisation codes issued by `/authorize`, redeemable exactly once. */
const oauthCodes = new Map();

/*
 * ONE ACCOUNT PER ADDRESS, NOT ONE ACCOUNT FULL STOP.
 *
 * This server used to answer every sign-in with the same user id and the same
 * seeded rows, whatever address was typed. That is fine for auditing one
 * screen and quietly wrong for auditing a journey: the second run of any
 * end-to-end script signed in as the FIRST run's user, inherited whatever it
 * left behind, and — because that user's profile already said onboarding was
 * finished — skipped straight past onboarding. A signup proof silently became
 * a sign-in proof, and it looked like a pass.
 *
 * The id is derived from the address rather than random so the same address
 * is the same account across a restart, which is what a person signing back in
 * expects. Any address that is not the original audit account gets its own
 * blank tables, seeded exactly as a new signup would be.
 */
function idForEmail(address) {
  if (!address || address === EMAIL) return USER_ID;
  const digest = createHash("sha256").update(address.toLowerCase()).digest("hex");
  // Shaped as a v4 UUID so anything that validates the format keeps working.
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

/** The address on the request, from the body or from `?email=`. */
function emailFrom(body, url) {
  try {
    const parsed = JSON.parse(body || "{}");
    if (typeof parsed.email === "string" && parsed.email) return parsed.email;
  } catch {
    /* Not JSON — fall through to the query string. */
  }
  return url.searchParams.get("email") ?? EMAIL;
}

/**
 * Who the bearer token says this is.
 *
 * `GET /auth/v1/user` carries no body and no query — the caller is identified
 * ENTIRELY by the token, which is how the app asks "who am I" before reading
 * anything that belongs to a person. Falling back to the default address here
 * answered every such question as the original audit account, so one user's
 * profile was read while another's was written, and a second account in the
 * same run could never be told apart from the first.
 */
function identityFromToken(req) {
  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims.sub !== "string" || !claims.sub) return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : EMAIL };
  } catch {
    return null;
  }
}

/**
 * Sessions, per account, in memory.
 *
 * WHY THIS EXISTS. The Security page lists real sessions and offers to end
 * them, and none of that had ever been driven by a browser audit: nothing
 * modelled `ocade_list_account_sessions`, so the panel read a 404, showed
 * nothing, and every check against it passed vacuously — including the one
 * that matters, which is that ending other sessions actually ends them.
 *
 * Each sign-in creates one, exactly as Supabase does, and the id goes into the
 * token's `session_id` claim because that is what OCADE reads to tell "this
 * browser" from "the other one".
 */
const sessions = new Map();

function openSession(userId, address) {
  const id = randomUUID();
  sessions.set(id, {
    session_id: id,
    user_id: userId,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    assurance: "aal1",
    user_agent: address === EMAIL ? "OCADE audit browser" : "Second audit browser",
    ip_address: "127.0.0.1",
  });
  return id;
}

/**
 * How much older than reality this fixture should treat the last proof as.
 *
 * A browser cannot sit for ten minutes waiting for a session's proof of
 * identity to go stale, and a journey that never reaches the stale case never
 * renders the "confirm it is you" panel — so every check against that panel
 * would pass by never running.
 *
 * The offset is applied where the guard COMPARES, not where the token is
 * minted. Minting it would need the page to refresh its token before the
 * fixture had any effect, and supabase-js refreshes on its own schedule — an
 * hour away — so the run would be measuring a token nobody had asked for yet.
 * What the product sees is identical either way: the server refuses with
 * `reauthentication_required`, which is the branch under test.
 *
 * IT DOES NOT SURVIVE A SIGN-IN, and that is the point: presenting a password
 * genuinely produces fresh proof in real Supabase. If the offset outlived it,
 * the retry after the password prompt could never succeed and this fixture
 * would be modelling a product nobody can use.
 */
let ageProofSeconds = 0;

/** Ten minutes, the same window `ocade_recent_proof_window()` returns. */
const RECENT_PROOF_SECONDS = 600;

function makeToken(
  userId,
  address = EMAIL,
  aal = "aal1",
  sessionId = openSession(userId, address),
) {
  // Shaped like a JWT so anything that splits on "." keeps working. Not signed,
  // and nothing here verifies it: this server trusts its own sandbox.
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      email: address,
      exp: now + 3600,
      // §C: OCADE verifies this against `auth.sessions` before anything
      // irreversible, so a token without it is a token that cannot be checked.
      session_id: sessionId,
      /*
       * ASSURANCE AND THE METHODS THAT PRODUCED IT.
       *
       * Real Supabase puts both in the access token, and OCADE reads both:
       * `aal` decides whether a second factor is still owed, and the LATEST
       * `amr` timestamp is what "recently authenticated" means for high-risk
       * actions. Leaving them out would make every assurance test here pass
       * against a token that says nothing — which is the failure this fixture
       * exists to avoid.
       */
      aal,
      amr:
        aal === "aal2"
          ? [
              { method: "password", timestamp: now - 60 },
              { method: "totp", timestamp: now },
            ]
          : [{ method: "password", timestamp: now }],
    }),
  ).toString("base64url");
  return `${header}.${body}.${createHash("sha256").update(userId).digest("base64url")}`;
}

/**
 * Second factors, per account, in memory.
 *
 * Keyed by user id so one browser run's enrollment does not appear on another
 * account — the same reason the tables are keyed that way.
 */
const factorsByUser = new Map();
const challenges = new Map();

function factorsFor(userId) {
  if (!factorsByUser.has(userId)) factorsByUser.set(userId, []);
  return factorsByUser.get(userId);
}

/**
 * Refresh tokens belonging to sessions that completed a challenge.
 *
 * ASSURANCE IS PER SESSION, NOT PER ACCOUNT, and getting that wrong makes the
 * fixture lie in the most convenient direction. An account-wide "verified"
 * flag means that once ANY browser completes a challenge, every other session
 * for that account is handed an `aal2` token the moment it refreshes — so the
 * route gate never fires and the fixture reports the product as broken (or, if
 * the gate were absent, as working). Real Supabase raises the level for the
 * session that answered the challenge and no other.
 */
const aal2Sessions = new Set();

function user(id = USER_ID, address = EMAIL) {
  const now = new Date().toISOString();
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: address,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Audit Tester" },
    identities: [],
    /*
     * WHERE supabase-js ACTUALLY READS FACTORS FROM.
     *
     * `mfa.listFactors()` and `mfa.getAuthenticatorAssuranceLevel()` both call
     * `getUser()` and walk `user.factors`; neither has an endpoint of its own.
     * A fixture that served factors somewhere else would answer every OCADE
     * question with an empty list while looking correct from the outside.
     *
     * Assurance is NOT here: it is per session and lives in the token, so a
     * factor row says only whether it has ever been verified.
     */
    factors: factorsFor(id),
    created_at: now,
    updated_at: now,
  };
}

function session(id = USER_ID, address = EMAIL, aal = "aal1") {
  const refresh = randomUUID();
  if (aal === "aal2") aal2Sessions.add(refresh);
  return {
    access_token: makeToken(id, address, aal),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refresh,
    user: user(id, address),
  };
}

/** table -> array of rows. Seeded with the rows a new account would have. */
function freshTables() {
  return seedAccount({}, USER_ID, EMAIL);
}

/**
 * Add the rows Supabase's own signup trigger would have created.
 *
 * Deliberately minimal: a new account has a profile, a settings row and the
 * `user` role, and nothing else. Anything a journey needs beyond that has to be
 * created by using the product, which is what makes the journey worth running.
 */
function seedAccount(tables, id, address) {
  (tables.user_settings ??= []).push({ user_id: id, created_at: new Date().toISOString() });
  (tables.profiles ??= []).push({
    id,
    display_name: address === EMAIL ? "Audit Tester" : address.split("@")[0],
    email: address,
    phone: null,
  });
  (tables.user_roles ??= []).push({ user_id: id, role: "user" });
  return tables;
}

/**
 * Columns the real schema defaults and this server otherwise would not.
 *
 * PostgREST inserts get whatever `DEFAULT` the column declares; an in-memory
 * array gets `undefined`. That difference is invisible until some code reads
 * the column and rejects a non-number — which is how unlocking the vault came
 * to fail here with "The vault lock timeout is invalid" while working against
 * real PostgreSQL. Anything with a NOT NULL DEFAULT that code actually reads
 * belongs in this table.
 */
const COLUMN_DEFAULTS = {
  // supabase/migrations/…_0b16767c: NOT NULL DEFAULT 900 CHECK (60..86400)
  vault_config: { lock_timeout_seconds: 900 },
};

/** `user_id=eq.<uuid>` and friends. Only the operators the client sends. */
/**
 * The organization read policies, applied to a stubbed table.
 *
 * Returns `rows` untouched for every other table — this models six policies,
 * not a general RLS engine, and pretending otherwise would be the kind of
 * half-truth that makes a stub worse than none.
 */
function restrictOrganizationRead(name, rows, tables, userId) {
  /*
   * The notification policy is `auth.uid() = user_id`, and it matters here for
   * the same reason the organization ones do: without it a browser run would
   * show one account another account's notifications and call it a pass.
   */
  if (name === "ocade_notifications") return rows.filter((row) => row.user_id === userId);

  /*
   * The status tables are the one PUBLIC-read pair in the schema, and
   * modelling that is the point: a browser run that could only read them
   * while signed in would never exercise the case a status page exists for.
   */
  if (name === "ocade_status_incidents" || name === "ocade_status_incident_updates") {
    return rows;
  }

  /*
   * A DRAFT HELP ARTICLE IS NOT PUBLIC, and modelling that is the point: a
   * browser run against a fixture that showed drafts to everyone would pass
   * while the product leaked half-written guidance into search.
   */
  if (name === "ocade_support_articles") {
    const isAdmin = (tables.user_roles ?? []).some(
      (row) => row.user_id === userId && row.role === "admin",
    );
    return isAdmin ? rows : rows.filter((row) => row.status === "published");
  }
  if (name === "ocade_support_article_revisions") {
    const isAdmin = (tables.user_roles ?? []).some(
      (row) => row.user_id === userId && row.role === "admin",
    );
    return isAdmin ? rows : [];
  }

  const isAdmin = (tables.user_roles ?? []).some(
    (row) => row.user_id === userId && row.role === "admin",
  );

  /*
   * Commercial usage: own rows, or every row for an operator — PLAN.md §G's
   * usage overview. Both halves matter, and the second is the one a browser run
   * would otherwise never exercise, because a screen that shows nothing looks
   * exactly like a screen that shows nothing because it is broken.
   */
  if (name === "ocade_commercial_usage") {
    return isAdmin ? rows : rows.filter((row) => row.user_id === userId);
  }

  if (!name.startsWith("ocade_organization")) return rows;

  // An operator reads the audit log across organizations, and the
  // organizations with it, or a log of opaque identifiers is all they get.
  if (isAdmin && (name === "ocade_organization_events" || name === "ocade_organizations")) {
    return rows;
  }

  const members = tables.ocade_organization_members ?? [];
  const roleIn = (organizationId) =>
    members.find(
      (row) =>
        row.organization_id === organizationId && row.user_id === userId && row.state === "active",
    )?.role ?? null;
  const administers = (organizationId) =>
    roleIn(organizationId) === "owner" || roleIn(organizationId) === "admin";

  if (name === "ocade_organizations") return rows.filter((row) => roleIn(row.id) !== null);
  if (name === "ocade_organization_group_members") {
    const groups = tables.ocade_organization_groups ?? [];
    return rows.filter((row) => {
      const group = groups.find((g) => g.id === row.group_id);
      return group ? roleIn(group.organization_id) !== null : false;
    });
  }
  if (name === "ocade_organization_invites" || name === "ocade_organization_events") {
    return rows.filter((row) => administers(row.organization_id));
  }
  return rows.filter((row) => roleIn(row.organization_id) !== null);
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    const [op, ...rest] = String(raw).split(".");
    const value = rest.join(".");
    const cell = row[key];
    if (op === "eq" && String(cell) !== value) return false;
    if (op === "neq" && String(cell) === value) return false;
    if (op === "is" && !(value === "null" ? cell == null : String(cell) === value)) return false;
    if (
      op === "in" &&
      !value
        .replace(/^\(|\)$/g, "")
        .split(",")
        .includes(String(cell))
    )
      return false;
  }
  return true;
}

function project(row, select) {
  if (!select || select === "*") return row;
  const wanted = select.split(",").map((c) => c.trim().split(":").pop().trim());
  if (wanted.includes("*")) return row;
  const out = {};
  for (const column of wanted) out[column] = row[column] ?? null;
  return out;
}

/**
 * @param {object} [options]
 * @param {number} [options.port]
 * @param {(tables: Record<string, object[]>, userId: string) => void} [options.seed]
 *   Called once with the freshly seeded tables, so a suite can add the rows a
 *   real account would already have — a conversation with an answer in it, for
 *   instance, which no browser run can produce without an engine.
 */
export function startStubSupabase({ port = 0, seed } = {}) {
  const tables = freshTables();
  seed?.(tables, USER_ID);
  const requests = [];

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const body = await new Promise((resolve) => {
      let buffer = "";
      req.on("data", (c) => (buffer += c));
      req.on("end", () => resolve(buffer));
    });
    requests.push({ method: req.method, path: url.pathname, search: url.search, body });

    const send = (status, payload, extra = {}) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": req.headers.origin ?? "*",
        "access-control-allow-credentials": "true",
        // Echo whatever the browser asked for. Guessing the list meant one
        // unlisted header (supabase-js adds its own) failed the preflight and
        // the whole sign-in died with an opaque CORS error.
        "access-control-allow-headers":
          req.headers["access-control-request-headers"] ??
          "authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile, range",
        "access-control-max-age": "600",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS,HEAD",
        "access-control-expose-headers": "content-range",
        ...extra,
      });
      res.end(payload === undefined ? "" : JSON.stringify(payload));
    };

    if (req.method === "OPTIONS") return send(204);

    /* ------------------------------------------------ fixture controls ---- */
    /*
     * Not part of Supabase's surface, and deliberately named so nothing can
     * mistake it for one.
     *
     * A browser journey cannot sit for ten minutes to watch a session's proof
     * of identity go stale, and a journey that never watches it go stale never
     * reaches the "confirm it is you" panel — so every check against that panel
     * would pass by never running. This ages the proof instead. Everything
     * downstream is the real path: the token still carries an
     * authentication-methods list, the guard still reads it, and signing in
     * with a password still clears it.
     */
    /*
     * Make an account an administrator.
     *
     * The admin screens are gated on a role this fixture otherwise never
     * issues, so without this no browser run could reach one — and a screen
     * that has never rendered in a browser is a screen whose checks pass by
     * never running. The journey that uses it also drives the OTHER half: an
     * ordinary account asking for the same route and being sent away.
     */
    if (url.pathname === "/__fixture/grant-admin") {
      const address = String(JSON.parse(body || "{}").email ?? "").toLowerCase();
      if (!address) return send(400, { message: "grant-admin needs an email" });
      const id = idForEmail(address);
      const roles = (tables.user_roles ??= []);
      if (!roles.some((row) => row.user_id === id && row.role === "admin")) {
        roles.push({ user_id: id, role: "admin" });
      }
      return send(200, { user_id: id, role: "admin" });
    }

    if (url.pathname === "/__fixture/age-proof") {
      const seconds = Number(JSON.parse(body || "{}").seconds ?? 0);
      ageProofSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
      return send(200, { ageProofSeconds });
    }

    /* -------------------------------------------------- oauth redirect ---- */
    /*
     * A REDIRECT-BASED PROVIDER, BECAUSE THAT IS THE ONE THING THE PRODUCT
     * DEPENDS ON.
     *
     * Cross-origin isolation is why this exists. COOP `same-origin` severs
     * `window.opener`, so a popup sign-in would break — and the whole argument
     * for isolating the inference routes rests on the claim that this product
     * signs in by navigating the whole document instead. A claim like that has
     * to be exercised, not asserted, so this models the two hops a real
     * provider makes: `/authorize` sends the browser away, and the browser
     * comes back to the application's own callback with a code.
     *
     * The code is opaque and single-use. Nothing here authenticates anybody —
     * it is the SHAPE of the journey that is under test, not an identity
     * check, and `stub-supabase` never claims otherwise.
     */
    if (url.pathname === "/auth/v1/authorize") {
      const address = url.searchParams.get("login_hint") ?? OAUTH_EMAIL;
      const back = url.searchParams.get("redirect_to");
      if (!back) return send(400, { message: "authorize needs redirect_to" });
      const target = new URL(back);

      /*
       * WHICH FLOW, DECIDED THE WAY THE REAL SERVICE DECIDES IT.
       *
       * A client running PKCE sends a `code_challenge` and expects an
       * authorisation code back in the query string, to be exchanged for a
       * session. A client running the implicit flow — which is supabase-js's
       * DEFAULT, and therefore what this application actually does — sends no
       * challenge and expects the tokens themselves in the URL fragment.
       *
       * Modelling only the code branch is how this fixture first "worked" and
       * proved nothing: the application ignored the `?code=` it was never
       * configured to look for, the callback waited for a session that could
       * not arrive, and the journey ended on a spinner. Branching on the
       * challenge means the harness exercises whichever flow the client is
       * built with rather than the one the fixture assumed.
       */
      if (url.searchParams.get("code_challenge")) {
        const code = randomUUID();
        oauthCodes.set(code, { email: address, at: Date.now() });
        target.searchParams.set("code", code);
      } else {
        const id = idForEmail(address);
        if (!(tables.profiles ?? []).some((row) => String(row.id) === id)) {
          seedAccount(tables, id, address);
        }
        const issued = session(id, address);
        target.hash = new URLSearchParams({
          access_token: issued.access_token,
          refresh_token: issued.refresh_token,
          expires_in: String(issued.expires_in),
          expires_at: String(issued.expires_at),
          token_type: "bearer",
          provider_token: randomUUID(),
        }).toString();
      }

      res.writeHead(302, { location: target.toString(), "cache-control": "no-store" });
      return res.end();
    }

    /* ---------------------------------------------------------- auth ---- */
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
      /*
       * Single-use, and that is the assertion the harness cares about: a
       * journey that exchanged the same code twice would be a journey with two
       * sign-ins in it, which is exactly the sort of duplicate this work is
       * meant to rule out.
       */
      const code = body?.auth_code;
      const issued = code ? oauthCodes.get(code) : undefined;
      if (!issued)
        return send(400, { error: "invalid_grant", message: "unknown authorisation code" });
      oauthCodes.delete(code);
      const id = idForEmail(issued.email);
      if (!(tables.profiles ?? []).some((row) => String(row.id) === id)) {
        seedAccount(tables, id, issued.email);
      }
      return send(200, session(id, issued.email));
    }

    if (
      url.pathname === "/auth/v1/token" ||
      url.pathname === "/auth/v1/signup" ||
      url.pathname === "/auth/v1/user"
    ) {
      // A bearer token wins: it is the only thing `GET /auth/v1/user` carries.
      const identity = identityFromToken(req);
      const address = identity?.email ?? emailFrom(body, url);
      const id = identity?.id ?? idForEmail(address);
      // First sight of an address is its signup, whichever endpoint reached us.
      if (!(tables.profiles ?? []).some((row) => String(row.id) === id)) {
        seedAccount(tables, id, address);
      }
      if (url.pathname === "/auth/v1/user") return send(200, user(id, address));
      /*
       * A REFRESH PRESERVES THE LEVEL, it does not grant one. Minting `aal2`
       * here for any session of an enrolled account is exactly how a fixture
       * quietly walks a browser past the challenge it is supposed to be
       * testing.
       */
      let level = "aal1";
      let refreshing = false;
      try {
        const presented = JSON.parse(body || "{}").refresh_token;
        refreshing = Boolean(presented);
        if (presented && aal2Sessions.has(presented)) {
          level = "aal2";
          aal2Sessions.delete(presented);
        }
      } catch {
        /* Not a refresh; a fresh sign-in starts at aal1. */
      }
      /*
       * SIGNING IN IS FRESH PROOF, and a refresh is not.
       *
       * Real Supabase appends an authentication-methods entry when a password
       * is presented and appends nothing when a token is merely renewed. That
       * difference is the entire mechanism behind "confirm it is you": without
       * it, either every session would be permanently recent or no session
       * could ever become recent again.
       */
      if (!refreshing) ageProofSeconds = 0;
      return send(200, session(id, address, level));
    }
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (url.pathname === "/auth/v1/settings")
      return send(200, {
        external: { email: true, google: true },
        disable_signup: false,
        mailer_autoconfirm: true,
      });

    /* ------------------------------------------------------------ mfa ---- */
    /*
     * The wire shapes `supabase.auth.mfa.*` actually sends.
     *
     * WHAT THIS MODELS FAITHFULLY, because OCADE's behaviour depends on it:
     *
     *   - enrollment creates a factor that is `unverified` and protects
     *     NOTHING until a code is checked;
     *   - the assurance level rises only on a verified challenge, never on
     *     enrollment;
     *   - `nextLevel` reports `aal2` exactly when a verified factor exists.
     *
     * WHAT IT DOES NOT MODEL: real TOTP. There is no shared-secret clock here,
     * so any six digits are accepted and `000000` is treated as wrong. That is
     * enough to drive both branches of every screen — accepted and refused —
     * and it is deliberately not a claim that OCADE's TOTP arithmetic is
     * correct, because OCADE does not do that arithmetic: Supabase does.
     */
    const identity = identityFromToken(req) ?? { id: USER_ID, email: EMAIL };

    if (url.pathname === "/auth/v1/factors" && req.method === "POST") {
      const parsed = JSON.parse(body || "{}");
      const id = randomUUID();
      const secret = "JBSWY3DPEHPK3PXP";
      factorsFor(identity.id).push({
        id,
        friendly_name: parsed.friendly_name ?? null,
        factor_type: "totp",
        status: "unverified",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return send(200, {
        id,
        type: "totp",
        friendly_name: parsed.friendly_name ?? null,
        totp: {
          qr_code: "",
          secret,
          uri: `otpauth://totp/OCADE:${encodeURIComponent(identity.email)}?secret=${secret}&issuer=OCADE`,
        },
      });
    }

    const challengeMatch = /^\/auth\/v1\/factors\/([^/]+)\/challenge$/.exec(url.pathname);
    if (challengeMatch && req.method === "POST") {
      const challengeId = randomUUID();
      challenges.set(challengeId, { factorId: challengeMatch[1], userId: identity.id });
      return send(200, {
        id: challengeId,
        type: "totp",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      });
    }

    const verifyMatch = /^\/auth\/v1\/factors\/([^/]+)\/verify$/.exec(url.pathname);
    if (verifyMatch && req.method === "POST") {
      const parsed = JSON.parse(body || "{}");
      const factorId = verifyMatch[1];
      const factor = factorsFor(identity.id).find((entry) => entry.id === factorId);
      if (!factor)
        return send(422, { error: "mfa_verification_failed", message: "factor not found" });
      // Any plausible code passes; 000000 is the deliberate wrong answer, so a
      // test can drive the refusal branch without guessing at a real secret.
      const code = String(parsed.code ?? "");
      if (!/^\d{6}$/.test(code) || code === "000000") {
        return send(422, {
          error: "mfa_verification_failed",
          message: "Invalid TOTP code entered",
        });
      }
      factor.status = "verified";
      factor.updated_at = new Date().toISOString();
      // The session that ANSWERED the challenge is the one that rises.
      return send(200, session(identity.id, identity.email, "aal2"));
    }

    const unenrollMatch = /^\/auth\/v1\/factors\/([^/]+)$/.exec(url.pathname);
    if (unenrollMatch && req.method === "DELETE") {
      const list = factorsFor(identity.id);
      const index = list.findIndex((entry) => entry.id === unenrollMatch[1]);
      if (index >= 0) list.splice(index, 1);
      return send(200, { id: unenrollMatch[1] });
    }

    /* ------------------------------------------------------------ rpc ---- */
    /*
     * The recovery-credential functions, as the server calls them.
     *
     * These mirror the SEMANTICS of the real migration — single use, bound to
     * the account, a batch replacing the last one, a lockout after five wrong
     * guesses — because those semantics are what OCADE's screens depend on.
     * They are NOT a second implementation to be trusted: the real functions
     * are proven against real PostgreSQL in `db-twin.test.ts` and against the
     * live project, and this exists so a browser run can drive the paths that
     * call them rather than skipping them.
     */
    const rpcMatch = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(url.pathname);
    if (rpcMatch) {
      const args = JSON.parse(body || "{}");
      const codes = (tables.__mfa_recovery_codes ??= []);
      const attempts = (tables.__mfa_recovery_attempts ??= []);

      /*
       * Commercial usage is mutated by the server's service-role client, not
       * by a browser. The customer journey still has to exercise that real
       * server path: otherwise a fail-closed gate quite correctly refuses
       * every Chat send and the browser proof never reaches an engine or its
       * truthful unavailable state.
       *
       * Mirror the migration's atomic semantics rather than returning a
       * ceremonial success. An increment that would exceed the supplied cap
       * leaves the row unchanged and returns PostgreSQL's check-violation
       * shape; release is idempotent and floored at zero.
       */
      if (rpcMatch[1] === "ocade_consume_commercial_work") {
        const rows = (tables.ocade_commercial_usage ??= []);
        const cost = Math.max(0, Number(args.p_cost_hundredths) || 0);
        const limit =
          args.p_limit_hundredths === null || args.p_limit_hundredths === undefined
            ? null
            : Math.max(0, Number(args.p_limit_hundredths) || 0);
        const existing = rows.find(
          (row) =>
            row.user_id === args.p_user_id &&
            row.window_kind === args.p_window_kind &&
            row.window_start === args.p_window_start,
        );
        const current = Number(existing?.used_hundredths ?? 0);
        const next = current + cost;
        if (limit !== null && next > limit) {
          return send(400, { code: "23514", message: "allowance_exhausted" });
        }
        if (existing) {
          existing.used_hundredths = next;
          existing.updated_at = new Date().toISOString();
        } else {
          rows.push({
            id: randomUUID(),
            user_id: args.p_user_id,
            window_kind: args.p_window_kind,
            window_start: args.p_window_start,
            used_hundredths: next,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        return send(200, next);
      }

      if (rpcMatch[1] === "ocade_release_commercial_work") {
        const rows = (tables.ocade_commercial_usage ??= []);
        const existing = rows.find(
          (row) =>
            row.user_id === args.p_user_id &&
            row.window_kind === args.p_window_kind &&
            row.window_start === args.p_window_start,
        );
        if (!existing) return send(200, 0);
        existing.used_hundredths = Math.max(
          0,
          Number(existing.used_hundredths ?? 0) - Math.max(0, Number(args.p_cost_hundredths) || 0),
        );
        existing.updated_at = new Date().toISOString();
        return send(200, existing.used_hundredths);
      }

      if (rpcMatch[1] === "ocade_replace_mfa_recovery_codes") {
        const hashes = args.p_code_hashes ?? [];
        if (!Array.isArray(hashes) || hashes.length === 0) {
          return send(400, { code: "23514", message: "a recovery batch cannot be empty" });
        }
        for (let i = codes.length - 1; i >= 0; i -= 1) {
          if (codes[i].user_id === args.p_user_id) codes.splice(i, 1);
        }
        for (const hash of hashes) {
          codes.push({ user_id: args.p_user_id, code_hash: hash, used_at: null });
        }
        for (let i = attempts.length - 1; i >= 0; i -= 1) {
          if (attempts[i].user_id === args.p_user_id) attempts.splice(i, 1);
        }
        return send(200, hashes.length);
      }

      if (rpcMatch[1] === "ocade_count_mfa_recovery_codes") {
        const mine = codes.filter((row) => row.user_id === args.p_user_id);
        return send(200, [
          {
            remaining: mine.filter((row) => row.used_at === null).length,
            total: mine.length,
            generated_at: mine.length > 0 ? new Date().toISOString() : null,
          },
        ]);
      }

      if (rpcMatch[1] === "ocade_consume_mfa_recovery_code") {
        let attempt = attempts.find((row) => row.user_id === args.p_user_id);
        if (!attempt) {
          attempt = { user_id: args.p_user_id, failed_count: 0 };
          attempts.push(attempt);
        }
        if (attempt.failed_count >= 5) return send(200, "locked");

        const match = codes.find(
          (row) =>
            row.user_id === args.p_user_id &&
            row.code_hash === args.p_code_hash &&
            row.used_at === null,
        );
        if (!match) {
          attempt.failed_count += 1;
          return send(200, attempt.failed_count >= 5 ? "locked" : "rejected");
        }
        match.used_at = new Date().toISOString();
        attempt.failed_count = 0;
        return send(200, "consumed");
      }

      /* ------------------------------------------------------ sessions ---- */
      /*
       * The session authority §C describes: list what is signed in, end one,
       * end every other. Bound to the caller's account in every case — a
       * session id belonging to somebody else matches no row, which is the
       * property the real functions hold with a WHERE clause rather than with
       * a validated parameter.
       */
      if (rpcMatch[1] === "ocade_list_account_sessions") {
        return send(
          200,
          [...sessions.values()]
            .filter((row) => row.user_id === (args.p_user_id ?? identity.id))
            .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at)),
        );
      }

      if (rpcMatch[1] === "ocade_revoke_account_session") {
        const row = sessions.get(args.p_session_id);
        if (!row || row.user_id !== (args.p_user_id ?? identity.id)) return send(200, 0);
        sessions.delete(args.p_session_id);
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_revoke_other_account_sessions") {
        const owner = args.p_user_id ?? identity.id;
        const keep = args.p_keep_session_id ?? null;
        let removed = 0;
        for (const [id, row] of [...sessions]) {
          if (row.user_id !== owner) continue;
          if (keep && id === keep) continue;
          sessions.delete(id);
          removed += 1;
        }
        return send(200, removed);
      }

      if (rpcMatch[1] === "ocade_session_is_live") {
        const row = sessions.get(args.p_session_id);
        return send(200, Boolean(row) && row.user_id === (args.p_user_id ?? identity.id));
      }

      /* --------------------------------------------- conversation share ---- */
      /*
       * SHARING A CONVERSATION, MODELLED BECAUSE A BROWSER RUN HAS TO DRIVE IT.
       *
       * The real functions are proven against real PostgreSQL in
       * `conversation-share-schema.test.ts`, including the parts a stub cannot
       * establish: that the table is unreadable by `anon`, that the reader
       * bypasses row-level security safely, and that a stranger's revoke
       * changes nothing. What is modelled here is the SEMANTICS the two screens
       * depend on — the snapshot, the single live link, the refusals, and a
       * revoked token reading as nothing — so the §8 journey can create a link
       * in one browser context and open it in a signed-out one.
       *
       * The refusal DETAIL strings are the contract the interface branches on,
       * so they are the same strings, deliberately.
       */
      const shares = (tables.ocade_conversation_shares ??= []);
      const refuseWithDetail = (message, detail, status = 400) =>
        send(status, { code: "P0001", message, details: detail });

      if (rpcMatch[1] === "ocade_share_conversation") {
        if (!identity.id) {
          return refuseWithDetail("Sign in to share a conversation.", "authentication_required");
        }
        const conversation = (tables.ocade_conversations ?? []).find(
          (row) => row.id === args.p_conversation_id,
        );
        // One answer for "not yours" and "does not exist": telling them apart
        // would let anybody test whether a conversation id is real.
        if (!conversation || conversation.user_id !== identity.id) {
          return refuseWithDetail(
            "That conversation is not available to share.",
            "not_found_or_forbidden",
          );
        }
        if (conversation.privacy_mode !== "private_sync") {
          return refuseWithDetail(
            "This conversation is stored only on your device, so there is nothing here to share.",
            "conversation_not_synchronised",
          );
        }
        const turns = (tables.ocade_messages ?? [])
          .filter((row) => row.conversation_id === args.p_conversation_id)
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        if (turns.length === 0) {
          return refuseWithDetail(
            "There is nothing in this conversation to share yet.",
            "conversation_empty",
          );
        }
        const snapshot = turns.map((row) => ({
          role: row.role,
          content: row.content,
          created_at: row.created_at,
          // The count, not the attachments: sharing a conversation is not
          // consent to publish the documents read during it.
          attachment_count: Array.isArray(row.attachments) ? row.attachments.length : 0,
        }));
        const live = shares.find(
          (row) => row.conversation_id === args.p_conversation_id && !row.revoked_at,
        );
        if (live) {
          // The token survives a refresh: a link already sent must not stop
          // working because its owner updated what it shows.
          Object.assign(live, {
            title: conversation.title,
            messages: snapshot,
            message_count: snapshot.length,
            snapshot_at: new Date().toISOString(),
            expires_at: args.p_expires_at ?? null,
          });
          return send(200, live.token);
        }
        const created = {
          id: randomUUID(),
          token: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "").slice(0, 16),
          conversation_id: args.p_conversation_id,
          owner_id: identity.id,
          title: conversation.title,
          messages: snapshot,
          message_count: snapshot.length,
          snapshot_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          expires_at: args.p_expires_at ?? null,
          revoked_at: null,
        };
        shares.push(created);
        return send(200, created.token);
      }

      if (rpcMatch[1] === "ocade_revoke_conversation_share") {
        if (!identity.id) {
          return refuseWithDetail(
            "Sign in to stop sharing a conversation.",
            "authentication_required",
          );
        }
        let revoked = 0;
        for (const row of shares) {
          // Scoped to the caller's own shares. The real function runs as the
          // table owner, so this predicate IS the access control there too.
          if (
            row.conversation_id === args.p_conversation_id &&
            row.owner_id === identity.id &&
            !row.revoked_at
          ) {
            row.revoked_at = new Date().toISOString();
            revoked += 1;
          }
        }
        return send(200, revoked);
      }

      if (rpcMatch[1] === "ocade_read_shared_conversation") {
        /*
         * The one function a signed-out visitor may call. Revoked, expired and
         * unknown all return the same empty answer — a distinguishable
         * "revoked" would confirm a guessed token had once been real.
         */
        const row = shares.find(
          (candidate) =>
            candidate.token === args.p_token &&
            !candidate.revoked_at &&
            (!candidate.expires_at || Date.parse(candidate.expires_at) > Date.now()),
        );
        if (!row) return send(200, []);
        return send(200, [
          {
            title: row.title,
            messages: row.messages,
            message_count: row.message_count,
            snapshot_at: row.snapshot_at,
          },
        ]);
      }

      /* ------------------------------------------------- notifications ---- */
      /*
       * The notification recorder and the two mark-read functions.
       *
       * The real ones are proven against real PostgreSQL in
       * `notification-schema.test.ts`, including the parts that matter most and
       * that a stub cannot establish: that `authenticated` cannot record a
       * notification for itself, and cannot rewrite one it received. What is
       * modelled here is the SEMANTICS the screens depend on — idempotent
       * insert, read state, per-account scoping — so a browser run can drive
       * the history rather than skip it.
       */
      const notifications = (tables.ocade_notifications ??= []);
      const me = identity.id;

      /**
       * The assurance level the caller's own token carries.
       *
       * The entitlement functions check this in the DATABASE rather than only
       * in the application, so the fixture reads it from the presented token
       * the same way: a screen that had lost its second-factor step would
       * otherwise pass a browser run against a fixture that never asked.
       */
      const claimedAal = () => {
        const payload = String(req.headers.authorization ?? "").split(".")[1];
        try {
          return payload
            ? (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).aal ?? "aal1")
            : "aal1";
        } catch {
          return "aal1";
        }
      };

      if (rpcMatch[1] === "ocade_record_notification") {
        const existing = notifications.find(
          (row) => row.user_id === args.p_user_id && row.idempotency_key === args.p_idempotency_key,
        );
        // Idempotent on the key, exactly as the unique constraint makes it.
        if (existing) return send(200, existing.id);
        const row = {
          id: randomUUID(),
          user_id: args.p_user_id,
          category: args.p_category,
          title: args.p_title,
          body: args.p_body ?? "",
          deep_link: args.p_deep_link ?? null,
          created_at: new Date().toISOString(),
          read_at: null,
          delivery: args.p_delivery ?? {},
          idempotency_key: args.p_idempotency_key,
        };
        notifications.push(row);
        return send(200, row.id);
      }

      if (rpcMatch[1] === "ocade_mark_notification_read") {
        // Bound to the caller: an id belonging to somebody else matches nothing.
        const row = notifications.find(
          (candidate) => candidate.id === args.p_notification_id && candidate.user_id === me,
        );
        if (!row || row.read_at) return send(200, 0);
        row.read_at = new Date().toISOString();
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_mark_all_notifications_read") {
        let marked = 0;
        for (const row of notifications) {
          if (row.user_id === me && !row.read_at) {
            row.read_at = new Date().toISOString();
            marked += 1;
          }
        }
        return send(200, marked);
      }

      /* ------------------------------------------------- organizations ---- */
      /*
       * THE ORGANIZATION FUNCTIONS, MODELLED FOR THE SCREEN — NOT AS A SECOND
       * IMPLEMENTATION.
       *
       * The real ones are `SECURITY DEFINER` plpgsql in
       * `20260904120000_ocade_organizations_and_membership.sql`, and their
       * AUTHORIZATION is proven where authorization actually lives: against
       * real PostgreSQL under `SET ROLE authenticated`, in
       * `organization-schema.test.ts`, which issues the forged requests §F
       * names and watches them be refused.
       *
       * What CANNOT be proven there is whether a person can use the screen: that
       * the invitation link appears once and is copyable, that a refusal reaches
       * the page in words, that last-owner protection disables the control
       * rather than only failing the call, that deleting asks for the name. Those
       * need a browser, and a browser needs something to answer. This is that
       * something.
       *
       * It mirrors the refusals verbatim — the same sentences the migration
       * raises — because the screen renders them, and a stub that invented its
       * own wording would prove the page can display a string rather than the
       * string a person will actually see.
       */
      const orgs = (tables.ocade_organizations ??= []);
      const memberRows = (tables.ocade_organization_members ??= []);
      const inviteRows = (tables.ocade_organization_invites ??= []);
      const groupRows = (tables.ocade_organization_groups ??= []);
      const groupMemberRows = (tables.ocade_organization_group_members ??= []);
      const eventRows = (tables.ocade_organization_events ??= []);

      const roleIn = (organizationId) =>
        memberRows.find(
          (row) =>
            row.organization_id === organizationId && row.user_id === me && row.state === "active",
        )?.role ?? null;
      const administers = (organizationId) =>
        roleIn(organizationId) === "owner" || roleIn(organizationId) === "admin";
      const owns = (organizationId) => roleIn(organizationId) === "owner";
      const activeOwners = (organizationId, excludingMemberId) =>
        memberRows.filter(
          (row) =>
            row.organization_id === organizationId &&
            row.role === "owner" &&
            row.state === "active" &&
            row.id !== excludingMemberId,
        ).length;
      const refuse = (message) => send(400, { code: "P0001", message });

      /*
       * THE ASSURANCE GUARD, MODELLED BECAUSE THE PRODUCT DEPENDS ON IT.
       *
       * `ocade_require_recent_strong_auth` runs inside the four high-risk
       * organization mutations in the real schema, where it is proven against
       * real PostgreSQL in `organization-assurance.test.ts`. This is not a
       * second implementation to be trusted — it exists so a browser run can
       * DRIVE the refusal: without it the "confirm it is you" panel would never
       * render in any browser, and its checks would pass by never happening.
       *
       * Same rule, same order: a second factor first when the account holds
       * one, then recency for everybody, then a proof time that cannot be read
       * treated as not recent. Same PostgREST shape on the way out, so the
       * screen reads `details` exactly as it does against the real database.
       */
      /** Answers the request and returns true when it refused, because `send`
       * returns nothing and a caller cannot tell a refusal from a pass without
       * this — which is how the fixture answered twice and crashed the run. */
      const requireRecentStrongAuth = (action) => {
        const payload = String(req.headers.authorization ?? "").split(".")[1];
        let claims = null;
        try {
          claims = payload ? JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) : null;
        } catch {
          claims = null;
        }
        const enrolled = factorsFor(me).some((factor) => factor.status === "verified");
        if (enrolled && (claims?.aal ?? "aal1") !== "aal2") {
          send(403, {
            code: "PT403",
            details: "factor_required",
            message: `Confirm the code from your authenticator app before ${action}. It only takes a moment and it stops somebody who finds this browser open from doing it instead.`,
          });
          return true;
        }
        const provedAt = Array.isArray(claims?.amr)
          ? claims.amr.reduce(
              (latest, entry) =>
                typeof entry?.timestamp === "number" && entry.timestamp > latest
                  ? entry.timestamp
                  : latest,
              Number.NEGATIVE_INFINITY,
            )
          : Number.NEGATIVE_INFINITY;
        const now = Math.floor(Date.now() / 1000) + ageProofSeconds;
        if (!Number.isFinite(provedAt) || provedAt > now || now - provedAt > RECENT_PROOF_SECONDS) {
          send(403, {
            code: "PT403",
            details: "reauthentication_required",
            message: `Confirm it is you before ${action}. This is asked for anything that could lock somebody out of their work, however long you have been signed in.`,
          });
          return true;
        }
        return false;
      };
      const record = (organizationId, event, subject = null, detail = {}) => {
        eventRows.push({
          id: randomUUID(),
          organization_id: organizationId,
          event,
          actor_id: me,
          subject_id: subject,
          detail,
          created_at: new Date().toISOString(),
        });
      };

      if (rpcMatch[1] === "ocade_org_role") {
        return send(200, roleIn(args.p_organization_id));
      }
      if (rpcMatch[1] === "ocade_org_can_administer") {
        return send(200, administers(args.p_organization_id));
      }
      if (rpcMatch[1] === "ocade_org_is_owner") {
        return send(200, owns(args.p_organization_id));
      }

      if (rpcMatch[1] === "ocade_create_organization") {
        if (orgs.some((row) => row.slug === args.p_slug)) {
          return send(409, {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          });
        }
        const organizationId = randomUUID();
        orgs.push({
          id: organizationId,
          name: String(args.p_name).trim(),
          slug: String(args.p_slug).trim().toLowerCase(),
          created_by: me,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        memberRows.push({
          id: randomUUID(),
          organization_id: organizationId,
          user_id: me,
          role: "owner",
          state: "active",
          invited_by: null,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        record(organizationId, "organization.created", me, { slug: args.p_slug });
        return send(200, organizationId);
      }

      if (rpcMatch[1] === "ocade_rename_organization") {
        if (!administers(args.p_organization_id)) {
          return refuse("Only an owner or admin may rename this organization.");
        }
        const organization = orgs.find((row) => row.id === args.p_organization_id);
        if (!organization) return send(200, 0);
        organization.name = String(args.p_name).trim();
        record(args.p_organization_id, "organization.renamed", null, { name: organization.name });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_delete_organization") {
        const organization = orgs.find((row) => row.id === args.p_organization_id);
        if (!organization) return send(200, 0);
        if (!owns(args.p_organization_id)) {
          return refuse("Only an owner may delete this organization.");
        }
        if (args.p_typed_name !== organization.name) {
          return refuse("Type the organization name exactly to confirm.");
        }
        if (requireRecentStrongAuth("deleting this organization")) return;
        const cascade = (list) => {
          for (let i = list.length - 1; i >= 0; i -= 1) {
            if (list[i].organization_id === args.p_organization_id) list.splice(i, 1);
          }
        };
        cascade(memberRows);
        cascade(inviteRows);
        cascade(groupRows);
        cascade(eventRows);
        orgs.splice(orgs.indexOf(organization), 1);
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_invite_to_organization") {
        if (!administers(args.p_organization_id)) {
          return refuse("Only an owner or admin may invite people to this organization.");
        }
        if (args.p_role === "owner" && !owns(args.p_organization_id)) {
          return refuse("Only an owner may invite another owner.");
        }
        const email = String(args.p_email).trim().toLowerCase();
        if (
          inviteRows.some(
            (row) =>
              row.organization_id === args.p_organization_id &&
              row.email === email &&
              !row.accepted_at &&
              !row.revoked_at,
          )
        ) {
          return refuse("That address already has an open invitation. Resend it instead.");
        }
        const inviteId = randomUUID();
        inviteRows.push({
          id: inviteId,
          organization_id: args.p_organization_id,
          email,
          role: args.p_role,
          token_hash: args.p_token_hash,
          invited_by: me,
          created_at: new Date().toISOString(),
          expires_at: args.p_expires_at,
          accepted_at: null,
          accepted_by: null,
          revoked_at: null,
          revoked_by: null,
        });
        record(args.p_organization_id, "invite.sent", null, { invite_id: inviteId, email });
        return send(200, inviteId);
      }

      if (rpcMatch[1] === "ocade_resend_organization_invite") {
        const invite = inviteRows.find((row) => row.id === args.p_invite_id);
        if (!invite) return refuse("That invitation no longer exists.");
        if (!administers(invite.organization_id)) {
          return refuse("Only an owner or admin may resend an invitation.");
        }
        if (invite.accepted_at) return refuse("That invitation has already been accepted.");
        if (invite.revoked_at) return refuse("That invitation was withdrawn. Send a new one.");
        invite.token_hash = args.p_token_hash;
        invite.expires_at = args.p_expires_at;
        record(invite.organization_id, "invite.resent", null, { invite_id: invite.id });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_revoke_organization_invite") {
        const invite = inviteRows.find((row) => row.id === args.p_invite_id);
        if (!invite || invite.accepted_at || invite.revoked_at) return send(200, 0);
        if (!administers(invite.organization_id)) return send(200, 0);
        invite.revoked_at = new Date().toISOString();
        invite.revoked_by = me;
        record(invite.organization_id, "invite.revoked", null, { invite_id: invite.id });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_accept_organization_invite") {
        const invite = inviteRows.find((row) => row.token_hash === args.p_token_hash);
        if (!invite) return refuse("That invitation link is not valid.");
        if (invite.revoked_at) return refuse("That invitation was withdrawn.");
        if (invite.accepted_at) {
          if (invite.accepted_by === me) return send(200, invite.organization_id);
          return refuse("That invitation has already been used.");
        }
        if (Date.parse(invite.expires_at) <= Date.now()) {
          return refuse("That invitation has expired. Ask for a new one.");
        }
        if (
          !memberRows.some(
            (row) => row.organization_id === invite.organization_id && row.user_id === me,
          )
        ) {
          memberRows.push({
            id: randomUUID(),
            organization_id: invite.organization_id,
            user_id: me,
            role: invite.role,
            state: "active",
            invited_by: invite.invited_by,
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        invite.accepted_at = new Date().toISOString();
        invite.accepted_by = me;
        record(invite.organization_id, "invite.accepted", me, { invite_id: invite.id });
        return send(200, invite.organization_id);
      }

      if (rpcMatch[1] === "ocade_set_organization_member_role") {
        const target = memberRows.find((row) => row.id === args.p_member_id);
        if (!target) return refuse("That person is not in this organization.");
        const callerRole = roleIn(target.organization_id);
        if (callerRole !== "owner" && callerRole !== "admin") {
          return refuse("Only an owner or admin may change a role.");
        }
        if ((args.p_role === "owner" || target.role === "owner") && callerRole !== "owner") {
          return refuse("Only an owner may change an owner's role.");
        }
        if (
          target.role === "owner" &&
          args.p_role !== "owner" &&
          activeOwners(target.organization_id, target.id) === 0
        ) {
          return refuse("This is the last owner. Make somebody else an owner first.");
        }
        if (target.role === args.p_role) return send(200, 0);
        if (requireRecentStrongAuth("changing what this person may do")) return;
        record(target.organization_id, "member.role_changed", target.user_id, {
          from: target.role,
          to: args.p_role,
        });
        target.role = args.p_role;
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_set_organization_member_state") {
        const target = memberRows.find((row) => row.id === args.p_member_id);
        if (!target) return refuse("That person is not in this organization.");
        if (!administers(target.organization_id)) {
          return refuse("Only an owner or admin may deactivate a member.");
        }
        if (target.role === "owner" && !owns(target.organization_id)) {
          return refuse("Only an owner may deactivate an owner.");
        }
        if (
          args.p_state === "deactivated" &&
          target.role === "owner" &&
          activeOwners(target.organization_id, target.id) === 0
        ) {
          return refuse("This is the last active owner.");
        }
        if (target.state === args.p_state) return send(200, 0);
        target.state = args.p_state;
        record(
          target.organization_id,
          args.p_state === "deactivated" ? "member.deactivated" : "member.reactivated",
          target.user_id,
          {},
        );
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_remove_organization_member") {
        const target = memberRows.find((row) => row.id === args.p_member_id);
        if (!target) return send(200, 0);
        if (!administers(target.organization_id)) {
          return refuse("Only an owner or admin may remove a member.");
        }
        if (target.role === "owner" && !owns(target.organization_id)) {
          return refuse("Only an owner may remove an owner.");
        }
        if (target.role === "owner" && activeOwners(target.organization_id, target.id) === 0) {
          return refuse("This is the last owner. Transfer ownership first.");
        }
        if (requireRecentStrongAuth("removing this person from the organization")) return;
        memberRows.splice(memberRows.indexOf(target), 1);
        record(target.organization_id, "member.removed", target.user_id, { role: target.role });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_transfer_organization_ownership") {
        if (!owns(args.p_organization_id)) {
          return refuse("Only an owner may transfer ownership.");
        }
        if (args.p_to_user_id === me) return refuse("You already own this organization.");
        const recipient = memberRows.find(
          (row) =>
            row.organization_id === args.p_organization_id && row.user_id === args.p_to_user_id,
        );
        if (!recipient) return refuse("That person is not in this organization.");
        if (recipient.state !== "active") {
          return refuse("A deactivated member cannot become the owner.");
        }
        if (requireRecentStrongAuth("handing this organization to somebody else")) return;
        recipient.role = "owner";
        const outgoing = memberRows.find(
          (row) => row.organization_id === args.p_organization_id && row.user_id === me,
        );
        if (outgoing) outgoing.role = "admin";
        record(args.p_organization_id, "ownership.transferred", args.p_to_user_id, { from: me });
        return send(200, 1);
      }

      if (
        rpcMatch[1] === "ocade_my_organizations_blocking_deletion" ||
        rpcMatch[1] === "ocade_organizations_blocking_deletion"
      ) {
        /*
         * The organizations this account cannot walk away from — §O.
         *
         * An organization blocks when this account is its ONLY active owner.
         * `solo` then separates the two answers a person needs: one they can
         * hand over, and one they can only close because nobody else is in it.
         */
        const about = args.p_user_id ?? me;
        const blocking = orgs
          .filter((organization) => {
            const owners = memberRows.filter(
              (row) =>
                row.organization_id === organization.id &&
                row.role === "owner" &&
                row.state === "active",
            );
            return owners.length === 1 && owners[0].user_id === about;
          })
          .map((organization) => ({
            organization_id: organization.id,
            name: organization.name,
            solo: !memberRows.some(
              (row) =>
                row.organization_id === organization.id &&
                row.user_id !== about &&
                row.state === "active",
            ),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return send(200, blocking);
      }

      if (rpcMatch[1] === "ocade_save_support_article") {
        /*
         * The help-publishing writer. Both writes, in the order the migration
         * makes them: the current row and the append-only revision. A fixture
         * that wrote only the first would let a screen pass that changes an
         * answer with no record of who changed it.
         */
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only an administrator may publish help content." });
        }
        const current = (tables.ocade_support_articles ??= []);
        const existing = current.find((row) => row.slug === args.p_slug);
        const fields = {
          slug: args.p_slug,
          title: String(args.p_title ?? "").trim(),
          summary: String(args.p_summary ?? "").trim(),
          category: args.p_category,
          body: args.p_body ?? [],
          keywords: args.p_keywords ?? [],
          status: args.p_status,
          updated_at: new Date().toISOString(),
          updated_by: me,
        };
        if (existing) Object.assign(existing, fields);
        else current.push(fields);
        (tables.ocade_support_article_revisions ??= []).push({
          ...fields,
          id: randomUUID(),
          note: args.p_note ?? "",
          created_at: new Date().toISOString(),
          created_by: me,
        });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_open_status_incident") {
        /*
         * The two status writers, modelled so a browser run can publish an
         * incident and then read it back from the public page. The role check
         * and the append of the first update are both here because both are in
         * the migration: a fixture that opened an incident with no update would
         * let a screen pass that publishes a headline with no information.
         */
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only an administrator may publish an incident." });
        }
        const openingState = args.p_kind === "maintenance" ? "scheduled" : "investigating";
        const incidentId = randomUUID();
        (tables.ocade_status_incidents ??= []).push({
          id: incidentId,
          component_ids: args.p_component_ids ?? [],
          kind: args.p_kind,
          title: String(args.p_title ?? "").trim(),
          impact: args.p_impact,
          state: openingState,
          started_at: args.p_started_at ?? new Date().toISOString(),
          scheduled_end: args.p_scheduled_end ?? null,
          resolved_at: null,
          created_by: me,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        (tables.ocade_status_incident_updates ??= []).push({
          id: randomUUID(),
          incident_id: incidentId,
          state: openingState,
          body: String(args.p_body ?? "").trim(),
          created_by: me,
          created_at: new Date().toISOString(),
        });
        return send(200, incidentId);
      }

      if (rpcMatch[1] === "ocade_post_status_incident_update") {
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only an administrator may update an incident." });
        }
        const incident = (tables.ocade_status_incidents ?? []).find(
          (row) => row.id === args.p_incident_id,
        );
        if (!incident) return refuse("That incident does not exist.");
        if (incident.state === "resolved") {
          return refuse("That incident is resolved. Open a new one if it has recurred.");
        }
        (tables.ocade_status_incident_updates ??= []).push({
          id: randomUUID(),
          incident_id: incident.id,
          state: args.p_state,
          body: String(args.p_body ?? "").trim(),
          created_by: me,
          created_at: new Date().toISOString(),
        });
        incident.state = args.p_state;
        incident.resolved_at = args.p_state === "resolved" ? new Date().toISOString() : null;
        incident.updated_at = new Date().toISOString();
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_admin_notification_delivery") {
        /*
         * The aggregate, modelled because the operations screen is built on it
         * and a browser run against a 404 would report an empty deployment as
         * a healthy one.
         *
         * The role check comes first, exactly as the migration orders it: the
         * screen is gated too, and a fixture that answered anybody would let a
         * broken gate pass unnoticed.
         */
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only an administrator may read notification delivery." });
        }
        const since = Date.parse(args.p_since ?? "") || 0;
        const counts = new Map();
        for (const row of tables.ocade_notifications ?? []) {
          if (Date.parse(row.created_at ?? "") < since) continue;
          for (const [channel, state] of Object.entries(row.delivery ?? {})) {
            const key = `${row.category}\u0000${channel}\u0000${state}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
        return send(
          200,
          [...counts.entries()]
            .map(([key, occurrences]) => {
              const [category, channel, state] = key.split("\u0000");
              return { category, channel, state, occurrences };
            })
            .sort((a, b) => b.occurrences - a.occurrences),
        );
      }

      /*
       * ENTITLEMENT GRANTS — PLAN.md §H, modelled in the same order the
       * database checks them: the role, then the second factor, then the
       * reason, then the window, then the refusal to grant to oneself. A
       * fixture that skipped straight to the insert would let a screen that
       * had lost one of those checks pass a browser run.
       */
      if (rpcMatch[1] === "ocade_grant_entitlement") {
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only support admins may grant an entitlement." });
        }
        if (claimedAal() !== "aal2") {
          return send(403, { message: "Granting an entitlement needs a recent second factor." });
        }
        const reason = String(args.grant_reason ?? "").trim();
        if (reason.length < 10) {
          return send(400, { message: "new row violates check constraint on reason" });
        }
        const days = Number(args.days ?? 30);
        if (!Number.isInteger(days) || days < 1 || days > 366) {
          return send(400, { message: "A grant runs for between 1 and 366 days." });
        }
        if (args.target_user === me) {
          return send(403, {
            message: "An entitlement cannot be granted to the account granting it.",
          });
        }
        const now = Date.now();
        const row = {
          id: randomUUID(),
          user_id: args.target_user,
          granted_by: me,
          tier: args.grant_tier,
          reason,
          starts_at: new Date(now).toISOString(),
          ends_at: new Date(now + days * 86400000).toISOString(),
          revoked_at: null,
          revoked_by: null,
          revoked_reason: null,
          created_at: new Date(now).toISOString(),
        };
        (tables.ocade_entitlement_grants ??= []).push(row);
        return send(200, row);
      }

      if (rpcMatch[1] === "ocade_revoke_entitlement") {
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only support admins may revoke an entitlement." });
        }
        if (claimedAal() !== "aal2") {
          return send(403, { message: "Revoking an entitlement needs a recent second factor." });
        }
        const grant = (tables.ocade_entitlement_grants ?? []).find(
          (row) => row.id === args.grant_id && !row.revoked_at,
        );
        if (!grant) return send(200, false);
        grant.revoked_at = new Date().toISOString();
        grant.revoked_by = me;
        grant.revoked_reason = String(args.revoke_reason ?? "");
        return send(200, true);
      }

      /* The strongest grant the CALLER holds. It can only ever mean them. */
      if (rpcMatch[1] === "ocade_my_entitlement_grant") {
        const now = Date.now();
        const mine = (tables.ocade_entitlement_grants ?? [])
          .filter(
            (row) =>
              row.user_id === me &&
              !row.revoked_at &&
              Date.parse(row.starts_at) <= now &&
              Date.parse(row.ends_at) > now,
          )
          .sort(
            (a, b) =>
              (b.tier === "max" ? 2 : 1) - (a.tier === "max" ? 2 : 1) ||
              Date.parse(b.ends_at) - Date.parse(a.ends_at),
          );
        return send(
          200,
          mine.slice(0, 1).map((row) => ({
            tier: row.tier,
            starts_at: row.starts_at,
            ends_at: row.ends_at,
            reason: row.reason,
          })),
        );
      }

      /* Seats, as counts. The membership rows themselves are never returned. */
      if (rpcMatch[1] === "ocade_admin_seat_overview") {
        const isAdmin = (tables.user_roles ?? []).some(
          (row) => row.user_id === me && row.role === "admin",
        );
        if (!isAdmin) {
          return send(403, { message: "Only a support admin may read the seat overview." });
        }
        const members = tables.ocade_organization_members ?? [];
        const invites = tables.ocade_organization_invites ?? [];
        const now = Date.now();
        return send(
          200,
          (tables.ocade_organizations ?? []).map((organization) => {
            const own = members.filter(
              (row) => row.organization_id === organization.id && row.state === "active",
            );
            return {
              organization_id: organization.id,
              organization_name: organization.name,
              created_at: organization.created_at,
              seats: own.length,
              admins: own.filter((row) => row.role === "owner" || row.role === "admin").length,
              pending_invites: invites.filter(
                (row) =>
                  row.organization_id === organization.id &&
                  !row.accepted_at &&
                  !row.revoked_at &&
                  Date.parse(row.expires_at ?? "") > now,
              ).length,
            };
          }),
        );
      }

      /*
       * NOTIFICATION PREFERENCES, WHICH BELONG TO THE ACCOUNT.
       *
       * Modelled because the product's own claim is that a preference set on
       * one device reaches the others — and without the function here that
       * request 404s, the save reports failure, and a browser run cannot tell
       * a working sync from a device-local store. The revision behaves as the
       * real function's does: one on insert, one more on every update, which
       * is what the reader uses to decide whether its copy is stale.
       */
      if (rpcMatch[1] === "ocade_save_notification_preferences") {
        const rows = (tables.ocade_notification_preferences ??= []);
        const existing = rows.find((row) => row.user_id === me);
        const now = new Date().toISOString();
        if (existing) {
          existing.mute_optional = args.p_mute_optional;
          existing.quiet_hours = args.p_quiet_hours;
          existing.categories = args.p_categories;
          existing.updated_at = now;
          existing.revision = Number(existing.revision ?? 0) + 1;
          return send(200, existing.revision);
        }
        rows.push({
          user_id: me,
          mute_optional: args.p_mute_optional,
          quiet_hours: args.p_quiet_hours,
          categories: args.p_categories,
          updated_at: now,
          revision: 1,
        });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_set_organization_policy") {
        if (!administers(args.p_organization_id)) {
          return refuse("Only an owner or admin may change what this organization allows.");
        }
        const policies = (tables.ocade_organization_policies ??= []);
        const existing = policies.find((row) => row.organization_id === args.p_organization_id);
        const capabilities = args.p_withheld_capabilities ?? [];
        const domains = args.p_withheld_tool_domains ?? [];
        const same = (a, b) => a.length === b.length && a.every((entry) => b.includes(entry));
        if (
          existing &&
          same(existing.withheld_capabilities ?? [], capabilities) &&
          same(existing.withheld_tool_domains ?? [], domains)
        ) {
          return send(200, 0);
        }
        // Saving an unchanged form asks nothing; a real change does, exactly as
        // the migration orders it.
        if (requireRecentStrongAuth("changing what this organization allows")) return;
        const before = {
          capabilities: existing?.withheld_capabilities ?? [],
          tool_domains: existing?.withheld_tool_domains ?? [],
        };
        if (existing) {
          existing.withheld_capabilities = capabilities;
          existing.withheld_tool_domains = domains;
          existing.updated_at = new Date().toISOString();
          existing.updated_by = me;
        } else {
          policies.push({
            organization_id: args.p_organization_id,
            withheld_capabilities: capabilities,
            withheld_tool_domains: domains,
            updated_at: new Date().toISOString(),
            updated_by: me,
          });
        }
        record(args.p_organization_id, "policy.changed", null, {
          from: before,
          to: { capabilities, tool_domains: domains },
        });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_create_organization_group") {
        if (!administers(args.p_organization_id)) {
          return refuse("Only an owner or admin may create a group.");
        }
        const groupId = randomUUID();
        groupRows.push({
          id: groupId,
          organization_id: args.p_organization_id,
          name: String(args.p_name).trim(),
          created_at: new Date().toISOString(),
        });
        record(args.p_organization_id, "group.created", null, { group_id: groupId });
        return send(200, groupId);
      }

      if (rpcMatch[1] === "ocade_delete_organization_group") {
        const group = groupRows.find((row) => row.id === args.p_group_id);
        if (!group) return send(200, 0);
        if (!administers(group.organization_id)) {
          return refuse("Only an owner or admin may delete a group.");
        }
        for (let i = groupMemberRows.length - 1; i >= 0; i -= 1) {
          if (groupMemberRows[i].group_id === group.id) groupMemberRows.splice(i, 1);
        }
        groupRows.splice(groupRows.indexOf(group), 1);
        record(group.organization_id, "group.deleted", null, { group_id: group.id });
        return send(200, 1);
      }

      if (rpcMatch[1] === "ocade_set_organization_group_membership") {
        const group = groupRows.find((row) => row.id === args.p_group_id);
        const target = memberRows.find((row) => row.id === args.p_member_id);
        if (!group || !target) return refuse("That group or member no longer exists.");
        if (group.organization_id !== target.organization_id) {
          return refuse("That member is not in this group's organization.");
        }
        if (!administers(group.organization_id)) {
          return refuse("Only an owner or admin may change group membership.");
        }
        const existing = groupMemberRows.findIndex(
          (row) => row.group_id === group.id && row.member_id === target.id,
        );
        if (args.p_present) {
          if (existing >= 0) return send(200, 0);
          groupMemberRows.push({
            group_id: group.id,
            member_id: target.id,
            added_at: new Date().toISOString(),
          });
          record(group.organization_id, "group.member_added", target.user_id, {
            group_id: group.id,
          });
          return send(200, 1);
        }
        if (existing < 0) return send(200, 0);
        groupMemberRows.splice(existing, 1);
        record(group.organization_id, "group.member_removed", target.user_id, {
          group_id: group.id,
        });
        return send(200, 1);
      }

      return send(404, { message: `stub-supabase does not model rpc ${rpcMatch[1]}` });
    }

    /* ------------------------------------------------------ postgrest ---- */
    const rest = /^\/rest\/v1\/([a-z0-9_]+)$/.exec(url.pathname);
    if (rest) {
      const name = rest[1];
      const rows = (tables[name] ??= []);
      const params = [...url.searchParams.entries()];
      const select = url.searchParams.get("select");
      const prefer = String(req.headers.prefer ?? "");
      const wantsRows = prefer.includes("return=representation");

      if (req.method === "GET" || req.method === "HEAD") {
        /*
         * ROW-LEVEL SECURITY, MODELLED FOR THE ORGANIZATION TABLES ONLY.
         *
         * PostgREST returns what the policies allow, and the organization
         * screens depend on that: a member sees their own organizations and
         * nobody else's, and invitations and the audit trail are ADMIN-only, so
         * an ordinary member's list is empty rather than forbidden. Without
         * this the browser run would show one account another account's team
         * and call it a pass.
         *
         * The real policies are proven against real PostgreSQL under
         * `SET ROLE authenticated` in `organization-schema.test.ts`. This is
         * here so the screen is driven the way a person will meet it.
         */
        const visible = restrictOrganizationRead(name, rows, tables, identity.id);
        const found = visible.filter((r) => matches(r, params)).map((r) => project(r, select));
        return send(200, found, {
          "content-range": `0-${Math.max(found.length - 1, 0)}/${found.length}`,
        });
      }

      if (req.method === "POST") {
        const incoming = JSON.parse(body || "[]");
        const list = Array.isArray(incoming) ? incoming : [incoming];
        const conflict = url.searchParams.get("on_conflict");
        const written = [];
        for (const item of list) {
          /*
           * Messages and activity events are append-only one-to-many
           * relations. Treating `user_id` as their implicit key made the
           * second turn or action from an account look like a duplicate row,
           * so the fixture returned 409 even though both real tables are keyed
           * by `id`.
           */
          const key =
            conflict ??
            (name === "profiles" || name === "ocade_messages" || name === "activity_log"
              ? "id"
              : "user_id");
          const existing =
            conflict || rows.some((r) => key in r)
              ? rows.find((r) => String(r[key]) === String(item[key]))
              : undefined;
          if (existing && prefer.includes("merge-duplicates")) {
            Object.assign(existing, item);
            written.push(existing);
          } else if (existing) {
            return send(409, {
              code: "23505",
              message: `duplicate key value violates unique constraint on ${name}`,
            });
          } else {
            const row = {
              id: item.id ?? randomUUID(),
              created_at: new Date().toISOString(),
              ...COLUMN_DEFAULTS[name],
              ...item,
            };
            rows.push(row);
            written.push(row);
          }
        }
        return send(201, wantsRows ? written.map((r) => project(r, select)) : []);
      }

      if (req.method === "PATCH") {
        const patch = JSON.parse(body || "{}");
        const touched = [];
        for (const row of rows) {
          if (matches(row, params)) {
            Object.assign(row, patch);
            touched.push(row);
          }
        }
        return send(200, wantsRows ? touched.map((r) => project(r, select)) : []);
      }

      if (req.method === "DELETE") {
        const keep = rows.filter((r) => !matches(r, params));
        const removed = rows.length - keep.length;
        tables[name] = keep;
        /*
         * `content-range` IS THE COUNT, and `x-removed` never was.
         *
         * A client that asks `.delete({ count: "exact" })` sends
         * `Prefer: count=exact` and reads the count out of `content-range` —
         * supabase-js knows nothing about `x-removed`, so it reported `null`
         * and every delete looked like it removed nothing. `deleteAllConversations`
         * returns exactly that number to the screen, which would have told
         * somebody who just cleared four hundred conversations that none were
         * deleted. The header stays alongside it because the fixture's own
         * assertions read it.
         */
        return send(200, wantsRows ? [] : [], {
          "x-removed": String(removed),
          "content-range": `*/${removed}`,
        });
      }
    }

    /* Anything the product asks for that is not modelled says so loudly, so a
     * missing endpoint cannot be mistaken for an empty result. */
    send(404, { message: `stub-supabase does not model ${req.method} ${url.pathname}` });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        userId: USER_ID,
        email: EMAIL,
        session: () => session(),
        tables,
        requests,
        close: () => new Promise((r) => server.close(r)),
      }),
    );
  });
}

if (process.argv[1] && process.argv[1].endsWith("stub-supabase.mjs")) {
  const s = await startStubSupabase({ port: Number(process.env.STUB_SUPABASE_PORT ?? 54321) });
  console.log(`stub supabase on ${s.url} (user ${s.userId})`);
}
