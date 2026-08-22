import { describe, expect, it, vi } from "vitest";
import { AutomationVerifierRegistry } from "../automation-supervisor";
import {
  DesktopAutomationWorkerHost,
  describeAutomationWorkerHost,
  type AutomationWorkerHostState,
  type AutomationWorkerHostSupabase,
} from "../automation-worker-host";
import type { NativeCompanionAdapter } from "../native/companion-bridge";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function supabase(userId: string | null = "user-private") {
  let authCallback: ((event: string, session: unknown) => void) | null = null;
  const subscription = { unsubscribe: vi.fn() };
  const client: AutomationWorkerHostSupabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      })),
      onAuthStateChange: vi.fn((callback) => {
        authCallback = callback;
        return { data: { subscription } };
      }),
    },
  };
  return {
    client,
    subscription,
    emit: (event: string) => authCallback?.(event, null),
  };
}

function companion(available = true): NativeCompanionAdapter {
  return {
    status: vi.fn(async () =>
      available
        ? { available: true, version: "test" }
        : { available: false, reason: "Native backend is unavailable." },
    ),
    execute: vi.fn(),
    cancel: vi.fn(),
    emergencyStop: vi.fn(),
    gestureStatus: vi.fn(async () => ({
      available: false,
      running: false,
      controlEnabled: false,
      cameraIndex: null,
      reason: "Not installed in this unit test.",
    })),
    startGestureControl: vi.fn(),
    stopGestureControl: vi.fn(),
  };
}

function observedRegistry(): AutomationVerifierRegistry {
  const registry = new AutomationVerifierRegistry();
  registry.registerObservationBacked(
    "window.list",
    async () => ({ verified: true, evidence: "Observed through accessibility tree." }),
    "Accessibility tree snapshot from a separate read channel.",
  );
  return registry;
}

function controller() {
  return {
    start: vi.fn(),
    stop: vi.fn(async () => undefined),
    getState: vi.fn(() => ({
      lifecycle: "idle" as const,
      inFlight: 0,
      lastTickAt: null,
      lastError: null,
    })),
  };
}

function host(
  over: {
    db?: ReturnType<typeof supabase>;
    native?: NativeCompanionAdapter;
    registry?: AutomationVerifierRegistry;
    desktop?: boolean;
    createController?: ReturnType<typeof vi.fn>;
    workerIdFactory?: () => string;
    onStateChange?: (state: AutomationWorkerHostState) => void;
  } = {},
) {
  const db = over.db ?? supabase();
  const native = over.native ?? companion();
  const registry = over.registry ?? observedRegistry();
  const workerController = controller();
  const createController = over.createController ?? vi.fn((_workerId: string) => workerController);
  return {
    db,
    native,
    registry,
    workerController,
    createController,
    instance: new DesktopAutomationWorkerHost({
      supabase: db.client,
      companion: native,
      verifiers: registry,
      isDesktopRuntime: () => over.desktop ?? true,
      workerIdFactory: over.workerIdFactory ?? (() => "desktop-ephemeral"),
      createController,
      onStateChange: over.onStateChange,
    }),
  };
}

