/**
 * First run must be invisible, honest, and never a dead end.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  preparationState,
  publishPreparation,
  resetPreparation,
  subscribeToPreparation,
  describePreparation,
} from "../preparation";

beforeEach(() => resetPreparation());

describe("the preparation store", () => {
  it("starts idle and notifies a new subscriber immediately", () => {
    const seen: string[] = [];
    const stop = subscribeToPreparation((s) => seen.push(s.stage));
    expect(seen).toEqual(["idle"]);
    stop();
  });

  it("merges partial updates so a stage change cannot blank a byte count", () => {
    publishPreparation({ stage: "downloading", totalBytes: 340_000_000, fraction: 0.25 });
    publishPreparation({ fraction: 0.5 });
    expect(preparationState().totalBytes).toBe(340_000_000);
    expect(preparationState().fraction).toBe(0.5);
    expect(preparationState().stage).toBe("downloading");
  });

  it("does not notify when nothing actually changed", () => {
    let count = 0;
    const stop = subscribeToPreparation(() => (count += 1));
    const after = count;
    publishPreparation({ stage: "idle" });
    expect(count).toBe(after);
    stop();
  });

  it("stops notifying after unsubscribe", () => {
    let count = 0;
    const stop = subscribeToPreparation(() => (count += 1));
    stop();
    const after = count;
    publishPreparation({ stage: "downloading" });
    expect(count).toBe(after);
  });
});

describe("what a person is told", () => {
  it("uses product language, never runtime vocabulary", () => {
    const stages = [
      "idle",
      "checking",
      "downloading",
      "loading",
      "ready",
      "retrying",
      "unsupported",
    ] as const;
    for (const stage of stages) {
      const text = describePreparation({
        stage,
        fraction: 0.4,
        receivedBytes: null,
        totalBytes: 340_000_000,
        detail: null,
      });
      expect(text).not.toMatch(/gguf|webgpu|wasm|quantis|q4f16|shard|huggingface|mlc/i);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("shows a real percentage and a real size while downloading", () => {
    const text = describePreparation({
      stage: "downloading",
      fraction: 0.42,
      receivedBytes: null,
      totalBytes: 340_000_000,
      detail: null,
    });
    expect(text).toContain("42%");
    expect(text).toContain("340 MB");
  });

  it("says GB rather than four digits of megabytes", () => {
    const text = describePreparation({
      stage: "downloading",
      fraction: 0.1,
      receivedBytes: null,
      totalBytes: 4_800_000_000,
      detail: null,
    });
    expect(text).toContain("4.8 GB");
  });

  it("never says the word Install, Setup or Download failed", () => {
    for (const stage of ["checking", "downloading", "loading", "retrying"] as const) {
      const text = describePreparation({
        stage,
        fraction: null,
        receivedBytes: null,
        totalBytes: null,
        detail: null,
      });
      expect(text).not.toMatch(/\binstall\b|\bset ?up\b|failed/i);
    }
  });

  it("treats an interruption as something that continues, not as an end", () => {
    const text = describePreparation({
      stage: "retrying",
      fraction: 0.3,
      receivedBytes: null,
      totalBytes: null,
      detail: null,
    });
    expect(text).toMatch(/carry on from where it stopped/i);
    expect(text).not.toMatch(/failed|try again|press/i);
  });

  it("is honest, and offers no retry, when the device genuinely cannot run one", () => {
    const text = describePreparation({
      stage: "unsupported",
      fraction: null,
      receivedBytes: null,
      totalBytes: null,
      detail: null,
    });
    expect(text).toMatch(/cannot run/i);
    expect(text).not.toMatch(/try again|retry/i);
  });
});
