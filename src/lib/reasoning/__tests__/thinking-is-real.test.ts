/**
 * THE FAST/THINKING SWITCH HAS TO CHANGE THE REQUEST.
 *
 * It did not. `brainReasonDeps` passed `think` down to the adapter and stopped
 * there, and neither browser adapter reads that field — WebLLM has no such
 * parameter and wllama has no such parameter. So on the shipped Chat page the
 * toggle produced byte-for-byte the same request in both positions. It saved
 * correctly, it drew correctly, and the static dead-controls scan passed it,
 * because the scan proves a control is wired and not that it has an effect.
 *
 * These tests assert the effect: the bytes differ, the difference lands on the
 * system message, and an engine that cannot carry deliberation says so instead
 * of being quietly asked to do it anyway.
 */
import { describe, expect, it, vi } from "vitest";
import { brainReasonDeps } from "../brain-deps";
import type { BrainAdapter, BrainMessage, AdapterReady } from "../../brain/adapter";
import type { RouteChosen } from "../../brain/router";

function routeWith(availability: Partial<AdapterReady>): {
  route: RouteChosen;
  seen: BrainMessage[][];
  thinkFlags: (boolean | undefined)[];
} {
  const seen: BrainMessage[][] = [];
  const thinkFlags: (boolean | undefined)[] = [];
  const adapter: BrainAdapter = {
    id: "browser_wasm",
    displayName: "test",
    probe: async () => ({ available: false, code: "probe_failed", reason: "n/a", remedies: [] }),
    stream: async (messages, handlers) => {
      seen.push(messages);
      thinkFlags.push(handlers.think);
      handlers.onToken("ok");
      return { ok: true, modelId: "test", firstTokenMs: 1 };
    },
  };
  const ready: AdapterReady = {
    available: true,
    label: "OCADE Browser",
    locality: "on_device",
    modelId: "test",
    capabilities: { text: true, vision: false, imageGeneration: false, tools: false },
    ...availability,
  };
  return {
    route: { ok: true, adapter, availability: ready, attempts: [], mode: "browser" as never },
    seen,
    thinkFlags,
  };
}

const conversation = [
  { role: "system" as const, content: "You are OCADE." },
  { role: "user" as const, content: "Why is the sky blue?" },
];

async function send(deps: ReturnType<typeof brainReasonDeps>) {
  await deps.streamLocal("test", conversation, { onToken: () => {} });
}

describe("Thinking changes what the model is actually asked", () => {
  it("sends different bytes with the switch on than with it off", async () => {
    const on = routeWith({});
    await send(brainReasonDeps(on.route, { think: true }));
    const off = routeWith({});
    await send(brainReasonDeps(off.route, { think: false }));

    expect(JSON.stringify(on.seen[0])).not.toBe(JSON.stringify(off.seen[0]));
  });

  it("puts the difference on the system message, never on what the user typed", async () => {
    const on = routeWith({});
    await send(brainReasonDeps(on.route, { think: true }));

    expect(on.seen[0][0].role).toBe("system");
    expect(on.seen[0][0].content).not.toBe("You are OCADE.");
    expect(on.seen[0][0].content.startsWith("You are OCADE.")).toBe(true);
    expect(on.seen[0][1].content).toBe("Why is the sky blue?");
  });

  it("leaves the conversation untouched when no preference was expressed", async () => {
    const none = routeWith({});
    await send(brainReasonDeps(none.route, {}));
    expect(none.seen[0]).toEqual(conversation);
    expect(none.thinkFlags[0]).toBeUndefined();
  });
});

describe("an engine that cannot deliberate is not asked to", () => {
  it("degrades Thinking to Fast on a tier that says it is unsuitable", async () => {
    const weak = routeWith({ thinkingSuitable: false });
    const told = vi.fn();
    await send(brainReasonDeps(weak.route, { think: true, onThinkingDegraded: told }));

    expect(told).toHaveBeenCalledTimes(1);
    expect(weak.thinkFlags[0]).toBe(false);

    // And the request is the Fast one, not the Thinking one.
    const fast = routeWith({ thinkingSuitable: false });
    await send(brainReasonDeps(fast.route, { think: false }));
    expect(weak.seen[0][0].content).toBe(fast.seen[0][0].content);
  });

  it("says nothing when the switch was already off", async () => {
    const weak = routeWith({ thinkingSuitable: false });
    const told = vi.fn();
    await send(brainReasonDeps(weak.route, { think: false, onThinkingDegraded: told }));
    expect(told).not.toHaveBeenCalled();
  });

  it("honours Thinking on a tier that can carry it", async () => {
    const strong = routeWith({ thinkingSuitable: true });
    const told = vi.fn();
    await send(brainReasonDeps(strong.route, { think: true, onThinkingDegraded: told }));
    expect(told).not.toHaveBeenCalled();
    expect(strong.thinkFlags[0]).toBe(true);
  });
});
