import type { EncryptedMobileEnvelope, MobileEnvelopeLink } from "./secure-channel";
import type { MobileTransportStatus } from "./companion-link";
import type { RelayTransportAdapter } from "./transport-adapters";

export class ReliableMobileEnvelopeLink implements MobileEnvelopeLink {
  private buffer: Map<number, EncryptedMobileEnvelope> = new Map();
  private lastReceivedSequence = 0;
  private messageListeners: Set<(envelope: EncryptedMobileEnvelope) => void> = new Set();
  private adapterUnsubscribe: (() => void) | null = null;
  private connected = false;

  constructor(
    private readonly adapter: RelayTransportAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.adapter.on("status", (status) => {
      this.connected = status.connected;
      if (this.connected) {
        this.reconcile();
      }
    });

    if (this.adapter.subscribe) {
      this.adapterUnsubscribe = this.adapter.subscribe((envelope) => {
        // Handle deduplication and out-of-order at the envelope sequence level
        // Actually, decryption will also check sequence, but we drop duplicates early here if possible.
        // We do not parse the encrypted sequence because it's authenticated data.
        // Wait, envelope.sequence IS in plaintext (authenticated via additional data).
        if (envelope.sequence <= this.lastReceivedSequence) {
          // Drop duplicate/reordered
          return;
        }
        this.lastReceivedSequence = envelope.sequence;

        for (const listener of this.messageListeners) {
          listener(envelope);
        }
      });
    }
  }

  async status(): Promise<MobileTransportStatus> {
    return this.adapter.status();
  }

  async send(
    envelope: EncryptedMobileEnvelope,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }> {
    // Buffer it for reconnect reconciliation
    this.buffer.set(envelope.sequence, envelope);

    if (!this.connected) {
      // It's buffered. Will be sent upon reconnect.
      return { ok: true, detail: "Buffered offline" };
    }

    return this.adapter.send(envelope, options);
  }

  acknowledge(sequence: number): void {
    // Drop from buffer once acknowledged by the application layer or remote
    this.buffer.delete(sequence);
  }

  private reconcile(): void {
    // Resend unacknowledged envelopes in sequence order
    const pending = Array.from(this.buffer.values()).sort((a, b) => a.sequence - b.sequence);
    const nowTime = this.now().getTime();
    for (const envelope of pending) {
      // Re-evaluate expiry
      if (nowTime > Date.parse(envelope.expiresAt)) {
        this.buffer.delete(envelope.sequence);
        continue;
      }
      this.adapter.send(envelope).catch(() => {});
    }
  }

  subscribe(onMessage: (envelope: EncryptedMobileEnvelope) => void): () => void {
    this.messageListeners.add(onMessage);
    return () => {
      this.messageListeners.delete(onMessage);
    };
  }

  destroy(): void {
    if (this.adapterUnsubscribe) {
      this.adapterUnsubscribe();
    }
    this.buffer.clear();
  }
}
