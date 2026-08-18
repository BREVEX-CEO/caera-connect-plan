import {
  unavailable,
  type AdapterAvailability,
  type BrainAdapter,
  type BrainMessage,
  type BrainStreamHandlers,
  type BrainStreamResult,
} from "../adapter";
import { BrowserWebGpuAdapter } from "./browser-webgpu";
import { BrowserWasmAdapter } from "./browser-wasm";

const LOCK_NAME = "ocade-browser-model-engine-v1";
const CHANNEL_NAME = "ocade-browser-model-relay-v1";
const HEARTBEAT_MS = 5_000;
const REQUEST_IDLE_TIMEOUT_MS = 45_000;

type RelayMessage =
  | { type: "leader"; tabId: string }
  | { type: "heartbeat"; tabId: string }
  | { type: "request"; from: string; requestId: string; messages: BrainMessage[] }
  | { type: "token"; to: string; requestId: string; token: string }
  | { type: "done"; to: string; requestId: string; result: BrainStreamResult }
  | { type: "abort"; from: string; requestId: string };

export interface BrowserEngineDiagnostics {
  tabId: string;
  role: "unknown" | "leader" | "follower" | "unsupported";
  modelInstances: number;
  localRequests: number;
  relayedRequests: number;
  activeEngine: "webgpu" | "wasm" | null;
}

