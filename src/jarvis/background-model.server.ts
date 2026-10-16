/**
 * One billed JARVIS model step, asked by OCADE's own server for a person who
 * is not there (see `background.server.ts`). The same gate as a browser: a
 * permit is reserved on the `jarvis` surface first, the Online boundary claims
 * it for that person, and it is charged only if something was delivered.
 * ONLINE ONLY: there is no other path from here.
 */
import { CommercialGenerationGate } from "@/lib/commercial/generation-gate";
import { resolveTierFor } from "@/lib/commercial/entitlement-resolver";
import { supabaseCommercialLedger } from "@/lib/commercial/supabase-ledger";
import { SERVICE_USER_HEADER, type NormalizedToolCall } from "@/lib/intelligence/contract";
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import type { BackgroundDeps } from "./background.server";
import { jarvisTools } from "./protocol";

/** As long as the boundary itself allows one request. */
const STEP_TIMEOUT_MS = 120_000;
const BUSY = ["provider_rate_limited", "online_unavailable", "empty_response", "provider_failed"];

export const serverModel: BackgroundDeps["model"] = async ({
  userId,
  conversationId,
  taskId,
  messages,
  attachments,
}) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "unavailable";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const gate = new CommercialGenerationGate(supabaseCommercialLedger(supabaseAdmin));
  const entitlement = await resolveTierFor(userId);
  const request = crypto.randomUUID();
  const acquired = await gate.acquire({
    userId,
    tier: entitlement.tier,
    anchoredAt: entitlement.anchoredAt,
    now: Date.now(),
    idempotencyKey: request,
    generationId: request,
    surface: "jarvis",
    taskId,
  });
  if (!acquired.ok) return null;

  const online = createOnlineIntelligenceTransport({
    // The server door at the boundary: a server key and the person it works
    // for, never a session.
    fetch: (_input, init) =>
      fetch(`${url.replace(/\/$/, "")}/functions/v1/ocade-intelligence-service`, {
        method: "POST",
        headers: {
          apikey: key,
          [SERVICE_USER_HEADER]: userId,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: init?.body,
        signal: init?.signal,
      }),
    getAccessToken: () => Promise.resolve("server"),
    refreshAccessToken: undefined,
    configuration: () => ({ url, publishableKey: key, configured: true }),
    online: () => true,
  });
  let text = "";
  const toolCalls: NormalizedToolCall[] = [];
  let refusal: { code: string; retryable: boolean } | null = null;
  try {
    for await (const event of online.stream({
      permit: {
        id: acquired.permit.id,
        generationId: request,
        idempotencyKey: request,
        surface: "jarvis",
        source: "server",
      },
      generationId: request,
      idempotencyKey: request,
      surface: "jarvis",
      mode: "online",
      messages,
      // Nothing is saved to memory, and nothing is scheduled, while the person is away.
      tools: jarvisTools(false, false),
      attachments,
      privacy: { onlineInferenceConsented: true, sealed: false },
      conversationId,
      signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
    })) {
      if (event.type === "token") text += event.text;
      else if (event.type === "tool_call") toolCalls.push(event.call);
      else if (event.type === "refusal") refusal = event;
      else if (event.type === "final") {
        text = event.response.text || text;
        if (toolCalls.length === 0) toolCalls.push(...event.response.toolCalls);
      }
    }
  } catch {
    refusal = { code: "online_unavailable", retryable: true };
  }
  const delivered = Boolean(text || toolCalls.length);
  if (delivered) await gate.finalizePersisted({ userId, idempotencyKey: request });
  else await gate.releasePersisted({ userId, idempotencyKey: request, reason: "failed" });
  if (delivered) return { text, toolCalls };
  // A refusal about this request itself (blocked content) ends as words for the person.
  return refusal && !(refusal.retryable && BUSY.includes(refusal.code))
    ? { text: "I could not continue this task safely.", toolCalls: [] }
    : "unavailable";
};
