import { useCallback, useEffect, useRef } from "react";

/**
 * One visual update per frame, without dropping a single token.
 *
 * THE PROBLEM. Both chat paths — the cloud stream reader and the local
 * engine's `onToken` — called `setStreamText(acc)` for every chunk that
 * arrived. A fast local engine emits tokens far quicker than the browser can
 * paint, so React was asked to re-render a Markdown transcript dozens of times
 * between frames. Every one of those renders except the last was thrown away
 * before a pixel changed, and the wasted work is exactly what makes the
 * composer feel sticky while an answer is arriving.
 *
 * WHY THIS IS LOSSLESS. The chat paths accumulate into `acc` themselves and
 * pass the WHOLE text so far, not a delta. Coalescing a sequence of
 * latest-wins values can only ever discard intermediate snapshots of a string
 * that is still growing — never a token, and never a reordering, because the
 * newest value always contains everything the skipped ones did. `flush()` is
 * therefore the whole correctness contract: whatever happens at the end
 * (completion, error, cancellation) must paint the final value synchronously
 * rather than leave it sitting in a frame that never comes.
 *
 * WHY A FRAME AND NOT A TIMER. `requestAnimationFrame` is what the compositor
 * actually honours, and it stops firing when the tab is hidden — which is the
 * correct behaviour for a background stream, since nothing is visible to
 * update. The final `flush()` fills in whatever the hidden tab missed.
 */

export interface StreamCoalescer<T> {
  /** Queue a value to be painted on the next frame. Never loses the latest. */
  push: (value: T) => void;
  /** Paint immediately and cancel any pending frame. Safe to call twice. */
  flush: () => void;
  /** Set immediately, discarding anything pending. Used for the final clear. */
  setNow: (value: T) => void;
  /** Drop anything pending WITHOUT applying it. Used on unmount. */
  cancelPending: () => void;
}

/**
 * Non-React core, so the behaviour can be tested without a renderer.
 * `schedule` and `cancel` are injectable for the same reason.
 */
export function createStreamCoalescer<T>(
  apply: (value: T) => void,
  schedule: (cb: () => void) => number = (cb) =>
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(() => cb())
      : (setTimeout(cb, 16) as unknown as number),
  cancel: (handle: number) => void = (handle) => {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
    else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  },
): StreamCoalescer<T> {
  let pending: { value: T } | null = null;
  let handle: number | null = null;

  const run = () => {
    handle = null;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    apply(value);
  };

  return {
    push(value) {
      pending = { value };
      if (handle === null) handle = schedule(run);
    },
    flush() {
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      if (pending) {
        const { value } = pending;
        pending = null;
        apply(value);
      }
    },
    setNow(value) {
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      pending = null;
      apply(value);
    },
    cancelPending() {
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      pending = null;
    },
  };
}

/**
 * React binding. The setter is held in a ref so the returned callbacks are
 * stable for the life of the component — an unstable `push` would defeat the
 * memoisation it exists to protect.
 */
export function useStreamCoalescer<T>(apply: (value: T) => void): {
  push: (value: T) => void;
  flush: () => void;
  setNow: (value: T) => void;
} {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const coalescerRef = useRef<StreamCoalescer<T> | null>(null);
  if (coalescerRef.current === null) {
    coalescerRef.current = createStreamCoalescer<T>((value) => applyRef.current(value));
  }

  // A pending frame after unmount would call setState on a dead component, so
  // it is dropped rather than applied — there is no component left to paint.
  useEffect(() => {
    const coalescer = coalescerRef.current!;
    return () => coalescer.cancelPending();
  }, []);

  const push = useCallback((value: T) => coalescerRef.current!.push(value), []);
  const flush = useCallback(() => coalescerRef.current!.flush(), []);
  const setNow = useCallback((value: T) => coalescerRef.current!.setNow(value), []);
  return { push, flush, setNow };
}
