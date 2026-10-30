/**
 * JARVIS's online planner turn (plan.md §23.3, P13), called only by the OCADE web
 * server, never by a browser or device. One bounded, non-streamed request: the
 * model must answer with exactly one of the functions it is offered, and the web
 * server validates that answer against the protocol before anything is queued.
 *
 * Reuses the Online Intelligence boundary: the same provider keys (which never
 * leave `_shared/boundary.ts`), the same failover slots and the account's own
 * online-AI consent. No consent, no key or a provider refusal is an honest error,
 * never a fallback to another model.
 */
import { boundary } from "../_shared/boundary.ts";
import { DEFAULT_ONLINE_MODEL } from "../../../src/lib/intelligence/online-models.ts";

const PLANNER_KEY = Deno.env.get("JARVIS_PLANNER_KEY") ?? "";
const MAX_BODY = 200_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** The function call in a streamed generateContent answer, or null. */
function firstCall(sse: string): { name: string; args: Record<string, unknown> } | null {
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const chunk = JSON.parse(line.slice(5));
      for (const part of chunk?.candidates?.[0]?.content?.parts ?? []) {
        if (part.functionCall?.name) {
          return { name: part.functionCall.name, args: part.functionCall.args ?? {} };
        }
      }
    } catch {
      // A malformed chunk is skipped; no call found means no decision.
    }
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!sameSecret(request.headers.get("x-ocade-planner-key") ?? "", PLANNER_KEY)) {
    return json(401, { error: "unauthorized" });
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: "too_large" });
  const input = JSON.parse(text) as {
    userId: string;
    system: string;
    prompt: string;
    tools: { name: string; description: string; parameters: unknown }[];
  };
  if (!boundary.providerReady) return json(503, { error: "planner_unavailable" });
  if (!(await boundary.consented!(input.userId)))
    return json(403, { error: "online_not_consented" });

  const body = {
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    system_instruction: { parts: [{ text: input.system }] },
    tools: [
      {
        function_declarations: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: tool.parameters,
        })),
      },
    ],
    tool_config: { function_calling_config: { mode: "ANY" } },
    generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "medium" } },
  };
  for (const slot of boundary.providerSlots ?? []) {
    const response = await boundary.callProvider({
      model: DEFAULT_ONLINE_MODEL,
      body,
      slot,
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 429) return json(429, { error: "provider_quota" });
    if (response.status === 401 || response.status === 403 || response.status >= 500) continue;
    if (!response.ok) return json(502, { error: "provider_refused" });
    const call = firstCall(await response.text());
    return call ? json(200, { call }) : json(502, { error: "no_decision" });
  }
  return json(503, { error: "planner_unavailable" });
});
