/**
 * Browser-side wiring for the reasoning service (W1).
 *
 * The local engine runs on the user's own machine, so the browser talks to it
 * DIRECTLY on 127.0.0.1 — the same route `ocade.tsx` already uses. Going via the
 * server would be wrong twice over: in a hosted deployment the server is not the
 * user's machine, and routing a local-only prompt through a remote host is
 * exactly the thing local-first exists to prevent.
 *
 * The cloud path deliberately stays absent here. A surface that wants cloud
 * passes its own `streamCloud`, so "this prompt may leave the device" is always
 * an explicit decision at the call site rather than an ambient capability.
 */
import { discoverLocalModels, streamLocalChat, DEFAULT_LOCAL_BRIDGE_URL } from "../ocade-local";
import { PerfLedger } from "../local/router-policy";
import { thinkingFor } from "../local/fixed-model";
import type { ReasonDeps } from "./engine";

/**
 * One ledger per browser session.
 *
 * Routing prefers the fastest MEASURED model, and it can only do that if every
 * surface feeds the same ledger — a per-call ledger would forget every
 * measurement the moment it was taken.
 */
export const sessionPerfLedger = new PerfLedger();

export function browserReasonDeps(
  bridgeUrl: string = DEFAULT_LOCAL_BRIDGE_URL,
  streamCloud?: ReasonDeps["streamCloud"],
  /**
   * Total memory, when this machine was measured precisely.
   *
   * Passed through so the context window can be sized to the hardware. Left
   * out it is treated as unknown, and unknown takes the smallest ceiling —
   * which is the safe direction, since the cost of a larger window is resident
   * memory on somebody's laptop.
   */
  totalRamBytes?: number,
): ReasonDeps {
  return {
    listLocalModels: async () => {
      const discovery = await discoverLocalModels(bridgeUrl);
      return discovery.ok ? discovery.models : [];
    },
    streamLocal: (modelId, messages, handlers) =>
      streamLocalChat(bridgeUrl, modelId, messages, {
        onToken: handlers.onToken,
        signal: handlers.signal,
        /*
         * Signed-in Chat reasons before answering.
         *
         * This is the third path to the engine — the demo chat and Control +
         * Work go through `use-local-chat-engine` — and it was the one still
         * sending no `think` flag at all, so the signed-in product silently
         * had thinking off while the policy said on. `thinkingFor` is the
         * single authority; this call now asks it like the others do.
         */
        think: thinkingFor("chat"),
        ...(totalRamBytes ? { totalRamBytes } : {}),
      }),
    ...(streamCloud ? { streamCloud } : {}),
    ledger: sessionPerfLedger,
    now: () => Date.now(),
  };
}
