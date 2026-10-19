#!/usr/bin/env node
/** Live High protocol probe. No production DB, personal files or secret values in output.
 * Run only with disposable staging credentials and independently verified included capacity.
 * Billing is checked before admission AND each inference; no paid-plan override exists.
 * These protocol checks are never counted as real JARVIS workflow successes.
 */
import { handleOnlineIntelligence } from "../../src/lib/intelligence/edge-handler.ts";
import { highIncluded } from "../../supabase/functions/_shared/workers-ai.ts";
import { HIGH_ONLINE_MODEL } from "../../src/lib/intelligence/online-models.ts";
import { HIGH_WARNING_VERSION } from "../../src/lib/intelligence/quality.ts";
import { sseData } from "../../src/lib/intelligence/contract.ts";

const account = process.env.OCADE_LIVE_CF_ACCOUNT_ID ?? "";
const token = process.env.OCADE_LIVE_CF_TOKEN ?? "";
const signal = AbortSignal.timeout(120_000);
const eligible = () => highIncluded(account, token, signal);
if (!(await eligible())) {
  console.log(
    "BLOCKED  High contract: disposable credentials or verifiable hard-capped Free plan unavailable. No inference sent.",
  );
  process.exit(3);
}
const samples = [];
let calls = 0;
let input = 0;
let output = 0;
async function turn(messages, tools = []) {
  const id = crypto.randomUUID();
  const before = performance.now();
  const response = await handleOnlineIntelligence(
    new Request("https://probe.invalid", {
      method: "POST",
      headers: {
        Origin: "https://probe.invalid",
        Authorization: "Bearer staging-fixture",
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        permit: { id, generationId: id, idempotencyKey: id, surface: "jarvis", source: "server" },
        generationId: id,
        idempotencyKey: id,
        surface: "jarvis",
        messages,
        tools,
        attachments: [],
        privacy: { onlineInferenceConsented: true, sealed: false },
        quality: "high",
        highModeAcknowledged: HIGH_WARNING_VERSION,
      }),
    }),
    {
      allowedOrigins: new Set(["https://probe.invalid"]),
      providerReady: false,
      verifyJwt: async () => ({ userId: "staging-fixture" }),
      consented: async () => true,
      claimPermit: async () => ({ ok: true }),
      highAvailable: eligible,
      async callProvider({ model, body, signal: requestSignal }) {
        if (model !== HIGH_ONLINE_MODEL || !(await highIncluded(account, token, requestSignal)))
          return new Response(null, { status: 412 });
        calls += 1;
        return fetch(
          `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`,
          {
            method: "POST",
            redirect: "error",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: requestSignal,
          },
        );
      },
    },
  );
  if (!response.ok || !response.body) throw new Error("protocol");
  let final;
  for await (const data of sseData(response.body, "truncated", signal)) {
    const event = JSON.parse(data);
    if (event.type === "refusal") throw new Error("refused");
    if (event.type === "final") final = event.response;
  }
  if (!final) throw new Error("terminal");
  samples.push(performance.now() - before);
  input += final.usage?.inputTokens ?? 0;
  output += final.usage?.outputTokens ?? 0;
  return final;
}
try {
  const question = [
    { role: "user", content: "Call probe_add with a=17, b=25. Do not calculate without the tool." },
  ];
  const planned = await turn(question, [
    {
      name: "probe_add",
      description: "Add two numbers",
      inputSchema: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
    },
  ]);
  const call = planned.toolCalls[0];
  if (
    planned.toolCalls.length !== 1 ||
    call?.name !== "probe_add" ||
    call.arguments.a !== 17 ||
    call.arguments.b !== 25
  )
    throw new Error("arguments");
  console.log("PASS  live High native function arguments");
  const result = await turn([
    ...question,
    {
      role: "assistant",
      content: planned.text,
      toolCalls: planned.toolCalls,
      parts: planned.parts,
    },
    {
      role: "user",
      content: JSON.stringify({ sum: 42 }),
      toolResult: { callId: call.id, name: call.name },
    },
    { role: "user", content: "State the tool's result as a number." },
  ]);
  if (!/\b42\b/.test(result.text) || result.toolCalls.length) throw new Error("continuation");
  console.log("PASS  live High native tool-result continuation");
  samples.sort((a, b) => a - b);
  const percentile = (p) =>
    Math.round(samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)]);
  console.log(
    JSON.stringify({
      evidence: "live protocol only; not task acceptance",
      requests: calls,
      inputTokens: input,
      outputTokens: output,
      sampleCount: samples.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
    }),
  );
} catch {
  console.log(
    "FAIL  High protocol: no workflow acceptance claimed; inspect normalized provider status in the staging environment.",
  );
  process.exitCode = 1;
}