declare global {
  interface Window {
    __OCADE_BROWSER_ENGINE_DIAGNOSTICS__?: BrowserEngineDiagnostics;
  }
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function diagnostic(tabId: string): BrowserEngineDiagnostics {
  return (
    (typeof window !== "undefined" && window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__) ?? {
      tabId,
      role: "unknown",
      modelInstances: 0,
      localRequests: 0,
      relayedRequests: 0,
      activeEngine: null,
    }
  );
}
function setDiagnostics(tabId: string, patch: Partial<BrowserEngineDiagnostics>) {
  if (typeof window === "undefined") return;
  window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__ = { ...diagnostic(tabId), ...patch, tabId };
}

type PendingFollower = {
  resolve: (result: BrainStreamResult) => void;
  onToken: (token: string) => void;
  timer: ReturnType<typeof setTimeout> | null;
  touch: () => void;
  signal?: AbortSignal;
  abort?: () => void;
};

type SharedRole = BrowserEngineDiagnostics["role"];

/**
 * Exactly one browser-model owner per same-origin browser profile.
 * Followers never load weights; they relay requests to the Web-Locks leader.
 */
export class SharedBrowserAdapter implements BrainAdapter {
  readonly id = "browser_webgpu" as const;
  readonly displayName = "OCADE Browser (shared)";

  private readonly tabId = makeId();
  private readonly webgpu = new BrowserWebGpuAdapter();
  private readonly wasm = new BrowserWasmAdapter();
  private channel: BroadcastChannel | null = null;
  private role: SharedRole = "unknown";
  private election: Promise<SharedRole> | null = null;
  private releaseLock: (() => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<string, PendingFollower>();
  private leaderAbort = new Map<string, AbortController>();
  private queue: Promise<void> = Promise.resolve();
  private active: BrainAdapter | null = null;
  private activeKind: "webgpu" | "wasm" | null = null;
  private disposed = false;

  constructor() {
    setDiagnostics(this.tabId, {});
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
        void this.onMessage(event.data);
      });
    }
  }

  private coordinationSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "locks" in navigator &&
      typeof navigator.locks?.request === "function" &&
      typeof BroadcastChannel !== "undefined" &&
      this.channel !== null
    );
  }

  private startHeartbeat() {
    if (this.heartbeat || this.role !== "leader") return;
    const beat = () =>
      this.channel?.postMessage({ type: "heartbeat", tabId: this.tabId } satisfies RelayMessage);
    beat();
    this.heartbeat = setInterval(beat, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private async elect(): Promise<SharedRole> {
    if (this.role !== "unknown") return this.role;
    if (this.election) return this.election;

    this.election = (async () => {
      if (!this.coordinationSupported()) {
        this.role = "unsupported";
        setDiagnostics(this.tabId, { role: "unsupported", modelInstances: 0, activeEngine: null });
        return this.role;
      }

      let decide!: (leader: boolean) => void;
      const decided = new Promise<boolean>((resolve) => (decide = resolve));
      let finished = false;
      const decideOnce = (leader: boolean) => {
        if (finished) return;
        finished = true;
        decide(leader);
      };

      void navigator.locks
        .request(LOCK_NAME, { ifAvailable: true, mode: "exclusive" }, async (lock) => {
          if (!lock) {
            decideOnce(false);
            return;
          }
          this.role = "leader";
          setDiagnostics(this.tabId, { role: "leader" });
          decideOnce(true);
          this.channel?.postMessage({ type: "leader", tabId: this.tabId } satisfies RelayMessage);
          this.startHeartbeat();
          await new Promise<void>((resolve) => {
            this.releaseLock = resolve;
          });
          this.stopHeartbeat();
        })
        .catch(() => decideOnce(false));

      if (!(await decided)) {
        this.role = "follower";
        setDiagnostics(this.tabId, { role: "follower", modelInstances: 0, activeEngine: null });
      }
      return this.role;
    })();
    return this.election;
  }

  /** A former follower must not keep broadcasting to a leader that has closed. */
  private async refreshFollowerLeadership(): Promise<void> {
    if (this.role !== "follower" || !this.coordinationSupported()) return;
    const manager = navigator.locks as LockManager & { query?: () => Promise<LockManagerSnapshot> };
    if (typeof manager.query !== "function") return;
    try {
      const snapshot = await manager.query();
      const ownerExists = snapshot.held?.some((lock) => lock.name === LOCK_NAME) ?? false;
      if (!ownerExists) this.resetFollowerForReelection();
    } catch {
      // The heartbeat idle timeout remains the recovery path when querying lock
      // state itself is unavailable or temporarily fails.
    }
  }

  async probe(): Promise<AdapterAvailability> {
    await this.refreshFollowerLeadership();
    const role = await this.elect();
    if (role === "unsupported") {
      return unavailable(
        "unsupported_device",
        "This browser cannot safely share one local OCADE model across tabs because Web Locks or BroadcastChannel is unavailable. OCADE refuses duplicate model copies.",
      );
    }
    const gpu = await this.webgpu.probe();
    if (gpu.available) return { ...gpu, label: "OCADE Browser (shared)" };
    const wasm = await this.wasm.probe();
    if (wasm.available) return { ...wasm, label: "OCADE Browser (shared)" };
    return unavailable(
      "unsupported_device",
      `${gpu.reason} ${wasm.reason}`.trim(),
      [...new Set([...gpu.remedies, ...wasm.remedies])],
    );
  }

  private async pickLeaderEngine(): Promise<BrainAdapter | null> {
    if (this.active) return this.active;
    const gpu = await this.webgpu.probe();
    if (gpu.available) {
      this.active = this.webgpu;
      this.activeKind = "webgpu";
      setDiagnostics(this.tabId, { activeEngine: "webgpu" });
      return this.active;
    }
    const wasm = await this.wasm.probe();
    if (wasm.available) {
      this.active = this.wasm;
      this.activeKind = "wasm";
      setDiagnostics(this.tabId, { activeEngine: "wasm" });
      return this.active;
    }
    return null;
  }

  async preload(): Promise<void> {
    await this.refreshFollowerLeadership();
    const role = await this.elect();
    if (role !== "leader") return;
    const engine = await this.pickLeaderEngine();
    if (!engine) return;
    const preload = (engine as BrainAdapter & { preload?: () => Promise<void> }).preload;
    if (!preload) return;
    try {
      await preload.call(engine);
      setDiagnostics(this.tabId, { modelInstances: 1, activeEngine: this.activeKind });
    } catch {
      // Streaming can retry later; failed warm-up is never counted as an instance.
    }
  }

  async stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    await this.refreshFollowerLeadership();
    const role = await this.elect();
    if (role === "unsupported") {
      return {
        ok: false,
        failure: "unavailable",
        reason: "Browser-local OCADE requires Web Locks and BroadcastChannel so multiple tabs cannot duplicate the model.",
      };
    }
    if (role === "follower") return this.relay(messages, handlers);
    return this.runOnLeader(messages, handlers);
  }

  private runOnLeader(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    return new Promise<BrainStreamResult>((resolve) => {
      this.queue = this.queue
        .catch(() => {})
        .then(async () => {
          if (handlers.signal?.aborted) {
            resolve({ ok: false, failure: "cancelled", reason: "Stopped." });
            return;
          }
          const engine = await this.pickLeaderEngine();
          if (!engine) {
            resolve({ ok: false, failure: "unavailable", reason: "No browser-local OCADE engine can run on this device." });
            return;
          }
          setDiagnostics(this.tabId, { localRequests: diagnostic(this.tabId).localRequests + 1 });
          const result = await engine.stream(messages, handlers);
          if (result.ok) setDiagnostics(this.tabId, { modelInstances: 1, activeEngine: this.activeKind });
          resolve(result);
        });
    });
  }

  private resetFollowerForReelection() {
    if (this.role !== "follower") return;
    this.role = "unknown";
    this.election = null;
    setDiagnostics(this.tabId, { role: "unknown", modelInstances: 0, activeEngine: null });
  }

  private relay(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    if (!this.channel) {
      return Promise.resolve({ ok: false, failure: "unavailable", reason: "This tab cannot reach the tab that owns OCADE's local engine." });
    }
    const requestId = makeId();
    setDiagnostics(this.tabId, { relayedRequests: diagnostic(this.tabId).relayedRequests + 1 });

    return new Promise<BrainStreamResult>((resolve) => {
      let timedOut = false;
      const pending = {} as PendingFollower;
      const expire = () => {
        if (timedOut) return;
        timedOut = true;
        if (pending.timer) clearTimeout(pending.timer);
        if (pending.abort && pending.signal) pending.signal.removeEventListener("abort", pending.abort);
        this.pending.delete(requestId);
        this.resetFollowerForReelection();
        resolve({
          ok: false,
          failure: "unavailable",
          reason: "The tab running OCADE's local engine stopped responding. Retry once; a new single leader will be elected.",
        });
      };
      const touch = () => {
        if (timedOut) return;
        if (pending.timer) clearTimeout(pending.timer);
        pending.timer = setTimeout(expire, REQUEST_IDLE_TIMEOUT_MS);
      };
      const abort = () => {
        this.channel?.postMessage({ type: "abort", from: this.tabId, requestId } satisfies RelayMessage);
        const current = this.pending.get(requestId);
        if (!current) return;
        if (current.timer) clearTimeout(current.timer);
        this.pending.delete(requestId);
        timedOut = true;
        current.resolve({ ok: false, failure: "cancelled", reason: "Stopped." });
      };
      Object.assign(pending, {
        resolve,
        onToken: handlers.onToken,
        timer: null,
        touch,
        signal: handlers.signal,
        abort,
      } satisfies PendingFollower);
      this.pending.set(requestId, pending);
      handlers.signal?.addEventListener("abort", abort, { once: true });
      touch();
      this.channel!.postMessage({ type: "request", from: this.tabId, requestId, messages } satisfies RelayMessage);
    });
  }

  private async onMessage(message: RelayMessage): Promise<void> {
    if (!message || this.disposed) return;
    if (message.type === "heartbeat") {
      if (message.tabId !== this.tabId) {
        for (const pending of this.pending.values()) pending.touch();
      }
      return;
    }
    if (message.type === "token" && message.to === this.tabId) {
      const pending = this.pending.get(message.requestId);
      pending?.touch();
      pending?.onToken(message.token);
      return;
    }
    if (message.type === "done" && message.to === this.tabId) {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      if (pending.timer) clearTimeout(pending.timer);
      if (pending.abort && pending.signal) pending.signal.removeEventListener("abort", pending.abort);
      this.pending.delete(message.requestId);
      pending.resolve(message.result);
      return;
    }
    if (message.type === "abort" && this.role === "leader") {
      this.leaderAbort.get(message.requestId)?.abort();
      return;
    }
    if (message.type !== "request" || this.role !== "leader") return;

    const controller = new AbortController();
    this.leaderAbort.set(message.requestId, controller);
    const result = await this.runOnLeader(message.messages, {
      signal: controller.signal,
      onToken: (token) =>
        this.channel?.postMessage({ type: "token", to: message.from, requestId: message.requestId, token } satisfies RelayMessage),
    });
    this.leaderAbort.delete(message.requestId);
    this.channel?.postMessage({ type: "done", to: message.from, requestId: message.requestId, result } satisfies RelayMessage);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.stopHeartbeat();
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      if (pending.abort && pending.signal) pending.signal.removeEventListener("abort", pending.abort);
      pending.resolve({ ok: false, failure: "cancelled", reason: "OCADE closed." });
    }
    this.pending.clear();
    for (const controller of this.leaderAbort.values()) controller.abort();
    this.leaderAbort.clear();
    await this.active?.dispose?.().catch(() => {});
    this.active = null;
    this.activeKind = null;
    setDiagnostics(this.tabId, { modelInstances: 0, activeEngine: null });
    this.channel?.close();
    this.channel = null;
    this.releaseLock?.();
    this.releaseLock = null;
  }
}

export const SHARED_BROWSER_LOCK_NAME = LOCK_NAME;
export const SHARED_BROWSER_CHANNEL_NAME = CHANNEL_NAME;
