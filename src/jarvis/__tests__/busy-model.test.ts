import { describe, expect, it, vi } from "vitest";
import type { IntelligenceEvent } from "@/lib/intelligence/contract";

const online = vi.hoisted(() => ({ stream: vi.fn() }));

vi.mock("@/lib/intelligence/online-client", () => ({
  createOnlineIntelligenceTransport: () => online,
}));
vi.mock("@/lib/commercial/use-generation-permit", () => ({ beginBilledRequest: vi.fn() }));
vi.mock("../jarvis.functions", () => ({}));
vi.mock("../changes", () => ({ actionChanged: vi.fn() }));

const { askThroughBusy, Unavailable, ModelRefused, liveDeps } = await import("../live-deps");
const { beginBilledRequest } = await import("@/lib/commercial/use-generation-permit");

describe("a busy model answer", () => {
  it("passes completed native parts to the agent and withholds an interrupted turn", async () => {
    const parts = [{ text: "Reading", signature: "text-sig" }, { callId: "c" }];
    const toolCalls = [
      { id: "c", name: "computer", arguments: { action: "file_list" }, signature: "call-sig" },
    ];
    const billed = {
      permit: {
        id: "p",
        generationId: "g",
        idempotencyKey: "i",
        surface: "jarvis" as const,
        source: "server" as const,
      },
      recordDelivery: vi.fn(),
      settle: vi.fn(async () => undefined),
    };
    vi.mocked(beginBilledRequest).mockResolvedValue(billed);
    const input = {
      messages: [],
      memory: false,
      attachments: [],
      signal: new AbortController().signal,
    };
    const response = {
      text: "Reading",
      toolCalls,
      parts,
      toolResults: [],
      backend: "online" as const,
      stopReason: "tool_use" as const,
    };
    online.stream.mockImplementation(async function* () {
      yield { type: "final", response } satisfies IntelligenceEvent;
    });
    await expect(liveDeps("c1").model(input)).resolves.toEqual({
      text: response.text,
      toolCalls,
      parts,
      permitKey: "i",
    });
    expect(billed.settle).toHaveBeenCalledTimes(1);
    online.stream.mockImplementation(async function* () {
      yield { type: "tool_call", call: toolCalls[0]! } satisfies IntelligenceEvent;
    });
    await expect(liveDeps("c1").model(input)).rejects.toBeInstanceOf(Unavailable);
    expect(billed.settle).toHaveBeenCalledTimes(2);
  });

  it("is waited out and asked again, the same request, before the task pauses", async () => {
    const ask = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Unavailable(1))
      .mockResolvedValueOnce("answer");
    await expect(askThroughBusy(ask, undefined, [1, 1])).resolves.toBe("answer");
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("pauses the task after the last wait, and never waits on a refusal that is not busy", async () => {
    const busy = vi.fn(async () => {
      throw new Unavailable(1);
    });
    await expect(askThroughBusy(busy, undefined, [1, 1])).rejects.toBeInstanceOf(Unavailable);
    expect(busy).toHaveBeenCalledTimes(3);
    const refused = vi.fn(async () => {
      throw new ModelRefused("no");
    });
    await expect(askThroughBusy(refused, undefined, [1, 1])).rejects.toBeInstanceOf(ModelRefused);
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it("does not wait at all when capacity returns long after the waits (a day's limit)", async () => {
    const busy = vi.fn(async () => {
      throw new Unavailable(4 * 60 * 60_000);
    });
    const started = Date.now();
    await expect(askThroughBusy(busy, undefined, [30_000, 60_000])).rejects.toBeInstanceOf(
      Unavailable,
    );
    expect(busy).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("does not ask again when OCADE already retried and the provider named no wait", async () => {
    // Each ask is up to 3 provider attempts on OCADE's server: asking again here made it up to
    // 9 a turn (BLOCKED_TESTS DEB-19-01). The task pauses and continues by itself instead.
    const busy = vi.fn(async () => {
      throw new Unavailable();
    });
    await expect(askThroughBusy(busy, undefined, [1, 1])).rejects.toBeInstanceOf(Unavailable);
    expect(busy).toHaveBeenCalledTimes(1);
  });

  it("stops waiting the moment STOP is pressed", async () => {
    const stop = new AbortController();
    const busy = vi.fn(async () => {
      throw new Unavailable(1);
    });
    const asked = askThroughBusy(busy, stop.signal, [60_000]);
    stop.abort(new Error("stopped"));
    await expect(asked).rejects.toThrow("stopped");
    expect(busy).toHaveBeenCalledTimes(1);
  });
});
