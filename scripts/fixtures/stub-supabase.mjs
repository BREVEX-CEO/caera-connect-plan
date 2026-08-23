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

function makeToken(userId) {
  // Shaped like a JWT so anything that splits on "." keeps working. Not signed,
  // and nothing here verifies it: this server trusts its own sandbox.
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      email: EMAIL,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return `${header}.${body}.${createHash("sha256").update(userId).digest("base64url")}`;
}

function user(id = USER_ID) {
  const now = new Date().toISOString();
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: EMAIL,
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

function session(id = USER_ID) {
  return {
    access_token: makeToken(id),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: randomUUID(),
    user: user(id),
  };
}

/** table -> array of rows. Seeded with the row a new account would have. */
function freshTables() {
  return {
    user_settings: [{ user_id: USER_ID, created_at: new Date().toISOString() }],
    profiles: [{ id: USER_ID, display_name: "Audit Tester", email: EMAIL, phone: null }],
    user_roles: [{ user_id: USER_ID, role: "user" }],
  };
}

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

    /* ---------------------------------------------------------- auth ---- */
    if (url.pathname === "/auth/v1/token") return send(200, session());
    if (url.pathname === "/auth/v1/signup") return send(200, session());
    if (url.pathname === "/auth/v1/user") return send(200, user());
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (url.pathname === "/auth/v1/settings")
      return send(200, {
        external: { email: true },
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
