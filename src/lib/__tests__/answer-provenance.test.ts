import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildReceipt,
  verdict,
  describeSourceUse,
  receiptDigest,
  verifyReceipt,
  receiptToText,
  type ReceiptInput,
} from "../provenance/receipt";
import {
  NetworkWitness,
  describeObservation,
  limits,
  type NetworkObservation,
} from "../provenance/network-witness";
import { sha256OfText, isRealDigest, UNAVAILABLE } from "../provenance/digest";

/**
 * A receipt is only worth having if it can be wrong.
 *
 * The whole feature rests on one property: every field reports what was
 * OBSERVED, never what was configured. A receipt derived from the privacy
 * setting would agree with itself precisely in the case where the setting was
 * not honoured — the only case anyone would ever check. These tests attack
 * that property from both sides: a receipt must say "private" when the browser
 * saw nothing, and must refuse to say it when the browser saw something, no
 * matter what the settings claimed.
 */

const silent: NetworkObservation = { silent: true, contacts: [], requests: 0, measured: true };

const talked: NetworkObservation = {
  silent: false,
  requests: 3,
  measured: true,
  contacts: [
    { origin: "https://api.example.net", kind: "third_party", count: 3, transferredBytes: 4096 },
  ],
};

/**
 * The app fetching its own engine binary.
 *
 * This is the case that made the first version cry wolf: a completely
 * on-device answer produced `leftDevice: true`, because loading
 * `/assets/wllama.wasm` is a network request. It is not the user's data going
 * anywhere, and the receipt must not say it is.
 */
const ownAssetsOnly: NetworkObservation = {
  silent: true,
  requests: 2,
  measured: true,
  contacts: [
    { origin: "https://app.example.com", kind: "own_assets", count: 2, transferredBytes: 500_000 },
  ],
};

const unmeasured: NetworkObservation = {
  silent: false,
  contacts: [],
  requests: 0,
  measured: false,
  unmeasuredReason: "This browser does not record network timing, so OCADE cannot check.",
};

function input(over: Partial<ReceiptInput> = {}): ReceiptInput {
  return {
    messageId: "m1",
    producedOn: "this_device",
    engineLabel: "OCADE Local",
    prompt: "what is in my contract?",
    answer: "The termination clause is in section 8.",
    sources: [],
    observation: silent,
    blindSpots: limits(),
    startedAt: new Date("2026-08-07T09:00:00Z"),
    durationMs: 812,
    ...over,
  };
}

