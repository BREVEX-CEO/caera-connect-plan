/**
 * A CUSTOMER'S MODEL ADDRESS IS CHECKED BEFORE OCADE'S SERVER DIALS IT (plan 14B.1A.6, 14B.1B.7;
 * threat O-14).
 *
 * The address is the customer's to choose, so it is treated as hostile: HTTPS on the standard port
 * only, a public DNS name (no IP literal in any encoding, no single-label or internal name), no
 * credentials, query or fragment, and every address the name resolves to must be public. The
 * certificate is checked by the platform when it connects, and redirects are refused by the
 * caller, so a name that later resolves to a private address still meets a certificate it cannot
 * present for that name.
 */

const INTERNAL_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
  ".private",
  ".arpa",
];

export type AddressRefusal =
  | "not_https"
  | "has_credentials"
  | "has_query"
  | "port"
  | "ip_literal"
  | "internal_name"
  | "malformed";

/** The customer's base URL, normalised (no trailing slash), or why it is refused. */
export function gatewayAddress(
  raw: string,
): { ok: true; url: string; host: string } | { ok: false; reason: AddressRefusal } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (url.username || url.password) return { ok: false, reason: "has_credentials" };
  if (url.search || url.hash || raw.includes("?") || raw.includes("#"))
    return { ok: false, reason: "has_query" };
  if (url.port && url.port !== "443") return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // WHATWG URL parsing turns every IPv4 spelling (octal, hex, short forms) into dotted decimal.
  if (host.startsWith("[") || /^[\d.]+$/.test(host) || host.includes(":"))
    return { ok: false, reason: "ip_literal" };
  if (
    !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ||
    host.split(".").some((label) => !label || label.length > 63 || label.startsWith("-"))
  )
    return { ok: false, reason: host.includes(".") ? "malformed" : "internal_name" };
  if (host === "localhost" || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix)))
    return { ok: false, reason: "internal_name" };
  const path = url.pathname.replace(/\/+$/, "");
  if (url.href.length > 300) return { ok: false, reason: "malformed" };
  return { ok: true, url: `https://${host}${path}`, host };
}

function v4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return bytes.every((byte) => byte >= 0 && byte <= 255) ? bytes : null;
}

function publicV4([a, b, c]: number[]): boolean {
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a! >= 224
  );
}

/** The 16 bytes of an IPv6 address, or null. */
function v6(ip: string): number[] | null {
  let text = ip.toLowerCase().replace(/%.*$/, "");
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const bytes = v4(tail[1]!);
    if (!bytes) return null;
    text =
      text.slice(0, -tail[1]!.length) +
      `${((bytes[0]! << 8) | bytes[1]!).toString(16)}:${((bytes[2]! << 8) | bytes[3]!).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const words = (part: string) => (part ? part.split(":") : []);
  const head = words(halves[0]!);
  const rest = halves.length === 2 ? words(halves[1]!) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (all.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  return all.flatMap((word) => {
    const value = parseInt(word, 16);
    return [value >> 8, value & 0xff];
  });
}

/** True only for a globally reachable unicast address (IPv4, or IPv6 including mapped forms). */
export function publicAddress(ip: string): boolean {
  const four = v4(ip);
  if (four) return publicV4(four);
  const bytes = v6(ip);
  if (!bytes) return false;
  const zeroTo = (n: number) => bytes.slice(0, n).every((byte) => byte === 0);
  // ::ffff:a.b.c.d (mapped), ::a.b.c.d (compatible) and 64:ff9b::a.b.c.d (NAT64) carry IPv4.
  if (zeroTo(10) && bytes[10] === 0xff && bytes[11] === 0xff) return publicV4(bytes.slice(12));
  if (zeroTo(12)) return false; // ::, ::1 and the deprecated IPv4-compatible range
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b)
    return publicV4(bytes.slice(12));
  // Only global unicast (2000::/3) is public; within it, documentation and 6to4/Teredo relays.
  if ((bytes[0]! & 0xe0) !== 0x20) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8)
    return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00)
    return false;
  return true;
}

/** Every address the name resolves to is public, and there is at least one. */
export async function resolvesPublic(
  host: string,
  resolve: (host: string, type: "A" | "AAAA") => Promise<string[]>,
): Promise<boolean> {
  const answers = await Promise.all(
    (["A", "AAAA"] as const).map((type) => resolve(host, type).catch(() => [] as string[])),
  );
  const addresses = answers.flat();
  return addresses.length > 0 && addresses.every(publicAddress);
}
