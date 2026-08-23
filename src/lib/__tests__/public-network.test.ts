import { describe, expect, it } from "vitest";
import { isPublicIpAddress } from "../research/public-network.server";

describe("research DNS target classification", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("refuses private or reserved address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows globally routable address %s",
    (address) => expect(isPublicIpAddress(address)).toBe(true),
  );
});
