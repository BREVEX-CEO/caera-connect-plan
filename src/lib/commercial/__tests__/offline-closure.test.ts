import { describe, expect, it } from "vitest";
import { offlineClosureSigningBytes, ownedArrayBuffer } from "../offline-lease";
import { verifyOfflineClosure } from "../offline-lease.server";

/**
 * F-067: only the browser holding a removed device's own key can give back the
 * capacity that device was holding. Any other browser's request returns nothing.
 */
const ACCOUNT = "0e0e0e0e-5555-4eee-8eee-eeeeeeeeeeee";

async function device() {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const sign = async (accountId: string, deviceId: string) =>
    btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.sign(
            { name: "Ed25519" },
            pair.privateKey,
            ownedArrayBuffer(offlineClosureSigningBytes(accountId, deviceId)),
          ),
        ),
      ),
    );
  return { publicKeyBase64: btoa(String.fromCharCode(...raw)), sign };
}

describe("an offline closure", () => {
  it("is accepted from the device that holds the key", async () => {
    const own = await device();
    const signature = await own.sign(ACCOUNT, "device-b");
    expect(
      await verifyOfflineClosure({ ...own, accountId: ACCOUNT, deviceId: "device-b", signature }),
    ).toBe(true);
  });

  it("is refused from another browser, for another device, or with no real signature", async () => {
    const own = await device();
    const other = await device();
    const fromOther = await other.sign(ACCOUNT, "device-b");
    const base = { publicKeyBase64: own.publicKeyBase64, accountId: ACCOUNT, deviceId: "device-b" };
    expect(await verifyOfflineClosure({ ...base, signature: fromOther })).toBe(false);
    const forAnother = await own.sign(ACCOUNT, "device-c");
    expect(await verifyOfflineClosure({ ...base, signature: forAnother })).toBe(false);
    expect(await verifyOfflineClosure({ ...base, signature: "not-a-signature" })).toBe(false);
  });
});
