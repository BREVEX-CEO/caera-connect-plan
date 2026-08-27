import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mappedIPv4 } from "@/primary-logic/net/mappedAddress";

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
  /*
   * AN IPv4 ADDRESS IN IPv6 CLOTHING IS STILL AN IPv4 ADDRESS.
   *
   * This used to be a `startsWith("::ffff:")` and a string slice, which reads
   * one spelling of a mapped address and misses the rest.
   * `0:0:0:0:0:ffff:a9fe:a9fe` is the metadata endpoint written out in full;
   * it starts with `0:`, so it fell past every check below and was answered
   * PUBLIC. The allowlist in front of this made that unreachable in practice,
   * which is exactly the kind of reasoning that stops being true the day
   * somebody adds a second caller.
   *
   * The archive's normaliser expands any representation — compressed, hex,
   * dotted, fully written out — and hands back the embedded IPv4 address, so
   * the v4 rules decide, which are the rules that actually know what is
   * private.
   */
  const embedded = mappedIPv4(value);
  if (embedded) return !privateIpv4(embedded);
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
