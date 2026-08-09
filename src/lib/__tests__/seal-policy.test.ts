import { describe, it, expect } from "vitest";
import {
  allowAssetsAndLoopback,
  allowNothing,
  installConversationSeal,
  intersect,
  isLoopbackHost,
} from "@/lib/edge/seal-policy";
import { Seal } from "@/lib/edge/sealed-mode";

/**
 * The seal used to be installed only around `generate()`, so it was up for the
 * milliseconds an answer was produced while the UI promised a conversation-long
 * barrier. Measured in the browser, every network primitive was still native
 * and a cross-origin `sendBeacon` returned `true`.
 *
 * Keeping the seal up for the whole conversation is only possible if something
 * still gets through — otherwise the next route chunk is refused and the page
 * breaks. This file pins exactly what that "something" is, because an allowlist
 * that drifts permissive is the whole guarantee quietly leaking away.
 */

const ORIGIN = "https://app.example";
const allow = allowAssetsAndLoopback(ORIGIN);

describe("what a sealed page still permits", () => {
  it("lets its own route chunks and styles load, so navigation keeps working", () => {
    for (const url of [
      "/assets/index-a1b2c3.js",
      "/assets/main.css",
      "/src/routes/demo.ocade.tsx?t=1739",
      "/_build/chunk.mjs",
      "https://app.example/assets/font.woff2",
    ]) {
      expect(allow({ url }), url).toBe(true);
    }
  });

  it("lets the on-device engine on loopback answer", () => {
    // A request to localhost never reaches a network interface, which is the
    // entire claim. Same hosts the provenance witness calls `this_device`.
    for (const url of [
      "http://localhost:11434/api/tags",
      "http://127.0.0.1:8080/generate",
      "http://[::1]:3000/x",
    ]) {
      expect(allow({ url }), url).toBe(true);
    }
  });

  it("refuses every cross-origin host, asset-looking or not", () => {
    for (const url of [
      "https://telemetry.example/collect",
      "https://cdn.other/main.js",
      "https://app.example.evil.test/assets/x.js",
    ]) {
      expect(allow({ url }), url).toBe(false);
    }
  });

  it("refuses same-origin paths that carry content rather than code", () => {
    // These are the same-origin paths a conversation could actually ride out
    // on, which is why an origin check alone is not an allowlist.
    for (const url of ["/api/chat", "/_serverFn/save", "/auth/token"]) {
      expect(allow({ url }), url).toBe(false);
    }
  });

  it("refuses anything with a body or a writing method, even to an asset path", () => {
    expect(allow({ url: "/assets/index.js", method: "POST" })).toBe(false);
    expect(allow({ url: "/assets/index.js", hasBody: true })).toBe(false);
    expect(allow({ url: "/assets/index.js", method: "PUT" })).toBe(false);
  });

  it("refuses a same-origin path that is neither an asset nor in a build directory", () => {
    // `/exfil?data=...` is same-origin and a GET, and must still not pass.
    expect(allow({ url: "/exfil?data=secret" })).toBe(false);
    expect(allow({ url: "/" })).toBe(false);
  });

  it("fails closed on anything it cannot parse", () => {
    expect(allow({ url: "://not a url" })).toBe(false);
    expect(allow({ url: "" })).toBe(false);
  });

  it("does not mistake a hostname that merely contains a loopback name", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("evil-localhost.example")).toBe(false);
    expect(isLoopbackHost("localhost.attacker.test")).toBe(false);
  });
});

describe("overlapping seals take the most restrictive policy", () => {
  it("refuses when any policy refuses", () => {
    const permissive = () => true;
    expect(intersect([permissive, allowNothing])({ url: "/assets/a.js" })).toBe(false);
    expect(intersect([permissive, allow])({ url: "/assets/a.js" })).toBe(true);
    expect(intersect([permissive, allow])({ url: "https://elsewhere/x" })).toBe(false);
  });

  it("permits only what an empty set trivially allows", () => {
    expect(intersect([])({ url: "https://anywhere/x" })).toBe(true);
  });
});

/**
 * The interaction that made this necessary: reference counting means a second
 * seal JOINS rather than re-patching, so without intersection a strict
 * send-time seal installed under a permissive page seal would silently inherit
 * the page's allowlist.
 */
describe("a strict seal is not loosened by a permissive one already in force", () => {
  function fakeScope() {
    const scope = {
      fetch: (() => Promise.resolve("real")) as unknown as typeof fetch,
      location: { href: `${ORIGIN}/` },
    };
    return scope as unknown as typeof globalThis;
  }

  it("blocks an asset once a strict seal joins a permissive one", async () => {
    const scope = fakeScope();
    const page = new Seal(scope, allow);
    page.seal();
    // Permissive seal alone: the asset is allowed through to the real fetch.
    await expect(scope.fetch("/assets/index.js")).resolves.toBe("real");

    const send = new Seal(scope, allowNothing);
    send.seal();
    // Strict seal joined — the same asset must now be refused.
    await expect(scope.fetch("/assets/index.js")).rejects.toThrow(/sealed/i);

    send.unseal();
    // ...and permitted again once the strict seal lifts.
    await expect(scope.fetch("/assets/index.js")).resolves.toBe("real");
    page.unseal();
  });

  /*
   * THE WIRING, which is what was actually broken.
   *
   * `Seal` was correct and mutation-covered the whole time. What did not exist
   * was any caller that installed it while the button said "Sealed". These
   * cover the decision itself, so a future edit cannot quietly go back to a
   * screen that claims a barrier it never builds.
   */
  it("installs nothing when the conversation is not sealed", () => {
    let made = 0;
    const cleanup = installConversationSeal(
      false,
      () => {
        made += 1;
        return { seal: () => {}, unseal: () => null };
      },
      ORIGIN,
    );
    expect(made).toBe(0);
    expect(cleanup).toBeUndefined();
  });

  it("installs a real barrier when the conversation is sealed, and lifts it on cleanup", async () => {
    const scope = fakeScope();
    const original = scope.fetch;
    const cleanup = installConversationSeal(true, (allow) => new Seal(scope, allow), ORIGIN);

    expect(scope.fetch).not.toBe(original);
    await expect(scope.fetch("https://telemetry.example/collect")).rejects.toThrow(/sealed/i);
    // The engine on loopback must still be reachable, or sealing a conversation
    // would mean it can no longer be answered.
    await expect(scope.fetch("http://localhost:11434/api/tags")).resolves.toBe("real");

    cleanup?.();
    expect(scope.fetch).toBe(original);
  });

  it("installs nothing when there is no origin to judge against", () => {
    // Server render: no `window`, so no policy can be built. Refusing to
    // install is right — a seal with no origin would block its own assets.
    let made = 0;
    const cleanup = installConversationSeal(
      true,
      () => {
        made += 1;
        return { seal: () => {}, unseal: () => null };
      },
      undefined,
    );
    expect(made).toBe(0);
    expect(cleanup).toBeUndefined();
  });

  it("restores the real fetch only when the last seal leaves", async () => {
    const scope = fakeScope();
    const original = scope.fetch;
    const a = new Seal(scope, allow);
    const b = new Seal(scope, allowNothing);
    a.seal();
    b.seal();
    a.unseal();
    expect(scope.fetch).not.toBe(original);
    b.unseal();
    expect(scope.fetch).toBe(original);
  });
});
