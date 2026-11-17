/**
 * Settings > BYOK on the server (plan 14B.1A.3-6): only a signed-in person changes only their own
 * connections; a refused address or model is never saved; the key never comes back; a test proves
 * tool calls and sight with the customer's own provider and records only what it proved.
 * Scripted provider and database only.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import type { CustomerRoute } from "../../src/lib/intelligence/edge-handler.ts";
import {
  calledTool,
  handleByok,
  sawColours,
  statusOf,
  stripesPng,
  visionProbe,
  type ByokDependencies,
} from "../../src/lib/intelligence/byok-handler.ts";

const origin = "https://ocade.example";
const alice = "00000000-0000-4000-8000-00000000000a";
const conn = "11111111-2222-4333-8444-555555555555";
const secret = "sk-alice-very-secret-9999";

function post(body: unknown, token = "alice-session"): Request {
  return new Request("https://fn/ocade-byok", {
    method: "POST",
    headers: { origin, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface Log {
  saved: unknown[];
  recorded: unknown[];
  sent: unknown[];
}

function deps(
  log: Log,
  answer: (body: unknown) => Response,
  extra: Partial<ByokDependencies> = {},
) {
  const route: CustomerRoute = {
    id: conn,
    enabled: true,
    status: "untested",
    protocol: "openai",
    model: "vendor/model",
    seesImages: null,
  };
  const value: ByokDependencies = {
    allowedOrigins: new Set([origin]),
    verifyJwt: async (token) => (token === "alice-session" ? { userId: alice } : null),
    save: async (input) => (log.saved.push(input), conn),
    route: async (userId, id) => (userId === alice && id === conn ? route : null),
    send: async (_route, body) => (log.sent.push(body), answer(body)),
    record: async (...args) => void log.recorded.push(args),
    enable: async (userId, id) => userId === alice && id === conn,
    choose: async () => undefined,
    remove: async (userId, id) => userId === alice && id === conn,
    ...extra,
  };
  return value;
}

const fresh = (): Log => ({ saved: [], recorded: [], sent: [] });
const ok = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

test("only a signed-in person from OCADE's own site reaches the connections", async () => {
  const log = fresh();
  const handler = deps(log, () => ok({}));
  assert.equal(
    (await handleByok(post({ action: "delete", connectionId: conn }, "forged"), handler)).status,
    401,
  );
  const elsewhere = new Request("https://fn/ocade-byok", {
    method: "POST",
    headers: { origin: "https://evil.example", authorization: "Bearer alice-session" },
    body: "{}",
  });
  assert.equal((await handleByok(elsewhere, handler)).status, 403);
  // Another person's connection id is simply not found.
  const other = "99999999-2222-4333-8444-555555555555";
  assert.equal(
    (await handleByok(post({ action: "delete", connectionId: other }), handler)).status,
    404,
  );
  assert.equal(
    (await handleByok(post({ action: "test", connectionId: other }), handler)).status,
    404,
  );
});

test("a refused address, model or key is never saved; a saved key is never returned", async () => {
  const log = fresh();
  const handler = deps(log, () => ok({}));
  const base = {
    action: "save",
    alias: "Mine",
    protocol: "openai",
    endpoint: "https://api.example.com/v1/",
    model: "vendor/model",
    key: secret,
  };
  for (const [change, error] of [
    [{ endpoint: "http://api.example.com/v1" }, "endpoint_refused"],
    [{ endpoint: "https://169.254.169.254/latest" }, "endpoint_refused"],
    [{ endpoint: "https://localhost/v1" }, "endpoint_refused"],
    [{ endpoint: "https://api.example.com/v1?token=x" }, "endpoint_refused"],
    [{ model: "a,b" }, "model_invalid"],
    [{ protocol: "soap" }, "protocol_invalid"],
    [{ key: "short" }, "key_invalid"],
    [{ key: "has a space inside it" }, "key_invalid"],
    [{ key: undefined }, "key_required"],
    [{ alias: "" }, "alias_invalid"],
  ] as const) {
    const response = await handleByok(post({ ...base, ...change }), handler);
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.equal(((await response.json()) as { error: string }).error, error);
  }
  assert.equal(log.saved.length, 0);
  const saved = await handleByok(post(base), handler);
  const text = await saved.text();
  assert.equal(saved.status, 200);
  assert.doesNotMatch(text, /very-secret/, "the key never comes back");
  assert.deepEqual(log.saved[0], {
    userId: alice,
    connectionId: null,
    alias: "Mine",
    protocol: "openai",
    endpoint: "https://api.example.com/v1",
    model: "vendor/model",
    key: secret,
  });
});

/** What a model that sees would say: the colours of the probe image's two halves, read back. */
function look(dataUrl: string): string {
  const png = Buffer.from(dataUrl.split(",")[1]!, "base64");
  const idat = png.indexOf("IDAT");
  const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
  const name = (offset: number) =>
    ({
      "220,20,20": "red",
      "20,170,40": "green",
      "20,40,220": "blue",
      "240,220,20": "yellow",
      "0,0,0": "black",
      "255,255,255": "white",
    })[[...raw.subarray(offset, offset + 3)].join(",")];
  return [0, 1, 2, 3].map((stripe) => name(1 + (stripe * 16 + 8) * 3)).join(", ");
}

