import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { streamLocalChat } from "../ocade-local";
import { BrowserWebGpuAdapter } from "../brain/adapters/browser-webgpu";
import { BrowserWasmAdapter } from "../brain/adapters/browser-wasm";
// @ts-expect-error - plain-JS test fixture, no declarations needed
import { startStubLocalEngine } from "../../../scripts/fixtures/stub-local-engine.mjs";

/**
 * Two promises the chat surface makes, held to what actually goes on the wire.
 *
 * FAST vs THINKING is a request field, not a label. The toggle is only real if
 * the flag reaches the engine, so this asserts against the body the engine
 * RECEIVED rather than against what the caller intended to send.
 *
 * VISION IS A REFUSAL WHERE IT IS ABSENT. An engine with no vision must say so
 * and decline the image. The failure this exists to prevent is the quiet one:
 * dropping the attachment, answering from the text alone, and leaving the
 * person believing their picture was read.
 */

let engine: {
  url: string;
  chatRequests: Array<Record<string, unknown>>;
  close: () => Promise<void>;
};

beforeAll(async () => {
  engine = await startStubLocalEngine({ tokenDelayMs: 2 });
});
afterAll(async () => {
  await engine?.close();
});

describe("Thinking is a flag that reaches the engine", () => {
  it("does not ask a model with no reasoning mode to think", async () => {
    engine.chatRequests.length = 0;
    await streamLocalChat(engine.url, "qwen2.5:3b", [{ role: "user", content: "hello" }], {
      onToken: () => {},
      think: true,
    });
    const sent = engine.chatRequests.at(-1)!;
    // qwen2.5 has no reasoning mode; asking anyway costs a guaranteed failed
    // round trip on every message, so the field is withheld by model id.
    expect(sent.think).not.toBe(true);
    expect(sent.model).toBe("qwen2.5:3b");
  }, 30_000);

  it("sends the conversation and the model on every request", async () => {
    engine.chatRequests.length = 0;
    await streamLocalChat(
      engine.url,
      "qwen2.5:3b",
      [
        { role: "user", content: "first" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "second" },
      ],
      { onToken: () => {} },
    );
    const sent = engine.chatRequests.at(-1)! as {
      messages: { content: string }[];
      stream: boolean;
    };
    expect(sent.messages.map((m) => m.content)).toEqual(["first", "ok", "second"]);
    expect(sent.stream).toBe(true);
  }, 30_000);

  it("keeps the model resident so the next question is not a cold start", async () => {
    engine.chatRequests.length = 0;
    await streamLocalChat(engine.url, "qwen2.5:3b", [{ role: "user", content: "hi" }], {
      onToken: () => {},
    });
    expect(engine.chatRequests.at(-1)!.keep_alive).toBeTruthy();
  }, 30_000);
});

describe("an engine that cannot see says so, and refuses the image", () => {
  const IMAGE = {
    role: "user" as const,
    content: "What is in this picture?",
    images: ["data:image/png;base64,iVBORw0KGgo="],
  };

  it.each([
    ["the accelerated browser engine", () => new BrowserWebGpuAdapter()],
    ["the compatibility browser engine", () => new BrowserWasmAdapter()],
  ])(
    "%s refuses rather than answering from the text alone",
    async (_label, make) => {
      const adapter = make();
      let tokens = "";
      const result = await adapter.stream([IMAGE], { onToken: (t) => (tokens += t) });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.reason).toMatch(/cannot read images/i);
      // The quiet failure: an answer produced as though the picture were read.
      expect(tokens).toBe("");
    },
    30_000,
  );

  it.each([
    ["the accelerated browser engine", () => new BrowserWebGpuAdapter()],
    ["the compatibility browser engine", () => new BrowserWasmAdapter()],
  ])(
    "%s never advertises vision it does not have",
    async (_label, make) => {
      const availability = await make().probe();
      if (availability.available) {
        expect(availability.capabilities?.vision).toBe(false);
      } else {
        // Unavailable engines must still not claim a capability.
        expect(availability.capabilities?.vision ?? false).toBe(false);
      }
    },
    30_000,
  );

  it("points somewhere that CAN read the image, rather than just refusing", async () => {
    const result = await new BrowserWasmAdapter().stream([IMAGE], { onToken: () => {} });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/device engine|paired computer/i);
  }, 30_000);
});
