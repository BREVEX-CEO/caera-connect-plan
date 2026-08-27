import { describe, expect, it } from "vitest";
import { expandIPv6Groups, mappedIPv4 } from "../net/mappedAddress";
import { isPublicIpAddress } from "@/lib/research/public-network.server";

/*
 * The address that matters is 169.254.169.254 — the cloud metadata endpoint,
 * the single most valuable target of a server-side request forgery. It can be
 * written at least four ways as an IPv6 address, and a guard that recognises
 * some of them is a guard with a spelling bee for a threat model.
 */
const METADATA = [
  "::ffff:169.254.169.254",
  "::ffff:a9fe:a9fe",
  "0:0:0:0:0:ffff:a9fe:a9fe",
  "0000:0000:0000:0000:0000:ffff:a9fe:a9fe",
  "::FFFF:A9FE:A9FE",
];

describe("IPv4 addresses written as IPv6", () => {
  it.each(METADATA)("%s is the metadata endpoint", (address) => {
    expect(mappedIPv4(address)).toBe("169.254.169.254");
  });

  it.each(METADATA)("%s is not a public address", (address) => {
    // The fully-written-out form was answered PUBLIC before this was ported.
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each([
    ["::ffff:10.0.0.1", "10.0.0.1"],
    ["::ffff:0a00:0001", "10.0.0.1"],
    ["::ffff:127.0.0.1", "127.0.0.1"],
    ["::ffff:192.168.1.1", "192.168.1.1"],
    ["::ffff:c0a8:0101", "192.168.1.1"],
    ["::ffff:8.8.8.8", "8.8.8.8"],
  ])("%s unwraps to %s", (mapped, plain) => {
    expect(mappedIPv4(mapped)).toBe(plain);
  });

  it("still lets a genuinely public mapped address through", () => {
    expect(isPublicIpAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("::ffff:0808:0808")).toBe(true);
  });

  it.each(["::1", "::", "fe80::1", "fc00::1", "2001:db8::1", "2606:4700::1111"])(
    "%s is not a mapped IPv4 address",
    (address) => {
      expect(mappedIPv4(address)).toBeNull();
    },
  );

  it("keeps the ordinary IPv6 rules working", () => {
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });
});

describe("expanding an IPv6 address", () => {
  it("fills the gap a :: stands for", () => {
    expect(expandIPv6Groups("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIPv6Groups("::")).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(expandIPv6Groups("2001:db8::1")).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
  });

  it("accepts an address already written in full", () => {
    expect(expandIPv6Groups("2001:0db8:0000:0000:0000:0000:0000:0001")).toEqual([
      0x2001, 0xdb8, 0, 0, 0, 0, 0, 1,
    ]);
  });

  it("ignores a zone index, which names an interface rather than an address", () => {
    expect(expandIPv6Groups("fe80::1%eth0")).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  });

  it.each([
    "",
    "not-an-address",
    "1:2:3:4:5:6:7",
    "1:2:3:4:5:6:7:8:9",
    "::ffff:999.1.1.1",
    "::ffff:1.2.3",
    "1::2::3",
    "::gggg",
    "12345::1",
  ])("refuses %s rather than guessing", (address) => {
    expect(expandIPv6Groups(address)).toBeNull();
  });
});
