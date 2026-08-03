import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setLockTimeout,
  unlockWith,
  lock,
  isUnlocked,
  requireKey,
  subscribe,
} from "../storage/vault-session";
import { StorageLockedError } from "../storage/types";

/**
 * Vault session — the in-memory holder for the unwrapped data encryption key.
 *
 * This is a security control, not a cache: the key never touches disk, and the
 * vault must AUTO-LOCK after inactivity so an unattended machine does not leave
 * browser-only data readable. A locked vault must raise `StorageLockedError`
 * rather than let a caller quietly continue without encryption.
 *
 * Timers are faked so the auto-lock is asserted deterministically instead of by
 * waiting.
 */

// A CryptoKey is opaque here; the holder only ever stores and returns it.
const KEY = { type: "secret" } as unknown as CryptoKey;
const OTHER = { type: "secret", other: true } as unknown as CryptoKey;

const DEFAULT_TIMEOUT_S = 15 * 60;

beforeEach(() => {
  vi.useFakeTimers();
  // The module holds process-wide state; start every test from locked+default.
  lock();
  setLockTimeout(DEFAULT_TIMEOUT_S);
});

afterEach(() => {
  lock();
  vi.useRealTimers();
});

describe("lock state", () => {
  it("starts locked and refuses to hand out a key", () => {
    expect(isUnlocked()).toBe(false);
    expect(() => requireKey()).toThrow(StorageLockedError);
  });

  it("hands out exactly the key it was unlocked with", () => {
    unlockWith(KEY);
    expect(isUnlocked()).toBe(true);
    expect(requireKey()).toBe(KEY);
  });

  it("replaces the key on a second unlock", () => {
    unlockWith(KEY);
    unlockWith(OTHER);
    expect(requireKey()).toBe(OTHER);
  });

  it("locking clears the key", () => {
    unlockWith(KEY);
    lock();
    expect(isUnlocked()).toBe(false);
    expect(() => requireKey()).toThrow(StorageLockedError);
  });

  it("locking twice is safe", () => {
    unlockWith(KEY);
    lock();
    expect(() => lock()).not.toThrow();
    expect(isUnlocked()).toBe(false);
  });
});

describe("auto-lock after inactivity", () => {
  it("locks once the timeout elapses", () => {
    unlockWith(KEY);
    expect(isUnlocked()).toBe(true);

    vi.advanceTimersByTime(DEFAULT_TIMEOUT_S * 1000 - 1);
    expect(isUnlocked()).toBe(true); // not yet

    vi.advanceTimersByTime(1);
    expect(isUnlocked()).toBe(false); // auto-locked
  });

  it("keeps the vault open while it is being USED (sliding expiry)", () => {
    unlockWith(KEY);

    // Use the key just before the deadline; that must restart the countdown.
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_S * 1000 - 1_000);
    expect(requireKey()).toBe(KEY);

    // The original deadline passes, but the timer was reset by the use above.
    vi.advanceTimersByTime(2_000);
    expect(isUnlocked()).toBe(true);

    // With no further use it still locks a full timeout after the last use.
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_S * 1000);
    expect(isUnlocked()).toBe(false);
  });

  it("does not schedule an auto-lock while already locked", () => {
    lock();
    setLockTimeout(60);
    // Nothing should be pending; advancing time must not throw or change state.
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(isUnlocked()).toBe(false);
  });

  it("a fresh unlock restarts the countdown from zero", () => {
    unlockWith(KEY);
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_S * 1000 - 1_000);
    unlockWith(KEY); // re-unlock
    vi.advanceTimersByTime(2_000);
    expect(isUnlocked()).toBe(true);
  });
});

describe("lock timeout configuration", () => {
  it("applies a custom timeout", () => {
    setLockTimeout(120);
    unlockWith(KEY);
    vi.advanceTimersByTime(119_000);
    expect(isUnlocked()).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(isUnlocked()).toBe(false);
  });

  it("enforces a 60-second floor so the vault cannot be set to lock instantly", () => {
    setLockTimeout(1);
    unlockWith(KEY);
    vi.advanceTimersByTime(59_000);
    expect(isUnlocked()).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(isUnlocked()).toBe(false);
  });

  it("treats a negative timeout as the floor rather than disabling the lock", () => {
    setLockTimeout(-999);
    unlockWith(KEY);
    vi.advanceTimersByTime(60_000);
    expect(isUnlocked()).toBe(false);
  });

  it("rejects a non-finite timeout instead of storing NaN", () => {
    expect(() => setLockTimeout(Number.NaN)).toThrow(/invalid/i);
    expect(() => setLockTimeout(Number.POSITIVE_INFINITY)).toThrow(/invalid/i);
  });

  it("changing the timeout while unlocked re-arms the countdown", () => {
    unlockWith(KEY);
    vi.advanceTimersByTime(60_000);
    setLockTimeout(120); // re-arms from now
    vi.advanceTimersByTime(119_000);
    expect(isUnlocked()).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(isUnlocked()).toBe(false);
  });
});

describe("subscribers", () => {
  it("notifies on unlock and on lock", () => {
    const seen: boolean[] = [];
    const off = subscribe(() => seen.push(isUnlocked()));

    unlockWith(KEY);
    lock();

    expect(seen).toEqual([true, false]);
    off();
  });

  it("notifies when the vault AUTO-locks, so the UI cannot show a stale state", () => {
    const seen: boolean[] = [];
    const off = subscribe(() => seen.push(isUnlocked()));

    unlockWith(KEY);
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_S * 1000);

    expect(seen).toEqual([true, false]);
    off();
  });

  it("stops notifying after unsubscribe", () => {
    let count = 0;
    const off = subscribe(() => (count += 1));
    unlockWith(KEY);
    expect(count).toBe(1);

    off();
    lock();
    unlockWith(KEY);
    expect(count).toBe(1);
  });

  it("supports several independent subscribers", () => {
    let a = 0;
    let b = 0;
    const offA = subscribe(() => (a += 1));
    const offB = subscribe(() => (b += 1));

    unlockWith(KEY);
    expect([a, b]).toEqual([1, 1]);

    offA();
    lock();
    expect([a, b]).toEqual([1, 2]);
    offB();
  });
});
