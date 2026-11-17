/**
 * A customer's model address (BYOK) is refused unless it is an HTTPS public name whose every
 * resolved address is public (plan 14B.1A.6, 14B.1B.7; threat O-14).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gatewayAddress,
  publicAddress,
  resolvesPublic,
} from "../../src/lib/intelligence/gateway-address.ts";

test("only an HTTPS public name on the standard port is accepted", () => {
  assert.deepEqual(gatewayAddress("https://openrouter.ai/api/v1/"), {
    ok: true,
    url: "https://openrouter.ai/api/v1",
    host: "openrouter.ai",
  });
  assert.equal(gatewayAddress("HTTPS://API.Example.com:443/v1").ok, true);
  const refused: [string, string][] = [
    ["http://api.example.com/v1", "not_https"],
    ["https://user:pw@api.example.com", "has_credentials"],
    ["https://api.example.com/v1?key=x", "has_query"],
    ["https://api.example.com/v1#x", "has_query"],
    ["https://api.example.com:8443/v1", "port"],
    ["https://169.254.169.254/latest", "ip_literal"],
    ["https://0x7f000001/", "ip_literal"],
    ["https://017700000001/", "ip_literal"],
    ["https://2130706433/", "ip_literal"],
    ["https://127.1/", "ip_literal"],
    ["https://[::1]/", "ip_literal"],
    ["https://[::ffff:10.0.0.1]/", "ip_literal"],
    ["https://localhost/v1", "internal_name"],
    ["https://metadata/computeMetadata", "internal_name"],
    ["https://metadata.google.internal/", "internal_name"],
    ["https://printer.local/", "internal_name"],
    ["https://router.home.arpa/", "internal_name"],
    ["file:///etc/passwd", "not_https"],
    ["not a url", "malformed"],
  ];
  for (const [raw, reason] of refused) {
    assert.deepEqual(gatewayAddress(raw), { ok: false, reason }, raw);
  }
});

test("private, reserved, mapped and translated addresses are not public", () => {
  for (const ip of [
    "10.1.2.3",
    "127.0.0.1",
    "0.0.0.0",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::10.0.0.1",
    "2001:db8::1",
    "2002:7f00:1::",
    "not-an-ip",
  ]) {
    assert.equal(publicAddress(ip), false, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(publicAddress(ip), true, ip);
  }
});

test("a name is dialled only when every address it resolves to is public", async () => {
  const table: Record<string, string[]> = {
    "public.example:A": ["93.184.216.34"],
    "public.example:AAAA": ["2606:2800:220:1::1"],
    "rebind.example:A": ["93.184.216.34", "10.0.0.5"],
    "inside.example:AAAA": ["::ffff:192.168.0.1"],
  };
  const resolve = async (host: string, type: string) => table[`${host}:${type}`] ?? [];
  assert.equal(await resolvesPublic("public.example", resolve), true);
  assert.equal(await resolvesPublic("rebind.example", resolve), false);
  assert.equal(await resolvesPublic("inside.example", resolve), false);
  assert.equal(await resolvesPublic("nothing.example", resolve), false, "an unresolvable name");
});
