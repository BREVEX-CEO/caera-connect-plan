/**
 * `QueryDeps.callModel`: the query loop's only route to a model, and it goes
 * to this device.
 *
 * THE DONOR'S PRODUCTION FACTORY WIRED THIS TO A HOSTED CLIENT. That is the one
 * substitution the whole import turns on. The loop above it does not know or
 * care — it asks `deps.callModel` — which is exactly why the donor's
 * dependency boundary was worth keeping and its transport was not.
 *
 * THE ORDER, AND WHY IT IS AN ORDER RATHER THAN A CHOICE
 * ------------------------------------------------------
 * WebGPU when the device has a usable adapter, the WASM runtime when it does
 * not, a paired local runtime when one is connected and selected. Each is
 * slower and more compatible than the last. A person is never asked to pick,
 * because the question ("do you have a usable graphics adapter?") is not one
 * they can answer, and the wrong answer is a product that does not run.
 *
 * WHEN NONE OF THEM CAN SERVE THE DEVICE, THIS REFUSES AND SAYS WHY. It does
 * not fall back to a hosted model, because there is none to fall back to: no
 * code in OCADE can reach one. A refusal with a remedy is the honest end of
 * that road.
 */

import type { CallModelInput, QueryTurn, QueryToolCall } from "@/primary-logic/query/deps";
import type { BrainMessage } from "@/lib/brain/adapter";

/** What `useLocalChatEngine` gives this module. Narrowed to what it needs. */
export interface LocalEngine {
  send: (options: {
    messages: BrainMessage[];
    onToken: (chunk: string) => void;
    tools?: readonly unknown[];
    onToolCall?: (call: { id?: string; name: string; arguments: Record<string, unknown> }) => void;
    signal?: AbortSignal;
  }) => Promise<{ ok: boolean; reason?: string; cancelled?: boolean }>;
}

/**
 * The wire format the on-device runtimes accept for tools.
 *
 * Both the WebGPU and WASM runtimes speak the OpenAI-shaped function-call
 * schema; the query loop speaks the block-shaped one. Converting here rather
 * than in either of them keeps one conversion in one place.
 */
function toWireTools(tools: CallModelInput["tools"]): readonly unknown[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
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
function toBrainMessages(input: CallModelInput): BrainMessage[] {
  const messages: BrainMessage[] = [{ role: "system", content: input.systemPrompt }];
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

export function createCallModel(
  engine: LocalEngine,
): (input: CallModelInput) => Promise<QueryTurn> {
  return async (input) => {
    let text = "";
    const toolCalls: QueryToolCall[] = [];

    const result = await engine.send({
      messages: toBrainMessages(input),
      onToken: (chunk) => {
        text += chunk;
        input.onToken?.(chunk);
      },
      ...(input.tools.length
        ? {
            tools: toWireTools(input.tools),
            onToolCall: (call) =>
              toolCalls.push({
                id: call.id ?? `${call.name}-${toolCalls.length}`,
                name: call.name,
                arguments: call.arguments ?? {},
              }),
          }
        : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });

    if (result.cancelled) {
      /*
       * A stop is the person's decision, and the loop reads an empty completed
       * turn as "nothing more to do" — which is the correct end for a turn
       * somebody stopped. Whatever streamed is kept: it is theirs.
       */
      return { text, toolCalls: [], stopReason: "end_turn" };
    }

    if (!result.ok) {
      /*
       * Thrown rather than returned, because the loop's recovery paths key on
       * the failure: an over-long prompt is retried after compaction, and
       * anything else ends the turn with the engine's own reason. Returning an
       * empty success here would silently discard both.
       */
      throw new Error(result.reason ?? "No engine on this device could answer.");
    }

    return {
      text,
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
