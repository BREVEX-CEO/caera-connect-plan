import { describe, expect, it } from "vitest";
import { LocalRelayServer, SimulatedRelayAdapter } from "./fixtures/relay-simulator";
import { ReliableMobileEnvelopeLink } from "../mobile/reconnect-protocol";
import { EncryptedMobileTransport, generateMobileChannelIdentity } from "../mobile/secure-channel";
import type { MobileIntent } from "../mobile/companion-link";

const NOW = new Date("2026-07-25T00:00:00.000Z");

describe("authenticated relay channel and reconnect protocol", () => {
  it("delivers messages and prevents duplicates/loss through the relay", async () => {
    const server = new LocalRelayServer();
    const roomId = "test-room";

    const desktopId = await generateMobileChannelIdentity();
    const phoneId = await generateMobileChannelIdentity();

    // Desktop
    const desktopAdapter = new SimulatedRelayAdapter(server, "desktop", roomId);
    const desktopReliable = new ReliableMobileEnvelopeLink(desktopAdapter, () => NOW);
    await desktopAdapter.connect();

    const receivedIntents: any[] = [];
    desktopReliable.subscribe(async (envelope) => {
      // simulate PC receiving it
      receivedIntents.push(envelope.sequence);
      // PC acknowledges by sending something back or the application layer acks
      // The reliable link uses sequence numbers
    });

    // Phone
    const phoneAdapter = new SimulatedRelayAdapter(server, "phone", roomId);
    const phoneReliable = new ReliableMobileEnvelopeLink(phoneAdapter, () => NOW);
    await phoneAdapter.connect();

    const transport = new EncryptedMobileTransport(
      "phone",
      phoneId,
      desktopId.publicKey,
      phoneReliable,
      () => NOW,
    );

    const intent: MobileIntent = { kind: "emergency.stop" };
    await transport.send(intent, { idempotencyKey: "1" });

    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(receivedIntents).toEqual([1]);
  });

  it("reconciles reconnects and resends unacknowledged envelopes", async () => {
    const server = new LocalRelayServer();
    const roomId = "reconnect-room";

    const desktopId = await generateMobileChannelIdentity();
    const phoneId = await generateMobileChannelIdentity();

    const desktopAdapter = new SimulatedRelayAdapter(server, "desktop", roomId);
    const desktopReliable = new ReliableMobileEnvelopeLink(desktopAdapter, () => NOW);
    await desktopAdapter.connect();

    let receiveCount = 0;
    desktopReliable.subscribe((env) => {
      receiveCount++;
    });

    const phoneAdapter = new SimulatedRelayAdapter(server, "phone", roomId);
    const phoneReliable = new ReliableMobileEnvelopeLink(phoneAdapter, () => NOW);
    await phoneAdapter.connect();

    const transport = new EncryptedMobileTransport(
      "phone",
      phoneId,
      desktopId.publicKey,
      phoneReliable,
      () => NOW,
    );

    // Drop connection
    phoneAdapter.triggerDisconnect();

    await transport.send({ kind: "monitor.status" }, { idempotencyKey: "1" });
    await transport.send({ kind: "emergency.stop" }, { idempotencyKey: "2" });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(receiveCount).toBe(0);

    // Reconnect should resend
    await phoneAdapter.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Both envelopes should be delivered
    expect(receiveCount).toBe(2);
  });

  it("handles out of order and duplicate envelopes robustly", async () => {
    const server = new LocalRelayServer();
    server.duplicateProbability = 1.0; // Every packet sent twice
    const roomId = "dup-room";

    const desktopId = await generateMobileChannelIdentity();
    const phoneId = await generateMobileChannelIdentity();

    const desktopAdapter = new SimulatedRelayAdapter(server, "desktop", roomId);
    const desktopReliable = new ReliableMobileEnvelopeLink(desktopAdapter);
    await desktopAdapter.connect();

    let receiveCount = 0;
    desktopReliable.subscribe((env) => {
      receiveCount++;
    });

    const phoneAdapter = new SimulatedRelayAdapter(server, "phone", roomId);
    const phoneReliable = new ReliableMobileEnvelopeLink(phoneAdapter, () => NOW);
    await phoneAdapter.connect();

    const transport = new EncryptedMobileTransport(
      "phone",
      phoneId,
      desktopId.publicKey,
      phoneReliable,
      () => NOW,
    );

    await transport.send({ kind: "emergency.stop" }, { idempotencyKey: "1" });

    await new Promise((resolve) => setTimeout(resolve, 20));

    // Desktop reliable link should filter out the duplicate sequence
    expect(receiveCount).toBe(1);
  });
});
