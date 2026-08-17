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
const REQUEST_TIMEOUT_MS = 180_000;

type RelayMessage =
  | { type: "leader"; tabId: string }
  | { type: "ping"; from: string; nonce: string }
  | { type: "pong"; to: string; nonce: string }
  | { type: "request"; from: string; requestId: string; messages: BrainMessage[] }
  | { type: "token"; to: string; requestId: string; token: string }
  | { type: "done"; to: string; requestId: string; result: BrainStreamResult }
  | { type: "abort"; from: string; requestId: string };

export interface BrowserEngineDiagnostics {
  tabId: string;
  role: "unknown" | "leader" | "follower" | "single-tab-fallback";
  /** Number of underlying browser model engines owned by THIS tab. Followers stay at zero. */
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

function setDiagnostics(next: Partial<BrowserEngineDiagnostics>, tabId: string) {
  if (typeof window === "undefined") return;
  const current = window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__ ?? {
    tabId,
    role: "unknown" as const,
    modelInstances: 0,
    localRequests: 0,
    relayedRequests: 0,
    activeEngine: null,
  };
  window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__ = { ...current, ...next, tabId };
}

type PendingFollower = {
  resolve: (result: BrainStreamResult) => void;
  onToken: (token: string) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * One browser model engine per same-origin browser profile, even with many tabs.
 *
 * Web Locks owns leadership. Followers NEVER instantiate WebLLM/WASM; they
 * relay messages over BroadcastChannel and receive the token stream back. The
 * leader serializes requests because a single model context must not be driven
 * concurrently by unrelated chats.
 */
export class SharedBrowserAdapter implements BrainAdapter {
  readonly id = "browser_webgpu" as const;
  readonly displayName = "OCADE Browser (shared)";

  private readonly tabId = makeId();
  private readonly webgpu = new BrowserWebGpuAdapter();
  private readonly wasm = new BrowserWasmAdapter();
  private channel: BroadcastChannel | null = null;
  private role: "unknown" | "leader" | "follower" | "single-tab-fallback" = "unknown";
  private election: Promise<typeof this.role> | null = null;
  private releaseLock: (() => void) | null = null;
  private pending = new Map<string, PendingFollower>();
  private leaderAbort = new Map<string, AbortController>();
  private queue: Promise<void> = Promise.resolve();
  private active: BrainAdapter | null = null;
  private disposed = false;

  constructor() {
    setDiagnostics({}, this.tabId);
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.addEventListener("message", (event: MessageEvent<RelayMessage>) => {
        void this.onMessage(event.data);
      });
    }
  }

  private async elect(): Promise<typeof this.role> {
    if (this.role !== "unknown") return this.role;
    if (this.election) return this.election;

    this.election = (async () => {
      if (
        typeof navigator === "undefined" ||
        !("locks" in navigator) ||
        typeof BroadcastChannel === "undefined"
      ) {
        this.role = "single-tab-fallback";
        setDiagnostics({ role: this.role }, this.tabId);
        return this.role;
      }

      let decide!: (leader: boolean) => void;
      const decided = new Promise<boolean>((resolve) => (decide = resolve));
      let decidedOnce = false;
      const decideOnce = (value: boolean) => {
        if (decidedOnce) return;
        decidedOnce = true;
        decide(value);
      };

      void navigator.locks
        .request(LOCK_NAME, { ifAvailable: true, mode: "exclusive" }, async (lock) => {
          if (!lock) {
            decideOnce(false);
            return;
          }
          this.role = "leader";
          setDiagnostics({ role: "leader" }, this.tabId);
          decideOnce(true);
          this.channel?.postMessage({ type: "leader", tabId: this.tabId } satisfies RelayMessage);
          await new Promise<void>((resolve) => {
            this.releaseLock = resolve;
          });
        })
        .catch(() => decideOnce(false));

      const leader = await decided;
      if (!leader) {
        this.role = "follower";
        setDiagnostics({ role: "follower", modelInstances: 0, activeEngine: null }, this.tabId);
      }
      return this.role;
    })();

    return this.election;
  }

  async probe(): Promise<AdapterAvailability> {
    // Probe is intentionally read-only and does not load weights. It is safe in
    // every tab; only stream/preload is leader-gated.
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
      setDiagnostics({ modelInstances: 1, activeEngine: "webgpu" }, this.tabId);
      return this.active;
    }
    const wasm = await this.wasm.probe();
    if (wasm.available) {
      this.active = this.wasm;
      setDiagnostics({ modelInstances: 1, activeEngine: "wasm" }, this.tabId);
      return this.active;
    }
    return null;
  }

