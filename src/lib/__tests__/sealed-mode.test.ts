import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  Seal,
  SealedModeError,
  describeSeal,
  sealLimits,
  type SealedTransport,
} from "../edge/sealed-mode";
import { allowAssetsAndLoopback } from "../edge/seal-policy";

/**
 * A seal that can be talked around is decoration.
 *
 * The tests below try to get out through every transport a page has, because
 * the failure mode is not "the seal is missing" — it is "the seal covers fetch
 * and somebody's telemetry uses sendBeacon". Each escape route is exercised
 * separately, and each must be refused AND recorded.
 */

/** A scope with every network primitive, so blocking can be observed. */
function fakeScope() {
  const calls: string[] = [];
  const scope = {
    location: { href: "https://app.example.com/" },
    fetch: (url: string) => {
      calls.push(`fetch ${url}`);
      return Promise.resolve("real response");
    },
    XMLHttpRequest: class {
      open(_method: string, url: string) {
        calls.push(`xhr ${url}`);
      }
    },
    navigator: {
      sendBeacon: (url: string) => {
        calls.push(`beacon ${url}`);
        return true;
      },
    },
    WebSocket: class {
      constructor(url: string) {
        calls.push(`ws ${url}`);
      }
    },
    EventSource: class {
      constructor(url: string) {
        calls.push(`sse ${url}`);
      }
    },
  } as unknown as typeof globalThis;
  return { scope, calls };
}

describe("every transport is sealed, not just fetch", () => {
  it("refuses fetch", async () => {
    const { scope, calls } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    await expect(
      (scope as unknown as { fetch: (u: string) => Promise<unknown> }).fetch(
        "https://evil.example/collect",
      ),
    ).rejects.toBeInstanceOf(SealedModeError);
    expect(calls, "the real fetch ran anyway").toEqual([]);
  });

  it("refuses XMLHttpRequest", () => {
    const { scope, calls } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    const XHR = (
      scope as unknown as { XMLHttpRequest: new () => { open(m: string, u: string): void } }
    ).XMLHttpRequest;
    expect(() => new XHR().open("POST", "https://evil.example/x")).toThrow(SealedModeError);
    expect(calls).toEqual([]);
  });

  it("refuses sendBeacon, which is what telemetry actually uses", () => {
    /*
     * The transport most likely to carry analytics, precisely because it
     * survives page unload. A seal that covered only fetch would look complete
     * and leak on every navigation.
     */
    const { scope, calls } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    const sent = (
      scope as unknown as { navigator: { sendBeacon: (u: string) => boolean } }
    ).navigator.sendBeacon("https://analytics.example/hit");
    // Returns false rather than throwing: callers legitimately ignore this
    // result, and a throw on unload would break unrelated code.
    expect(sent).toBe(false);
    expect(calls).toEqual([]);
  });

  it("refuses WebSocket", () => {
    const { scope, calls } = fakeScope();
    new Seal(scope).seal();
    const WS = (scope as unknown as { WebSocket: new (u: string) => unknown }).WebSocket;
    expect(() => new WS("wss://evil.example/socket")).toThrow(SealedModeError);
    expect(calls).toEqual([]);
  });

  it("refuses EventSource", () => {
    const { scope, calls } = fakeScope();
    new Seal(scope).seal();
    const ES = (scope as unknown as { EventSource: new (u: string) => unknown }).EventSource;
    expect(() => new ES("https://evil.example/stream")).toThrow(SealedModeError);
    expect(calls).toEqual([]);
  });
});

