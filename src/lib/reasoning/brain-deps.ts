/**
 * The reasoning service, backed by the Brain adapter registry.
 *
 * WHAT THIS FIXES. OCADE had two complete local-AI systems that never met.
 *
 * One is the browser-native stack: `brain/adapters/browser-webgpu.ts` runs a
 * model on the user's graphics card through WebLLM, `browser-wasm.ts` runs it
 * on the CPU through wllama, `model-download.ts` fetches the weights with
 * resumable Range requests and a SHA-256 check, and `model-store.ts` keeps
 * them in OPFS. It is the better-built half of the product.
 *
 * The other is `browser-deps.ts`, which talks to `http://localhost:11434` —
 * Ollama, a program the user installs on their computer.
 *
 * The signed-in Chat page used the second one. `useBrain` was imported on that
 * screen and returns `{ mode, route, warm, remedyLabel }` — no `generate`, no
 * `stream` — so the browser engines could be probed, and warmed, and could
 * start a 340 MB download, and then never produced a single token. On a clean
 * laptop with only Chrome, OCADE downloaded a model it could not answer with,
 * found nothing listening on 11434, and refused.
 *
 * This module is the join. It hands `reason()` a `streamLocal` that goes
 * through whichever adapter the Brain router picked, so the whole existing
 * chain — WebGPU first, WASM when there is no usable GPU adapter, a paired
 * desktop or a local Ollama when the person happens to have one — serves the
 * production Chat surface without a third implementation being written.
 */
import type { BrainAdapter, BrainMessage } from "../brain/adapter";
import type { RouteChosen } from "../brain/router";
import { PerfLedger } from "../local/router-policy";
import { deliberationClause } from "../local/fixed-model";
import type { ReasonDeps, ReasonMessage } from "./engine";
import type { LocalModelInfo } from "../ocade-local";

/**
 * One ledger per browser session.
 *
 * Routing prefers the fastest MEASURED engine, and a per-call ledger would
 * forget every measurement the moment it was taken, so every surface feeds
 * this one.
 */
export const sessionPerfLedger = new PerfLedger();

/**
 * Describe the chosen adapter as an installed model.
 *
 * `reason()` asks for a model list so it can route and so it can say "nothing
 * is installed" rather than "something went wrong". The Brain router has
 * already routed by the time we get here, so this reports exactly one entry —
 * the winner — and lets the service's own selection agree with it trivially
 * instead of running a second, differently-informed election.
 */
function asModelInfo(route: RouteChosen): LocalModelInfo {
  const availability = route.availability;
  const vision = Boolean(availability.capabilities?.vision);
  return {
    id: availability.modelId ?? route.adapter.id,
    /*
     * The adapter's `label` is already a capability label by contract, but it
     * is typed as a plain string there. Narrowing through the vision flag
     * rather than casting means a label the type does not know about becomes
     * "OCADE Local" instead of a value that fails somewhere further down.
     */
    label: vision ? "OCADE Local Vision" : "OCADE Local",
    /*
     * Size and parameter count are not on `AdapterReady` and are not worth
     * inventing: the reasoning service uses them only to compare installed
     * models, and there is exactly one entry here because the Brain router
     * has already chosen. Zero and null say "not measured", which is true.
     */
    sizeBytes: 0,
    paramsB: null,
    vision,
    profile: vision ? "vision" : "general",
    isCloudPointer: false,
  };
}

/**
 * A `ReasonMessage` has no images; a `BrainMessage` may.
 *
 * Chat carries pictures as base64 on the user turn, and the vision adapters
 * read them from there. Converting without a place to put them would silently
 * drop the image and produce a confident answer about a picture nobody looked
 * at, so the caller passes them alongside and they are attached to the last
 * user message — which is the turn the image belongs to.
 */
function toBrainMessages(messages: ReasonMessage[], images?: string[]): BrainMessage[] {
  const out: BrainMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
  if (!images?.length) return out;
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i].role === "user") {
      out[i] = { ...out[i], images };
      return out;
    }
  }
  return out;
}

export interface BrainDepsOptions {
  /** Base64 image payloads for this request, without the data-URL prefix. */
  images?: string[];
  /** The user's Fast/Thinking choice, already resolved by `thinkingFor`. */
  think?: boolean;
  /**
   * Called when Thinking was asked for and the engine that answered cannot
   * carry it, so the screen can say so instead of leaving a dead switch.
   */
  onThinkingDegraded?: () => void;
  ledger?: PerfLedger;
  now?: () => number;
}

/**
 * Build `ReasonDeps` around an adapter the Brain router has already chosen.
 *
 * Deliberately takes the ROUTE rather than the registry: routing is an async
 * probe of real hardware and belongs to the screen, which can show "preparing"
 * while it happens. Doing it inside `streamLocal` would hide a multi-second
 * WebGPU check inside what looks like a synchronous send.
 */
export function brainReasonDeps(route: RouteChosen, options: BrainDepsOptions = {}): ReasonDeps {
  const adapter: BrainAdapter = route.adapter;
  const model = asModelInfo(route);
  return {
    listLocalModels: async () => [model],
    streamLocal: async (_modelId, messages, handlers) => {
      /*
       * THINKING HAS TO CHANGE THE REQUEST, OR IT IS A DECORATION.
       *
       * This passed `think` to the adapter and stopped there. The browser
       * adapters — the only engines the shipped product has — do not read that
       * field: WebLLM has no such parameter and wllama has no such parameter,
       * so on the real Chat page the switch produced byte-for-byte the same
       * request whether it was on or off. It saved, it drew itself correctly,
       * and it did nothing. The demo hook had the clause; the product did not,
       * which is the wrong way round.
       *
       * The clause goes on the system message here instead, at the boundary
       * BOTH surfaces cross, so Chat and the demo cannot drift apart again.
       * `think` is still passed for adapters that do have a native mode, so
       * this is an addition rather than a replacement.
       *
       * And the engine keeps a veto. A tier that is `thinkingSuitable: false`
       * runs on the processor, where deliberating multiplies the tokens
       * produced without improving the answer; there Thinking degrades to Fast
       * and the caller is told, rather than the weakest device being the one
       * that appears to hang.
       */
      const wanted = options.think === true;
      const engineAllows = route.availability.thinkingSuitable !== false;
      const deliberate = wanted && engineAllows;
      if (wanted && !engineAllows) options.onThinkingDegraded?.();

      const prepared =
        options.think === undefined
          ? messages
          : messages.map((message, index) =>
              index === 0 && message.role === "system"
                ? { ...message, content: `${message.content}${deliberationClause(deliberate)}` }
                : message,
            );

      const result = await adapter.stream(toBrainMessages(prepared, options.images), {
        onToken: handlers.onToken,
        ...(handlers.signal ? { signal: handlers.signal } : {}),
        ...(options.think === undefined ? {} : { think: deliberate }),
      });
      if (result.ok) return { ok: true };
      /*
       * `cancelled` is passed through as the reason verbatim because the
       * reasoning service recognises that exact word and turns it into a
       * cancellation rather than an error. A stop the user asked for must not
       * be dressed as a failure.
       */
      return { ok: false, reason: result.failure === "cancelled" ? "cancelled" : result.reason };
    },
    ledger: options.ledger ?? new PerfLedger(),
    now: options.now ?? (() => Date.now()),
  };
}
