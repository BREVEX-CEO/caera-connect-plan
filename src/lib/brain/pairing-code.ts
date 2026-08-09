/**
 * Parsing the code a computer shows when it agrees to be paired.
 *
 * Pure, and deliberately apart from the panel that renders it: this is the
 * function that decides whether a browser will talk to a given address, and
 * the loopback / https rule inside it is a security boundary. A security
 * boundary living in a component file is one that gets edited during a layout
 * change.
 */
/**
 * A pairing code carries three things the browser needs. Parsed strictly:
 * a malformed code is refused rather than half-applied, because a partly
 * configured pairing fails later in a way nobody can diagnose.
 */
export function parsePairingCode(
  raw: string,
):
  | { ok: true; deviceId: string; bridgeUrl: string; secret: string }
  | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Enter the code shown on your computer." };

  let decoded: string;
  try {
    // The desktop encodes the three fields so a line break in the middle of a
    // copy-paste cannot silently truncate one of them.
    decoded = atob(trimmed.replace(/\s+/g, ""));
  } catch {
    return { ok: false, reason: "That does not look like a pairing code from OCADE." };
  }

  const parts = decoded.split("|");
  if (parts.length !== 3) {
    return { ok: false, reason: "That pairing code is incomplete. Copy the whole thing." };
  }
  const [deviceId, bridgeUrl, secret] = parts;
  if (!deviceId || !bridgeUrl || !secret) {
    return { ok: false, reason: "That pairing code is missing part of its detail." };
  }

  let url: URL;
  try {
    url = new URL(bridgeUrl);
  } catch {
    return { ok: false, reason: "That code contains an address OCADE cannot use." };
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !loopback) {
    // Plain http to another machine would put the conversation on the wire in
    // clear text on whatever network both devices share.
    return {
      ok: false,
      reason: "That computer is offering an unencrypted address, so OCADE will not connect to it.",
    };
  }

  return { ok: true, deviceId, bridgeUrl, secret };
}
