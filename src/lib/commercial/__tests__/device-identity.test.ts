import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  deviceRegistrationProblem,
  ensureCurrentDeviceIdentity,
  getOfflineCurrentDeviceIdentity,
  watchDeviceRegistration,
} from "../device-identity";

/**
 * WHAT THE BROWSER IS RESPONSIBLE FOR, NOW THAT THE DATABASE OWNS THE REST.
 *
 * Registration used to be a two-step protocol written here — insert a device,
 * insert a grant, delete the device if the second failed — and these tests
 * modelled every step of it. It is one transactional function now, so the only
 * things left to prove on this side are the ones that are genuinely the
 * client's: the cache is keyed to the account, a revoked browser is forgotten
 * rather than re-admitted, the refusal is published in a form a screen can
 * read, and it does not leak across an account change.
 *
 * `device-registration-against-postgres.test.ts` proves the transaction itself
 * against real Postgres, which is the only place that claim can be proved.
 */
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/integrations/supabase/on-demand", () => ({ loadSupabaseClient: mocks.load }));

let account: string;
let storage: Map<string, string>;
/** What the registration function answers: a device id, null, or an error. */
let answer: { data: string | null; error?: { code?: string; message: string } };
let calls: Record<string, unknown>[];

beforeEach(() => {
  account = "account-one";
  answer = { data: "device-one" };
  calls = [];
  storage = new Map([["caera.browser_install_id", "install-one"]]);
  vi.stubGlobal("window", {
    location: { origin: "https://ocade.invalid" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  // Deliberately WITHOUT `navigator.locks`: a browser that has none used to
  // return null here without registering and without saying anything.
  vi.stubGlobal("navigator", { onLine: true, userAgent: "Chrome Windows" });
  mocks.load.mockResolvedValue({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: account } } }, error: null }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, ...args });
      return answer.error
        ? { data: null, error: answer.error }
        : { data: answer.data, error: null };
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("asks once when two parts of the page ask at the same moment", async () => {
  // Offline preparation and the allowance both asked; a refused browser logged two 400s.
  const [a, b] = await Promise.all([ensureCurrentDeviceIdentity(), ensureCurrentDeviceIdentity()]);
  expect(a).toEqual(b);
  expect(calls).toHaveLength(1);
  await ensureCurrentDeviceIdentity(); // a later visit asks again
  expect(calls).toHaveLength(2);
});

it("registers through the one transactional function, in a browser with no Web Locks", async () => {
  const identity = await ensureCurrentDeviceIdentity();
  expect(identity).toEqual({
    accountId: "account-one",
    deviceId: "device-one",
    browserInstallId: "install-one",
  });
  expect(calls).toEqual([
    {
      name: "register_browser_device_for_current_user",
      _browser_install_id: "install-one",
      _kind: "desktop",
      _name: expect.any(String),
      _origin: "https://ocade.invalid",
      _user_agent: "Chrome Windows",
    },
  ]);
  expect(await getOfflineCurrentDeviceIdentity()).toEqual(identity);
});

it("does not reuse another account's cached identity", async () => {
  await ensureCurrentDeviceIdentity();
  account = "account-two";
  expect(await getOfflineCurrentDeviceIdentity()).toBeNull();
});

it("forgets a browser whose device was removed rather than re-registering it", async () => {
  await ensureCurrentDeviceIdentity();
  // Null is the function's way of saying this browser's grant was revoked.
  answer = { data: null };
  expect(await ensureCurrentDeviceIdentity()).toBeNull();
  expect(await getOfflineCurrentDeviceIdentity()).toBeNull();
});

it("says an account at its device limit instead of swallowing the refusal", async () => {
  const seen: (string | null)[] = [];
  const stop = watchDeviceRegistration(() => seen.push(deviceRegistrationProblem()));
  answer = { data: null, error: { code: "23514", message: "Device cap reached" } };

  await expect(ensureCurrentDeviceIdentity()).rejects.toThrow("could not be registered");

  expect(deviceRegistrationProblem()).toBe("device_limit");
  expect(seen).toEqual(["device_limit"]);
  stop();
});

it("reports anything else as a fault that may pass, and clears it once a device exists", async () => {
  answer = { data: null, error: { message: "database unavailable" } };
  await expect(ensureCurrentDeviceIdentity()).rejects.toThrow("could not be registered");
  expect(deviceRegistrationProblem()).toBe("unavailable");

  answer = { data: "device-one" };
  await expect(ensureCurrentDeviceIdentity()).resolves.toMatchObject({ accountId: account });
  expect(deviceRegistrationProblem()).toBeNull();
});

it("never shows one account's refusal to another", async () => {
  answer = { data: null, error: { code: "23514", message: "Device cap reached" } };
  await expect(ensureCurrentDeviceIdentity()).rejects.toThrow();
  expect(deviceRegistrationProblem("account-one")).toBe("device_limit");
  // The same module state, asked on behalf of somebody else, answers nothing.
  expect(deviceRegistrationProblem("account-two")).toBeNull();

  account = "account-two";
  await getOfflineCurrentDeviceIdentity();
  expect(deviceRegistrationProblem()).toBeNull();
});