describe("the receipt reports measurement, not configuration", () => {
  it("says nothing left the device when the browser saw nothing", async () => {
    const receipt = await buildReceipt(input());
    expect(receipt.leftDevice).toBe(false);
    expect(verdict(receipt).tone).toBe("private");
    expect(verdict(receipt).headline).toMatch(/no network requests/i);
  });

  it("refuses to say private when the browser saw traffic, even on a local engine", async () => {
    /*
     * THE CASE THE WHOLE FEATURE EXISTS FOR. Everything about the intent says
     * local: `producedOn: "this_device"`, the label says Local. If the receipt
     * trusted any of that it would report privacy while the browser was
     * recording requests to a third party. It must believe the measurement.
     */
    const receipt = await buildReceipt(
      input({ producedOn: "this_device", engineLabel: "OCADE Local", observation: talked }),
    );
    expect(receipt.leftDevice, "the receipt believed the label over the browser").toBe(true);
    expect(verdict(receipt).tone).toBe("sent");
    expect(receipt.contacted).toContain("https://api.example.net");
  });

  it("says unknown rather than false when it could not check", async () => {
    // "We did not look" laundered into "nothing was sent" is the failure mode
    // that would make every other guarantee here worthless.
    const receipt = await buildReceipt(input({ observation: unmeasured }));
    expect(receipt.leftDevice).toBeNull();
    expect(verdict(receipt).tone).toBe("unknown");
    expect(verdict(receipt).headline).toMatch(/could not check/i);
  });

  it("does not count this device's own blob and data URLs as leaving", async () => {
    const local: NetworkObservation = {
      silent: true,
      requests: 2,
      measured: true,
      contacts: [
        { origin: "(this device)", kind: "this_device", count: 2, transferredBytes: null },
      ],
    };
    const receipt = await buildReceipt(input({ observation: local }));
    expect(receipt.leftDevice).toBe(false);
    expect(receipt.contacted).toEqual([]);
  });

  it("does not treat OCADE loading its own engine as data leaving", async () => {
    /*
     * DEFECT PR-01, FIXED. Measured against the live engine, a fully on-device
     * answer reported `leftDevice: true` and a headline naming the app's own
     * address — because the browser had fetched `wllama.wasm`. An indicator
     * that fires on every single answer trains people to ignore it, and then
     * it is worth nothing on the day it is right.
     */
    const receipt = await buildReceipt(input({ observation: ownAssetsOnly }));
    expect(receipt.leftDevice, "loading its own runtime was reported as a leak").toBe(false);
    expect(receipt.contacted, "the app's own address appeared in a sent-to list").toEqual([]);
    expect(verdict(receipt).tone).toBe("private");
  });

  it("still counts a same-origin API call as data leaving", async () => {
    /*
     * The other half, and the reason origin alone cannot decide this. A POST to
     * /api/chat is the user's question going to a server, and it is on exactly
     * the same origin as the asset requests above.
     */
    const apiCall: NetworkObservation = {
      silent: false,
      requests: 1,
      measured: true,
      contacts: [
        { origin: "https://app.example.com", kind: "data", count: 1, transferredBytes: 900 },
      ],
    };
    const receipt = await buildReceipt(input({ observation: apiCall }));
    expect(receipt.leftDevice).toBe(true);
    expect(receipt.contacted).toEqual(["https://app.example.com"]);
  });

  it("does not report an engine on localhost as data leaving the device", async () => {
    /*
     * DEFECT PR-02, FIXED — found by running the real product rather than by
     * reasoning about it. An answer produced by a local Ollama instance
     * recorded a request to `http://localhost:11434`, and the receipt headline
     * read "Sent to 1 server". The detection was right and the wording was
     * wrong: loopback traffic is delivered by the kernel and never reaches a
     * network interface, so nothing left the machine.
     *
     * A false alarm about the precise thing the user opened this panel to
     * check is the fastest way to make them stop reading it.
     */
    const viaOllama: NetworkObservation = {
      silent: true,
      requests: 4,
      measured: true,
      contacts: [
        { origin: "http://localhost:11434", kind: "loopback", count: 4, transferredBytes: 8000 },
      ],
    };
    const receipt = await buildReceipt(input({ observation: viaOllama }));
    expect(receipt.leftDevice, "a loopback engine was reported as data leaving").toBe(false);
    expect(receipt.contacted).toEqual([]);
    expect(verdict(receipt).tone).toBe("private");
  });

  it("still names the local server rather than hiding it", async () => {
    /*
     * The other half. "A program on your own machine that OCADE did not write"
     * is a different trust question from "inside this browser tab", and the
     * user is entitled to know which one answered.
     */
    const viaOllama: NetworkObservation = {
      silent: true,
      requests: 1,
      measured: true,
      contacts: [
        { origin: "http://127.0.0.1:11434", kind: "loopback", count: 1, transferredBytes: 10 },
      ],
    };
    const receipt = await buildReceipt(input({ observation: viaOllama }));
    expect(receipt.localServer).toBe("http://127.0.0.1:11434");
    expect(verdict(receipt).headline).toMatch(/on this computer/i);
    expect(verdict(receipt).headline).toMatch(/127\.0\.0\.1:11434/);
    expect(verdict(receipt).headline).toMatch(/Nothing left the machine/i);
  });

  it("covers the local server in the fingerprint", async () => {
    // Otherwise a receipt could be edited to hide which program answered.
    const base = await buildReceipt(input());
    const digest = await receiptDigest(base);
    const forged = { ...base, localServer: "http://localhost:11434" };
    expect((await verifyReceipt(forged, digest)).ok).toBe(false);
  });

  it("names what the check cannot see", async () => {
    const receipt = await buildReceipt(input());
    expect(receipt.blindSpots.length).toBeGreaterThan(0);
    expect(receipt.blindSpots.join(" ")).toMatch(/native managed-browser host/i);
  });
});

describe("what it read, described honestly", () => {
  it("distinguishes read-in-full from searched", () => {
    expect(
      describeSourceUse({
        name: "note.txt",
        sha256: "a".repeat(64),
        passagesUsed: 3,
        passagesTotal: 3,
      }),
    ).toMatch(/read in full/i);

    const partial = describeSourceUse({
      name: "report.pdf",
      sha256: "b".repeat(64),
      passagesUsed: 4,
      passagesTotal: 210,
    });
    // The difference between a citation and a claim.
    expect(partial).toMatch(/4 of 210/);
    expect(partial).not.toMatch(/read in full/i);
  });

  it("says so when nothing could be extracted", () => {
    expect(
      describeSourceUse({
        name: "scan.png",
        sha256: "c".repeat(64),
        passagesUsed: 0,
        passagesTotal: 0,
      }),
    ).toMatch(/nothing readable/i);
  });

  it("fingerprints each source, so a changed file is detectable", async () => {
    const receipt = await buildReceipt(
      input({
        sources: [
          {
            name: "a.txt",
            sha256: await sha256OfText("original"),
            passagesUsed: 1,
            passagesTotal: 1,
          },
        ],
      }),
    );
    expect(isRealDigest(receipt.sources[0].sha256)).toBe(true);
    expect(receipt.sources[0].sha256).not.toBe(await sha256OfText("edited"));
  });
});

