import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F34: Offline answers carried text from a previous chat. wllama cannot cancel
 * inside its worker, so an aborted completion's queued output was read by the
 * next one. The fake below behaves exactly that way: whatever an instance did
 * not deliver is handed to its next completion.
 */

const instances: FakeWllama[] = [];
let lastOptions: Record<string, unknown> = {};

class FakeWllama {
  leftover: string[] = [];
  exited = false;
  constructor() {
    instances.push(this);
  }
  setCompat() {}
  async loadModel() {}
  async exit() {
    this.exited = true;
  }
  async createChatCompletion(options: {
    messages: { content: string }[];
    abortSignal?: AbortSignal;
  }) {
    lastOptions = options;
    const prompt = options.messages[options.messages.length - 1]!.content;
    const tokens = [...this.leftover, ...[1, 2, 3, 4].map((n) => `${prompt}${n} `)];
    this.leftover = [];
    const keep = (rest: string[]) => {
      this.leftover = rest;
    };
    return (async function* () {
      for (let i = 0; i < tokens.length; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (options.abortSignal?.aborted) {
          keep(tokens.slice(i)); // the worker kept going
          return;
        }
        yield { choices: [{ delta: { content: tokens[i] } }] };
      }
    })();
  }
}

vi.mock("@wllama/wllama", () => ({ Wllama: FakeWllama }));
vi.mock("@wllama/wllama/esm/wasm/wllama.wasm?url", () => ({ default: "wllama.wasm" }));
vi.mock("../offline-release", () => ({
  OFFLINE_LABEL: "Offline Intelligence",
  formatSize: () => "1 MB",
  offlineRelease: () => ({ releaseId: "release-1", totalBytes: 1, thinkingSuitable: false }),
}));

async function adapter() {
  const { BrowserWasmAdapter } = await import("../adapters/browser-wasm");
  return new BrowserWasmAdapter({ weightsProvider: async () => new Blob(["x"]) });
}

async function ask(
  engine: Awaited<ReturnType<typeof adapter>>,
  prompt: string,
  stopAfter?: number,
) {
  const controller = new AbortController();
  let text = "";
  const result = await engine.stream([{ role: "user", content: prompt }], {
    signal: controller.signal,
    onToken: (piece) => {
      text += piece;
      if (stopAfter !== undefined && text.split(" ").length > stopAfter) controller.abort();
    },
  });
  return { text, result };
}

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("window", {});
});

describe("one Offline chat never hears another", () => {
  it("does not carry a stopped answer's tail into the next answer", async () => {
    const engine = await adapter();
    const first = await ask(engine, "lighthouse", 1);
    expect(first.result.ok).toBe(false);
    const second = await ask(engine, "fruit");
    expect(second.result.ok).toBe(true);
    expect(second.text).not.toContain("lighthouse");
    expect(second.text).toBe("fruit1 fruit2 fruit3 fruit4 ");
  });

  it("disposes the runtime only when a generation did not finish", async () => {
    const engine = await adapter();
    await ask(engine, "a");
    await ask(engine, "b");
    expect(instances).toHaveLength(1);
    await ask(engine, "c", 1);
    expect(instances[0]!.exited).toBe(true);
    await ask(engine, "d");
    expect(instances).toHaveLength(2);
  });

  it("runs one generation at a time", async () => {
    const engine = await adapter();
    const order: string[] = [];
    const run = (prompt: string) =>
      engine.stream([{ role: "user", content: prompt }], { onToken: (t) => order.push(t) });
    await Promise.all([run("x"), run("y")]);
    expect(order.join("")).toBe("x1 x2 x3 x4 y1 y2 y3 y4 ");
  });
});

describe("the transcript fits the engine", () => {
  it("keeps the newest turns and always the current question", async () => {
    const { fitTranscript, estimateTokens } = await import("../adapters/browser-wasm");
    const turn = "word ".repeat(200);
    const messages = [
      { role: "system" as const, content: "be brief" },
      ...Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content: turn,
      })),
      { role: "user" as const, content: "What is 12 minus 7?" },
    ];
    const budget = 1536;
    const fitted = fitTranscript(messages, budget)!;
    expect(fitted[0]!.role).toBe("system");
    expect(fitted[fitted.length - 1]!.content).toBe("What is 12 minus 7?");
    expect(fitted[1]!.role).toBe("user");
    expect(fitted.reduce((sum, m) => sum + estimateTokens(m.content), 0)).toBeLessThanOrEqual(
      budget,
    );
    expect(fitted.length).toBeLessThan(messages.length);
  });

  it("refuses a question that cannot fit on its own", async () => {
    const { fitTranscript } = await import("../adapters/browser-wasm");
    expect(fitTranscript([{ role: "user", content: "x".repeat(10_000) }], 1536)).toBeNull();
  });

  it("gives desktops more room than phones", async () => {
    const { contextTokens } = await import("../adapters/browser-wasm");
    expect(contextTokens({ mobile: true, deviceMemoryGb: 8 })).toBe(2048);
    expect(contextTokens({ mobile: false, deviceMemoryGb: 8 })).toBe(4096);
    expect(contextTokens({ mobile: false, deviceMemoryGb: null })).toBe(2048);
  });
});

describe("strict formats on the small model (F21/F22)", () => {
  it("tells it once to keep to the requested format", async () => {
    const engine = await adapter();
    await ask(engine, "Name one primary color. Reply with one word.");
    const messages = lastOptions.messages as { role: string; content: string }[];
    expect(messages[0]!.role).toBe("system");
    expect(messages[0]!.content).toMatch(/only that and nothing else/);
    expect(lastOptions.response_format).toBeUndefined();
  });

  it("constrains the output to JSON only when JSON-only is asked for", async () => {
    const engine = await adapter();
    await ask(engine, "Return only valid JSON with keys sum and even for 3 + 5. No Markdown.");
    expect(lastOptions.response_format).toEqual({ type: "json_object" });
    const { wantsJsonOnly } = await import("../adapters/browser-wasm");
    expect(wantsJsonOnly("Explain what JSON is")).toBe(false);
    expect(wantsJsonOnly("Reply in JSON only")).toBe(true);
  });
});
