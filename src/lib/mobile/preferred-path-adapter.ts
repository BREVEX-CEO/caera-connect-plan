import type { EncryptedMobileEnvelope } from "./secure-channel";
import type { MobileTransportStatus } from "./companion-link";
import type { RelayTransportAdapter } from "./transport-adapters";
import {
  chooseTransportPath,
  DIRECT_PROBE_TIMEOUT_MS,
  type PathChoice,
  type RelayPreference,
} from "./direct-path";

/**
 * The adapter that actually keeps traffic off the relay (HWE-26).
 *
 * It holds both candidates and connects exactly one. The decision itself is in
 * `direct-path.ts` and is pure; this class is the small amount of I/O around
 * it — probing the direct address, and delegating once a path is chosen.
 *
 * TWO PROPERTIES THIS TYPE EXISTS TO GUARANTEE:
 *
 *  1. THE LOSING PATH IS NEVER CONNECTED. When the direct link works, the relay
 *     socket is never opened, so the relay operator never learns the pair
 *     exists. Opening it "just in case" would minimise bytes while leaking the
 *     metadata that was the reason to avoid it.
 *  2. NOBODY IS TOLD THEY ARE DIRECT WHEN THEY ARE NOT. `activePath` is set
 *     from the connection that actually succeeded, never from the preference
 *     that was asked for.
 */
export class PreferredPathAdapter implements RelayTransportAdapter {
  private active: RelayTransportAdapter | null = null;
  private choice: PathChoice | null = null;
  private readonly statusListeners = new Set<(status: MobileTransportStatus) => void>();
  private readonly messageListeners = new Set<(envelope: EncryptedMobileEnvelope) => void>();
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    private readonly options: {
      preference: RelayPreference;
      /** LAN/loopback candidate, when pairing established one. */
      direct: RelayTransportAdapter | null;
      relay: RelayTransportAdapter | null;
      /**
       * Reachability probe, injected so the whole routing rule can be
       * exercised without two devices on one network.
       */
      probeDirect?: (adapter: RelayTransportAdapter) => Promise<boolean>;
      timeoutMs?: number;
    },
  ) {}

  /** Which path is carrying traffic right now, or null before connecting. */
  get activePath(): "direct" | "relay" | null {
    return this.choice?.path ?? null;
  }

  /** The sentence explaining that choice, for the screen. */
  get pathReason(): string {
    return this.choice?.reason ?? "Not connected.";
  }

  async connect(): Promise<void> {
    const { preference, direct, relay } = this.options;

    /*
     * The probe runs BEFORE the decision, because "is the computer reachable"
     * is an input to it. It is skipped entirely when no direct candidate is
     * configured or when the preference rules direct out — probing an address
     * we would not use is a packet sent for nothing.
     */
    const directConfigured = direct !== null;
    const directReachable =
      directConfigured && preference !== "relay_only" ? await this.probe(direct) : false;

    const choice = chooseTransportPath({
      preference,
      directConfigured,
      directReachable,
      relayConfigured: relay !== null,
    });
    this.choice = choice;

    if (choice.path === null) {
      // An honest refusal, with the reason the pure decision produced.
      this.notifyStatus({ connected: false, reason: choice.reason });
      throw new Error(choice.reason);
    }

    const chosen = choice.path === "direct" ? direct! : relay!;
    await chosen.connect();
    this.adopt(chosen);
    this.notifyStatus({ connected: true });
  }

  private async probe(adapter: RelayTransportAdapter | null): Promise<boolean> {
    if (!adapter) return false;
    const probe = this.options.probeDirect ?? defaultProbe;
    const timeoutMs = this.options.timeoutMs ?? DIRECT_PROBE_TIMEOUT_MS;
    try {
      return await withTimeout(probe(adapter), timeoutMs);
    } catch {
      // A probe that throws is a machine that is not there. Not an error to
      // surface: falling back to the relay is the designed response.
      return false;
    }
  }

  /** Bind the winning adapter's messages and status to our own listeners. */
  private adopt(adapter: RelayTransportAdapter): void {
    this.active = adapter;
    if (adapter.subscribe) {
      this.unsubscribers.push(
        adapter.subscribe((envelope) => {
          for (const listener of this.messageListeners) listener(envelope);
        }),
      );
    }
    adapter.on("status", (status) => this.notifyStatus(status));
  }

  disconnect(): void {
    for (const off of this.unsubscribers.splice(0)) off();
    this.active?.disconnect();
    this.active = null;
    this.choice = null;
  }

  async status(): Promise<MobileTransportStatus> {
    if (!this.active) return { connected: false, reason: this.pathReason };
    return this.active.status();
  }

  async send(
    envelope: EncryptedMobileEnvelope,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }> {
    if (!this.active) {
      return { ok: false, detail: this.pathReason };
    }
    return this.active.send(envelope, options);
  }

  subscribe(onMessage: (envelope: EncryptedMobileEnvelope) => void): () => void {
    this.messageListeners.add(onMessage);
    return () => {
      this.messageListeners.delete(onMessage);
    };
  }

  on(event: "status", listener: (status: MobileTransportStatus) => void): void {
    if (event === "status") this.statusListeners.add(listener);
  }

  private notifyStatus(status: MobileTransportStatus): void {
    for (const listener of this.statusListeners) listener(status);
  }
}

/**
 * Default reachability probe: open the socket and see.
 *
 * Connecting IS the probe — there is no cheaper question to ask a websocket,
 * and a candidate that connects is one we are about to use anyway.
 */
async function defaultProbe(adapter: RelayTransportAdapter): Promise<boolean> {
  await adapter.connect();
  const status = await adapter.status();
  if (!status.connected) {
    adapter.disconnect();
    return false;
  }
  return true;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
