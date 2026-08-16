import { describe, expect, it } from "vitest";
import { FALLBACK_CHANGES, assessDevice, describeTrigger } from "../perf-fallback";

describe("assessDevice", () => {
  it("steps down on a low core count", () => {
    const r = assessDevice({ cores: 2, memoryGb: 8 });
    expect(r.lowEnd).toBe(true);
    expect(r.reason).toContain("2 processor cores");
  });

  it("steps down on low reported memory", () => {
    expect(assessDevice({ cores: 8, memoryGb: 4 }).lowEnd).toBe(true);
  });

  it("honours the browser data-saver request", () => {
    expect(assessDevice({ cores: 16, memoryGb: 32, saveData: true }).lowEnd).toBe(true);
  });

  it("treats unknown signals as capable", () => {
    expect(assessDevice({}).lowEnd).toBe(false);
    expect(assessDevice({ cores: 8, memoryGb: 16 }).lowEnd).toBe(false);
  });
});

describe("explanations", () => {
  it("names the measured trigger", () => {
    expect(describeTrigger("frames", null)).toMatch(/dropped frames/i);
  });
  it("quotes the device signal", () => {
    expect(describeTrigger("device", "this device reports 2 processor cores")).toContain(
      "2 processor cores",
    );
  });
  it("lists what changed", () => {
    expect(FALLBACK_CHANGES.length).toBeGreaterThan(2);
  });
});
