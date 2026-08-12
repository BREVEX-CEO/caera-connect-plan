import { describe, it, expect } from "vitest";
import {
  chooseTransportPath,
  isDirectAddress,
  DIRECT_PROBE_TIMEOUT_MS,
} from "../mobile/direct-path";
import { PreferredPathAdapter } from "../mobile/preferred-path-adapter";
import type { RelayTransportAdapter } from "../mobile/transport-adapters";
import type { EncryptedMobileEnvelope } from "../mobile/secure-channel";
import type { MobileTransportStatus } from "../mobile/companion-link";

/**
 * PEER-TO-PEER RELAY MINIMISATION (HWE-26).
 *
 * The requirement was recorded as NOT STARTED with a precise reason: the
 * transport factory always built a relay socket, so there was no second path
 * and nothing to minimise. Two devices on one sofa sent every message to a
 * rented server on the public internet and back.
 *
 * The assertion that matters most is `never opens the relay socket`. Sealing
 * the payload keeps the relay operator from reading a message; it does not stop
 * them learning that this phone and this computer are paired, how often they
 * talk and when. Minimisation that still opened the relay "as a fallback" would
 * save bytes and leak exactly the thing worth protecting.
 */

/** A relay adapter that records what was done to it. Connects unless told not to. */
class SpyAdapter implements RelayTransportAdapter {
  connectCalls = 0;
  disconnectCalls = 0;
  sent: EncryptedMobileEnvelope[] = [];
  private connected = false;
  private statusListeners: Array<(s: MobileTransportStatus) => void> = [];
  private messageListeners: Array<(e: EncryptedMobileEnvelope) => void> = [];

  constructor(
    readonly label: string,
    private readonly behaviour: { reachable?: boolean; hangs?: boolean } = {},
  ) {}

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.behaviour.hangs) {
      // A machine that has left the network: the socket never resolves.
      await new Promise(() => {});
    }
    if (this.behaviour.reachable === false) throw new Error(`${this.label} unreachable`);
    this.connected = true;
  }
  disconnect(): void {
    this.disconnectCalls += 1;
    this.connected = false;
  }
  async status(): Promise<MobileTransportStatus> {
    return { connected: this.connected };
  }
  async send(envelope: EncryptedMobileEnvelope): Promise<{ ok: boolean; detail: string }> {
    this.sent.push(envelope);
    return { ok: true, detail: `sent via ${this.label}` };
  }
  subscribe(onMessage: (e: EncryptedMobileEnvelope) => void): () => void {
    this.messageListeners.push(onMessage);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== onMessage);
    };
  }
  on(event: "status", listener: (s: MobileTransportStatus) => void): void {
    if (event === "status") this.statusListeners.push(listener);
  }
  /** Simulate an inbound message from the peer. */
  deliver(envelope: EncryptedMobileEnvelope): void {
    for (const l of this.messageListeners) l(envelope);
  }
}

const ENVELOPE = { v: 1, sequence: 1 } as unknown as EncryptedMobileEnvelope;

