/**
 * One run at a time, including during the gap before one starts.
 *
 * The bug this closes is invisible: `run()` resets the tool runner's
 * repeat-detection, and a second request arriving a second later reset it while
 * the first run was still inside a tool call. The first run lost the state that
 * stops it looping, and nothing anywhere recorded that it had happened.
 *
 * The three-state machine is the point. Two states cannot answer "has something
 * claimed this?" during the await between deciding to start and starting.
 */

import { describe, expect, it } from "vitest";

import { QueryGuard } from "../query/queryGuard";

describe("claiming a run", () => {
  it("is idle until something claims it", () => {
    const guard = new QueryGuard();
    expect(guard.getStatus()).toBe("idle");
    expect(guard.isActive()).toBe(false);
  });

  it("counts a reservation as active before the run exists", () => {
    const guard = new QueryGuard();
    expect(guard.reserve()).toBe(true);
    expect(guard.getStatus()).toBe("dispatching");
    // The whole reason for the third state: the gap is not idle.
    expect(guard.isActive()).toBe(true);
  });

  it("refuses a second reservation", () => {
    const guard = new QueryGuard();
    guard.reserve();
    expect(guard.reserve()).toBe(false);
  });

  it("gives a reservation back when the run never happened", () => {
    const guard = new QueryGuard();
    guard.reserve();
    guard.cancelReservation();
    expect(guard.isActive()).toBe(false);
    expect(guard.reserve()).toBe(true);
  });

  it("will not start a second run over a running one", () => {
    const guard = new QueryGuard();
    expect(guard.tryStart()).toBe(1);
    expect(guard.tryStart()).toBeNull();
  });

  it("upgrades its own reservation into a run", () => {
    const guard = new QueryGuard();
    guard.reserve();
    expect(guard.tryStart()).toBe(1);
    expect(guard.getStatus()).toBe("running");
  });
});

describe("finishing", () => {
  it("releases the run that started", () => {
    const guard = new QueryGuard();
    const generation = guard.tryStart()!;
    expect(guard.end(generation)).toBe(true);
    expect(guard.isActive()).toBe(false);
  });

  it("does not let a superseded run release a newer one", () => {
    /*
     * The same re-entrancy bug arriving from the other direction. An older run
     * that finishes late must not free the guard the run that replaced it is
     * holding, or a third request walks straight into the second one's state.
     */
    const guard = new QueryGuard();
    const first = guard.tryStart()!;
    guard.forceEnd();
    const second = guard.tryStart()!;

    expect(guard.end(first)).toBe(false);
    expect(guard.isActive()).toBe(true);
    expect(guard.end(second)).toBe(true);
  });

  it("forceEnd releases whatever is held, and is safe when nothing is", () => {
    const guard = new QueryGuard();
    expect(() => guard.forceEnd()).not.toThrow();
    guard.reserve();
    guard.forceEnd();
    expect(guard.isActive()).toBe(false);
  });
});

describe("telling somebody", () => {
  it("notifies on every transition, and stops when unsubscribed", () => {
    const guard = new QueryGuard();
    let seen = 0;
    const unsubscribe = guard.subscribe(() => (seen += 1));

    guard.reserve();
    const generation = guard.tryStart()!;
    guard.end(generation);
    expect(seen).toBe(3);

    unsubscribe();
    guard.tryStart();
    expect(seen).toBe(3);
  });

  it("does not notify for a transition that did not happen", () => {
    const guard = new QueryGuard();
    let seen = 0;
    guard.subscribe(() => (seen += 1));
    guard.cancelReservation(); // nothing reserved
    guard.end(99); // not the running generation
    expect(seen).toBe(0);
  });
});
