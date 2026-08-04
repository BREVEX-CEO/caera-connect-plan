import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Out-of-band error capture.
 *
 * The server recovers a real stack trace from here after h3 has swallowed a
 * throw into a generic 500. Two properties matter and are easy to break:
 *
 *  1. CONSUME-ONCE — reading clears the slot, so a later unrelated 500 cannot
 *     be reported with a stale stack from an earlier request.
 *  2. TTL — a captured error older than 5 seconds is discarded rather than
 *     attached to whatever happens to fail next.
 *
 * Both are about not attributing an error to the WRONG request, which is worse
 * than having no stack at all.
 *
 * This runtime has no global `dispatchEvent`, so rather than skip the tests
 * (a skipped test proves nothing) the global `addEventListener` is stubbed
 * BEFORE the module is imported. That captures the handlers the module really
 * registers, and the tests then invoke those exact handlers — the real
 * registration and recording path, not a reimplementation of it.
 */

const handlers = new Map<string, (event: unknown) => void>();

vi.stubGlobal("addEventListener", (type: string, fn: (event: unknown) => void) => {
  handlers.set(type, fn);
});

const { consumeLastCapturedError } = await import("../error-capture");

const emitError = (error: unknown) => handlers.get("error")!({ error });
const emitRejection = (reason: unknown) => handlers.get("unhandledrejection")!({ reason });

beforeEach(() => {
  vi.useFakeTimers();
  consumeLastCapturedError(); // start from an empty slot
});

afterEach(() => {
  vi.useRealTimers();
});

describe("global handler registration", () => {
  it("registers for both uncaught errors and unhandled rejections", () => {
    expect(handlers.has("error")).toBe(true);
    expect(handlers.has("unhandledrejection")).toBe(true);
  });
});

describe("consumeLastCapturedError", () => {
  it("returns undefined when nothing has been captured", () => {
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("captures a thrown error from the global error event", () => {
    const boom = new Error("boom");
    emitError(boom);
    expect(consumeLastCapturedError()).toBe(boom);
  });

  it("captures an unhandled rejection reason", () => {
    const reason = new Error("rejected");
    emitRejection(reason);
    expect(consumeLastCapturedError()).toBe(reason);
  });

  it("CONSUMES the error, so a second read is empty", () => {
    emitError(new Error("once"));
    expect(consumeLastCapturedError()).toBeInstanceOf(Error);
    // A stale stack must never be attached to a later, unrelated failure.
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("keeps only the most recent capture", () => {
    emitError(new Error("first"));
    const second = new Error("second");
    emitError(second);
    expect(consumeLastCapturedError()).toBe(second);
  });

  it("discards a capture older than the 5 second TTL", () => {
    emitError(new Error("stale"));
    vi.advanceTimersByTime(5_001);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("still returns a capture just inside the TTL", () => {
    const fresh = new Error("fresh");
    emitError(fresh);
    vi.advanceTimersByTime(4_999);
    expect(consumeLastCapturedError()).toBe(fresh);
  });

  it("clears the slot on TTL expiry, not just for this one read", () => {
    emitError(new Error("stale"));
    vi.advanceTimersByTime(5_001);
    expect(consumeLastCapturedError()).toBeUndefined();
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("falls back to the event itself when it carries no error", () => {
    const event = { type: "error" };
    handlers.get("error")!(event);
    expect(consumeLastCapturedError()).toBe(event);
  });

  it("a fresh capture after an expiry is returned normally", () => {
    emitError(new Error("stale"));
    vi.advanceTimersByTime(6_000);
    expect(consumeLastCapturedError()).toBeUndefined();

    const fresh = new Error("fresh");
    emitError(fresh);
    expect(consumeLastCapturedError()).toBe(fresh);
  });
});
