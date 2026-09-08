/**
 * `QueryDeps.callModel`: the query loop's only route to intelligence, through
 * OCADE's canonical permit-carrying router.
 *
 * THE DONOR'S PRODUCTION FACTORY WIRED THIS TO A HOSTED CLIENT. That is the one
 * substitution the whole import turns on. The loop above it does not know or
 * care — it asks `deps.callModel` — which is exactly why the donor's
 * dependency boundary was worth keeping and its transport was not.
 *
 * Automatic, Online and Local-only policy lives above this adapter. The query
 * loop receives normalized events and neither knows nor chooses which backend
 * produced them. That separation keeps permission, fallback, privacy and the
 * single commercial permit identical in Chat and tool-running turns.
 */

import type { CallModelInput, QueryTurn, QueryToolCall } from "@/primary-logic/query/deps";
import type { BilledRequest } from "@/lib/commercial/use-generation-permit";
import type {
  IntelligenceMode,
  IntelligencePrivacyPolicy,
  IntelligenceRequest,
  NormalizedMessage,
  OcadeIntelligence,
} from "@/lib/intelligence/contract";

/**
 * The wire format the on-device runtimes accept for tools.
 *
 * Both the WebGPU and WASM runtimes speak the OpenAI-shaped function-call
 * schema; the query loop speaks the block-shaped one. Converting here rather
 * than in either of them keeps one conversion in one place.
 */
function toWireTools(tools: CallModelInput["tools"]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
  }));
}

/**
 * The transcript, in the three roles the on-device engines understand.
 *
 * The loop writes system, user and assistant only, so this is a narrowing
 * rather than a translation — but it is written out because the engines drop an
 * unknown role silently, and a silently dropped message is a model answering a
 * question it never saw.
 */
function toMessages(input: CallModelInput): NormalizedMessage[] {
  const messages: NormalizedMessage[] = [{ role: "system", content: input.systemPrompt }];
  for (const message of input.messages) {
    if (message.role === "system") continue; // The prompt above is the system turn.
    messages.push({
      role: message.role,
      content:
        typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    });
  }
  return messages;
}

export interface CallModelContext {
  intelligence: OcadeIntelligence;
  permit: BilledRequest["permit"];
  mode: IntelligenceMode;
  privacy: IntelligencePrivacyPolicy;
}

export function createCallModel(
  context: CallModelContext,
): (input: CallModelInput) => Promise<QueryTurn> {
  return async (input) => {
    let text = "";
    const toolCalls: QueryToolCall[] = [];
    let finalText: string | null = null;
    let refusal: string | null = null;
    const request: IntelligenceRequest = {
      permit: context.permit,
      generationId: context.permit.generationId,
      idempotencyKey: context.permit.idempotencyKey,
      surface: context.permit.surface,
      mode: context.mode,
      messages: toMessages(input),
      tools: toWireTools(input.tools),
      attachments: [],
      privacy: context.privacy,
      ...(input.signal ? { signal: input.signal } : {}),
    };

    for await (const event of context.intelligence.stream(request)) {
      if (event.type === "token") {
        text += event.text;
        input.onToken?.(event.text);
      }
      if (event.type === "tool_call") {
        toolCalls.push({
          id: event.call.id,
          name: event.call.name,
          arguments: event.call.arguments,
        });
      }
      if (event.type === "final") finalText = event.response.text;
      if (event.type === "refusal") refusal = event.reason;
    }

    if (input.signal?.aborted) {
      return { text: finalText ?? text, toolCalls: [], stopReason: "end_turn" };
    }
    if (refusal && !text.trim() && !finalText?.trim() && toolCalls.length === 0) {
      throw new Error(refusal);
    }

    return {
      text: finalText ?? text,
      toolCalls,
      /*
       * The browser runtimes do not report a stop reason. Inferring `tool_use`
       * from the presence of calls is exact; everything else is `end_turn`,
       * which means the truncation-recovery path stays dormant on these engines
       * rather than firing on a guess. A runtime that does report one can be
       * plumbed through here later without touching the loop.
       */
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
    };
  };
}
