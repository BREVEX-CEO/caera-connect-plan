import { describe, expect, it } from "vitest";
import {
  EncryptedMobileTransport,
  generateMobileChannelIdentity,
  type EncryptedMobileEnvelope,
  type MobileEnvelopeLink,
} from "../mobile/secure-channel";
import type { MobileIntent } from "../mobile/companion-link";

/**
 * RECEIVE-PATH REPLAY DEFENCE (spec §8.1 replay prevention, §9.7 "duplicate
 * messages do not repeat mutations", §8.7 replayed command / reconnect race).
 *
 * `openMobileMessage` rejects `sequence <= lastSequence` and returns the
 * accepted sequence so the caller can advance its watermark.
 * `EncryptedMobileTransport.subscribe` previously passed a hard-coded
 * `lastSequence: 0`, so a captured envelope could be re-delivered indefinitely
 * and every copy passed the check. These tests pin the fix.
 *
 * The intent used is `emergency.stop` deliberately: a mutation whose duplicate
 * delivery must never be executed twice.
 */

const NOW = new Date("2026-07-25T00:00:00.000Z");

/** A link that captures what is sent and lets a test push envelopes back. */
class TestLink implements MobileEnvelopeLink {
  readonly sent: EncryptedMobileEnvelope[] = [];
  private handler: ((envelope: EncryptedMobileEnvelope) => void) | null = null;

  status() {
    return Promise.resolve({ connected: true });
  }

  send(envelope: EncryptedMobileEnvelope) {
    this.sent.push(envelope);
    return Promise.resolve({ ok: true, detail: "queued" });
  }

  subscribe(onMessage: (envelope: EncryptedMobileEnvelope) => void) {
    this.handler = onMessage;
    return () => {
      this.handler = null;
    };
  }

  /** Deliver an envelope exactly as a relay would, and await processing. */
  async deliver(envelope: EncryptedMobileEnvelope): Promise<void> {
    await (this.handler?.(envelope) as unknown as Promise<void> | undefined);
  }

  /** Deliver concurrently, without awaiting between calls. */
  async deliverConcurrently(envelopes: EncryptedMobileEnvelope[]): Promise<void> {
    await Promise.all(envelopes.map((e) => this.handler?.(e) as unknown as Promise<void>));
  }
}

async function pair() {
  const phoneId = await generateMobileChannelIdentity();
  const desktopId = await generateMobileChannelIdentity();

  const phoneLink = new TestLink();
  const desktopLink = new TestLink();

  const phone = new EncryptedMobileTransport(
    "phone",
    phoneId,
    desktopId.publicKey,
    phoneLink,
    () => NOW,
  );
  const desktop = new EncryptedMobileTransport(
    "desktop",
    desktopId,
    phoneId.publicKey,
    desktopLink,
    () => NOW,
  );

  const received: MobileIntent[] = [];
  desktop.subscribe((payload) => received.push(payload as MobileIntent));

  return { phone, phoneLink, desktopLink, received };
}

describe("encrypted transport receive-path replay watermark", () => {
  it("accepts a genuine message once", async () => {
    const { phone, phoneLink, desktopLink, received } = await pair();
    await phone.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });
    await desktopLink.deliver(phoneLink.sent[0]);
    expect(received).toEqual([{ kind: "emergency.stop" }]);
  });

  it("REJECTS the same envelope replayed a second time", async () => {
    const { phone, phoneLink, desktopLink, received } = await pair();
    await phone.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });

    const captured = phoneLink.sent[0];
    await desktopLink.deliver(captured);
    await desktopLink.deliver(captured); // attacker re-sends the capture
    await desktopLink.deliver(captured);

    expect(received).toHaveLength(1);
  });

  it("rejects an out-of-order envelope below the watermark", async () => {
    const { phone, phoneLink, desktopLink, received } = await pair();
    await phone.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });
    await phone.send({ kind: "run.cancel", runId: "r1" }, { idempotencyKey: "2" });

    const [first, second] = phoneLink.sent;
    await desktopLink.deliver(second); // sequence 2 accepted
    await desktopLink.deliver(first); // sequence 1 is now stale
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ kind: "run.cancel" });
  });

  it("still accepts a strictly increasing stream", async () => {
    const { phone, phoneLink, desktopLink, received } = await pair();
    await phone.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });
    await phone.send({ kind: "run.cancel", runId: "r1" }, { idempotencyKey: "2" });
    await phone.send({ kind: "monitor.status" }, { idempotencyKey: "3" });

    for (const envelope of phoneLink.sent) await desktopLink.deliver(envelope);
    expect(received).toHaveLength(3);
  });

  it("does not accept a duplicate delivered CONCURRENTLY (reconnect race)", async () => {
    const { phone, phoneLink, desktopLink, received } = await pair();
    await phone.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });

    const captured = phoneLink.sent[0];
    // Both arrive before either finishes: without serialisation both would read
    // the same watermark and both would be accepted.
    await desktopLink.deliverConcurrently([captured, captured, captured]);

    expect(received).toHaveLength(1);
  });

  it("survives a throwing handler without losing the subscription", async () => {
    const phoneId = await generateMobileChannelIdentity();
    const desktopId = await generateMobileChannelIdentity();
    const phoneLink = new TestLink();
    const desktopLink = new TestLink();
    const phone = new EncryptedMobileTransport(
      "phone",
      phoneId,
      desktopId.publicKey,
      phoneLink,
      () => NOW,
    );
    const desktop = new EncryptedMobileTransport(
      "desktop",
      desktopId,
      phoneId.publicKey,
      desktopLink,
      () => NOW,
    );

    const seen: MobileIntent[] = [];
    desktop.subscribe((payload) => {
      seen.push(payload as MobileIntent);
      if (seen.length === 1) throw new Error("handler blew up");
    });

    await phone.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });
    await phone.send({ kind: "run.cancel", runId: "r1" }, { idempotencyKey: "2" });
    for (const envelope of phoneLink.sent) await desktopLink.deliver(envelope);

    // The first handler threw; the second message must still arrive.
    expect(seen).toHaveLength(2);
  });
});
