import { useCallback, useMemo } from "react";
import { useLocalChatEngine } from "@/lib/chat/use-local-chat-engine";
import { createEngineIntelligenceTransport } from "@/lib/intelligence/engine-transport";
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import { createOcadeIntelligence } from "@/lib/intelligence/router";
import type { MissionBrain } from "./use-mission";

/**
 * The same engine Chat uses, shaped for the mission loop.
 *
 * ONE BRAIN, TWO ROOMS. Control + Work does not get its own model, its own
 * router or its own runtime — the existing local engine is adapted behind the
 * same `OcadeIntelligence` contract as Chat. What differs between the rooms is
 * what the engine is allowed to reach afterwards, and that lives in the
 * mission, not here.
 *
 * WHY THE TEXT IS ACCUMULATED RATHER THAN RETURNED. `send` streams tokens and
 * resolves with success or a reason; the reply itself only exists as the tokens
 * that went past. The loop needs the whole reply to look for an action in it,
 * so it is collected here and handed over once the stream closes.
 */
export function useMissionBrain(): {
  brain: MissionBrain;
  ready: boolean;
  status: string;
  /** Stops generation without ending the mission. */
  stop: () => void;
  /** Load the weights now. Called when Control + Work opens. */
  warm: () => void;
} {
  /*
   * CONTROL + WORK DOES NOT THINK OUT LOUD.
   *
   * Declared here rather than left to the default because this is the surface
   * where the difference is felt: the turn is "emit one JSON action", a
   * reasoning pass buys nothing for that, and it costs seconds while the user
   * watches their own mouse. `thinkingFor` owns the rule; this names the room.
   */
  const engine = useLocalChatEngine({ surface: "control" });
  const intelligence = useMemo(
    () =>
      createOcadeIntelligence({
        online: createOnlineIntelligenceTransport(),
        local: createEngineIntelligenceTransport(engine),
      }),
    [engine],
  );

  const brain = useCallback<MissionBrain>(
    async (messages, onToken, signal, tools, permit) => {
      if (!permit) {
        throw new Error("Cowork requires a commercial generation permit before intelligence runs.");
      }
      let text = "";
      /*
       * Structured actions when the engine can carry them.
       *
       * Collected here rather than parsed out of `text` afterwards: the
       * runtime constrains the shape, so a call either arrives well-formed or
       * does not arrive at all. The prose path is still there for adapters
       * with no function-call channel, and the mission falls back to it when
       * this list comes back empty.
       */
      const calls: { name: string; arguments: Record<string, unknown> }[] = [];
      let refusal: string | null = null;
      let finalText: string | null = null;
      const normalizedTools = (tools ?? []).flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const fn = (value as { function?: unknown }).function;
        if (!fn || typeof fn !== "object") return [];
        const candidate = fn as {
          name?: unknown;
          description?: unknown;
          parameters?: unknown;
        };
        if (typeof candidate.name !== "string") return [];
        return [
          {
            name: candidate.name,
            description: typeof candidate.description === "string" ? candidate.description : "",
            inputSchema:
              candidate.parameters && typeof candidate.parameters === "object"
                ? (candidate.parameters as Record<string, unknown>)
                : {},
          },
        ];
      });
      for await (const event of intelligence.stream({
        permit,
        generationId: permit.generationId,
        idempotencyKey: permit.idempotencyKey,
        surface: "cowork",
        mode: "local_only",
        messages,
        tools: normalizedTools,
        attachments: [],
        privacy: {
          storageMode: "browser_only",
          onlineInferenceConsented: false,
          sealed: true,
        },
        ...(signal ? { signal } : {}),
      })) {
        if (event.type === "token") {
          text += event.text;
          onToken(event.text);
        }
        if (event.type === "tool_call") {
          calls.push({ name: event.call.name, arguments: event.call.arguments });
        }
        if (event.type === "final") finalText = event.response.text;
        if (event.type === "refusal") refusal = event.reason;
      }
      if (signal?.aborted) {
        return { ok: false, text, reason: "The task was stopped." };
      }
      if (refusal && !text.trim() && !finalText?.trim() && calls.length === 0) {
        return {
          ok: false,
          text,
          reason: refusal,
        };
      }
      return { ok: true, text: finalText ?? text, calls };
    },
    [intelligence],
  );

  return useMemo(
    () => ({
      brain,
      ready: engine.state.status === "ready" || engine.state.status === "generating",
      status: engine.state.status,
      stop: engine.stop,
      warm: engine.warm,
    }),
    [brain, engine.state.status, engine.stop, engine.warm],
  );
}
