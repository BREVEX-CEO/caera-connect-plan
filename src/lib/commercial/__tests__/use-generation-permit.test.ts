import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  finalize: vi.fn(),
  release: vi.fn(),
  offlineIdentity: vi.fn(),
  installedLeases: vi.fn(),
  reserveOffline: vi.fn(),
  finalizeOffline: vi.fn(),
  releaseOffline: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../usage.functions", () => ({
  acquireGenerationPermit: mocks.acquire,
  finalizeGenerationPermit: mocks.finalize,
  releaseGenerationPermit: mocks.release,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("../device-identity", () => ({
  getOfflineCurrentDeviceIdentity: mocks.offlineIdentity,
}));

vi.mock("../offline-counter", () => ({
  readInstalledOfflineLeases: mocks.installedLeases,
  reserveOfflineGeneration: mocks.reserveOffline,
  finalizeOfflineGeneration: mocks.finalizeOffline,
  releaseOfflineGeneration: mocks.releaseOffline,
}));

vi.mock("@/lib/time/trusted-clock", () => ({
  observeNow: vi.fn(),
  readTrustedClockHighWater: () => 0,
}));

vi.mock("../offline-lease", () => ({
  resolveTrustedOfflineTime: ({ wallNow }: { wallNow: number }) => ({
    now: wallNow,
    rollbackDetected: false,
  }),
}));

import { beginBilledRequest } from "../use-generation-permit";

