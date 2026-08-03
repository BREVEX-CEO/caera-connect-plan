/**
 * Composes the real mobile transport (P21).
 *
 * Three modules held the whole encrypted, reconnecting, replay-protected
 * mobile channel — and all three were imported only by tests:
 *
 *   WebSocketRelayAdapter      (transport-adapters)  raw relay socket
 *   ReliableMobileEnvelopeLink (reconnect-protocol)  retry + resend on reconnect
 *   EncryptedMobileTransport   (secure-channel)      seal/open, replay watermark
 *
 * `companion-link.ts` meanwhile defaulted to `UnavailableMobileTransport`, so
 * the only transport production could reach was the one that refuses
 * everything. The pieces existed and were simply never assembled.
 *
 * This assembles them in the only order that is safe: the socket is the
 * lowest layer, reliability wraps it, and ENCRYPTION WRAPS RELIABILITY. Sealing
 * above the retry layer means a resend re-sends an already-sealed envelope
 * rather than re-encrypting, so a retry cannot leak plaintext to the relay and
 * cannot produce two different ciphertexts for one logical message.
 *
 * Building this does NOT make the phone connected. It makes the connection
 * possible; the relay must still exist and the device must still be paired.
 */
import { WebSocketRelayAdapter, type RelayTransportAdapter } from "./transport-adapters";
import { ReliableMobileEnvelopeLink } from "./reconnect-protocol";
import {
  EncryptedMobileTransport,
  generateMobileChannelIdentity,
  type MobileChannelIdentity,
} from "./secure-channel";
import { type MobileTransport, UnavailableMobileTransport } from "./companion-link";

export interface MobileTransportConfig {
  /** Relay websocket URL, e.g. wss://relay.example/ws. */
  relayUrl: string;
  /** Pairing room both devices joined. */
  roomId: string;
  /** This device's stable id. */
  deviceId: string;
  /** The paired phone's public key, established during pairing. */
  peerPublicKey: JsonWebKey;
  /** This device's identity. Generated when omitted. */
  identity?: MobileChannelIdentity;
}

export interface BuiltMobileTransport {
  transport: MobileTransport;
  /** Exposed so a caller can connect/disconnect and observe status. */
  adapter: RelayTransportAdapter;
  identity: MobileChannelIdentity;
}

/**
 * Build the encrypted transport stack.
 *
 * Does not connect. Connection is the caller's decision because it is a
 * network action with a visible consequence, and a factory that dialled out on
 * construction would make importing this module a side effect.
 */
export async function buildMobileTransport(
  config: MobileTransportConfig,
): Promise<BuiltMobileTransport> {
  const identity = config.identity ?? (await generateMobileChannelIdentity());
  const adapter = new WebSocketRelayAdapter(config.relayUrl, config.roomId);
  const reliable = new ReliableMobileEnvelopeLink(adapter);
  const transport = new EncryptedMobileTransport(
    config.deviceId,
    identity,
    config.peerPublicKey,
    reliable,
  );
  return { transport, adapter, identity };
}

/**
 * Build a transport, or return the refusing one with an honest reason.
 *
 * A missing relay URL or unpaired device is not an error to throw — it is the
 * ordinary state of an unpaired installation, and the correct response is a
 * transport that declines every send with a reason the user can act on.
 */
export async function buildMobileTransportOrUnavailable(
  config: Partial<MobileTransportConfig>,
): Promise<MobileTransport> {
  if (!config.relayUrl || !config.roomId || !config.deviceId || !config.peerPublicKey) {
    return new UnavailableMobileTransport();
  }
  const built = await buildMobileTransport(config as MobileTransportConfig);
  return built.transport;
}
