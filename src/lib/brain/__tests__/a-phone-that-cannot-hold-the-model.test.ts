import { describe, expect, it } from "vitest";
import { isAllocationFailure } from "../adapters/browser-wasm";

/**
 * JARVIS-045: a phone that cannot allocate the model is recognised, so the
 * release is refused on that device and Auto answers online instead of
 * retrying the impossible local path.
 */
describe("a device that cannot hold the model", () => {
  it("recognises the allocation failures phones actually report", () => {
    expect(isAllocationFailure(new RangeError("Cannot allocate WebAssembly.Memory"))).toBe(true);
    expect(isAllocationFailure(new TypeError("Cannot convert a BigInt value to a number"))).toBe(
      true,
    );
    expect(isAllocationFailure(new Error("out of memory"))).toBe(true);
  });

  it("does not mistake an ordinary failure for a device limit", () => {
    expect(isAllocationFailure(new Error("The model file is damaged"))).toBe(false);
    expect(isAllocationFailure(new Error("Network error"))).toBe(false);
  });
});