describe("the receipt can be checked by someone else", () => {
  it("verifies against its own fingerprint", async () => {
    const receipt = await buildReceipt(input());
    const digest = await receiptDigest(receipt);
    expect((await verifyReceipt(receipt, digest)).ok).toBe(true);
  });

  it("detects a receipt edited to hide that data was sent", async () => {
    // The tamper someone would actually attempt.
    const receipt = await buildReceipt(input({ observation: talked }));
    const digest = await receiptDigest(receipt);
    const forged = { ...receipt, leftDevice: false, contacted: [] };
    const check = await verifyReceipt(forged, digest);
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/altered/i);
  });

  it("detects an edited answer", async () => {
    const receipt = await buildReceipt(input());
    const digest = await receiptDigest(receipt);
    const forged = { ...receipt, answerSha256: await sha256OfText("something else") };
    expect((await verifyReceipt(forged, digest)).ok).toBe(false);
  });

  it("detects a swapped source", async () => {
    const receipt = await buildReceipt(
      input({
        sources: [{ name: "a.txt", sha256: "a".repeat(64), passagesUsed: 1, passagesTotal: 1 }],
      }),
    );
    const digest = await receiptDigest(receipt);
    const forged = {
      ...receipt,
      sources: [{ name: "a.txt", sha256: "b".repeat(64), passagesUsed: 1, passagesTotal: 1 }],
    };
    expect((await verifyReceipt(forged, digest)).ok).toBe(false);
  });

  it("is stable across key order, so reserialising does not break it", async () => {
    const receipt = await buildReceipt(input());
    const digest = await receiptDigest(receipt);
    // Same content, different key order — a digest over JSON.stringify would
    // change here and prove nothing about the content.
    const reordered = JSON.parse(
      JSON.stringify(receipt, Object.keys(receipt).sort()),
    ) as typeof receipt;
    expect(await receiptDigest({ ...receipt, ...reordered })).toBe(digest);
  });
});

describe("the exported text says the true thing first", () => {
  it("leads with the verdict", async () => {
    const receipt = await buildReceipt(input({ observation: talked }));
    const text = receiptToText(receipt, await receiptDigest(receipt));
    expect(text).toMatch(/OCADE ANSWER RECEIPT/);
    expect(text).toMatch(/api\.example\.net/);
    expect(text).toMatch(/Receipt fingerprint/);
  });

  it("carries the blind spots into the export", async () => {
    const receipt = await buildReceipt(input());
    const text = receiptToText(receipt, await receiptDigest(receipt));
    expect(text).toMatch(/cannot see/i);
  });
});

