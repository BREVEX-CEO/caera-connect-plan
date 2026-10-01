import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  b64url,
  encryptForBrowser,
  isPushService,
  sendPush,
  vapidAuthorization,
} from "../web-push";

/**
 * Web Push, checked against the standard's own example and against an
 * independent decryption written with Node's crypto rather than WebCrypto.
 */

/** RFC 8291 §5: the worked example, byte for byte. */
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  senderPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  browserPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** What a browser does with the message: decrypt with its own key, independently. */
function browserDecrypts(body: Uint8Array, browser: ReturnType<typeof createECDH>, auth: Buffer) {
  const salt = body.subarray(0, 16);
  const idLength = body[20]!;
  const senderPublic = body.subarray(21, 21 + idLength);
  const sealed = body.subarray(21 + idLength);
  const shared = browser.computeSecret(senderPublic);
  const info = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    browser.getPublicKey(),
    Buffer.from(senderPublic),
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, info, 32));
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16),
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12),
  );
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(Buffer.from(sealed.subarray(sealed.length - 16)));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(sealed.subarray(0, sealed.length - 16))),
    decipher.final(),
  ]);
  expect(plain[plain.length - 1]).toBe(2); // the last-record delimiter
  return plain.subarray(0, plain.length - 1).toString("utf8");
}

describe("encrypting a push message (RFC 8291)", () => {
  it("reproduces the standard's worked example exactly", async () => {
    const body = await encryptForBrowser(
      new TextEncoder().encode(RFC.plaintext),
      { p256dh: RFC.browserPublic, auth: RFC.auth },
      {
        salt: b64url.decode(RFC.salt),
        senderPublic: b64url.decode(RFC.senderPublic),
        senderPrivate: RFC.senderPrivate,
      },
    );
    expect(b64url.encode(body)).toBe(RFC.body);
  });

  it("is read by the browser it was written for, and by nobody else", async () => {
    const browser = createECDH("prime256v1");
    browser.generateKeys();
    const auth = Buffer.from("0123456789abcdef");
    const keys = { p256dh: b64url.encode(browser.getPublicKey()), auth: b64url.encode(auth) };
    const message = JSON.stringify({ title: "Reminder: call the bank", url: "/ocade-jarvis" });
    const body = await encryptForBrowser(new TextEncoder().encode(message), keys);
    expect(browserDecrypts(body, browser, auth)).toBe(message);

    const stranger = createECDH("prime256v1");
    stranger.generateKeys();
    expect(() => browserDecrypts(body, stranger, auth)).toThrow();
    // Fresh salt and sender key every time: the same words never look alike.
    const again = await encryptForBrowser(new TextEncoder().encode(message), keys);
    expect(b64url.encode(again)).not.toBe(b64url.encode(body));
  });

  it("refuses keys that are not a browser's", async () => {
    await expect(
      encryptForBrowser(new Uint8Array(1), { p256dh: "AAAA", auth: "AAAA" }),
    ).rejects.toThrow(/not usable/);
  });
});

describe("signing for the push service (VAPID, RFC 8292)", () => {
  it("is a JWT for the service's origin, signed by OCADE's key", async () => {
    const server = createECDH("prime256v1");
    server.generateKeys();
    const publicKey = b64url.encode(server.getPublicKey());
    const header = await vapidAuthorization({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      publicKey,
      privateKey: b64url.encode(server.getPrivateKey()),
      subject: "https://ocade.in",
      now: 1_790_000_000_000,
    });
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(publicKey);
    const [head, claims, signature] = token!.split(".");
    expect(JSON.parse(Buffer.from(claims!, "base64url").toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_790_000_000 + 12 * 3600,
      sub: "https://ocade.in",
    });
    const key = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: b64url.encode(server.getPublicKey().subarray(1, 33)),
        y: b64url.encode(server.getPublicKey().subarray(33, 65)),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${head}.${claims}`),
        { key, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature!, "base64url"),
      ),
    ).toBe(true);
  });
});

describe("where a message may go", () => {
  it("only to the browsers' own push services", () => {
    expect(isPushService("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(isPushService("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isPushService("https://web.push.apple.com/QX")).toBe(true);
    expect(isPushService("https://db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isPushService("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isPushService("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushService("http://fcm.googleapis.com/x")).toBe(false);
    expect(isPushService("http://127.0.0.1:54321/push")).toBe(false);
    expect(isPushService("http://127.0.0.1:54321/push", true)).toBe(true);
  });

  it("reports a subscription the service no longer has as gone", async () => {
    const browser = createECDH("prime256v1");
    browser.generateKeys();
    const server = createECDH("prime256v1");
    server.generateKeys();
    const send = (status: number) =>
      sendPush({
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/abc",
          p256dh: b64url.encode(browser.getPublicKey()),
          auth: b64url.encode(Buffer.alloc(16, 7)),
        },
        message: { title: "t", body: "", url: "/", tag: "x" },
        publicKey: b64url.encode(server.getPublicKey()),
        privateKey: b64url.encode(server.getPrivateKey()),
        subject: "https://ocade.in",
        urgent: false,
        fetcher: async () => new Response(null, { status }),
      });
    expect(await send(201)).toBe("sent");
    expect(await send(410)).toBe("gone");
    expect(await send(404)).toBe("gone");
    expect(await send(429)).toBe("refused");
    expect(await send(503)).toBe("refused");
    // Never worth asking again: a bad request, a refused key, a redirect.
    expect(await send(400)).toBe("rejected");
    expect(await send(403)).toBe("rejected");
    expect(await send(301)).toBe("rejected");
  });
});
