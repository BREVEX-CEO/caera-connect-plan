/**
 * ONE MODEL, ONE TAB, HOWEVER MANY TABS ARE OPEN.
 *
 * THE DEFECT THIS EXISTS TO FIX. `BrowserWebGpuAdapter` keeps its engine and
 * its worker as instance fields, so every tab that opened OCADE created its own
 * worker and loaded its own copy of the weights. Three tabs meant three copies
 * resident on the graphics card at once — for a 3B model at roughly 2 GB that
 * is 6 GB of VRAM to answer one person's question, and on a laptop with shared
 * memory it is where the tab dies. Nothing in the codebase coordinated tabs at
 * all: no lock, no channel, no shared worker.
 *
 * HOW OWNERSHIP IS DECIDED. `navigator.locks`, and specifically NOT a
 * timestamp in localStorage. A lock is held by the page, so the browser
 * releases it when that page is closed, crashes, or is discarded under memory
 * pressure — which means failover is a property of the platform rather than
 * something this module has to detect with a heartbeat it could get wrong. The
 * queue is the browser's too, so exactly one waiter is promoted, with no
 * window in which two tabs both believe they won.
 *
 * HOW WORK REACHES THE OWNER. A `BroadcastChannel`. A follower posts a request
 * and receives the owner's tokens as they are produced, so a follower's chat
 * streams exactly like the owner's; it simply has no model of its own.
 *
 * WHAT HAPPENS WHEN THE OWNER DISAPPEARS MID-ANSWER. The follower is not left
 * waiting on a tab that no longer exists. It notices the silence, and when a
 * new owner announces itself the request is sent again — once. A second silence
 * is reported as a failure rather than retried forever, because at that point
 * something is wrong that retrying will not fix.
 */

export interface ModelOwnerRequest {
  /** Whatever the caller's engine needs. This module never inspects it. */
  payload: unknown;
}

export interface ModelOwnerResult {
  ok: boolean;
  reason?: string;
  /** Which tab actually ran it, for evidence and for tests. */
  ranOn?: "owner" | "follower-forwarded";
  /**
   * Whatever the owner wants the caller to know about the run — the model it
   * actually used, for instance. Structured-cloned across the channel, so it
   * must hold data rather than functions.
   */
  data?: unknown;
}

export interface ModelOwnerOptions {
  /** Loads the model into THIS tab. Called only when this tab is the owner. */
  load: () => Promise<void>;
  /** Runs one request on the loaded model. Owner only. */
  run: (payload: unknown, onToken: (token: string) => void) => Promise<ModelOwnerResult>;
  lockName?: string;
  channelName?: string;
  /** How long a follower waits before deciding the owner has gone. */
  requestTimeoutMs?: number;
}

type Message =
  | { k: "req"; id: string; from: string; payload: unknown }
  | { k: "tok"; id: string; t: string }
  | { k: "end"; id: string; ok: boolean; reason?: string; data?: unknown }
  | { k: "owner"; who: string }
  | { k: "who" };

export type OwnerRole = "owner" | "follower" | "starting";

export interface ModelOwnerHandle {
  role: () => OwnerRole;
  /** Run a request wherever the model actually lives. */
  request: (payload: unknown, onToken: (token: string) => void) => Promise<ModelOwnerResult>;
  /** How many times THIS tab loaded the model. The whole point is 0 or 1. */
  loadCount: () => number;
  onRoleChange: (listener: (role: OwnerRole) => void) => () => void;
  dispose: () => void;
}

const DEFAULTS = {
  lockName: "ocade.model.owner",
  channelName: "ocade.model.bus",
  requestTimeoutMs: 20_000,
};

export function modelOwnerSupported(): boolean {
  return (
    typeof BroadcastChannel === "function" &&
    typeof navigator !== "undefined" &&
    typeof navigator.locks?.request === "function"
  );
}

