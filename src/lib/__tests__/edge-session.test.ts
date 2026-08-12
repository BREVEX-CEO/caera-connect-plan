import { describe, it, expect } from "vitest";
import { prepareSend, runGuarded, defaultGuards } from "../edge/session";
import type { BudgetItem } from "../edge/context-budget";

/**
 * The order of the guarantees is the thing being tested.
 *
 * Each module is correct on its own. Composed in the wrong order they produce
 * features that appear to work and guarantee nothing: a scan that runs after
 * the send, a witness opened after generation, a seal that a thrown error
 * leaves up forever. Those are the failures this file exists to catch, because
 * none of them shows up as a visible fault.
 */

const item = (over: Partial<BudgetItem> & { id: string }): BudgetItem => ({
  label: over.id,
  kind: "turn",
  tokens: 10,
  priority: 1,
  ...over,
});

const guards = () => ({ ...defaultGuards(), contextLimitTokens: 1000 });

describe("nothing is sent before it has been checked", () => {
  it("blocks a message carrying a live credential", () => {
    const prepared = prepareSend({
      text: "deploy with AKIAIOSFODNN7EXAMPLE",
      items: [item({ id: "q", pinned: true })],
      guards: guards(),
    });
    // Blocked, not warned: this would put a working key into somebody's logs.
    expect(prepared.proceed).toBe(false);
    expect(prepared.blockedReason).toMatch(/access to an account/i);
    expect(prepared.findings.map((f) => f.kind)).toContain("aws_key");
  });

  it("lets an ordinary message through", () => {
    const prepared = prepareSend({
      text: "how do I sort an array?",
      items: [item({ id: "q", pinned: true })],
      guards: guards(),
    });
    expect(prepared.proceed).toBe(true);
    expect(prepared.findings).toEqual([]);
  });

  it("does not block on a medium finding alone", () => {
    // An email address is worth mentioning, not worth stopping the user for.
    const prepared = prepareSend({
      text: "email me at someone@example.com",
      items: [item({ id: "q", pinned: true })],
      guards: guards(),
    });
    expect(prepared.proceed).toBe(true);
    expect(prepared.findings.map((f) => f.kind)).toContain("email");
  });

  it("skips scanning when the conversation is sealed", () => {
    /*
     * Not laziness. Sealed means nothing can leave by construction, so warning
     * about a credential would train the user to dismiss the warning in the
     * exact case where it is harmless — which is how it stops working in the
     * case where it is not.
     */
    const prepared = prepareSend({
      text: "deploy with AKIAIOSFODNN7EXAMPLE",
      items: [item({ id: "q", pinned: true })],
      guards: { ...guards(), sealed: true },
    });
    expect(prepared.proceed).toBe(true);
    expect(prepared.findings).toEqual([]);
  });

  it("refuses a message too large for the engine", () => {
    const prepared = prepareSend({
      text: "hello",
      items: [item({ id: "q", pinned: true, tokens: 99_999 })],
      guards: guards(),
    });
    expect(prepared.proceed).toBe(false);
    expect(prepared.blockedReason).toMatch(/too long for the engine/i);
  });

  it("carries the truncation notice forward with the answer", () => {
    const prepared = prepareSend({
      text: "hello",
      items: [
        item({ id: "q", pinned: true, tokens: 10 }),
        item({ id: "contract", kind: "document", label: "contract.pdf", tokens: 5000 }),
      ],
      guards: guards(),
    });
    expect(prepared.proceed).toBe(true);
    // Discovered before generating, so it can be shown WITH the answer.
    expect(prepared.truncation).toMatch(/contract\.pdf/);
  });

  it("scans by default", () => {
    // A protection nobody switches on protects nobody.
    expect(defaultGuards().scanOutgoing).toBe(true);
  });
});

