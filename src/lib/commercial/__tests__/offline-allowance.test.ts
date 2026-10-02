import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { syncOfflineAllowance } from "../offline-allowance";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  installed: vi.fn(),
  events: vi.fn(),
  allocate: vi.fn(),
  reconcile: vi.fn(),
  install: vi.fn(),
  key: vi.fn(),
  forget: vi.fn(),
}));
vi.mock("../device-identity", () => ({ ensureCurrentDeviceIdentity: mocks.identity }));
vi.mock("../offline-counter", () => ({
  readInstalledOfflineLeases: mocks.installed,
  listOfflineUsageEvents: mocks.events,
  ensureOfflineDeviceKey: mocks.key,
  installOfflineUsageLease: mocks.install,
  forgetOfflineUsageLease: mocks.forget,
}));
vi.mock("../offline-usage.functions", () => ({
  allocateOfflineUsage: mocks.allocate,
  reconcileOfflineUsage: mocks.reconcile,
}));
vi.mock("@/lib/time/trusted-clock", () => ({ settleTrustedClock: () => undefined }));
vi.mock("../offline-lease", () => ({
  trustedOfflineTimeNow: () => ({
    now: Date.parse("2026-09-18T10:00:00Z"),
    rollbackDetected: false,
  }),
}));

const entry = (id: string, expiresAt: string, consumed = 0) => ({
  lease: {
    payload: {
      leaseId: id,
      allocatedHundredths: 700,
      issuedAt: "2026-09-18T09:00:00Z",
      notBefore: "2026-09-18T09:00:00Z",
      expiresAt,
    },
  },
  consumedHundredths: consumed,
  reservedHundredths: 0,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-18T10:00:00Z"));
  vi.stubGlobal("indexedDB", {});
  vi.stubGlobal("navigator", { onLine: true });
  mocks.identity.mockResolvedValue({
    accountId: "account",
    deviceId: "device",
    browserInstallId: "install",
  });
  mocks.installed.mockResolvedValue([]);
  mocks.events.mockResolvedValue([]);
  mocks.key.mockResolvedValue("device-public-key");
  mocks.allocate.mockResolvedValue({ ok: false, reason: "session_exhausted" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("registers a fresh browser before asking the server for its first signed block", async () => {
  await syncOfflineAllowance();
  expect(mocks.identity).toHaveBeenCalledOnce();
  expect(mocks.allocate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      requestKey: "device:initial:2026-09-18T10",
      deviceId: "device",
    }),
  });
});
it("does not treat an expired unused lease as spendable capacity", async () => {
  mocks.installed.mockResolvedValue([entry("expired", "2026-09-18T09:59:00Z")]);
  await syncOfflineAllowance();
  expect(mocks.allocate).toHaveBeenCalledWith({
    data: expect.objectContaining({ requestKey: "device:expired:2026-09-18T10" }),
  });
});
it("can replenish two spent blocks in one hour while retries keep the same key", async () => {
  mocks.installed.mockResolvedValue([entry("first", "2026-09-18T15:00:00Z", 700)]);
  await syncOfflineAllowance();
  await syncOfflineAllowance();
  expect(mocks.allocate.mock.calls[0]).toEqual(mocks.allocate.mock.calls[1]);
  mocks.installed.mockResolvedValue([entry("second", "2026-09-18T15:00:00Z", 700)]);
  await syncOfflineAllowance();
  expect(mocks.allocate.mock.calls[2]![0].data.requestKey).toBe("device:second:2026-09-18T10");
});
it("keeps a usable existing block instead of reserving another", async () => {
  mocks.installed.mockResolvedValue([entry("active", "2026-09-18T15:00:00Z")]);
  await syncOfflineAllowance();
  expect(mocks.allocate).not.toHaveBeenCalled();
});

it("forgets an expired block once the server has its events, and keeps an unsettled one", async () => {
  mocks.installed.mockResolvedValue([entry("expired", "2026-09-18T09:59:00Z", 700)]);
  mocks.events.mockResolvedValue([{ payload: { sequence: 1 } }]);
  mocks.reconcile.mockResolvedValue({ consumedHundredths: 700 });

  await syncOfflineAllowance();
  expect(mocks.forget).toHaveBeenCalledWith("account", "device", "expired");

  mocks.forget.mockClear();
  mocks.reconcile.mockRejectedValue(new Error("the account could not be reached"));
  await syncOfflineAllowance();
  expect(mocks.forget).not.toHaveBeenCalled();
});

it("keeps a block that is still spendable, reconciled or not", async () => {
  mocks.installed.mockResolvedValue([entry("live", "2026-09-18T15:00:00Z", 700)]);
  mocks.events.mockResolvedValue([{ payload: { sequence: 1 } }]);
  mocks.reconcile.mockResolvedValue({ consumedHundredths: 700 });

  await syncOfflineAllowance();
  expect(mocks.forget).not.toHaveBeenCalled();
});

it("does not keep replaying an expired server lease after local storage was lost", async () => {
  await syncOfflineAllowance();
  vi.setSystemTime(new Date("2026-09-18T15:00:00Z"));
  await syncOfflineAllowance();
  expect(mocks.allocate.mock.calls[0]![0].data.requestKey).not.toBe(
    mocks.allocate.mock.calls[1]![0].data.requestKey,
  );
});
