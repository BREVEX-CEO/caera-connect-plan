/**
 * The join: one model turn, carrying tool schemas, against the fixed engine.
 *
 * This is the function whose absence the audit named. Everything else — the
 * router, the registry, the loop, the adapters — is scaffolding around the
 * moment a local model is handed a list of things it may do and answers with
 * one of them.
 *
 * WHICH MODEL: `local/fixed-model.ts` decides, from the platform alone. Not the
 * largest installed, not the fastest measured, not the one that fits. The
 * user's other models are listed for display and never routed to, with the one
 * capability exception vision requests carry.
 */

import { detectPlatform, resolveFixedModel, selectFixedModel } from "../local/fixed-model";
import { discoverLocalModels, streamLocalChat, type LocalChatMessage } from "../ocade-local";
import type { AgentMessage, ModelTurn } from "./loop";
import type { WireTool } from "./tool-registry";

const BRIDGE = process.env.OCADE_BRIDGE_URL ?? "http://127.0.0.1:11434";

/** Reasoning models emit a hidden pass; it is not part of the answer. */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Which model this machine should use, refusing rather than substituting.
 *
 * Asked per call rather than cached: a user can install or remove the engine
 * while the app is open, and a cached "ready" would make OCADE claim an engine
 * it no longer has.
 */
export async function resolveModelId(
  visionRequired = false,
): Promise<{ ok: true; modelId: string } | { ok: false; reason: string }> {
  const platform = detectPlatform();
  const discovery = await discoverLocalModels(BRIDGE);
  if (!discovery.reachable) {
    const spec = resolveFixedModel(platform);
    return {
      ok: false,
      reason: `OCADE's engine (${spec.family} ${spec.parameters}) is not running on this computer.`,
    };
  }
  const choice = selectFixedModel({
    platform,
    installed: discovery.models.map((m) => ({
      id: m.id,
      vision: m.vision,
      sizeBytes: m.sizeBytes,
      isCloudPointer: m.isCloudPointer,
    })),
    visionRequired,
  });
  return choice.ok && choice.modelId
    ? { ok: true, modelId: choice.modelId }
    : { ok: false, reason: choice.reason ?? "No engine on this device can answer." };
}

/** A short, non-streaming completion. Used by the domain classifier. */
export async function complete(prompt: string, signal?: AbortSignal): Promise<string | null> {
  const model = await resolveModelId();
  if (!model.ok) return null;
  let text = "";
  const result = await streamLocalChat(
    BRIDGE,
    model.modelId,
    [{ role: "user", content: prompt }],
    { onToken: (chunk) => (text += chunk), think: false, signal },
    fetch,
  );
  return result.ok ? stripThinking(text) : null;
}

/**
 * One turn WITH tools.
 *
 * Tool results are folded into a user turn rather than sent with a `tool` role.
 * The runtimes differ on whether they accept that role and on what they do with
 * an unknown one — quietly dropping the message in at least one case, which
 * loses the observation the next step depends on. Labelling it explicitly is
 * uglier and cannot be silently discarded.
 */
export async function turn(
  messages: AgentMessage[],
  tools: WireTool[],
  handlers: { onToken?: (chunk: string) => void; signal?: AbortSignal },
): Promise<ModelTurn> {
  const model = await resolveModelId();
  if (!model.ok) throw new Error(model.reason);

  const local: LocalChatMessage[] = messages.map((message) =>
    message.role === "tool"
      ? { role: "user", content: `Tool ${message.toolName} returned:\n${message.content}` }
      : { role: message.role, content: message.content },
  );

  const toolCalls: ModelTurn["toolCalls"] = [];
  let text = "";
  const result = await streamLocalChat(
    BRIDGE,
    model.modelId,
    local,
    {
      onToken: (chunk) => {
        text += chunk;
        handlers.onToken?.(chunk);
      },
      onToolCall: (call) => toolCalls.push(call),
      tools,
      think: false,
      signal: handlers.signal,
    },
    fetch,
  );
  if (!result.ok) throw new Error(result.reason ?? "The local engine did not answer.");
  return { text: stripThinking(text), toolCalls };
}
