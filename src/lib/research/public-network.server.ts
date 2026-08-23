import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function privateIpv4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return true;
  const octets = parts.map(Number);
  if (octets.some((value) => value > 255)) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** True only for globally routable IP addresses. */
export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !privateIpv4(address);
  if (version !== 6) return false;
  const value = address.toLowerCase().split("%", 1)[0];
  if (value.startsWith("::ffff:")) return isPublicIpAddress(value.slice(7));
  return !(
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value) ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8:")
  );
}

/**
 * Resolve every address for a source immediately before fetching it. If even
 * one answer is private/reserved the hostname is refused; mixed DNS answers
 * must not be allowed to choose a private target after validation.
 */
export async function guardPublicNetworkUrl(url: URL): Promise<string | null> {
  let addresses: string[];
  if (isIP(url.hostname)) {
    addresses = [url.hostname];
  } else {
    try {
      addresses = (await lookup(url.hostname, { all: true, verbatim: true })).map(
        (result) => result.address,
      );
    } catch {
      return "The source hostname could not be resolved.";
    }
  }
  if (addresses.length === 0 || addresses.some((address) => !isPublicIpAddress(address))) {
    return "The source resolved to a local, private, reserved, or metadata address.";
  }
  return null;
}
