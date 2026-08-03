import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  decideMobileIntent,
  dispatchMobileIntent,
  applyMobileApproval,
  createMobileIntentQueue,
  flushMobileQueue,
  isReplayable,
  enqueueIfSafe,
  getMobileTransport,
  setMobileTransport,
  setMobileBiometricGate,
  UnavailableMobileTransport,
  UnavailableMobileBiometricGate,
  MOBILE_TRANSPORT_UNAVAILABLE,
  MOBILE_BIOMETRIC_UNAVAILABLE,
  MAX_HANDOFF_BYTES,
  type MobileIntent,
} from "../mobile/companion-link";
import { createApprovalRequest, TRUST_STALE_MS, type PairedDevice } from "../mobile/pairing";

const NOW = new Date("2026-07-23T10:00:00Z");

function phone(over: Partial<PairedDevice> = {}): PairedDevice {
  return {
    id: "d1",
    label: "Pixel",
    kind: "mobile",
    platform: "android",
    pairedAt: NOW,
    lastSeenAt: NOW,
    revoked: false,
    ...over,
  };
}

beforeEach(() => {
  setMobileTransport(new UnavailableMobileTransport());
  setMobileBiometricGate(new UnavailableMobileBiometricGate());
});

describe("mobile intent policy", () => {
  it("refuses an unpaired device", () => {
    expect(decideMobileIntent({ kind: "monitor.status" }, null, NOW)).toMatchObject({
      allow: false,
    });
  });

  it("refuses a desktop device sending mobile intents", () => {
    const d = decideMobileIntent({ kind: "monitor.status" }, phone({ kind: "desktop" }), NOW);
    expect(d).toMatchObject({ allow: false });
  });

  it("refuses a revoked device", () => {
    const d = decideMobileIntent({ kind: "monitor.status" }, phone({ revoked: true }), NOW);
    expect(d).toMatchObject({ allow: false });
    if (!d.allow) expect(d.reason).toMatch(/revoked/i);
  });

  it("refuses a stale device for ordinary intents", () => {
    const stale = phone({ lastSeenAt: new Date(NOW.getTime() - TRUST_STALE_MS - 1000) });
    expect(decideMobileIntent({ kind: "monitor.status" }, stale, NOW)).toMatchObject({
      allow: false,
    });
  });

  it("STILL allows emergency stop from a stale device — halting is never the dangerous direction", () => {
    const stale = phone({ lastSeenAt: new Date(NOW.getTime() - TRUST_STALE_MS - 1000) });
    const d = decideMobileIntent({ kind: "emergency.stop" }, stale, NOW);
    expect(d).toMatchObject({ allow: true, requiresBiometric: true });
  });

  it("refuses emergency stop from a REVOKED device", () => {
    const d = decideMobileIntent({ kind: "emergency.stop" }, phone({ revoked: true }), NOW);
    expect(d).toMatchObject({ allow: false });
  });

  it("requires biometric confirmation for consequential intents", () => {
    const d = decideMobileIntent(
      { kind: "approval.decide", requestId: "r1", decision: "approved" },
      phone(),
      NOW,
    );
    expect(d).toMatchObject({ allow: true, requiresBiometric: true });
  });

  it("does not require biometric just to watch status", () => {
    expect(decideMobileIntent({ kind: "monitor.status" }, phone(), NOW)).toMatchObject({
      allow: true,
      requiresBiometric: false,
    });
  });

  it("rejects an oversized file handoff", () => {
    const d = decideMobileIntent(
      { kind: "file.handoff", name: "big.bin", sizeBytes: MAX_HANDOFF_BYTES + 1 },
      phone(),
      NOW,
    );
    expect(d).toMatchObject({ allow: false });
  });
});

