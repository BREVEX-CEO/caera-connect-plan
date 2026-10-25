/**
 * `node:async_hooks` for the browser, which has no async context. A store entered with `run()`
 * stays current until the promise `run()` returned settles, so it reaches the awaits inside it.
 *
 * Exact only while one run per instance is in flight and nothing reads it from outside that
 * run. OCADE builds one Cordis context per JARVIS turn, holding one Agent, and disposes it only
 * once that Agent is idle (src/jarvis/deepseek-turn.ts), so each AgentRegistry's stores serve
 * one chain. What this cannot give is pinned by upstream's own specs (`npm run deepseek:specs`):
 * overlapping initiators, child agents, disposal while a run is pending and cross-realm promises
 * fail under it, and OCADE creates none of them. Cloudflare Workers and Node keep the native module.
 */
export class AsyncLocalStorage<T> {
  private store: T | undefined;
  /** Bumped by disable(), so a run settling afterwards does not bring its store back. */
  private epoch = 0;

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = this.store;
    const epoch = this.epoch;
    const restore = () => {
      if (this.epoch === epoch) this.store = previous;
    };
    this.store = store;
    let result: R;
    try {
      result = callback(...args);
    } catch (error) {
      restore();
      throw error;
    }
    if (result instanceof Promise) {
      // The intrinsic then, as Node observes a promise: a subclass's own then is never called.
      Promise.prototype.then.call(result, restore, restore);
    } else {
      restore();
    }
    return result;
  }

  disable(): void {
    this.epoch += 1;
    this.store = undefined;
  }
}
