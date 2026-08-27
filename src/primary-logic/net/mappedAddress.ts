/**
 * Ported from the OCADE primary-logic archive: `src/utils/hooks/ssrfGuard.ts`.
 *
 * WHAT IT IS FOR. An IPv4 address can be written as an IPv6 one in several
 * ways — `::ffff:169.254.169.254`, `::ffff:a9fe:a9fe`,
 * `0:0:0:0:0:ffff:a9fe:a9fe` — and they are all the same address: the cloud
 * metadata endpoint. A guard that recognises one spelling and not the others
 * is a guard with a spelling bee for a threat model.
 *
 * The archive's version normalises any representation to the embedded IPv4
 * address, so the v4 rules — which are the ones that actually know what is
 * private — decide every time. The DNS half of the archive's file is not here:
 * it is Node's `dns.lookup` wired into an axios config, and OCADE's own
 * `guardPublicNetworkUrl` already resolves every answer for a hostname before
 * fetching it. This is the part OCADE did not have.
 *
 * No `net.isIP` and no Node imports, so it runs in the Worker and in the
 * browser as well as on a server.
 */

/**
 * Expand `::` and any trailing dotted-decimal so an address is exactly eight
 * 16-bit groups. Returns null when the text is not a well-formed IPv6 address.
 */
export function expandIPv6Groups(address: string): number[] | null {
  let text = address.trim().toLowerCase();
  // A zone index (`%eth0`) identifies an interface, not an address.
  text = text.split("%", 1)[0] ?? "";
  if (!text || text.includes(":::")) return null;

  /*
   * A trailing dotted-decimal tail (`::ffff:169.254.169.254`) becomes its two
   * hex groups first, so the `::` expansion below has one uniform shape to
   * work with rather than two.
   */
  let tail: number[] = [];
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":");
    if (lastColon === -1) return null;
    const dotted = text.slice(lastColon + 1);
    text = text.slice(0, lastColon);
    const octets = dotted.split(".");
    if (octets.length !== 4) return null;
    const numbers = octets.map((octet) =>
      /^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN,
    );
    if (numbers.some((value) => Number.isNaN(value) || value > 255)) return null;
    tail = [(numbers[0]! << 8) | numbers[1]!, (numbers[2]! << 8) | numbers[3]!];
    // `::ffff:1.2.3.4` leaves "::ffff" behind, which must still expand.
    if (text.endsWith(":") && !text.endsWith("::")) text = `${text}:`;
  }

  const doubleColon = text.indexOf("::");
  let head: string[];
  let rest: string[];
  if (doubleColon === -1) {
    head = text === "" ? [] : text.split(":");
    rest = [];
  } else {
    if (text.indexOf("::", doubleColon + 1) !== -1) return null;
    const before = text.slice(0, doubleColon);
    const after = text.slice(doubleColon + 2);
    head = before === "" ? [] : before.split(":");
    rest = after === "" ? [] : after.split(":");
  }

  const target = 8 - tail.length;
  const fill = target - head.length - rest.length;
  // Without a `::` there is nothing to pad with, so the count must be exact.
  if (fill < 0 || (doubleColon === -1 && fill !== 0)) return null;

  const groups = [...head, ...new Array<string>(fill).fill("0"), ...rest];
  const values = groups.map((group) =>
    /^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : Number.NaN,
  );
  if (values.some((value) => Number.isNaN(value))) return null;
  values.push(...tail);
  return values.length === 8 ? values : null;
}

/**
 * The IPv4 address embedded in an IPv4-mapped IPv6 address, in whatever way it
 * was written. Null when the address is not IPv4-mapped.
 */
export function mappedIPv4(address: string): string | null {
  const groups = expandIPv6Groups(address);
  if (!groups) return null;
  // ::ffff:0:0/96 — eighty zero bits, then ffff, then the IPv4 address.
  if (
    groups[0] !== 0 ||
    groups[1] !== 0 ||
    groups[2] !== 0 ||
    groups[3] !== 0 ||
    groups[4] !== 0 ||
    groups[5] !== 0xffff
  ) {
    return null;
  }
  const high = groups[6]!;
  const low = groups[7]!;
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}
