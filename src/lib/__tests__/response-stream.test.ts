import { describe, it, expect } from "vitest";
import { ResponseStream } from "../chat/response-stream";

function streaming() {
  const s = new ResponseStream();
  s.start();
  s.push("Hello");
  s.push(", world");
  return s;
}

describe("a completed stream is whole", () => {
  it("accumulates chunks and marks a completed answer not-truncated", () => {
    const s = streaming();
    const done = s.complete();
    expect(done.ok).toBe(true);
    if (!done.ok) throw new Error("unreachable");
    expect(done.data.content).toBe("Hello, world");
    expect(done.data.truncated).toBe(false);
    expect(done.data.chunks).toBe(2);
    expect(s.disclosure()).toBe("");
    expect(s.canRetry()).toBe(false);
  });
});

/**
 * The core honesty: a stopped stream is a fragment and says so — never rendered
 * as a finished answer.
 */
describe("a stopped stream is a fragment", () => {
  it("keeps partial content but marks it truncated", () => {
    const s = streaming();
    const stopped = s.stop();
    if (!stopped.ok) throw new Error("unreachable");
    expect(stopped.data.content).toBe("Hello, world");
    expect(stopped.data.truncated).toBe(true);
    expect(stopped.data.status).toBe("stopped");
  });

  it("discloses that it was stopped and offers retry", () => {
    const s = streaming();
    s.stop();
    expect(s.disclosure()).toMatch(/fragment, not a finished answer/i);
    expect(s.canRetry()).toBe(true);
  });
});

describe("an errored stream keeps partial content, marked incomplete", () => {
  it("records the error and keeps what arrived", () => {
    const s = streaming();
    const failed = s.fail("connection reset");
    if (!failed.ok) throw new Error("unreachable");
    expect(failed.data.status).toBe("errored");
    expect(failed.data.content).toBe("Hello, world");
    expect(failed.data.truncated).toBe(true);
    expect(failed.data.error).toBe("connection reset");
    expect(s.disclosure()).toMatch(/connection dropped.*connection reset/i);
    expect(s.canRetry()).toBe(true);
  });
});

/**
 * A terminal state is final — a late chunk must never silently extend a
 * finished answer.
 */
describe("terminal states are final", () => {
  it("rejects a chunk after complete", () => {
    const s = streaming();
    s.complete();
    const late = s.push(" and more");
    expect(late.ok).toBe(false);
    // Content unchanged.
    expect(s.snapshot().content).toBe("Hello, world");
  });

  it("rejects a chunk after stop", () => {
    const s = streaming();
    s.stop();
    expect(s.push("x").ok).toBe(false);
  });

  it("rejects double-completing or completing an errored stream", () => {
    const s = streaming();
    s.complete();
    expect(s.complete().ok).toBe(false);
    expect(s.stop().ok).toBe(false);

    const e = streaming();
    e.fail("boom");
    expect(e.complete().ok).toBe(false);
  });
});

describe("start guards", () => {
  it("can't start twice", () => {
    const s = new ResponseStream();
    expect(s.start().ok).toBe(true);
    expect(s.start().ok).toBe(false);
  });

  it("can't push before starting", () => {
    expect(new ResponseStream().push("x").ok).toBe(false);
  });

  it("an idle stream is trivially truncated (nothing was produced)", () => {
    const snap = new ResponseStream().snapshot();
    expect(snap.status).toBe("idle");
    expect(snap.truncated).toBe(true);
    expect(snap.content).toBe("");
  });

  it("refuses empty chunks so chunk-count backpressure cannot be bypassed", () => {
    const stream = new ResponseStream();
    stream.start();
    expect(stream.push("").ok).toBe(false);
    expect(stream.snapshot().chunks).toBe(0);
  });

  it("terminates honestly when content or chunk budgets are exceeded", () => {
    const byContent = new ResponseStream({ maxCharacters: 5, maxChunks: 10 });
    byContent.start();
    expect(byContent.push("hello").ok).toBe(true);
    expect(byContent.push("!").ok).toBe(false);
    expect(byContent.snapshot().status).toBe("errored");
    expect(byContent.snapshot().content).toBe("hello");

    const byChunks = new ResponseStream({ maxCharacters: 100, maxChunks: 1 });
    byChunks.start();
    expect(byChunks.push("a").ok).toBe(true);
    expect(byChunks.push("b").ok).toBe(false);
    expect(byChunks.snapshot().status).toBe("errored");
  });
});
