import { describe, expect, it } from "vitest";
import { assessDevice } from "@/lib/perf-fallback";

describe("animation performance fallback", () => {
  it("does not flatten a normal 4-core / 4-GB device", () => {
    expect(assessDevice({ cores: 4, memoryGb: 4 })).toEqual({ lowEnd: false, reason: null });
  });

  it("does not use Save-Data as a UI animation signal", () => {
    expect(assessDevice({ cores: 8, memoryGb: 8, saveData: true })).toEqual({ lowEnd: false, reason: null });
  });

  it("reduces visual cost for genuinely constrained memory", () => {
    expect(assessDevice({ cores: 8, memoryGb: 2 }).lowEnd).toBe(true);
  });

  it("reduces visual cost for genuinely constrained CPU", () => {
    expect(assessDevice({ cores: 2, memoryGb: 8 }).lowEnd).toBe(true);
  });
});