describe("mobile approvals", () => {
  it("applies an approval from a trusted phone", () => {
    const req = createApprovalRequest({
      id: "r1",
      summary: "Open notes",
      risk: "confirm",
      now: NOW,
    });
    const r = applyMobileApproval(req, "approved", phone(), NOW);
    expect(r.status).toBe("approved");
  });

  it("can never approve a prohibited action remotely", () => {
    const req = createApprovalRequest({
      id: "r2",
      summary: "Type password",
      risk: "prohibited",
      now: NOW,
    });
    const r = applyMobileApproval(req, "approved", phone(), NOW);
    expect(r.status).not.toBe("approved");
    expect(r.reason).toMatch(/protected information/i);
  });

  it("reports an expired request instead of deciding it", () => {
    const req = createApprovalRequest({ id: "r3", summary: "x", risk: "low", now: NOW });
    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    expect(applyMobileApproval(req, "approved", phone(), later).status).toBe("expired");
  });
});

describe("offline queue", () => {
  it("queues only intents that are safe to replay", () => {
    expect(isReplayable({ kind: "task.handoff", conversationId: "c", text: "t" })).toBe(true);
    expect(isReplayable({ kind: "emergency.stop" })).toBe(false);
    expect(isReplayable({ kind: "approval.decide", requestId: "r", decision: "approved" })).toBe(
      false,
    );
  });

  it("refuses to queue a live-only intent", () => {
    const r = enqueueIfSafe([], { kind: "emergency.stop" }, NOW);
    expect(r.queued).toBe(false);
    expect(r.queue).toHaveLength(0);
  });

  it("queues a handoff with a timestamp", () => {
    const r = enqueueIfSafe([], { kind: "task.handoff", conversationId: "c", text: "hi" }, NOW);
    expect(r.queued).toBe(true);
    expect(r.queue[0].queuedAt).toBe(NOW.toISOString());
  });
});

describe("dispatch", () => {
  it("blocks when biometric confirmation is missing", async () => {
    const r = await dispatchMobileIntent({ kind: "emergency.stop" }, phone());
    expect(r.ok).toBe(false);
    expect(r.detail).toBe(MOBILE_BIOMETRIC_UNAVAILABLE);
  });

  it("accepts biometric confirmation only through the registered native gate", async () => {
    const confirmed: MobileIntent[] = [];
    setMobileBiometricGate({
      confirm: async (intent) => {
        confirmed.push(intent);
        return { ok: true, detail: "native biometric confirmed" };
      },
    });
    setMobileTransport({
      status: async () => ({ connected: true }),
      send: async () => ({ ok: true, detail: "stop acknowledged" }),
    });

    const r = await dispatchMobileIntent({ kind: "emergency.stop" }, phone());
    expect(r).toEqual({ ok: true, detail: "stop acknowledged" });
    expect(confirmed).toEqual([{ kind: "emergency.stop" }]);
  });

  it("queues a safe intent while offline instead of failing", async () => {
    const r = await dispatchMobileIntent(
      { kind: "task.handoff", conversationId: "c", text: "later" },
      phone(),
      { online: false, queue: [] },
    );
    expect(r.ok).toBe(true);
    expect(r.queue).toHaveLength(1);
  });

  it("reports the transport as unavailable rather than faking delivery", async () => {
    const r = await dispatchMobileIntent({ kind: "monitor.status" }, phone(), { online: true });
    expect(r.ok).toBe(false);
    expect(r.detail).toBe(MOBILE_TRANSPORT_UNAVAILABLE);
  });

  it("default transport reports disconnected", async () => {
    expect((await getMobileTransport().status()).connected).toBe(false);
  });
});

/**
 * A clipboard hand-off is the easiest accidental credential leak in the
 * product: copy a password, then send "my clipboard" to the desktop, where it
 * lands in a queue and an audit trail. It must be refused at the decision
 * layer, before anything is queued, sent or written.
 */
