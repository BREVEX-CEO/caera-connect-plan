import type { EncryptedMobileEnvelope, MobileEnvelopeLink } from "./secure-channel";
import type { MobileTransportStatus } from "./companion-link";

export interface RelayTransportAdapter extends MobileEnvelopeLink {
  connect(): Promise<void>;
  disconnect(): void;
  on(event: "status", listener: (status: MobileTransportStatus) => void): void;
}

export class WebSocketRelayAdapter implements RelayTransportAdapter {
  private ws: WebSocket | null = null;
  private statusListeners: Set<(status: MobileTransportStatus) => void> = new Set();
  private messageListeners: Set<(envelope: EncryptedMobileEnvelope) => void> = new Set();
  private connected = false;

  constructor(
    private readonly url: string,
    private readonly roomId: string,
  ) {}

  async connect(): Promise<void> {
    if (this.ws) return;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.url}?room=${encodeURIComponent(this.roomId)}`);
        this.ws.onopen = () => {
          this.connected = true;
          this.notifyStatus({ connected: true });
          resolve();
        };
        this.ws.onmessage = (event) => {
          try {
            const envelope = JSON.parse(event.data) as EncryptedMobileEnvelope;
            if (envelope && envelope.v === 1) {
              for (const listener of this.messageListeners) {
                listener(envelope);
              }
            }
          } catch {
            // Ignore malformed messages
          }
        };
        this.ws.onclose = () => {
          this.connected = false;
          this.ws = null;
          this.notifyStatus({ connected: false, reason: "WebSocket closed" });
        };
        this.ws.onerror = () => {
          if (!this.connected) reject(new Error("WebSocket connection failed"));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.notifyStatus({ connected: false, reason: "Disconnected manually" });
  }

  async status(): Promise<MobileTransportStatus> {
    return { connected: this.connected };
  }

  async send(
    envelope: EncryptedMobileEnvelope,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }> {
    if (!this.connected || !this.ws) {
      return { ok: false, detail: "Not connected to relay" };
    }
    try {
      this.ws.send(JSON.stringify({ ...envelope, _options: options }));
      return { ok: true, detail: "Sent" };
    } catch (err) {
      return { ok: false, detail: String(err) };
    }
  }

  subscribe(onMessage: (envelope: EncryptedMobileEnvelope) => void): () => void {
    this.messageListeners.add(onMessage);
    return () => {
      this.messageListeners.delete(onMessage);
    };
  }

  on(event: "status", listener: (status: MobileTransportStatus) => void): void {
    if (event === "status") {
      this.statusListeners.add(listener);
    }
  }

  private notifyStatus(status: MobileTransportStatus) {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
