import { useCallback, useEffect, useRef, useState } from "react";
import { useBrain } from "../brain/use-brain";
import type { BrainMessage, RemedyAction } from "../brain/adapter";
import { deliberationClause, thinkingFor, type OcadeSurface } from "../local/fixed-model";

export type EngineStatus =
  | "idle"
  | "checking"
  | "ready"
  | "preparing"
  | "generating"
  | "unavailable";

export interface EngineState {
  status: EngineStatus;
  label: string | null;
  reason: string | null;
  remedies: RemedyAction[];
  progress: number | null;
}

const INITIAL: EngineState = {
  status: "idle",
  label: null,
  reason: null,
  remedies: [],
  progress: null,
};

export interface SendOptions {
  messages: BrainMessage[];
  onToken: (chunk: string) => void;
  tools?: readonly unknown[];
  onToolCall?: (call: { id?: string; name: string; arguments: Record<string, unknown> }) => void;
}
export interface SendResult {
  ok: boolean;
  reason?: string;
  cancelled?: boolean;
}
export interface ChatEngineContext {
  surface?: OcadeSurface;
  thinking?: boolean;
  visionRequired?: boolean;
}

/**
 * The only chat inference hook in OCADE.
 *
 * It has no provider keys, no cloud allowance, no remote model preference and
 * no server fallback. It asks the local Brain for an on-device adapter and
 * refuses if none is available. Browser tabs are coordinated inside the Brain
 * so follower tabs relay to the single Web-Locks leader instead of loading a
 * second copy of the model.
 */
export function useLocalChatEngine(context: ChatEngineContext = {}) {
  const brain = useBrain();
  const [state, setState] = useState<EngineState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const liveRef = useRef(true);
  const surface = context.surface ?? "chat";
  const thinking = context.thinking;
  const visionRequired = context.visionRequired ?? false;

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const apply = useCallback((next: Partial<EngineState>) => {
    if (liveRef.current) setState((prev) => ({ ...prev, ...next }));
  }, []);

  const decide = useCallback(
    async (needsVision: boolean) => {
      const outcome = await brain.route({ visionRequired: needsVision });
      return outcome;
    },
    [brain],
  );

  const check = useCallback(async () => {
    apply({ status: "checking", reason: null, remedies: [], progress: null });
    const outcome = await decide(visionRequired);
    if (!liveRef.current) return;
    if (outcome.ok) {
      apply({
        status: "ready",
        label: outcome.availability.label,
        reason: null,
        remedies: [],
        progress: null,
      });
      return;
    }
    apply({
      status: "unavailable",
      label: null,
      reason: outcome.reason,
      remedies: outcome.remedies,
      progress: null,
    });
  }, [apply, decide, visionRequired]);

  const send = useCallback(
    async ({ messages, onToken, tools, onToolCall }: SendOptions): Promise<SendResult> => {
      apply({ status: "checking", reason: null, remedies: [] });
      const outcome = await decide(visionRequired);
      if (!liveRef.current) return { ok: false, cancelled: true };
      if (!outcome.ok) {
        apply({
          status: "unavailable",
          label: null,
          reason: outcome.reason,
          remedies: outcome.remedies,
          progress: null,
        });
        return { ok: false, reason: outcome.reason };
      }

      const controller = new AbortController();
      abortRef.current = controller;
      apply({
        status: "generating",
        label: outcome.availability.label,
        reason: null,
        remedies: [],
        progress: null,
      });

      const deliberate = thinkingFor(surface, thinking);
      const prepared = messages.map((message, index) =>
        index === 0 && message.role === "system"
          ? { ...message, content: `${message.content}${deliberationClause(deliberate)}` }
          : message,
      );

      const result = await outcome.adapter.stream(prepared, {
        signal: controller.signal,
        ...(tools?.length ? { tools } : {}),
        ...(onToolCall ? { onToolCall } : {}),
        think: deliberate,
        onToken,
      });
      abortRef.current = null;
      if (!liveRef.current) return { ok: false, cancelled: true };

      if (result.ok) {
        apply({ status: "ready", progress: null });
        return { ok: true };
      }
      if (result.failure === "cancelled") {
        apply({ status: "ready", progress: null });
        return { ok: false, cancelled: true, reason: result.reason };
      }
      apply({ status: "unavailable", reason: result.reason, remedies: [], progress: null });
      return { ok: false, reason: result.reason };
    },
    [apply, decide, visionRequired, surface, thinking],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const warm = useCallback(() => brain.warm(), [brain]);

  return { state, check, send, stop, warm, remedyLabel: brain.remedyLabel };
}
