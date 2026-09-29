import { afterEach, describe, expect, it, vi } from "vitest";
import { executionDisabled } from "../device.server";

/** Which stops apply to which device: the global one to all, a family's to that family. */
const admin = (paused: string[]) =>
  ({
    from: () => ({
      select: () => ({
        limit: async () => ({
          data: ["jarvis_execution", "jarvis_agent", "jarvis_extension"].map((key) => ({
            key,
            paused: paused.includes(key),
          })),
          error: null,
        }),
      }),
    }),
  }) as never;

let clock = Date.parse("2026-09-29T00:00:00Z");
const fresh = () => {
  // Past the cache, so each case reads its own switches.
  clock += 60_000;
  vi.setSystemTime(clock);
};

afterEach(() => vi.useRealTimers());

describe("executionDisabled", () => {
  it("the global stop pauses every device family", async () => {
    vi.useFakeTimers();
    fresh();
    expect(await executionDisabled(admin(["jarvis_execution"]), "agent")).toBe(true);
    expect(await executionDisabled(admin(["jarvis_execution"]), "extension")).toBe(true);
    expect(await executionDisabled(admin(["jarvis_execution"]))).toBe(true);
  });

  it("a family's stop pauses that family only", async () => {
    vi.useFakeTimers();
    fresh();
    const extensionOff = admin(["jarvis_extension"]);
    expect(await executionDisabled(extensionOff, "extension")).toBe(true);
    expect(await executionDisabled(extensionOff, "agent")).toBe(false);
    expect(await executionDisabled(extensionOff)).toBe(false);
  });

  it("nothing paused, nothing stops", async () => {
    vi.useFakeTimers();
    fresh();
    expect(await executionDisabled(admin([]), "agent")).toBe(false);
  });
});
