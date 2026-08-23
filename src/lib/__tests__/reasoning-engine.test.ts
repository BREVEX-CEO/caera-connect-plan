import { describe, it, expect } from "vitest";
import { reason, explainReceipt, type ReasonDeps, type ReasonRequest } from "../reasoning/engine";
import { PerfLedger, DETERMINISTIC_TASKS } from "../local/router-policy";
import type { LocalModelInfo } from "../ocade-local";
import { OCADE_MODEL_ID } from "../local/fixed-model";

/**
 * The reasoning service's paths, and the rule that matters most: a prompt does
 * not leave the machine. Not "unless permitted" -- there is no permission and
 * no second engine to permit it to.
 */

function model(over: Partial<LocalModelInfo> = {}): LocalModelInfo {
  return {
    // OCADE's one engine. The default fixture must BE the fixed model: routing
    // no longer picks whatever is installed, so a fixture naming anything else
    // makes every "local first" test exercise the refusal path instead.
    id: OCADE_MODEL_ID,
    sizeBytes: 5_225_374_496,
    paramsB: 8.2,
    vision: false,
    profile: "general",
    label: "OCADE Local",
    isCloudPointer: false,
    ...over,
  };
}

interface HarnessOptions {
  models?: LocalModelInfo[];
  localReply?: string | null;
  localFails?: string;
}

function harness(options: HarnessOptions = {}) {
  const calls = { local: 0 };
  let clock = 1_000;

  const deps: ReasonDeps = {
    listLocalModels: async () => options.models ?? [model()],
    streamLocal: async (_id, _messages, handlers) => {
      calls.local += 1;
      clock += 50;
      if (options.localFails) return { ok: false, reason: options.localFails };
      const text = options.localReply === undefined ? "local answer" : options.localReply;
      if (text) handlers.onToken(text);
      return { ok: true };
    },
    ledger: new PerfLedger(),
    now: () => clock,
  };

  return { deps, calls };
}

const ask = (over: Partial<ReasonRequest> = {}): ReasonRequest => ({
  messages: [{ role: "user", content: "why is the sky blue?" }],
  task: "general",
  ...over,
});

describe("success — local first", () => {
  it("answers from the local engine", async () => {
    const h = harness();
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.text).toBe("local answer");
    expect(r.receipt.servedBy).toBe("local");
    // Nothing else exists to touch: `ReasonDeps` has no second stream.
  });

  it("streams tokens to the caller as they arrive", async () => {
    const h = harness();
    const seen: string[] = [];
    const r = await reason(h.deps, ask({ onToken: (c) => seen.push(c) }));
    expect(r.ok).toBe(true);
    expect(seen.join("")).toBe("local answer");
  });

  it("records which model answered and why", async () => {
    const h = harness();
    const r = await reason(h.deps, ask());
    if (!r.ok) throw new Error(r.reason);
    expect(r.receipt.modelId).toBe(OCADE_MODEL_ID);
    expect(r.receipt.routing).not.toBeNull();
    expect(explainReceipt(r.receipt)).toMatch(/nothing left your machine/i);
  });
});

describe("refusal — deterministic work never reaches a model", () => {
  /*
   * These are the values that actually matter. `DETERMINISTIC_TASKS` is a
   * separate vocabulary from `TaskKind`, so an earlier version of the service
   * that typed `task` as `TaskKind` alone made this guard unreachable: no value
   * it accepted could ever be deterministic. The guard existed and could never
   * fire. Asserting over every member keeps it that way.
   */
  it.each(DETERMINISTIC_TASKS)("refuses %s outright, before asking anything", async (task) => {
    const h = harness();
    const r = await reason(h.deps, ask({ task }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("deterministic_task");
    expect(r.reason).toMatch(/single correct answer/i);
    expect(h.calls.local).toBe(0);
    // There is no other engine that could have been asked instead.
  });

  it("still serves an ordinary model task", async () => {
    const h = harness();
    const r = await reason(h.deps, ask({ task: "summarise" }));
    expect(r.ok).toBe(true);
  });
});

describe("local is the only engine, and its failure is final", () => {
  /*
   * These three used to prove that cloud was reached only after local failed
   * AND the caller had passed `allowCloud`. That permission is gone with the
   * cloud branch, so what is proved instead is stronger: local failing ends
   * the request, and the message says nothing was sent anywhere — which is
   * the sentence a user of a local-first product most needs to see when they
   * hit an error.
   */
  it("ends the request when the local engine fails", async () => {
    const h = harness({ localFails: "Local engine unreachable." });
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("local_unreachable");
    expect(r.reason).toMatch(/not sent to any server/i);
  });

  it("says no local model is installed rather than looking for another route", async () => {
    const h = harness({ models: [] });
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("no_local_model");
    expect(r.reason).toMatch(/not sent to any server/i);
  });

  it("treats an empty local reply as a failure, not an answer", async () => {
    const h = harness({ localReply: "" });
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/empty reply/i);
  });

  it("never reports having been served by anything but the device", async () => {
    const h = harness();
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.receipt.servedBy).toBe("local");
  });
});

describe("cancellation", () => {
  it("stops before asking when already aborted", async () => {
    const h = harness();
    const r = await reason(h.deps, ask({ signal: AbortSignal.abort() }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("cancelled");
    expect(h.calls.local).toBe(0);
  });

  it("a cancelled local stream stays cancelled", async () => {
    const h = harness({ localFails: "cancelled" });
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("cancelled");
    // A cancellation is not a reason to look elsewhere; there is nowhere else.
  });
});

describe("failure — no suitable model", () => {
  it("refuses when installed models cannot serve the task", async () => {
    // A vision task with only a non-vision model installed.
    const h = harness({ models: [model({ profile: "general", vision: false })] });
    const r = await reason(h.deps, ask({ task: "vision" }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.receipt.servedBy).toBe("none");
  });
});

describe("rollback / no partial state", () => {
  it("a refusal leaves no claim of an answer behind", async () => {
    const h = harness({ models: [] });
    const r = await reason(h.deps, ask());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.receipt.servedBy).toBe("none");
    expect(r.receipt.modelId).toBeNull();
    expect(explainReceipt(r.receipt)).toBe("Nothing answered this request.");
  });
});
