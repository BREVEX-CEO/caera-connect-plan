/**
 * Preferring a direct link over the relay.
 *
 * WHAT THE RELAY COSTS. Every message between a paired phone and computer went
 * through `WebSocketRelayAdapter` — a rented server on the public internet.
 * The payload is sealed end-to-end, so the relay operator cannot read it, but
 * that is not the whole cost:
 *
 *   - TRAFFIC PATTERN. Who talks to whom, how often, how much, and when, is
 *     visible to whoever runs the relay. On a product that tells people their
 *     data stays on their devices, that metadata is the part still leaving.
 *   - AVAILABILITY. Two devices on the same sofa could not talk to each other
 *     when the relay was down or the house was offline.
 *   - MONEY. Relay bandwidth is a per-message running cost for traffic that
 *     never needed to leave the building.
 *
 * When both devices are on one network the computer is already reachable
 * directly — pairing established its bridge address, and `parsePairingCode`
 * has already refused anything that is not loopback or HTTPS. So the direct
 * path exists; it was simply never preferred.
 *
 * THE RULE THIS FILE ENFORCES: if the direct link works, nothing goes over the
 * relay at all. Not a fallback ping, not a keepalive. "Minimisation" that still
 * announces both devices to the relay would minimise bytes and leak the same
 * metadata, which is the part that mattered.
 *
 * The decision is pure and lives here; the switching adapter is thin and lives
 * beside it. A routing rule that can only be exercised by owning two devices on
 * one network is a rule nobody has tested.
 */

/** How hard the user wants OCADE to avoid the relay. */
export type RelayPreference =
  /** Try direct first; use the relay when direct is unreachable. Default. */
  | "prefer_direct"
  /** Never use the relay. Refuse rather than route through it. */
  | "direct_only"
  /** Always use the relay — for a phone that is genuinely elsewhere. */
  | "relay_only";

export interface PathInputs {
  preference: RelayPreference;
  /** A direct address was established during pairing. */
  directConfigured: boolean;
  /** The direct address answered a reachability probe just now. */
  directReachable: boolean;
  /** A relay URL is configured for this installation. */
  relayConfigured: boolean;
}

export type PathChoice =
  | { path: "direct"; reason: string }
  | { path: "relay"; reason: string }
  | { path: null; reason: string };

/**
 * Choose the path, and say why in words a person can act on.
 *
 * Every refusal names the thing to change. "No transport available" tells a
 * user nothing; "your computer did not answer on this network, and OCADE is set
 * never to use the relay" tells them either to move onto the same network or to
 * change one setting.
 */
export function chooseTransportPath(input: PathInputs): PathChoice {
  const { preference, directConfigured, directReachable, relayConfigured } = input;

  if (preference === "relay_only") {
    return relayConfigured
      ? { path: "relay", reason: "OCADE is set to always use the relay." }
      : {
          path: null,
          reason: "OCADE is set to always use the relay, but no relay is configured.",
        };
  }

  if (directConfigured && directReachable) {
    // The whole point. Reported so the screen can say it, because "your phone
    // is talking to this computer directly" is the reassurance being earned.
    return {
      path: "direct",
      reason: "Your devices are on the same network, so nothing goes through the relay.",
    };
  }

  if (preference === "direct_only") {
    return {
      path: null,
      reason: directConfigured
        ? "Your computer did not answer on this network, and OCADE is set never to use the relay."
        : "No direct address is paired, and OCADE is set never to use the relay.",
    };
  }

  if (relayConfigured) {
    return {
      path: "relay",
      reason: directConfigured
        ? "Your computer is not reachable on this network, so OCADE is using the encrypted relay."
        : "No direct address is paired, so OCADE is using the encrypted relay.",
    };
  }

  return {
    path: null,
    reason:
      "No direct address is paired and no relay is configured, so there is no way to connect.",
  };
}

/**
 * How long to wait for the direct address before giving up on it.
 *
 * Short on purpose. This runs on the path to sending a message, and a device
 * that has left the house must not make every send feel broken. A LAN round
 * trip is single-digit milliseconds; anything approaching a second means the
 * machine is not there.
 */
export const DIRECT_PROBE_TIMEOUT_MS = 800;

/**
 * Is this address one we are willing to treat as "direct"?
 *
 * Loopback and private ranges only. A public address would technically work and
 * would be the exact opposite of the point — it would send the traffic across
 * the internet while telling the user it stayed on their network.
 */
export function isDirectAddress(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host === "127.0.0.1") return true;
  if (/^127\./.test(host)) return true;
  // RFC1918 and link-local. Anything else is somebody else's network.
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^fe80:/i.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;
  return false;
}