describe("protected content never crosses a handoff", () => {
  it.each([
    "my password is hunter2",
    "the OTP is 483920",
    "card number 4111 1111 1111 1111",
    "recovery code alpha bravo",
  ])("refuses a clipboard hand-off containing %s", (text) => {
    const d = decideMobileIntent({ kind: "clipboard.handoff", text }, phone());
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.reason).toMatch(/won't send it|enter it directly/i);
  });

  it("refuses a task hand-off containing a credential", () => {
    const d = decideMobileIntent(
      { kind: "task.handoff", conversationId: "c", text: "log in with password hunter2" },
      phone(),
    );
    expect(d.allow).toBe(false);
  });

  it("is never queued, so it cannot be replayed later", async () => {
    const q = createMobileIntentQueue();
    const r = await dispatchMobileIntent(
      { kind: "clipboard.handoff", text: "my password is hunter2" },
      phone(),
      { online: false, durable: q },
    );
    expect(r.ok).toBe(false);
    expect(q.size).toBe(0);
  });

  it("still allows ordinary text through", () => {
    const d = decideMobileIntent(
      { kind: "clipboard.handoff", text: "the meeting notes from Tuesday" },
      phone(),
    );
    expect(d.allow).toBe(true);
    if (!d.allow) throw new Error("unreachable");
    // Moving data off the device still needs a fresh confirmation.
    expect(d.requiresBiometric).toBe(true);
  });
});

/**
 * The mobile settings page tells the user offline work is "saved and sent when
 * your phone reconnects". These pin that promise: it must survive a reload, and
 * it must never replay something that has to be decided live.
 */
describe("the durable offline queue", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
    setMobileTransport(new UnavailableMobileTransport());
    setMobileBiometricGate(new UnavailableMobileBiometricGate());
  });

  it("persists a handoff so it survives a reload", async () => {
    const q = createMobileIntentQueue();
    await dispatchMobileIntent(
      { kind: "task.handoff", conversationId: "c", text: "later" },
      phone(),
      { online: false, durable: q },
    );
    // A fresh instance reads the same storage — this is the "after reload" case.
    expect(createMobileIntentQueue().size).toBe(1);
  });

  it("NEVER persists an emergency stop — halting must be decided live", async () => {
    const q = createMobileIntentQueue();
    const r = await dispatchMobileIntent({ kind: "emergency.stop" }, phone(), {
      online: false,
      durable: q,
    });
    expect(r.ok).toBe(false);
    expect(q.size).toBe(0);
  });

  it("NEVER persists an approval decision", async () => {
    const q = createMobileIntentQueue();
    await dispatchMobileIntent(
      { kind: "approval.decide", requestId: "r1", decision: "approved" },
      phone(),
      { online: false, durable: q },
    );
    expect(q.size).toBe(0);
  });

  it("sends queued work once a transport is connected", async () => {
    const sent: MobileIntent[] = [];
    setMobileTransport({
      status: async () => ({ connected: true }),
      send: async (i) => {
        sent.push(i);
        return { ok: true, detail: "delivered" };
      },
    });
    const q = createMobileIntentQueue();
    q.enqueue({ kind: "task.handoff", conversationId: "c", text: "one" });
    q.enqueue({ kind: "clipboard.handoff", text: "two" });

    const r = await flushMobileQueue(q, phone());
    expect(r.sent).toBe(2);
    expect(q.size).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it("refuses to send queued work for a phone revoked while it was offline", async () => {
    let delivered = 0;
    setMobileTransport({
      status: async () => ({ connected: true }),
      send: async () => {
        delivered++;
        return { ok: true, detail: "delivered" };
      },
    });
    const q = createMobileIntentQueue();
    q.enqueue({ kind: "task.handoff", conversationId: "c", text: "one" });

    const r = await flushMobileQueue(q, phone({ revoked: true }));
    expect(delivered).toBe(0);
    expect(r.sent).toBe(0);
    // Held, not silently discarded on the first refusal.
    expect(q.size).toBe(1);
  });

  it("gives up on a permanently failing item instead of retrying forever", async () => {
    const q = createMobileIntentQueue();
    q.enqueue({ kind: "task.handoff", conversationId: "c", text: "doomed" });
    // maxAttempts is 3 for this queue.
    for (let i = 0; i < 3; i++) await flushMobileQueue(q, phone({ revoked: true }));
    expect(q.size).toBe(0);
  });

  it("keeps the pure in-memory queue working for callers that don't persist", async () => {
    const r = await dispatchMobileIntent(
      { kind: "task.handoff", conversationId: "c", text: "x" },
      phone(),
      { online: false, queue: [] },
    );
    expect(r.queue).toHaveLength(1);
  });
});
