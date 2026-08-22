/**
 * Browser-side wiring for the reasoning service (W1).
 *
 * The local engine runs on the user's own machine, so the browser talks to it
 * DIRECTLY on 127.0.0.1 — the same route `ocade.tsx` already uses. Going via the
 * server would be wrong twice over: in a hosted deployment the server is not the
 * user's machine, and routing a local-only prompt through a remote host is
 * exactly the thing local-first exists to prevent.
 *
 * There is no cloud path, here or anywhere. `ReasonDeps` used to take an
 * optional `streamCloud` so that "this prompt may leave the device" was an
 * explicit decision at each call site; the parameter is gone with the engine
 * it fed, so the decision no longer exists to be made.
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
  /**
   * Total memory, when this machine was measured precisely.
   *
   * Passed through so the context window can be sized to the hardware. Left
   * out it is treated as unknown, and unknown takes the smallest ceiling —
   * which is the safe direction, since the cost of a larger window is resident
   * memory on somebody's laptop.
   */
  totalRamBytes?: number,
  /**
   * The user's Fast/Thinking choice, when the surface has one.
   *
   * Left out means "this surface does not offer the choice" and the policy
   * default applies. It is deliberately not defaulted to `true` here: that is
   * `thinkingFor`'s decision to make, and duplicating it would be a second
   * authority disagreeing with the first the moment either changed.
   */
  thinking?: boolean,
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
         * Signed-in Chat reasons before answering, and the USER decides how
         * hard.
         *
         * Two bugs lived on this line. First it sent no `think` flag at all,
         * so the signed-in product silently had thinking off while the policy
         * said on. Then it asked `thinkingFor("chat")` with no preference —
         * which returns `preference ?? true`, i.e. always on — so the Fast /
         * Thinking switch in Settings saved a value that nothing read. The
         * switch was real, the persistence was real, and the effect was nil.
         *
         * Passing the preference through is what makes the control a control.
         * `thinkingFor` remains the single authority over what the absence of
         * a preference means.
         */
        think: thinkingFor("chat", thinking),
        ...(totalRamBytes ? { totalRamBytes } : {}),
      }),
    ledger: sessionPerfLedger,
    now: () => Date.now(),
  };
}
