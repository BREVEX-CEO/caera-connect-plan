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
 * ENTIRELY by the token, which is how the server-rendered half of the app asks
 * "who am I" before deciding whether to send someone to onboarding. Falling
 * back to the default address there answered every such question as the
 * original audit account, so the route gate read one user's profile while the
 * page wrote another's, and onboarding could never complete: the app set
 * `onboarding_completed` on the real account and the gate kept checking a
 * different one.
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

function makeToken(userId, address = EMAIL) {
  // Shaped like a JWT so anything that splits on "." keeps working. Not signed,
  // and nothing here verifies it: this server trusts its own sandbox.
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      email: address,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return `${header}.${body}.${createHash("sha256").update(userId).digest("base64url")}`;
}

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
    created_at: now,
    updated_at: now,
  };
}

function session(id = USER_ID, address = EMAIL) {
  return {
    access_token: makeToken(id, address),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: randomUUID(),
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
 * Deliberately does NOT set `onboarding_completed`: a new account has not
 * onboarded, and the app's gate reads exactly that column to decide.
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

export function startStubSupabase({ port = 0 } = {}) {
  const tables = freshTables();
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
      return send(200, session(id, address));
    }
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (url.pathname === "/auth/v1/settings")
      return send(200, {
        external: { email: true, google: true },
        disable_signup: false,
        mailer_autoconfirm: true,
      });

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
        const found = rows.filter((r) => matches(r, params)).map((r) => project(r, select));
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
          const key = conflict ?? (name === "profiles" ? "id" : "user_id");
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
        return send(200, wantsRows ? [] : [], { "x-removed": String(removed) });
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
