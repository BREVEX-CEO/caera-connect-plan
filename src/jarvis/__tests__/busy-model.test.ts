import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/intelligence/online-client", () => ({
  createOnlineIntelligenceTransport: () => ({}),
}));
vi.mock("@/lib/commercial/use-generation-permit", () => ({ beginBilledRequest: vi.fn() }));
vi.mock("../jarvis.functions", () => ({}));
vi.mock("../changes", () => ({ actionChanged: vi.fn() }));

const { askThroughBusy, Unavailable, ModelRefused } = await import("../live-deps");

describe("a busy model answer", () => {
  it("is waited out and asked again, the same request, before the task pauses", async () => {
    const ask = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Unavailable())
      .mockResolvedValueOnce("answer");
    await expect(askThroughBusy(ask, undefined, [1, 1])).resolves.toBe("answer");
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("pauses the task after the last wait, and never waits on a refusal that is not busy", async () => {
    const busy = vi.fn(async () => {
      throw new Unavailable();
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

  it("stops waiting the moment STOP is pressed", async () => {
    const stop = new AbortController();
    const busy = vi.fn(async () => {
      throw new Unavailable();
    });
    const asked = askThroughBusy(busy, stop.signal, [60_000]);
    stop.abort(new Error("stopped"));
    await expect(asked).rejects.toThrow("stopped");
    expect(busy).toHaveBeenCalledTimes(1);
  });
});