describe("the customer-side commercial permit boundary", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.release.mockResolvedValue({ released: true });
    mocks.finalize.mockResolvedValue({ charged: 1 });
    mocks.offlineIdentity.mockResolvedValue(null);
    mocks.installedLeases.mockResolvedValue([]);
    mocks.finalizeOffline.mockResolvedValue(100);
    mocks.releaseOffline.mockResolvedValue(0);
    Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a billable request only after the server grants a permit", async () => {
    mocks.acquire.mockResolvedValue({ ok: true, permitId: "request-1", tier: "free", reserved: 1 });

    const billed = await beginBilledRequest({ idempotencyKey: "request-1" });
    expect(billed).not.toBeNull();
    expect(billed!.permit).toMatchObject({
      id: "request-1",
      generationId: "request-1",
      surface: "chat",
      source: "server",
    });

    billed!.recordDelivery({ prompt: "hello", answer: "hello back" });
    await billed!.settle();

    expect(mocks.finalize).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("releases a granted permit when no output reached the user", async () => {
    mocks.acquire.mockResolvedValue({ ok: true, permitId: "request-2", tier: "free", reserved: 1 });

    const billed = await beginBilledRequest({ idempotencyKey: "request-2" });
    await billed!.settle();

    expect(mocks.release).toHaveBeenCalledWith({
      data: { idempotencyKey: "request-2", reason: "cancelled_before_output" },
    });
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(mocks.offlineIdentity).not.toHaveBeenCalled();
  });

  it("refuses an exhausted account before returning anything that can run AI", async () => {
    mocks.acquire.mockResolvedValue({
      ok: false,
      reason: "allowance_exhausted",
      exhausted: "session",
      resetsInMs: 60_000,
      resetsAt: "2026-09-07T10:00:00.000Z",
    });

    await expect(beginBilledRequest({ idempotencyKey: "request-3" })).resolves.toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "You have used this session's allowance.",
      expect.objectContaining({
        description: expect.stringMatching(/resets .*2026.*in about 1 minute/i),
      }),
    );
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it("fails closed when the usage authority is unreachable", async () => {
    mocks.acquire.mockRejectedValue(new Error("network unavailable"));

    await expect(beginBilledRequest({ idempotencyKey: "request-4" })).resolves.toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "OCADE could not verify your usage allowance.",
      expect.any(Object),
    );
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledWith({
      data: { idempotencyKey: "request-4", reason: "acquire_failed" },
    });
  });

  it("fails closed on timeout and releases a reservation that arrives late", async () => {
    vi.useFakeTimers();
    let resolveAcquisition!: (value: {
      ok: true;
      permitId: string;
      tier: "free";
      reserved: number;
    }) => void;
    mocks.acquire.mockReturnValue(
      new Promise((resolve) => {
        resolveAcquisition = resolve;
      }),
    );

    const pending = beginBilledRequest({ idempotencyKey: "request-5" });
    await vi.advanceTimersByTimeAsync(6_001);
    await expect(pending).resolves.toBeNull();
    expect(mocks.finalize).not.toHaveBeenCalled();

    resolveAcquisition({ ok: true, permitId: "request-5", tier: "free", reserved: 1 });
    await vi.waitFor(() => {
      expect(mocks.release).toHaveBeenCalledWith({
        data: { idempotencyKey: "request-5", reason: "client_timeout" },
      });
    });
  });

  it("uses a signed device allocation offline and settles meaningful output locally", async () => {
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    mocks.offlineIdentity.mockResolvedValue({
      accountId: "account-1",
      deviceId: "device-1",
      browserInstallId: "browser-1",
    });
    const lease = {
      payload: {
        leaseId: "lease-1",
        accountId: "account-1",
        deviceId: "device-1",
        tier: "free",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
    mocks.installedLeases.mockResolvedValue([{ lease, verificationKeys: [] }]);
    mocks.reserveOffline.mockResolvedValue({
      leaseId: "lease-1",
      generationId: "generation-1",
      idempotencyKey: "offline-1",
      surface: "code",
      reservedHundredths: 100,
    });

    const billed = await beginBilledRequest({
      idempotencyKey: "offline-1",
      generationId: "generation-1",
      surface: "code",
    });
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(billed?.permit).toMatchObject({
      generationId: "generation-1",
      surface: "code",
      source: "offline_lease",
    });
    billed!.recordDelivery({ prompt: "edit this", answer: "done" });
    await billed!.settle();

    expect(mocks.finalizeOffline).toHaveBeenCalledOnce();
    expect(mocks.releaseOffline).not.toHaveBeenCalled();
  });

  it("releases an offline reservation when cancellation produces no output", async () => {
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    mocks.offlineIdentity.mockResolvedValue({
      accountId: "account-1",
      deviceId: "device-1",
      browserInstallId: "browser-1",
    });
    const lease = {
      payload: {
        leaseId: "lease-1",
        accountId: "account-1",
        deviceId: "device-1",
        tier: "pro",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
    mocks.installedLeases.mockResolvedValue([{ lease, verificationKeys: [] }]);
    mocks.reserveOffline.mockResolvedValue({
      leaseId: "lease-1",
      generationId: "offline-2",
      idempotencyKey: "offline-2",
      surface: "cowork",
      reservedHundredths: 3500,
    });

    const billed = await beginBilledRequest({ idempotencyKey: "offline-2", surface: "cowork" });
    await billed!.settle();

    expect(mocks.releaseOffline).toHaveBeenCalledOnce();
    expect(mocks.finalizeOffline).not.toHaveBeenCalled();
  });

  it("reuses one logical identity when an online transport failure falls back offline", async () => {
    mocks.acquire.mockRejectedValue(new Error("connection dropped"));
    mocks.offlineIdentity.mockResolvedValue({
      accountId: "account-1",
      deviceId: "device-1",
      browserInstallId: "browser-1",
    });
    const lease = {
      payload: {
        leaseId: "lease-1",
        accountId: "account-1",
        deviceId: "device-1",
        tier: "free",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
    mocks.installedLeases.mockResolvedValue([{ lease, verificationKeys: [] }]);
    mocks.reserveOffline.mockResolvedValue({
      leaseId: "lease-1",
      generationId: "generation-fallback",
      idempotencyKey: "request-fallback",
      surface: "artifact",
      reservedHundredths: 100,
    });

    const billed = await beginBilledRequest({
      idempotencyKey: "request-fallback",
      generationId: "generation-fallback",
      surface: "artifact",
    });
    expect(billed?.permit).toMatchObject({
      generationId: "generation-fallback",
      idempotencyKey: "request-fallback",
      surface: "artifact",
      source: "offline_lease",
    });
    expect(mocks.reserveOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-fallback",
        idempotencyKey: "request-fallback",
        surface: "artifact",
      }),
    );

    billed!.recordDelivery({ prompt: "create it", answer: "created" });
    await billed!.settle();
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(mocks.finalizeOffline).toHaveBeenCalledOnce();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledWith({
      data: { idempotencyKey: "request-fallback", reason: "acquire_failed" },
    });
  });
});
