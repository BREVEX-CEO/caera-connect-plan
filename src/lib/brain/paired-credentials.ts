import type { PairedCredentials, PairedCredentialSource } from "./adapters/paired-desktop";

/**
 * Where this browser keeps its pairing.
 *
 * The shared secret lives here and is used only to SIGN — it is never sent
 * anywhere, which is what makes storing it defensible at all. It is scoped to
 * this browser deliberately: a pairing authorises one specific device to use
 * one specific computer, and syncing it would silently extend that permission
 * to every device the user signs in on.
 */

const KEY = "ocade.pairing.v1";

function read(): PairedCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PairedCredentials>;
    if (
      typeof parsed.deviceId !== "string" ||
      typeof parsed.bridgeUrl !== "string" ||
      typeof parsed.secret !== "string" ||
      !parsed.deviceId ||
      !parsed.secret
    ) {
      return null;
    }
    /*
     * A bridge URL must be https, or loopback for local development. Plain
     * http to another machine would put the signed request — and the
     * conversation — on the wire in clear text.
     */
    let url: URL;
    try {
      url = new URL(parsed.bridgeUrl);
    } catch {
      return null;
    }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !loopback) return null;

    return {
      deviceId: parsed.deviceId,
      bridgeUrl: parsed.bridgeUrl,
      secret: parsed.secret,
    };
  } catch {
    return null;
  }
}

export const pairedCredentials: PairedCredentialSource = { current: read };

/** Store a pairing after the user approved it on the desktop. */
export function savePairing(credentials: PairedCredentials): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

/** Forget the pairing on THIS device. Revoking on the desktop is separate. */
export function forgetPairing(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

export function hasPairing(): boolean {
  return read() !== null;
}