test("a test records what the provider proved: tool calls, and sight only when both colours are named", async () => {
  for (const sees of [false, true]) {
    const log = fresh();
    const handler = deps(log, (body) => {
      const sent = body as { tools?: unknown; messages: { content: unknown }[] };
      if (sent.tools)
        return ok({
          choices: [{ message: { tool_calls: [{ function: { name: "ok", arguments: "{}" } }] } }],
        });
      const parts = sent.messages[0]!.content as { image_url?: { url: string } }[];
      const answer = sees ? look(parts[1]!.image_url!.url) : "I cannot see images.";
      return ok({ choices: [{ message: { content: answer } }] });
    });
    const response = await handleByok(post({ action: "test", connectionId: conn }), {
      ...handler,
      now: () => (sees ? 7e12 : 8e12),
    });
    assert.deepEqual(await response.json(), {
      status: "connected",
      seesImages: sees,
      callsTools: true,
    });
    assert.deepEqual(log.recorded.at(-1), [alice, conn, "connected", sees, true]);
    assert.equal(log.sent.length, 2);
  }
});

test("the colour probe is passed only by naming every stripe in order", async () => {
  const picks = [0.1, 0.5, 0.9, 0.3];
  const probe = await visionProbe("gemini", "m", () => picks.shift() ?? 0);
  assert.equal(probe.colours.length, 4);
  probe.colours.slice(1).forEach((colour, i) => assert.notEqual(colour, probe.colours[i]));
  assert.ok(sawColours(`From the left: ${probe.colours.join(", then ")}.`, probe.colours));
  assert.ok(!sawColours([...probe.colours].reverse().join(" "), probe.colours));
  assert.ok(!sawColours(probe.colours.slice(0, 3).join(" "), probe.colours));
  assert.ok(!sawColours("I cannot see images.", probe.colours));
  const png = Buffer.from(
    await stripesPng([
      [255, 0, 0],
      [0, 0, 255],
    ]),
    "base64",
  );
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 64, "width");
  assert.equal(png.readUInt32BE(20), 16, "height");
});

test("a refused, spent or foreign answer is recorded as such; a key is not an image test", async () => {
  for (const [code, status] of [
    [401, "invalid"],
    [402, "credits_unavailable"],
    [404, "incompatible"],
    [421, "blocked"],
    [429, "rate_limited"],
    [500, "unreachable"],
  ] as const) {
    const log = fresh();
    const handler = deps(log, () => new Response("{}", { status: code }));
    const response = await handleByok(post({ action: "test", connectionId: conn }), {
      ...handler,
      now: () => code * 1_000_000,
    });
    assert.deepEqual(await response.json(), { status, seesImages: null, callsTools: null });
    assert.equal(log.sent.length, 1, "no image test after a failed first call");
    assert.equal(statusOf(code), status);
  }
  const log = fresh();
  const foreign = deps(log, () => ok({ hello: "world" }));
  const response = await handleByok(post({ action: "test", connectionId: conn }), {
    ...foreign,
    now: () => 9e12,
  });
  assert.equal(((await response.json()) as { status: string }).status, "incompatible");
  assert.equal(
    calledTool("gemini", { candidates: [{ content: { parts: [{ text: "hi" }] } }] }),
    false,
  );
});

test("tests are limited per minute: each may spend the customer's own quota", async () => {
  const log = fresh();
  const handler = deps(log, () => new Response("{}", { status: 500 }), { now: () => 1e13 });
  const codes = [];
  for (let i = 0; i < 8; i += 1)
    codes.push((await handleByok(post({ action: "test", connectionId: conn }), handler)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 200, 429, 429]);
});

test("the database's refusals come back as plain answers, never a stack or a key", async () => {
  const log = fresh();
  const handler = deps(log, () => ok({}), {
    choose: async () => {
      throw Object.assign(new Error(`check_violation ${secret}`), { code: "check_violation" });
    },
  });
  const response = await handleByok(
    post({ action: "choose", surface: "jarvis", connectionId: conn }),
    handler,
  );
  assert.equal(response.status, 409);
  const text = await response.text();
  assert.equal(text, JSON.stringify({ error: "not_allowed" }));
});
