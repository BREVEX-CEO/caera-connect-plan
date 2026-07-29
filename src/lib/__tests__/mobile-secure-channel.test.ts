import { describe, expect, it } from "vitest";
import {
  EncryptedMobileTransport,
  generateMobileChannelIdentity,
  openMobileMessage,
  sealMobileMessage,
  type EncryptedMobileEnvelope,
} from "../mobile/secure-channel";

const NOW = new Date("2026-07-25T00:00:00.000Z");

describe("encrypted cross-device channel", () => {
  it("round-trips through ECDH + HKDF + AES-GCM without exposing plaintext", async () => {
    const desktop = await generateMobileChannelIdentity();
    const phone = await generateMobileChannelIdentity();
    const payload = { kind: "approval.decide", requestId: "r-1", decision: "approved" };
    const envelope = await sealMobileMessage(payload, {
      sender: phone,
      recipientPublicKey: desktop.publicKey,
      deviceId: "phone-1",
      sequence: 1,
      now: NOW,
    });

    expect(JSON.stringify(envelope)).not.toContain("approved");
    const opened = await openMobileMessage<typeof payload>(envelope, {
      recipientPrivateKey: desktop.privateKey,
      expectedSenderFingerprint: phone.fingerprint,
      lastSequence: 0,
      now: NOW,
    });
    expect(opened).toMatchObject({ ok: true, value: payload, sequence: 1 });
  });

  it("refuses tampering, the wrong recipient, and an unpinned sender", async () => {
    const desktop = await generateMobileChannelIdentity();
    const phone = await generateMobileChannelIdentity();
    const stranger = await generateMobileChannelIdentity();
    const envelope = await sealMobileMessage(
      { kind: "emergency.stop" },
      {
        sender: phone,
        recipientPublicKey: desktop.publicKey,
        deviceId: "phone-1",
        sequence: 1,
        now: NOW,
      },
    );
    const tampered = {
      ...envelope,
      // Change a full six-bit Base64URL symbol. Changing the final symbol can
      // touch only unused padding bits and decode to the original ciphertext.
      ciphertext: `${envelope.ciphertext.startsWith("A") ? "B" : "A"}${envelope.ciphertext.slice(1)}`,
    };

    expect(
      await openMobileMessage(tampered, {
        recipientPrivateKey: desktop.privateKey,
        expectedSenderFingerprint: phone.fingerprint,
        lastSequence: 0,
        now: NOW,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await openMobileMessage(envelope, {
        recipientPrivateKey: stranger.privateKey,
        expectedSenderFingerprint: phone.fingerprint,
        lastSequence: 0,
        now: NOW,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await openMobileMessage(envelope, {
        recipientPrivateKey: desktop.privateKey,
        expectedSenderFingerprint: stranger.fingerprint,
        lastSequence: 0,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/untrusted/i) });
  });

  it("refuses replayed and expired envelopes before execution", async () => {
    const desktop = await generateMobileChannelIdentity();
    const phone = await generateMobileChannelIdentity();
    const envelope = await sealMobileMessage(
      { kind: "run.cancel", runId: "run-1" },
      {
        sender: phone,
        recipientPublicKey: desktop.publicKey,
        deviceId: "phone-1",
        sequence: 7,
        now: NOW,
        ttlMs: 1_000,
      },
    );

    expect(
      await openMobileMessage(envelope, {
        recipientPrivateKey: desktop.privateKey,
        expectedSenderFingerprint: phone.fingerprint,
        lastSequence: 7,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/replayed|reordered/i) });
    expect(
      await openMobileMessage(envelope, {
        recipientPrivateKey: desktop.privateKey,
        expectedSenderFingerprint: phone.fingerprint,
        lastSequence: 0,
        now: new Date(NOW.getTime() + 1_001),
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/expired/i) });
  });

  it("fails closed when replay state or the receiver clock is invalid", async () => {
    const desktop = await generateMobileChannelIdentity();
    const phone = await generateMobileChannelIdentity();
    const envelope = await sealMobileMessage(
      { kind: "run.cancel", runId: "run-1" },
      {
        sender: phone,
        recipientPublicKey: desktop.publicKey,
        deviceId: "phone-1",
        sequence: 1,
        now: NOW,
      },
    );

    expect(
      await openMobileMessage(envelope, {
        recipientPrivateKey: desktop.privateKey,
        expectedSenderFingerprint: phone.fingerprint,
        lastSequence: Number.NaN,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/replay state/i) });
    expect(
      await openMobileMessage(envelope, {
        recipientPrivateKey: desktop.privateKey,
        expectedSenderFingerprint: phone.fingerprint,
        lastSequence: 0,
        now: new Date(Number.NaN),
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/clock/i) });
  });

  it("binds transport delivery to encrypted envelopes and unique sequences", async () => {
    const desktop = await generateMobileChannelIdentity();
    const phone = await generateMobileChannelIdentity();
    const sent: EncryptedMobileEnvelope[] = [];
    const transport = new EncryptedMobileTransport(
      "phone-1",
      phone,
      desktop.publicKey,
      {
        status: async () => ({ connected: true }),
        send: async (envelope) => {
          sent.push(envelope);
          return { ok: true, detail: "acknowledged" };
        },
      },
      () => NOW,
    );

    await transport.send({ kind: "monitor.status" });
    await transport.send({ kind: "emergency.stop" });
    expect(sent.map((item) => item.sequence)).toEqual([1, 2]);
    expect(JSON.stringify(sent)).not.toContain("emergency.stop");
  });

  it("bounds plaintext and expiry before encryption", async () => {
    const desktop = await generateMobileChannelIdentity();
    const phone = await generateMobileChannelIdentity();
    await expect(
      sealMobileMessage(
        { text: "x".repeat(300_000) },
        {
          sender: phone,
          recipientPublicKey: desktop.publicKey,
          deviceId: "phone-1",
          sequence: 1,
          now: NOW,
        },
      ),
    ).rejects.toThrow(/256 KiB/i);
    await expect(
      sealMobileMessage(
        {},
        {
          sender: phone,
          recipientPublicKey: desktop.publicKey,
          deviceId: "phone-1",
          sequence: 1,
          now: NOW,
          ttlMs: 10 * 60 * 1000,
        },
      ),
    ).rejects.toThrow(/expiry/i);
  });
});
