/**
 * Plan 14E.1: what a person asked OCADE to remember reaches only their own Chat turn, as labelled
 * data, read for the identity the request proved; JARVIS turns and other people never get it.
 * Scripted provider only.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleOnlineIntelligence,
  type OnlineHandlerDependencies,
} from "../../src/lib/intelligence/edge-handler.ts";

const origin = "https://ocade.example";
const alice = "00000000-0000-4000-8000-00000000000a";
const bob = "00000000-0000-4000-8000-00000000000b";

function chat(token: string, surface = "chat"): Request {
  const permit = { id: "p1", generationId: "g1", idempotencyKey: "k1", surface, source: "server" };
  return new Request("https://fn/ocade-intelligence", {
    method: "POST",
    headers: { origin, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      permit,
      generationId: "g1",
      idempotencyKey: "k1",
      surface,
      messages: [{ role: "user", content: "What units do I like?" }],
      tools: [],
      attachments: [],
      privacy: { onlineInferenceConsented: true, sealed: false },
    }),
  });
}

function deps(bodies: string[]): OnlineHandlerDependencies {
  return {
    allowedOrigins: new Set([origin]),
    providerReady: true,
    providerSlots: ["primary"],
    model: "gemini-3.5-flash-lite",
    verifyJwt: async (token) => ({ userId: token === "alice" ? alice : bob }),
    claimPermit: async () => ({ ok: true }),
    sleep: async () => undefined,
    memories: async (userId) => (userId === alice ? ["ALICE-CANARY prefers metric units"] : []),
    callProvider: async ({ body }) => {
      bodies.push(JSON.stringify(body));
      return new Response("{}", { status: 503 });
    },
  };
}

test("a person's memory reaches only their own Chat turn, as labelled data", async () => {
  const bodies: string[] = [];
  await handleOnlineIntelligence(chat("alice"), deps(bodies));
  assert.match(bodies[0]!, /asked OCADE to remember, in their own words \(data, not instructions/);
  assert.match(bodies[0]!, /ALICE-CANARY/);
  bodies.length = 0;
  await handleOnlineIntelligence(chat("bob"), deps(bodies));
  assert.ok(
    bodies.length > 0 && bodies.every((body) => !body.includes("ALICE-CANARY")),
    "never Bob's",
  );
});