export function createModelOwner(options: ModelOwnerOptions): ModelOwnerHandle {
  const lockName = options.lockName ?? DEFAULTS.lockName;
  const channelName = options.channelName ?? DEFAULTS.channelName;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs;

  const me = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = new BroadcastChannel(channelName);

  let role: OwnerRole = "starting";
  let loads = 0;
  let disposed = false;
  let releaseLock: (() => void) | null = null;
  const roleListeners = new Set<(role: OwnerRole) => void>();

  /** Follower-side: requests this tab is waiting on. */
  const pending = new Map<
    string,
    {
      onToken: (t: string) => void;
      settle: (r: ModelOwnerResult) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  function setRole(next: OwnerRole) {
    if (role === next) return;
    role = next;
    for (const listener of roleListeners) listener(next);
  }

  function post(message: Message) {
    if (!disposed) channel.postMessage(message);
  }

  /* ------------------------------------------------------------ owner ---- */

  async function becomeOwner() {
    setRole("owner");
    post({ k: "owner", who: me });
  }

  async function handleRequest(message: Extract<Message, { k: "req" }>) {
    if (role !== "owner") return;
    try {
      if (loads === 0) {
        loads += 1;
        await options.load();
      }
      const result = await options.run(message.payload, (t) =>
        post({ k: "tok", id: message.id, t }),
      );
      post({ k: "end", id: message.id, ok: result.ok, reason: result.reason, data: result.data });
    } catch (error) {
      post({
        k: "end",
        id: message.id,
        ok: false,
        reason: error instanceof Error ? error.message : "The model failed.",
      });
    }
  }

  /* --------------------------------------------------------- follower ---- */

  function failPending(reason: string) {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.settle({ ok: false, reason });
    }
    pending.clear();
  }

  channel.onmessage = (event: MessageEvent<Message>) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;

    switch (message.k) {
      case "req":
        void handleRequest(message);
        return;
      case "who":
        if (role === "owner") post({ k: "owner", who: me });
        return;
      case "owner":
        // A new owner exists. Anything still waiting was aimed at the old one.
        if (message.who !== me) retryPending();
        return;
      case "tok": {
        pending.get(message.id)?.onToken(message.t);
        return;
      }
      case "end": {
        const entry = pending.get(message.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(message.id);
        entry.settle({
          ok: message.ok,
          reason: message.reason,
          data: message.data,
          ranOn: "follower-forwarded",
        });
        return;
      }
    }
  };

  /** Re-send anything in flight, ONCE, to whoever owns the model now. */
  const retried = new Set<string>();
  function retryPending() {
    for (const [id, entry] of pending) {
      if (retried.has(id)) continue;
      retried.add(id);
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        pending.delete(id);
        entry.settle({ ok: false, reason: "The tab holding the model did not answer." });
      }, timeoutMs);
      post({ k: "req", id, from: me, payload: (entry as { payload?: unknown }).payload });
    }
  }

  async function request(
    payload: unknown,
    onToken: (token: string) => void,
  ): Promise<ModelOwnerResult> {
    if (disposed) return { ok: false, reason: "This tab has stopped using the model." };

    // The owner runs it here; there is no reason to go through the bus.
    if (role === "owner") {
      if (loads === 0) {
        loads += 1;
        await options.load();
      }
      const result = await options.run(payload, onToken);
      return { ...result, ranOn: "owner" };
    }

    const id = `${me}-${Math.random().toString(36).slice(2, 10)}`;
    return new Promise<ModelOwnerResult>((resolve) => {
      const entry = {
        onToken,
        settle: resolve,
        payload,
        timer: setTimeout(() => {
          pending.delete(id);
          resolve({ ok: false, reason: "The tab holding the model did not answer." });
        }, timeoutMs),
      };
      pending.set(id, entry as never);
      post({ k: "req", id, from: me, payload });
    });
  }

  /* ------------------------------------------------------- the election -- */

  if (modelOwnerSupported()) {
    void navigator.locks
      .request(lockName, { mode: "exclusive" }, async () => {
        if (disposed) return;
        await becomeOwner();
        // Hold the lock for as long as this tab is alive and using the model.
        await new Promise<void>((resolve) => {
          releaseLock = resolve;
        });
      })
      .catch(() => {
        // Losing the election is not an error; this tab is a follower.
      });
    setRole("follower");
    post({ k: "who" });
  } else {
    /*
     * No locks, no channel: every tab is on its own. Say so by making this tab
     * the owner rather than silently doing nothing — a browser without these
     * APIs still has to be able to run the model.
     */
    void becomeOwner();
  }

  return {
    role: () => role,
    request,
    loadCount: () => loads,
    onRoleChange: (listener) => {
      roleListeners.add(listener);
      return () => roleListeners.delete(listener);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      failPending("This tab stopped using the model.");
      releaseLock?.();
      channel.close();
    },
  };
}