describe("the direct path is preferred, and the relay is genuinely bypassed", () => {
  it("never opens the relay socket when the direct link works", async () => {
    const direct = new SpyAdapter("direct");
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({ preference: "prefer_direct", direct, relay });

    await adapter.connect();

    expect(adapter.activePath).toBe("direct");
    // THE ASSERTION THIS FILE EXISTS FOR. Not "the relay carried less"; the
    // relay was never contacted, so it never learned the pair exists.
    expect(relay.connectCalls).toBe(0);
    expect(direct.connectCalls).toBeGreaterThan(0);
  });

  it("sends over the direct link and nothing over the relay", async () => {
    const direct = new SpyAdapter("direct");
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({ preference: "prefer_direct", direct, relay });

    await adapter.connect();
    const result = await adapter.send(ENVELOPE);

    expect(result.ok).toBe(true);
    expect(direct.sent).toHaveLength(1);
    expect(relay.sent).toHaveLength(0);
  });

  it("falls back to the relay when the computer is not on this network", async () => {
    const direct = new SpyAdapter("direct", { reachable: false });
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({ preference: "prefer_direct", direct, relay });

    await adapter.connect();
    await adapter.send(ENVELOPE);

    expect(adapter.activePath).toBe("relay");
    expect(relay.sent).toHaveLength(1);
    expect(adapter.pathReason).toMatch(/not reachable on this network/);
  });

  it("does not wait forever on a computer that has left the network", async () => {
    // A device that vanished mid-session leaves the socket hanging. Without a
    // bound, every send would appear broken rather than falling back.
    const direct = new SpyAdapter("direct", { hangs: true });
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({
      preference: "prefer_direct",
      direct,
      relay,
      timeoutMs: 20,
    });

    const started = Date.now();
    await adapter.connect();

    expect(adapter.activePath).toBe("relay");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("refuses rather than using the relay when the user said direct only", async () => {
    const direct = new SpyAdapter("direct", { reachable: false });
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({ preference: "direct_only", direct, relay });

    await expect(adapter.connect()).rejects.toThrow(/never to use the relay/);
    // The refusal must be real: a "direct only" setting that quietly used the
    // relay on failure would be worse than not offering the setting.
    expect(relay.connectCalls).toBe(0);
    expect(adapter.activePath).toBeNull();
  });

  it("does not probe the direct address when the user asked for relay only", async () => {
    const direct = new SpyAdapter("direct");
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({ preference: "relay_only", direct, relay });

    await adapter.connect();

    expect(adapter.activePath).toBe("relay");
    expect(direct.connectCalls).toBe(0);
  });

  it("passes inbound messages through from whichever path won", async () => {
    const direct = new SpyAdapter("direct");
    const relay = new SpyAdapter("relay");
    const adapter = new PreferredPathAdapter({ preference: "prefer_direct", direct, relay });
    const received: EncryptedMobileEnvelope[] = [];
    adapter.subscribe((e) => received.push(e));

    await adapter.connect();
    direct.deliver(ENVELOPE);

    expect(received).toHaveLength(1);
  });

  it("reports not-connected honestly before connecting", async () => {
    const adapter = new PreferredPathAdapter({
      preference: "prefer_direct",
      direct: new SpyAdapter("direct"),
      relay: new SpyAdapter("relay"),
    });
    const status = await adapter.status();
    expect(status.connected).toBe(false);
    const send = await adapter.send(ENVELOPE);
    expect(send.ok).toBe(false);
  });
});

describe("the routing decision, on its own", () => {
  it("prefers direct when it is configured and answering", () => {
    expect(
      chooseTransportPath({
        preference: "prefer_direct",
        directConfigured: true,
        directReachable: true,
        relayConfigured: true,
      }).path,
    ).toBe("direct");
  });

  it("names what to change in every refusal", () => {
    const noWay = chooseTransportPath({
      preference: "prefer_direct",
      directConfigured: false,
      directReachable: false,
      relayConfigured: false,
    });
    expect(noWay.path).toBeNull();
    // "No transport available" tells a user nothing they can act on.
    expect(noWay.reason).toMatch(/no direct address is paired and no relay is configured/i);
  });

  it("will not claim relay-only works with no relay", () => {
    const choice = chooseTransportPath({
      preference: "relay_only",
      directConfigured: true,
      directReachable: true,
      relayConfigured: false,
    });
    expect(choice.path).toBeNull();
  });

  it("keeps the probe bound short enough not to stall a send", () => {
    // A LAN round trip is single-digit milliseconds. Anything approaching a
    // second means the machine is not there, and the user is waiting.
    expect(DIRECT_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(1000);
  });
});

describe("only a genuinely local address counts as direct", () => {
  it("accepts loopback and private ranges", () => {
    for (const url of [
      "ws://localhost:8765",
      "ws://127.0.0.1:8765",
      "ws://192.168.1.10:8765",
      "ws://10.0.0.5:8765",
      "ws://172.16.4.2:8765",
      "ws://[fe80::1]:8765",
    ]) {
      expect(isDirectAddress(url), `${url} should count as direct`).toBe(true);
    }
  });

  it("rejects public addresses, which would cross the internet under a local label", () => {
    for (const url of [
      "wss://relay.example.com/ws",
      "ws://8.8.8.8:8765",
      "ws://172.32.0.1:8765", // just outside the RFC1918 172.16/12 block
      "not a url",
    ]) {
      expect(isDirectAddress(url), `${url} must not count as direct`).toBe(false);
    }
  });
});