describe("the network witness reads the browser's log, not its own", () => {
  /** A fake PerformanceObserver plus a resource log we control. */
  function fakeScope(entries: Array<{ name: string; startTime: number; transferSize?: number }>) {
    let fire: ((list: { getEntries(): unknown[] }) => void) | null = null;
    class FakeObserver {
      constructor(cb: (list: { getEntries(): unknown[] }) => void) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    }
    return {
      scope: {
        PerformanceObserver: FakeObserver,
        performance: { now: () => 0 },
        location: { origin: "https://app.example.com" },
      } as unknown as typeof globalThis,
      deliver: () => fire?.({ getEntries: () => entries }),
    };
  }

  it("classifies the app's own assets apart from its own API", () => {
    /*
     * Origin cannot decide this — both are `https://app.example.com`. One is
     * the engine binary, the other is the user's question. Getting these
     * confused in either direction ruins the feature: merge them into
     * "third party" and it cries wolf; merge them into "own" and a real
     * server-side inference call reports as private.
     */
    const { scope, deliver } = fakeScope([
      { name: "https://app.example.com/assets/wllama.wasm", startTime: 1 },
      { name: "https://app.example.com/api/chat", startTime: 2 },
      { name: "https://analytics.example.net/collect", startTime: 3 },
    ]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    const observation = witness.stop();

    const kinds = Object.fromEntries(observation.contacts.map((c) => [c.kind, c.origin]));
    expect(kinds.own_assets).toBe("https://app.example.com");
    expect(kinds.data).toBe("https://app.example.com");
    expect(kinds.third_party).toBe("https://analytics.example.net");
    expect(observation.silent, "an API call and a tracker were reported as silence").toBe(false);
  });

  it("calls a window silent when only its own assets were fetched", () => {
    const { scope, deliver } = fakeScope([
      { name: "https://app.example.com/assets/wllama.wasm", startTime: 1 },
      { name: "https://app.example.com/assets/index.js", startTime: 2 },
    ]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    const observation = witness.stop();
    expect(observation.silent).toBe(true);
    // Precise rather than flattering: requests happened, and it says what they
    // were instead of claiming none.
    expect(describeObservation(observation)).toMatch(/its own engine files/i);
    expect(observation.requests).toBe(2);
  });

  it.each([
    "http://localhost:11434/api/generate",
    "http://127.0.0.1:11434/api/generate",
    "http://[::1]:8080/v1/chat",
    "http://ollama.localhost:11434/x",
  ])("classifies %s as this machine, not a third party", (url) => {
    const { scope, deliver } = fakeScope([{ name: url, startTime: 1 }]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    const observation = witness.stop();
    expect(observation.contacts[0].kind).toBe("loopback");
    expect(observation.silent, "loopback was counted as content leaving").toBe(true);
    expect(describeObservation(observation)).toMatch(/Nothing left this computer/i);
  });

  it("does not mistake a hostname merely containing localhost for loopback", () => {
    // `localhost.evil.example` is a real remote host.
    const { scope, deliver } = fakeScope([
      { name: "https://localhost.evil.example/collect", startTime: 1 },
    ]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    const observation = witness.stop();
    expect(observation.contacts[0].kind).toBe("third_party");
    expect(observation.silent).toBe(false);
  });

  it.each(["/api/chat", "/_serverFn/send", "/auth/callback"])(
    "treats %s as content-carrying even on its own origin",
    (path) => {
      const { scope, deliver } = fakeScope([
        { name: `https://app.example.com${path}`, startTime: 1 },
      ]);
      const witness = new NetworkWitness(scope);
      witness.start();
      deliver();
      expect(witness.stop().silent).toBe(false);
    },
  );

  it("reports silence when the browser logged nothing", () => {
    const { scope } = fakeScope([]);
    const witness = new NetworkWitness(scope);
    witness.start();
    const observation = witness.stop();
    expect(observation.measured).toBe(true);
    expect(observation.silent).toBe(true);
    expect(describeObservation(observation)).toMatch(/nothing was sent/i);
  });

  it("groups requests by origin and never records full URLs", () => {
    // A path can carry the user's content — "?q=my+medical+condition".
    const { scope, deliver } = fakeScope([
      { name: "https://api.example.net/v1/chat?q=secret", startTime: 5, transferSize: 100 },
      { name: "https://api.example.net/v1/chat?q=other", startTime: 6, transferSize: 200 },
    ]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    const observation = witness.stop();
    expect(observation.contacts).toHaveLength(1);
    expect(observation.contacts[0].origin).toBe("https://api.example.net");
    expect(observation.contacts[0].count).toBe(2);
    expect(observation.contacts[0].transferredBytes).toBe(300);
    expect(JSON.stringify(observation)).not.toMatch(/secret/);
  });

  it("ignores requests that happened before the window opened", () => {
    /*
     * `buffered: false` plus this filter. Without it the page's own scripts and
     * stylesheets, fetched long before the question was asked, would be
     * reported as though answering had caused them.
     */
    const { scope, deliver } = fakeScope([
      { name: "https://cdn.example.net/app.js", startTime: -50 },
    ]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    expect(witness.stop().silent).toBe(true);
  });

  it("treats blob and data URLs as never having left", () => {
    const { scope, deliver } = fakeScope([{ name: "blob:http://localhost/abc", startTime: 1 }]);
    const witness = new NetworkWitness(scope);
    witness.start();
    deliver();
    const observation = witness.stop();
    expect(observation.contacts[0].origin).toBe("(this device)");
  });

  it("reports unmeasured, never silent, when the browser has no observer", () => {
    const witness = new NetworkWitness({} as typeof globalThis);
    witness.start();
    const observation = witness.stop();
    expect(observation.measured).toBe(false);
    expect(observation.silent, "an unmeasurable window was reported as private").toBe(false);
    expect(observation.unmeasuredReason).toBeTruthy();
  });

  it("reports unmeasured when observing throws", () => {
    const scope = {
      PerformanceObserver: class {
        constructor() {
          throw new Error("not permitted");
        }
      },
      performance: { now: () => 0 },
    } as unknown as typeof globalThis;
    const witness = new NetworkWitness(scope);
    witness.start();
    expect(witness.stop().measured).toBe(false);
  });
});

describe("digests fail loudly rather than quietly", () => {
  it("marks an unavailable digest instead of returning an empty string", async () => {
    const realCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      const digest = await sha256OfText("anything");
      // An empty string would compare equal between two unhashable receipts,
      // which is how a verifier ends up approving everything.
      expect(digest).toBe(UNAVAILABLE);
      expect(isRealDigest(digest)).toBe(false);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: realCrypto, configurable: true });
    }
  });

  it("produces a real digest when crypto is present", async () => {
    expect(isRealDigest(await sha256OfText("hello"))).toBe(true);
  });
});

describe("both chat surfaces carry a receipt, on the same terms", () => {
  /**
   * The receipt started life in the demo only, which made it a showcase rather
   * than a product feature — the people with real documents and real privacy
   * modes were the ones not getting it.
   *
   * These assertions hold both surfaces to the same rules, and in particular to
   * the one that matters: `leftDevice` is read from the measurement, never from
   * the fact that the code is sitting in the on-device branch.
   */
  const DEMO = readFileSync("src/routes/demo.ocade.tsx", "utf8");
  const CHAT = readFileSync("src/routes/_authenticated/ocade.tsx", "utf8");

  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  it.each([
    ["demo", DEMO],
    ["signed-in", CHAT],
  ])("%s chat opens a witness around generation", (_label, source) => {
    expect(code(source)).toMatch(/witness\.start\(\)|runGuarded\(/);
  });

  it("the signed-in chat can still show the receipt, behind the diagnostics switch", () => {
    /*
     * THIS USED TO REQUIRE THE RECEIPT UNDER EVERY ANSWER, ON BOTH SURFACES.
     * It is now gated, and the demo does not render it at all.
     *
     * The receipt is real and worth keeping — what it is not is something an
     * ordinary reader needs beneath each reply. Under every answer, a
     * fingerprint and a provenance card taught people to scroll past the whole
     * region, which is the opposite of what evidence is for. It survives behind
     * one switch (`showDiagnostics`, off by default), so the people who want it
     * still have it.
     *
     * What still matters, and is asserted here: the receipt must be built and
     * rendered from the MEASURED observation rather than removed outright — a
     * gate that quietly deleted the evidence would be a different change.
     */
    const c = code(CHAT);
    expect(c).toMatch(/AnswerReceiptPanel/);
    expect(c, "the receipt is rendered unconditionally again").toMatch(
      /showDiagnostics && receipts\[message\.id\]/,
    );
  });

  it("the demo shows no receipt at all", () => {
    // The first surface anyone sees, reached without an account. It opened with
    // a fingerprint under every answer and an integrity chain in the sidebar.
    expect(code(DEMO)).not.toMatch(/AnswerReceiptPanel/);
  });

  it("the signed-in chat stops the witness before building the receipt", () => {
    /*
     * Order matters: a receipt built from a window still open would report
     * whatever had arrived so far and miss the rest.
     */
    const c = code(CHAT);
    expect(c.indexOf("witness.stop()")).toBeLessThan(c.indexOf("buildReceipt("));
  });

  it("the signed-in chat passes the measured observation, not a literal", () => {
    // Handing `buildReceipt` a hand-built "nothing happened" object would make
    // every receipt say private regardless of what occurred.
    const call = code(CHAT).slice(code(CHAT).indexOf("buildReceipt("));
    expect(call.slice(0, 700)).toMatch(/observation,/);
    expect(call.slice(0, 700)).not.toMatch(/silent:\s*true/);
  });

  it("the signed-in chat reports real per-document usage", () => {
    /*
     * The demo has no attachments, so its `sources` is legitimately empty. The
     * signed-in chat does have them, and a receipt there that also passed `[]`
     * would silently drop the most useful half of the disclosure.
     */
    const call = code(CHAT).slice(code(CHAT).indexOf("buildReceipt("));
    expect(call.slice(0, 700)).toMatch(/sources: await sourceUsesFor\(/);
  });

  it("does not fabricate a receipt for a message loaded from history", () => {
    // Those were generated on another run, possibly another machine. A receipt
    // for them would be precisely the unfounded claim this replaces.
    expect(code(CHAT)).toMatch(/receipts\[message\.id\]\s*\?/);
  });
});