describe("what tried to leave is recorded, not swallowed", () => {
  it("records each blocked attempt with its transport and origin", async () => {
    const { scope } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    const s = scope as unknown as {
      fetch: (u: string) => Promise<unknown>;
      navigator: { sendBeacon: (u: string) => boolean };
    };
    await s.fetch("https://a.example/one").catch(() => {});
    s.navigator.sendBeacon("https://b.example/two");

    const report = seal.report();
    expect(report.attempts).toHaveLength(2);
    expect(report.attempts.map((a) => a.transport)).toEqual<SealedTransport[]>(["fetch", "beacon"]);
    expect(report.attempts.map((a) => a.origin)).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("keeps only the origin, never the path", async () => {
    // A path can carry the user's content verbatim; a privacy log that quotes
    // it back has become the leak it exists to detect.
    const { scope } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    await (scope as unknown as { fetch: (u: string) => Promise<unknown> })
      .fetch("https://a.example/collect?q=my+diagnosis")
      .catch(() => {});
    expect(JSON.stringify(seal.report())).not.toMatch(/diagnosis/);
  });

  it("says plainly when nothing tried to leave", () => {
    const { scope } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    expect(describeSeal(seal.report())).toMatch(/nothing attempted/i);
  });

  it("names the destinations when something did", async () => {
    const { scope } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    await (scope as unknown as { fetch: (u: string) => Promise<unknown> })
      .fetch("https://tracker.example/x")
      .catch(() => {});
    expect(describeSeal(seal.report())).toMatch(/tracker\.example/);
  });
});

describe("the seal comes off cleanly", () => {
  it("restores every primitive it replaced", async () => {
    const { scope, calls } = fakeScope();
    const before = {
      fetch: (scope as unknown as Record<string, unknown>).fetch,
      xhr: (scope as unknown as Record<string, unknown>).XMLHttpRequest,
      ws: (scope as unknown as Record<string, unknown>).WebSocket,
      es: (scope as unknown as Record<string, unknown>).EventSource,
      beacon: (scope as unknown as { navigator: { sendBeacon: unknown } }).navigator.sendBeacon,
    };
    const seal = new Seal(scope);
    seal.seal();
    seal.unseal();
    const after = scope as unknown as Record<string, unknown> & {
      navigator: { sendBeacon: unknown };
    };
    expect(after.fetch).toBe(before.fetch);
    expect(after.XMLHttpRequest).toBe(before.xhr);
    expect(after.WebSocket).toBe(before.ws);
    expect(after.EventSource).toBe(before.es);
    expect(after.navigator.sendBeacon).toBe(before.beacon);

    // And the real network works again.
    await (after as unknown as { fetch: (u: string) => Promise<unknown> }).fetch(
      "https://ok.example/",
    );
    expect(calls).toEqual(["fetch https://ok.example/"]);
  });

  it("does not stack wrappers when sealed twice", async () => {
    /*
     * Sealing twice and unsealing once would otherwise leave a wrapper behind
     * and the page permanently offline — a bug that only shows up after the
     * user has already left sealed mode and cannot work out why nothing loads.
     */
    const { scope, calls } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    seal.seal();
    seal.unseal();
    await (scope as unknown as { fetch: (u: string) => Promise<unknown> }).fetch(
      "https://ok.example/",
    );
    expect(calls).toEqual(["fetch https://ok.example/"]);
  });

  it("reports how long it held", () => {
    const { scope } = fakeScope();
    const seal = new Seal(scope);
    seal.seal();
    expect(seal.report().heldMs).toBeGreaterThanOrEqual(0);
    expect(seal.isActive()).toBe(true);
    seal.unseal();
    expect(seal.isActive()).toBe(false);
  });

  it("unsealing an unsealed seal is harmless", () => {
    const { scope } = fakeScope();
    const seal = new Seal(scope);
    expect(() => seal.unseal()).not.toThrow();
  });
});

describe("the limits are stated rather than implied away", () => {
  it("names extensions, other tabs and pre-captured references", () => {
    const limits = sealLimits().join(" ");
    expect(limits).toMatch(/native managed-browser host/i);
    expect(limits).toMatch(/tabs/i);
    // The one that cannot be fixed from inside the page, so it must be said.
    expect(limits).toMatch(/before sealing/i);
  });

  it("survives a scope missing some primitives", () => {
    // A worker has no sendBeacon; an old browser has no EventSource. Sealing
    // must degrade rather than throw on the primitive it cannot find.
    const partial = { location: { href: "https://a/" }, fetch: () => Promise.resolve() };
    const seal = new Seal(partial as unknown as typeof globalThis);
    expect(() => seal.seal()).not.toThrow();
    expect(() => seal.unseal()).not.toThrow();
  });
});

describe("the signed-in chat gets the same guarantees as the demo", () => {
  /**
   * The demo proved these first because it was the easier surface. This is the
   * one where they matter: real documents, real privacy modes, and a user who
   * may be pasting something they genuinely cannot afford to have leave.
   *
   * A guarantee that exists only on the marketing surface is worse than none —
   * it teaches people to expect a protection the product does not give them
   * where they actually work.
   */
  const CHAT = readFileSync("src/routes/_authenticated/ocade.tsx", "utf8");

  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  it("offers sealed mode", () => {
    const c = code(CHAT);
    expect(c).toMatch(/const \[sealed, setSealed\] = useState\(false\)/);
    expect(c).toMatch(/new Seal\(\)/);
  });

  it("seals around the generation, not around the whole send", () => {
    /*
     * Narrower is correct: the persistence calls after an answer are the user's
     * own storage, and sealing those would break saving the conversation they
     * just asked to keep.
     */
    const c = code(CHAT);
    expect(c.indexOf("seal?.seal()")).toBeLessThan(c.indexOf("await reason("));
    expect(c.indexOf("seal?.unseal()")).toBeGreaterThan(c.indexOf("await reason("));
  });

  it("unseals before anything else runs after the generation", () => {
    /*
     * A thrown persistence call with the seal still up would leave the page
     * offline for the rest of the session — a worse bug than whatever caused
     * it, and one that looks like the seal itself was broken.
     */
    const c = code(CHAT);
    expect(c.indexOf("seal?.unseal()")).toBeLessThan(c.indexOf("witness.stop()"));
  });

  it("reports what was blocked rather than swallowing it", () => {
    // Something tried to leave while the user had asked for silence. They are
    // entitled to know what.
    expect(code(CHAT)).toMatch(/describeSeal\(sealReport\)/);
  });

  it("warns that sealing blocks the engine download", () => {
    // The one case where sealing looks like a broken product instead of a
    // working guarantee. The sentence now also has to say what still WORKS,
    // because the seal became conversation-long: an on-device engine keeps
    // answering, and only fetching a new one is refused.
    expect(CHAT).toMatch(/Downloading one does not/);
    expect(CHAT).toMatch(/on-device engine still works/);
  });

  /*
   * THE SEAL IS HELD FOR THE WHOLE CONVERSATION, NOT JUST THE SEND.
   *
   * `runGuarded`'s seal (asserted above) covers the generation. It was the ONLY
   * seal, so between sends the page was wide open while the button read
   * "Sealed" — verified in the browser, where every primitive was still native
   * and a cross-origin `sendBeacon` returned true. Both surfaces now install a
   * conversation-long barrier as well.
   */
  it("installs a conversation-long seal on both chat surfaces", () => {
    for (const [name, source] of [
      ["signed-in chat", CHAT],
      ["demo", readFileSync("src/routes/demo.ocade.tsx", "utf8")],
    ] as const) {
      expect(source, name).toMatch(/installConversationSeal\(/);
    }
  });

  it("records both the question and the answer in the chain", () => {
    /*
     * Matched without assuming a formatting shape — the formatter wraps these
     * differently depending on line length, and a test that broke on
     * reformatting would be testing prettier rather than the behaviour.
     */
    const c = code(CHAT).replace(/\s+/g, " ");
    expect(c).toMatch(/appendLedger\(ledgerRef\.current, \{ role: "user", content: text/);
    expect(c).toMatch(/appendLedger\(ledgerRef\.current, \{ role: "assistant", content: acc/);
  });

  it("clears the chain when the conversation changes", () => {
    /*
     * Otherwise the panel verifies the PREVIOUS conversation and reports it
     * intact — a confident claim about something no longer on screen. The demo
     * had this defect across three separate reset paths.
     */
    const c = code(CHAT);
    const effect = c.slice(c.indexOf("ledgerRef.current = [];"));
    expect(effect.slice(0, 260)).toMatch(/treeRef\.current = emptyTree\(\)/);
    expect(effect.slice(0, 260)).toMatch(/\[conversation\.id\]/);
  });

  it("shows the integrity panel only once there is something to verify", () => {
    // A panel on an empty chat is a claim about nothing, and it teaches people
    // to skip past it before it ever matters.
    expect(code(CHAT)).toMatch(/ledgerRef\.current\.length > 0 \? \(\s*<ConversationIntegrity/);
  });
});

describe("overlapping seals do not corrupt the restore", () => {
  /**
   * DEFECT SM-01, FIXED. Sealing is monkey-patching, and monkey-patching does
   * not nest by itself:
   *
   *   a.seal()    // a saves the REAL fetch, installs wrapper A
   *   b.seal()    // b saves WRAPPER A, believing it is the original
   *   a.unseal()  // a restores the real fetch
   *   b.unseal()  // b restores wrapper A, over the top of the real one
   *
   * The page ends up permanently sealed: every request throws forever, with no
   * seal active to explain why, and the only recovery is a reload. Far worse
   * than the problem sealing solves — and it was in the first version of this
   * class, found by asking what two conversations would do.
   *
   * Reference counting fixes it. These tests are the reason it stays fixed.
   */
  function sharedScope() {
    const calls: string[] = [];
    const realFetch = (u: string) => {
      calls.push(u);
      return Promise.resolve("real");
    };
    return {
      calls,
      realFetch,
      scope: {
        location: { href: "https://app.example.com/" },
        fetch: realFetch,
      } as unknown as typeof globalThis,
    };
  }

  const fetchOf = (s: typeof globalThis) =>
    (s as unknown as { fetch: (u: string) => Promise<unknown> }).fetch;

  it("restores the GENUINE original after two seals unwind", async () => {
    const { scope, realFetch, calls } = sharedScope();
    const a = new Seal(scope);
    const b = new Seal(scope);
    a.seal();
    b.seal();
    a.unseal();
    b.unseal();

    expect(fetchOf(scope), "the page was left holding a wrapper").toBe(realFetch);
    await fetchOf(scope)("https://ok.example/");
    expect(calls).toEqual(["https://ok.example/"]);
  });

  it("stays sealed while any holder remains", async () => {
    /*
     * The other half. Restoring on the FIRST unseal would unseal the page while
     * a second conversation still believed it was protected — a silent failure
     * of the only guarantee this class makes.
     */
    const { scope, calls } = sharedScope();
    const a = new Seal(scope);
    const b = new Seal(scope);
    a.seal();
    b.seal();
    a.unseal();

    await expect(fetchOf(scope)("https://leak.example/")).rejects.toBeInstanceOf(SealedModeError);
    expect(calls).toEqual([]);
    b.unseal();
  });

  it("uses the strictest policy while permissive and strict seals overlap", async () => {
    const { scope, calls } = sharedScope();
    const page = new Seal(scope, allowAssetsAndLoopback("https://app.example.com"));
    const send = new Seal(scope);
    const asset = "https://app.example.com/assets/app.js";

    page.seal();
    await fetchOf(scope)(asset);
    expect(calls).toEqual([asset]);

    send.seal();
    await expect(fetchOf(scope)(asset)).rejects.toBeInstanceOf(SealedModeError);
    expect(calls).toEqual([asset]);

    send.unseal();
    await fetchOf(scope)(asset);
    expect(calls).toEqual([asset, asset]);
    page.unseal();
  });

  it("reports blocked attempts to every seal in force", async () => {
    // Two conversations sealed at once should each see what was refused while
    // they were up.
    const { scope } = sharedScope();
    const a = new Seal(scope);
    const b = new Seal(scope);
    a.seal();
    await fetchOf(scope)("https://one.example/").catch(() => {});
    b.seal();
    await fetchOf(scope)("https://two.example/").catch(() => {});

    const ra = a.unseal();
    const rb = b.unseal();
    expect(ra.attempts).toHaveLength(2);
    // b only joined for the second one, and must not claim the first.
    expect(rb.attempts).toHaveLength(1);
    expect(rb.attempts[0].origin).toBe("https://two.example");
  });

  it("survives unwinding out of order", async () => {
    const { scope, realFetch } = sharedScope();
    const a = new Seal(scope);
    const b = new Seal(scope);
    a.seal();
    b.seal();
    b.unseal();
    a.unseal();
    expect(fetchOf(scope)).toBe(realFetch);
  });

  it("keeps separate scopes independent", async () => {
    // Two tests, or two frames, must not unseal each other.
    const first = sharedScope();
    const second = sharedScope();
    const a = new Seal(first.scope);
    const b = new Seal(second.scope);
    a.seal();
    b.seal();
    a.unseal();

    expect(fetchOf(first.scope)).toBe(first.realFetch);
    await expect(fetchOf(second.scope)("https://x/")).rejects.toBeInstanceOf(SealedModeError);
    b.unseal();
    expect(fetchOf(second.scope)).toBe(second.realFetch);
  });
});
