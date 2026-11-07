/**
 * Expired and ended sessions (162). An expired token is refused before any
 * network call; a token whose session was ended, or whose account still owes
 * its second factor, is refused by the database's decision; and every JARVIS
 * server function takes the account from the verified session, never from input.
 * Synthetic tokens and a fake database; no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { sessionStanding } from "../../src/lib/security/session-standing.ts";

const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (claims: object) =>
  `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.${Buffer.from("sig").toString("base64url")}`;

function client() {
  const calls: string[] = [];
  const supabase = createClient("https://project.example.test", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response(JSON.stringify({ code: 401, msg: "invalid JWT" }), { status: 401 });
      },
    },
  });
  return { supabase, calls };
}

test("an expired token is refused without asking anyone", async () => {
  const { supabase, calls } = client();
  const expired = token({
    sub: "u",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const { data, error } = await supabase.auth.getClaims(expired);
  assert.equal(data, null);
  assert.ok(error, "expired token has no claims");
  assert.deepEqual(calls, [], "no network call is spent on an expired token");
});

test("an unexpired symmetric token still needs the auth server's yes", async () => {
  const { supabase, calls } = client();
  const live = token({ sub: "u", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 });
  const { data, error } = await supabase.auth.getClaims(live);
  assert.equal(data, null);
  assert.ok(error, "the server's refusal is final");
  assert.equal(calls.length, 1);
});

test("the database decides whether a session may continue", async (t) => {
  const answer = (data: unknown, error: { code?: string; hint?: string } | null) => {
    let asked = 0;
    return {
      rpc: async () => {
        asked++;
        return { data, error };
      },
      get asked() {
        return asked;
      },
    };
  };
  let n = 0;
  const claims = () => ({ sub: "u", session_id: `s${++n}`, exp: 1, aal: "aal1" });
  const cases: [string, unknown, { code?: string; hint?: string } | null, string][] = [
    ["live session", true, null, "ok"],
    ["owes second factor", false, null, "factor_required"],
    ["session ended", null, { code: "PT401", hint: "session_ended" }, "ended"],
    [
      "factor refused by pre-request",
      null,
      { code: "42501", hint: "factor_required" },
      "factor_required",
    ],
  ];
  for (const [name, data, error, expected] of cases) {
    await t.test(name, async () => {
      assert.equal(await sessionStanding(answer(data, error), claims()), expected);
    });
  }
  await t.test("an unclear answer is an error, never a pass", async () => {
    await assert.rejects(sessionStanding(answer(null, { code: "57014" }), claims()));
  });
  await t.test("a write re-asks, so signing out elsewhere stops it at once", async () => {
    const same = claims();
    const db = answer(true, null);
    await sessionStanding(db, same, 1000);
    await sessionStanding(db, same, 1001);
    assert.equal(db.asked, 1, "reads within the window reuse the answer");
    await sessionStanding(db, same, 1002, true);
    assert.equal(db.asked, 2);
  });
  await t.test("an aal2 token is never answered from the aal1 decision", async () => {
    const db = answer(false, null);
    const base = claims();
    assert.equal(await sessionStanding(db, base, 5000), "factor_required");
    assert.equal(await sessionStanding(answer(true, null), { ...base, aal: "aal2" }, 5001), "ok");
  });
});

test("every JARVIS server function takes the account from the session", () => {
  const source = readFileSync(
    new URL("../../src/lib/jarvis/functions.ts", import.meta.url),
    "utf8",
  );
  const functions = source.split("createServerFn(").slice(1);
  assert.ok(functions.length >= 10, "server functions found");
  for (const body of functions) {
    const handler = body.slice(0, body.indexOf("});") + 3);
    assert.match(handler, /\.middleware\(\[requireSession\]\)/, handler.slice(0, 80));
    assert.doesNotMatch(handler, /userId\s*:/, "an input never names the account");
    assert.doesNotMatch(handler, /data\.user/, "the account never comes from input");
  }
});
