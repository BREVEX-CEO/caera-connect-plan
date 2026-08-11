import { useCallback, useMemo } from "react";
import { useLocalChatEngine } from "@/lib/chat/use-local-chat-engine";
import type { MissionBrain } from "./use-mission";

/**
 * The same engine Chat uses, shaped for the mission loop.
 *
 * ONE BRAIN, TWO ROOMS. Control + Work does not get its own model, its own
 * router or its own runtime — it gets the engine `useLocalChatEngine` already
 * resolves, which is the one the signed-in chat and the demo both run on. What
 * differs between the rooms is what the engine is allowed to reach afterwards,
 * and that lives in the mission, not here.
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

  const brain = useCallback<MissionBrain>(
    async (messages, onToken, signal) => {
      let text = "";
      const result = await engine.send({
        messages,
        onToken: (chunk) => {
          text += chunk;
          onToken(chunk);
        },
      });
      if (signal?.aborted) {
        return { ok: false, text, reason: "The task was stopped." };
      }
      if (!result.ok) {
        return {
          ok: false,
          text,
          reason:
            result.reason ??
            (result.cancelled
              ? "The task was stopped."
              : "OCADE's engine did not answer on this device."),
        };
      }
      return { ok: true, text };
    },
    [engine],
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
