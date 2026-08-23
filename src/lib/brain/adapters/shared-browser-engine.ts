/**
 * Make a browser engine adapter shared across tabs instead of duplicated.
 *
 * WHAT IT WRAPS AND WHY. `BrowserWebGpuAdapter` keeps its engine and its worker
 * as instance fields, so every open tab loaded its own copy of the weights onto
 * the graphics card. For a 3B model at roughly 2 GB, three tabs meant 6 GB of
 * VRAM to answer one person — and on a laptop with shared memory that is where
 * the tab dies. Nothing coordinated tabs at all before this.
 *
 * This puts the ownership decision in front of the adapter rather than inside
 * it: exactly one tab holds the lock, and only that tab is ever asked to
 * stream. Every other tab forwards its request to the owner and receives the
 * owner's tokens as they are produced, so a follower's chat streams exactly
 * like the owner's.
 *
 * WHAT IT DELIBERATELY DOES NOT FORWARD. `signal` and `tools`. An AbortSignal
 * does not survive a `postMessage`, and a tool call has to be executed by the
 * tab that asked for it, not by whichever tab happens to hold the model. A
 * request carrying either is run locally, which costs a second copy of the
 * weights in that one tab and is still the right trade: silently dropping a
 * caller's cancellation, or running its tools somewhere else, would be worse
 * than using more memory.
 */

import type {
  BrainAdapter,
  BrainMessage,
  BrainStreamHandlers,
  BrainStreamResult,
} from "../adapter";
import {
  createModelOwner,
  modelOwnerSupported,
  type ModelOwnerHandle,
} from "@/lib/local/model-owner";

type ForwardedRequest =
  | { kind: "preload" }
  | {
      kind: "stream";
      messages: BrainMessage[];
      think?: boolean;
    };

export function shareAcrossTabs(inner: BrainAdapter): BrainAdapter {
  if (!modelOwnerSupported()) return inner;

  let handle: ModelOwnerHandle | null = null;

  function owner(): ModelOwnerHandle {
    if (handle) return handle;
    handle = createModelOwner({
      // The adapter loads lazily inside `stream`, so there is nothing to do
      // here beyond letting the owner know it is the one that will.
      load: async () => {},
      run: async (payload, onToken) => {
        const request = payload as ForwardedRequest;
        if (request.kind === "preload") {
          await inner.preload?.();
          return { ok: true };
        }
        const result = await inner.stream(request.messages, {
          onToken,
          think: request.think,
        });
        return result.ok
          ? { ok: true, data: { modelId: result.modelId } }
          : { ok: false, reason: result.reason ?? "The browser engine failed." };
      },
    });
    return handle;
  }

  return {
    id: inner.id,
    displayName: inner.displayName,
    probe: () => inner.probe(),
    async preload() {
      const coordinator = owner();
      // Treat warm-up as owner work. This also covers the first milliseconds
      // of a fresh tab, while the lock election is still settling.
      const result = await coordinator.request(
        { kind: "preload" } satisfies ForwardedRequest,
        () => {},
      );
      if (!result.ok) throw new Error(result.reason ?? "The browser engine could not warm up.");
    },
    async stream(
      messages: BrainMessage[],
      handlers: BrainStreamHandlers,
    ): Promise<BrainStreamResult> {
      const coordinator = owner();

      // Cancellation and tool calls belong to the tab that asked.
      const mustRunHere = handlers.signal !== undefined || (handlers.tools?.length ?? 0) > 0;
      if (mustRunHere || coordinator.role() === "owner") {
        return inner.stream(messages, handlers);
      }

      /*
       * Timed HERE, not by the owner. What a person waits for is the first
       * character appearing in THEIR tab, which includes the hop across the
       * channel; reporting the owner's own figure would quietly under-report
       * every follower's latency.
       */
      const startedAt = Date.now();
      let firstTokenMs: number | null = null;
      const result = await coordinator.request(
        { kind: "stream", messages, think: handlers.think } satisfies ForwardedRequest,
        (token) => {
          if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
          handlers.onToken(token);
        },
      );
      const modelId =
        typeof result.data === "object" && result.data !== null
          ? ((result.data as { modelId?: string | null }).modelId ?? null)
          : null;
      return result.ok
        ? { ok: true, modelId, firstTokenMs }
        : {
            ok: false,
            failure: "error",
            reason:
              result.reason ??
              "The tab holding the on-device model did not answer. Reload this tab to take it over.",
          };
    },
    async dispose() {
      handle?.dispose();
      handle = null;
      await inner.dispose?.();
    },
  };
}
