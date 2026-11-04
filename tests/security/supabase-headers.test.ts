import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabaseFetch } from "../../src/integrations/supabase/configuration.ts";

test("copied opaque API keys never become bearer JWTs, including surrounding whitespace", async (t) => {
  const sent: Headers[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    sent.push(new Headers(init?.headers));
    return new Response("{}");
  });
  for (const raw of [
    "sb_secret_synthetic",
    "sb_secret_synthetic\n",
    "  sb_secret_synthetic \r\n",
  ]) {
    await createSupabaseFetch(raw)("http://127.0.0.1/fixture", {
      headers: { Authorization: `Bearer ${raw}` },
    });
    assert.equal(sent.at(-1)?.get("apikey"), "sb_secret_synthetic");
    assert.equal(sent.at(-1)?.get("Authorization"), null);
  }
});

test("normalizing an API key preserves a different caller's bearer JWT", async (t) => {
  const sent: Headers[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    sent.push(new Headers(init?.headers));
    return new Response("{}");
  });
  await createSupabaseFetch(" sb_publishable_synthetic\n")("http://127.0.0.1/fixture", {
    headers: { Authorization: "Bearer caller.jwt.signature" },
  });
  assert.equal(sent.at(-1)?.get("apikey"), "sb_publishable_synthetic");
  assert.equal(sent.at(-1)?.get("Authorization"), "Bearer caller.jwt.signature");
});