describe("the seal is around the real generation", () => {
  function scope() {
    const calls: string[] = [];
    return {
      calls,
      scope: {
        location: { href: "https://app.example.com/" },
        fetch: (u: string) => {
          calls.push(u);
          return Promise.resolve("ok");
        },
        performance: { now: () => 0 },
      } as unknown as typeof globalThis,
    };
  }

  const base = {
    prompt: "hello",
    chain: [],
    engineLabel: "OCADE Local",
    modelKey: "m",
    modelSha256: "a".repeat(64),
    temperature: 0.2,
    topP: 0.9,
    backend: "wasm",
    messageId: "m1",
  };

  it("blocks a network call made DURING generation", async () => {
    const { scope: s, calls } = scope();
    const result = await runGuarded({
      ...base,
      guards: { ...guards(), sealed: true },
      scope: s,
      generate: async () => {
        // A telemetry ping added by some other module.
        await (s as unknown as { fetch: (u: string) => Promise<unknown> })
          .fetch("https://analytics.example/hit")
          .catch(() => {});
        return "an answer";
      },
    });
    expect(calls, "the seal did not cover the generation").toEqual([]);
    expect(result.seal?.attempts.map((a) => a.origin)).toEqual(["https://analytics.example"]);
  });

  it("lifts the seal even when generation throws", async () => {
    /*
     * A crash that left the page permanently offline would be far worse than
     * the crash itself, and would look like the seal was broken.
     */
    const { scope: s, calls } = scope();
    await expect(
      runGuarded({
        ...base,
        guards: { ...guards(), sealed: true },
        scope: s,
        generate: async () => {
          throw new Error("engine died");
        },
      }),
    ).rejects.toThrow("engine died");

    await (s as unknown as { fetch: (u: string) => Promise<unknown> }).fetch("https://ok.example/");
    expect(calls, "the seal stayed up after a crash").toEqual(["https://ok.example/"]);
  });

  it("does not seal when sealing was not asked for", async () => {
    const { scope: s, calls } = scope();
    const result = await runGuarded({
      ...base,
      guards: guards(),
      scope: s,
      generate: async () => {
        await (s as unknown as { fetch: (u: string) => Promise<unknown> }).fetch("https://ok/");
        return "answer";
      },
    });
    expect(calls).toEqual(["https://ok/"]);
    expect(result.seal).toBeNull();
  });
});

describe("what happened is recorded from what happened", () => {
  const base = {
    prompt: "hello",
    chain: [],
    guards: guards(),
    engineLabel: "OCADE Local",
    modelKey: "m",
    modelSha256: "a".repeat(64),
    temperature: 0.2,
    topP: 0.9,
    backend: "wasm",
    messageId: "m1",
    scope: {
      location: { href: "https://app.example.com/" },
      performance: { now: () => 0 },
    } as unknown as typeof globalThis,
  };

  it("produces a receipt, a cost, a ledger entry and a pin", async () => {
    const result = await runGuarded({ ...base, generate: async () => "an answer" });
    expect(result.answer).toBe("an answer");
    expect(result.receipt.messageId).toBe("m1");
    expect(result.entry.index).toBe(0);
    expect(result.pinned.pin.modelSha256).toBe("a".repeat(64));
    expect(result.cost.allowanceUsed).toBe(0);
  });

  it("derives the cost from the receipt, not from the settings", async () => {
    /*
     * The receipt is the measured artefact. A cost line that said "local, free"
     * while the receipt said the data left would undermine both — so the meter
     * reads the receipt rather than the configuration.
     */
    const result = await runGuarded({ ...base, generate: async () => "answer" });
    expect(result.cost.where).toBe(result.receipt.leftDevice ? "cloud" : "local");
  });

  it("chains onto an existing conversation", async () => {
    const first = await runGuarded({ ...base, generate: async () => "one" });
    const second = await runGuarded({
      ...base,
      messageId: "m2",
      chain: [first.entry],
      generate: async () => "two",
    });
    expect(second.entry.index).toBe(1);
    expect(second.entry.previous).toBe(first.entry.hash);
  });

  it("records an empty answer without inventing one", async () => {
    // A cancelled generation is a real outcome and must not be papered over.
    const result = await runGuarded({ ...base, generate: async () => "" });
    expect(result.answer).toBe("");
    expect(result.receipt.answerSha256).toBeTruthy();
  });
});
