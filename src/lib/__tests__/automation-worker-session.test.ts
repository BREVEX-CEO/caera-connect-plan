import { describe, expect, it, vi } from "vitest";
import { AutomationWorkerCompanionSession } from "../automation-worker-session";
import type { NativeCompanionAdapter } from "../native/companion-bridge";
import type { BootstrapResult } from "../native/tauri-companion";

function companion(name: string): NativeCompanionAdapter & { name: string } {
  return {
    name,
    status: vi.fn(),
    execute: vi.fn(),
    cancel: vi.fn(),
    emergencyStop: vi.fn(),
    gestureStatus: vi.fn(),
    startGestureControl: vi.fn(),
    stopGestureControl: vi.fn(),
  };
}

function harness() {
  const first = companion("first");
  let active: NativeCompanionAdapter = first;
  let listener: ((adapter: NativeCompanionAdapter) => void) | null = null;
  const hosts = new Map<
    NativeCompanionAdapter,
    { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }
  >();
  const bootstrap = vi.fn(async (): Promise<BootstrapResult> => ({ installed: true }));
  const unavailable = vi.fn();
  const errors = vi.fn();
  const session = new AutomationWorkerCompanionSession({
    bootstrap,
    getCompanion: () => active,
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
    createHost: (adapter) => {
      const host = {
        start: vi.fn(async () => ({ status: "stopped" as const, reason: "test" })),
        stop: vi.fn(async (): Promise<void> => {}),
      };
      hosts.set(adapter, host);
      return host;
    },
    onBootstrapUnavailable: unavailable,
    onError: errors,
  });
  return {
    first,
    hosts,
    bootstrap,
    unavailable,
    errors,
    session,
    replace(next: NativeCompanionAdapter) {
      active = next;
      listener?.(next);
    },
  };
}

describe("automation worker companion session", () => {
  it("subscribes before bootstrap and starts one host for the installed adapter", async () => {
    const h = harness();
    await h.session.start();
    expect(h.bootstrap).toHaveBeenCalledTimes(1);
    expect(h.hosts.get(h.first)?.start).toHaveBeenCalledTimes(1);
  });

  it("deduplicates the bootstrap notification and post-bootstrap lookup", async () => {
    const h = harness();
    h.bootstrap.mockImplementationOnce(async () => {
      h.replace(h.first);
      return { installed: true };
    });
    await h.session.start();
    expect(h.hosts.size).toBe(1);
    expect(h.hosts.get(h.first)?.start).toHaveBeenCalledTimes(1);
  });

  it("stops the old host before starting a replacement session", async () => {
    const h = harness();
    await h.session.start();
    const second = companion("second");
    h.replace(second);
    await h.session.retryBootstrap();
    await Promise.resolve();
    expect(h.hosts.get(h.first)?.stop).toHaveBeenCalledTimes(1);
    expect(h.hosts.get(second)?.start).toHaveBeenCalledTimes(1);
  });

  it("keeps a cold-start failure retryable", async () => {
    const h = harness();
    h.bootstrap
      .mockResolvedValueOnce({ installed: false, reason: "Companion is still starting." })
      .mockResolvedValueOnce({ installed: true });
    await h.session.start();
    expect(h.unavailable).toHaveBeenCalledWith("Companion is still starting.");
    expect(h.hosts.size).toBe(0);
    await h.session.retryBootstrap();
    expect(h.hosts.get(h.first)?.start).toHaveBeenCalledTimes(1);
  });

  it("shares concurrent bootstrap attempts", async () => {
    const h = harness();
    let release!: () => void;
    h.bootstrap.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ installed: true });
        }),
    );
    const a = h.session.start();
    const b = h.session.retryBootstrap();
    release();
    await Promise.all([a, b]);
    expect(h.bootstrap).toHaveBeenCalledTimes(1);
    expect(h.hosts.get(h.first)?.start).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes and stops without starting a later adapter", async () => {
    const h = harness();
    await h.session.start();
    await h.session.stop();
    const second = companion("second");
    h.replace(second);
    await Promise.resolve();
    expect(h.hosts.get(h.first)?.stop).toHaveBeenCalledTimes(1);
    expect(h.hosts.has(second)).toBe(false);
  });

  it("cannot revive an old bootstrap after stop and restart", async () => {
    const h = harness();
    let releaseOld!: () => void;
    h.bootstrap
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseOld = () => resolve({ installed: true });
          }),
      )
      .mockResolvedValueOnce({ installed: true });
    const old = h.session.start();
    await h.session.stop();
    const restarted = h.session.start();
    releaseOld();
    await Promise.all([old, restarted]);
    expect(h.bootstrap).toHaveBeenCalledTimes(2);
    expect(h.hosts.get(h.first)?.start).toHaveBeenCalledTimes(1);
  });

  it("redacts credential-like details from unexpected bootstrap errors", async () => {
    const h = harness();
    h.bootstrap.mockRejectedValueOnce(new Error("authorization=private-session-token"));
    await h.session.start();
    expect(h.errors).toHaveBeenCalledWith("authorization=[REDACTED]");
    expect(h.errors).not.toHaveBeenCalledWith(expect.stringContaining("private-session-token"));
  });
});