describe("desktop automation worker host", () => {
  it("refuses a web runtime before touching authentication or the companion", async () => {
    const ctx = host({ desktop: false });
    await expect(ctx.instance.start()).resolves.toMatchObject({
      status: "stopped",
      reason: expect.stringMatching(/signed desktop app/i),
    });
    expect(ctx.db.client.auth.getUser).not.toHaveBeenCalled();
    expect(ctx.native.status).not.toHaveBeenCalled();
    expect(ctx.createController).not.toHaveBeenCalled();
  });

  it("refuses a signed-out desktop session before checking native execution", async () => {
    const ctx = host({ db: supabase(null) });
    await expect(ctx.instance.start()).resolves.toMatchObject({
      status: "stopped",
      reason: expect.stringMatching(/sign in/i),
    });
    expect(ctx.native.status).not.toHaveBeenCalled();
    expect(ctx.createController).not.toHaveBeenCalled();
  });

  it("surfaces authentication errors with credential-like values redacted", async () => {
    const db = supabase();
    vi.mocked(db.client.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: "token=private-value expired" },
    });
    const ctx = host({ db });
    const result = await ctx.instance.start();
    expect(result.status).toBe("error");
    expect(result.reason).not.toContain("private-value");
    expect(ctx.native.status).not.toHaveBeenCalled();
  });

  it("refuses an unavailable companion without composing or polling", async () => {
    const ctx = host({ native: companion(false) });
    await expect(ctx.instance.start()).resolves.toMatchObject({
      status: "stopped",
      reason: expect.stringMatching(/native backend is unavailable/i),
    });
    expect(ctx.createController).not.toHaveBeenCalled();
  });

  it("rejects ordinary verifier registrations without observation provenance", async () => {
    const registry = new AutomationVerifierRegistry();
    registry.register("window.list", async () => ({
      verified: true,
      evidence: "executor said ok",
    }));
    const ctx = host({ registry });
    await expect(ctx.instance.start()).resolves.toMatchObject({
      status: "stopped",
      reason: expect.stringMatching(/no observation-backed action verifier/i),
    });
    expect(ctx.createController).not.toHaveBeenCalled();
  });

  it("starts one controller only after every host preflight passes", async () => {
    const states: AutomationWorkerHostState[] = [];
    const ctx = host({ onStateChange: (state) => states.push(state) });
    const result = await ctx.instance.start();
    expect(result.status).toBe("running");
    expect(ctx.createController).toHaveBeenCalledWith("desktop-ephemeral");
    expect(ctx.workerController.start).toHaveBeenCalledTimes(1);
    expect(ctx.db.client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(states.map((state) => state.status)).toEqual(["starting", "running"]);
  });

  it("cleans up the auth listener and controller when startup fails", async () => {
    const workerController = controller();
    workerController.start.mockImplementation(() => {
      throw new Error("token=private-startup-value could not schedule");
    });
    const createController = vi.fn(() => workerController);
    const ctx = host({ createController });
    const result = await ctx.instance.start();
    expect(result.status).toBe("error");
    expect(result.reason).not.toContain("private-startup-value");
    expect(ctx.db.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(workerController.stop).toHaveBeenCalledTimes(1);
  });

  it("uses an ephemeral worker ID that does not derive from the user ID", async () => {
    const ctx = host({ workerIdFactory: () => "random-only-id" });
    await ctx.instance.start();
    expect(ctx.createController).toHaveBeenCalledWith("random-only-id");
    expect(JSON.stringify(ctx.instance.getState())).not.toContain("user-private");
  });

  it("shares concurrent starts and never creates duplicate controllers", async () => {
    const gate = deferred<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>();
    const db = supabase();
    vi.mocked(db.client.auth.getUser).mockReturnValue(gate.promise);
    const ctx = host({ db });
    const first = ctx.instance.start();
    const second = ctx.instance.start();
    expect(first).toBe(second);
    gate.resolve({ data: { user: { id: "user-private" } }, error: null });
    await Promise.all([first, second]);
    expect(ctx.createController).toHaveBeenCalledTimes(1);
  });

  it("stops on sign-out and unsubscribes without reporting completed work", async () => {
    const ctx = host();
    await ctx.instance.start();
    ctx.db.emit("SIGNED_OUT");
    await vi.waitFor(() => expect(ctx.workerController.stop).toHaveBeenCalledTimes(1));
    expect(ctx.db.subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(ctx.instance.getState()).toMatchObject({
      status: "stopped",
      reason: expect.stringMatching(/queued rows remain pending/i),
    });
  });

  it("does not start after stop wins a slow authentication race", async () => {
    const gate = deferred<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>();
    const db = supabase();
    vi.mocked(db.client.auth.getUser).mockReturnValue(gate.promise);
    const ctx = host({ db });
    const starting = ctx.instance.start();
    await ctx.instance.stop("Stopped by the user.");
    gate.resolve({ data: { user: { id: "user-private" } }, error: null });
    await starting;
    expect(ctx.native.status).not.toHaveBeenCalled();
    expect(ctx.createController).not.toHaveBeenCalled();
    expect(ctx.instance.getState()).toEqual({ status: "stopped", reason: "Stopped by the user." });
  });

  it("describes stopped and running states without implying successful execution", () => {
    expect(describeAutomationWorkerHost({ status: "stopped", reason: "No verifier." })).toBe(
      "No verifier.",
    );
    const running = describeAutomationWorkerHost({
      status: "running",
      reason: "Polling only.",
      controller: {
        lifecycle: "idle",
        inFlight: 0,
        lastTickAt: null,
        lastError: null,
      },
    });
    expect(running).toMatch(/waiting for eligible work/i);
    expect(running).not.toMatch(/completed|executed successfully/i);
  });
});

describe("observation-backed verifier provenance", () => {
  it("requires non-empty provenance and reports only observation-backed kinds", () => {
    const registry = new AutomationVerifierRegistry();
    registry.register("screen.read", async () => ({ verified: true, evidence: "test only" }));
    expect(registry.observationBackedKinds()).toEqual([]);
    expect(() =>
      registry.registerObservationBacked(
        "window.list",
        async () => ({ verified: true, evidence: "observed" }),
        " ",
      ),
    ).toThrow(/provenance evidence/i);
    registry.registerObservationBacked(
      "window.list",
      async () => ({ verified: true, evidence: "observed" }),
      "Accessibility snapshot.",
    );
    expect(registry.observationBackedKinds()).toEqual(["window.list"]);
  });
});