  /** Only the lock holder is allowed to warm/download the browser engine. */
  async preload(): Promise<void> {
    const role = await this.elect();
    if (role === "follower") return;
    const engine = await this.pickLeaderEngine();
    if (!engine) return;
    const maybe = engine as BrainAdapter & { preload?: () => Promise<void> };
    await maybe.preload?.().catch(() => {});
  }

  async stream(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    const role = await this.elect();
    if (role === "follower") return this.relay(messages, handlers);
    return this.runOnLeader(messages, handlers);
  }

  private runOnLeader(
    messages: BrainMessage[],
    handlers: BrainStreamHandlers,
  ): Promise<BrainStreamResult> {
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
            resolve({
              ok: false,
              failure: "unavailable",
              reason: "No browser-local OCADE engine can run on this device.",
            });
            return;
          }
          setDiagnostics(
            {
              localRequests:
                (window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__?.localRequests ?? 0) + 1,
            },
            this.tabId,
          );
          resolve(await engine.stream(messages, handlers));
        });
    });
  }

  private relay(messages: BrainMessage[], handlers: BrainStreamHandlers): Promise<BrainStreamResult> {
    if (!this.channel) {
      return Promise.resolve({
        ok: false,
        failure: "unavailable",
        reason: "This browser cannot relay to the tab that owns OCADE's local engine.",
      });
    }
    const requestId = makeId();
    setDiagnostics(
      {
        relayedRequests:
          (window.__OCADE_BROWSER_ENGINE_DIAGNOSTICS__?.relayedRequests ?? 0) + 1,
      },
      this.tabId,
    );
    return new Promise<BrainStreamResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({
          ok: false,
          failure: "unavailable",
          reason: "The tab running OCADE's local engine stopped responding. Try the message again so a new leader can be elected.",
        });
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, onToken: handlers.onToken, timer });
      const abort = () => {
        this.channel?.postMessage({ type: "abort", from: this.tabId, requestId } satisfies RelayMessage);
        const pending = this.pending.get(requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(requestId);
          pending.resolve({ ok: false, failure: "cancelled", reason: "Stopped." });
        }
      };
      handlers.signal?.addEventListener("abort", abort, { once: true });
      this.channel!.postMessage({ type: "request", from: this.tabId, requestId, messages } satisfies RelayMessage);
    });
  }

  private async onMessage(message: RelayMessage): Promise<void> {
    if (!message || this.disposed) return;
    if (message.type === "token" && message.to === this.tabId) {
      this.pending.get(message.requestId)?.onToken(message.token);
      return;
    }
    if (message.type === "done" && message.to === this.tabId) {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      pending.resolve(message.result);
      return;
    }
    if (message.type === "ping" && this.role === "leader") {
      this.channel?.postMessage({ type: "pong", to: message.from, nonce: message.nonce } satisfies RelayMessage);
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
        this.channel?.postMessage({
          type: "token",
          to: message.from,
          requestId: message.requestId,
          token,
        } satisfies RelayMessage),
    });
    this.leaderAbort.delete(message.requestId);
    this.channel?.postMessage({
      type: "done",
      to: message.from,
      requestId: message.requestId,
      result,
    } satisfies RelayMessage);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.resolve({ ok: false, failure: "cancelled", reason: "OCADE closed." });
    }
    this.pending.clear();
    for (const controller of this.leaderAbort.values()) controller.abort();
    this.leaderAbort.clear();
    await this.active?.dispose?.().catch(() => {});
    this.active = null;
    setDiagnostics({ modelInstances: 0, activeEngine: null }, this.tabId);
    this.channel?.close();
    this.channel = null;
    this.releaseLock?.();
    this.releaseLock = null;
  }
}

export const SHARED_BROWSER_LOCK_NAME = LOCK_NAME;
export const SHARED_BROWSER_CHANNEL_NAME = CHANNEL_NAME;
