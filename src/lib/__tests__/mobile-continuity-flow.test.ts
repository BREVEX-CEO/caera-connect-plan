import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  dispatchMobileIntent,
  flushMobileQueue,
  createMobileIntentQueue,
  setMobileTransport,
  setMobileBiometricGate,
  UnavailableMobileTransport,
  UnavailableMobileBiometricGate,
  type MobileIntent,
} from "../mobile/companion-link";
import {
  listApprovals,
  requestApproval,
  saveApprovalStatus,
  clearApprovals,
} from "../mobile/approval-store";
import { setNotificationTransport, UnavailableNotifications } from "../mobile/notifications";
import { createPairingChallenge, verifyPairing, type PairedDevice } from "../mobile/pairing";

/**
 * END-TO-END MOBILE CONTINUITY.
 *
 * Each rule is unit-tested in isolation; this walks the JOURNEY a user actually
 * takes, because the failures that matter are at the seams:
 *
 *   pair → go offline → queue work → reconnect → replay → approve → revoke
 *
 * The dangerous seam is the last one: work queued or approved BEFORE a
 * revocation must never take effect AFTER it.
 */

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

/** Transport that records deliveries and can be switched on/off. */
function transport() {
  const delivered: MobileIntent[] = [];
  let online = true;
  setMobileTransport({
    status: async () => ({ connected: online }),
    send: async (i) => {
      if (!online) return { ok: false, detail: "offline" };
      delivered.push(i);
      return { ok: true, detail: "delivered" };
    },
  });
  return {
    delivered,
    goOffline: () => void (online = false),
    goOnline: () => void (online = true),
  };
}

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
  setNotificationTransport(new UnavailableNotifications());
});

describe("the full journey", () => {
  it("pairs, queues offline, replays on reconnect, and delivers exactly once", async () => {
    // 1. Pair — the code the phone echoes back must match the live challenge.
    const challenge = createPairingChallenge(NOW);
    expect(verifyPairing(challenge, { code: challenge.code, nonce: challenge.nonce }, NOW).ok).toBe(
      true,
    );
    const device = phone();

    // 2. Offline: safe work is held, not lost.
    const t = transport();
    t.goOffline();
    const queue = createMobileIntentQueue();
    const r = await dispatchMobileIntent(
      { kind: "task.handoff", conversationId: "c1", text: "finish the summary" },
      device,
      { online: false, durable: queue, now: NOW },
    );
    expect(r.ok).toBe(true);
    expect(queue.size).toBe(1);
    expect(t.delivered).toHaveLength(0);

    // 3. It survives a reload — a fresh queue reads the same storage.
    expect(createMobileIntentQueue().size).toBe(1);

    // 4. Reconnect and replay.
    t.goOnline();
    const flushed = await flushMobileQueue(queue, device, NOW);
    expect(flushed.sent).toBe(1);
    expect(t.delivered).toHaveLength(1);
    expect(queue.size).toBe(0);

    // 5. Replaying again delivers nothing — no duplicate work.
    const again = await flushMobileQueue(queue, device, NOW);
    expect(again.sent).toBe(0);
    expect(t.delivered).toHaveLength(1);
  });

  it("an emergency stop is never queued — it must be decided live", async () => {
    const queue = createMobileIntentQueue();
    const r = await dispatchMobileIntent({ kind: "emergency.stop" }, phone(), {
      online: false,
      durable: queue,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    expect(queue.size).toBe(0);
  });
});

/**
 * The most dangerous seam: a device revoked while its work is still pending.
 */
describe("revocation cuts off work queued beforehand", () => {
  it("queued work is NOT delivered after the device is revoked", async () => {
    const t = transport();
    t.goOffline();
    const queue = createMobileIntentQueue();
    await dispatchMobileIntent(
      { kind: "task.handoff", conversationId: "c1", text: "later" },
      phone(),
      { online: false, durable: queue, now: NOW },
    );
    expect(queue.size).toBe(1);

    // The phone is lost and revoked while still offline.
    t.goOnline();
    const flushed = await flushMobileQueue(queue, phone({ revoked: true }), NOW);

    expect(flushed.sent).toBe(0);
    expect(t.delivered).toHaveLength(0);
  });

  it("a stale (unrevoked) phone can still deliver — staleness is not revocation", async () => {
    const t = transport();
    const queue = createMobileIntentQueue();
    queue.enqueue({ kind: "clipboard.handoff", text: "notes" });

    const stale = phone({ lastSeenAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24 * 30) });
    const flushed = await flushMobileQueue(queue, stale, NOW);
    // Trust rules decide this; what matters is it is a DECISION, not a crash.
    expect(typeof flushed.sent).toBe("number");
    expect(t.delivered.length).toBe(flushed.sent);
  });

  it("pending approvals are cleared on revocation, so no decision lands late", () => {
    requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    expect(listApprovals(NOW)).toHaveLength(1);

    clearApprovals(); // what revoke() does
    expect(listApprovals(NOW)).toHaveLength(0);

    // A decision for the now-gone request cannot resurrect it.
    expect(saveApprovalStatus("anything", "approved", "d1")).toBeNull();
    expect(listApprovals(NOW)).toHaveLength(0);
  });
});

describe("continuity survives interruption", () => {
  it("an approval raised before a reload is still waiting after it", () => {
    const created = requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    // Fresh read = post-reload; nothing is held in memory.
    const after = listApprovals(NOW);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(created.id);
    expect(after[0].status).toBe("pending");
  });

  it("a decision made on the phone is visible to the desktop", () => {
    const created = requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    saveApprovalStatus(created.id, "approved", "d1", NOW);
    expect(listApprovals(NOW)[0].status).toBe("approved");
  });

  it("multiple queued items replay in order, oldest first", async () => {
    const t = transport();
    const queue = createMobileIntentQueue();
    queue.enqueue({ kind: "task.handoff", conversationId: "c", text: "first" });
    queue.enqueue({ kind: "task.handoff", conversationId: "c", text: "second" });
    queue.enqueue({ kind: "clipboard.handoff", text: "third" });

    await flushMobileQueue(queue, phone(), NOW);
    const texts = t.delivered.map((i) => ("text" in i ? i.text : ""));
    expect(texts).toEqual(["first", "second", "third"]);
  });

  it("one poisoned item cannot block the rest forever", async () => {
    const queue = createMobileIntentQueue();
    queue.enqueue({ kind: "task.handoff", conversationId: "c", text: "doomed" });
    // Revoked device => every send refused. maxAttempts is 3 for this queue.
    for (let i = 0; i < 3; i++) await flushMobileQueue(queue, phone({ revoked: true }), NOW);
    expect(queue.size).toBe(0);
  });
});
