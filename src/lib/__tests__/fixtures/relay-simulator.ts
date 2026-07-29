import type { EncryptedMobileEnvelope } from "../../mobile/secure-channel";

type ClientId = string;

export class LocalRelayServer {
  // room id -> set of client listener callbacks
  private rooms: Map<string, Set<(env: EncryptedMobileEnvelope) => void>> = new Map();
  private connections: Map<
    ClientId,
    { room: string; listener: (env: EncryptedMobileEnvelope) => void; onDisconnect: () => void }
  > = new Map();

  // Test injection points
  public dropProbability = 0.0;
  public latencyMs = 0;
  public duplicateProbability = 0.0;

  connect(
    clientId: ClientId,
    roomId: string,
    onMessage: (env: EncryptedMobileEnvelope) => void,
    onDisconnect: () => void,
  ): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(onMessage);
    this.connections.set(clientId, { room: roomId, listener: onMessage, onDisconnect });
  }

  disconnect(clientId: ClientId): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;
    this.rooms.get(conn.room)?.delete(conn.listener);
    this.connections.delete(clientId);
    conn.onDisconnect();
  }

  send(senderId: ClientId, envelope: EncryptedMobileEnvelope): void {
    const conn = this.connections.get(senderId);
    if (!conn) return;

    if (Math.random() < this.dropProbability) {
      return; // Simulated drop
    }

    const deliver = () => {
      const room = this.rooms.get(conn.room);
      if (!room) return;
      for (const listener of room) {
        if (listener !== conn.listener) {
          listener(envelope);
        }
      }
    };

    if (this.latencyMs > 0) {
      setTimeout(() => {
        deliver();
        if (Math.random() < this.duplicateProbability) {
          setTimeout(deliver, 5); // Simulated duplicate
        }
      }, this.latencyMs);
    } else {
      deliver();
      if (Math.random() < this.duplicateProbability) {
        deliver(); // Simulated duplicate
      }
    }
  }

  restart(): void {
    // Drop all connections
    for (const [clientId] of this.connections) {
      this.disconnect(clientId);
    }
  }
}

import type { MobileTransportStatus } from "../../mobile/companion-link";
import type { RelayTransportAdapter } from "../../mobile/transport-adapters";

export class SimulatedRelayAdapter implements RelayTransportAdapter {
  private statusListeners: Set<(status: MobileTransportStatus) => void> = new Set();
  private messageListeners: Set<(envelope: EncryptedMobileEnvelope) => void> = new Set();
  private connected = false;

  constructor(
    private readonly server: LocalRelayServer,
    private readonly clientId: string,
    private readonly roomId: string,
  ) {}

  async connect(): Promise<void> {
    if (this.connected) return;
    this.server.connect(
      this.clientId,
      this.roomId,
      (env) => {
        if (this.connected) {
          for (const listener of this.messageListeners) {
            listener(env);
          }
        }
      },
      () => {
        this.triggerDisconnect();
      },
    );
    this.connected = true;
    this.notifyStatus({ connected: true });
  }

  disconnect(): void {
    if (!this.connected) return;
    this.server.disconnect(this.clientId);
    this.connected = false;
    this.notifyStatus({ connected: false, reason: "Disconnected manually" });
  }

  // Hook for the server to abruptly drop connection
  triggerDisconnect(): void {
    this.connected = false;
    this.notifyStatus({ connected: false, reason: "Server dropped connection" });
  }

  async status(): Promise<MobileTransportStatus> {
    return { connected: this.connected };
  }

  async send(
    envelope: EncryptedMobileEnvelope,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }> {
    if (!this.connected) return { ok: false, detail: "Not connected to simulator" };
    this.server.send(this.clientId, envelope);
    return { ok: true, detail: "Sent" };
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
