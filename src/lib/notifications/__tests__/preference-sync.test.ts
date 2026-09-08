import { describe, expect, it, vi } from "vitest";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  type PreferenceBackend,
  type StoredPreferenceRow,
} from "../preference-sync";
import { defaultPreferences, type NotificationPreferences } from "../preferences";
import type { PreferenceStorage } from "../preference-store";
import type { NotificationChannelId } from "../channels";

/**
 * WHICH COPY WINS, AND WHAT THE PERSON IS TOLD.
 *
 * PLAN.md §D asks for cross-device synchronisation and a save confirmation, and
 * the failure this file exists to prevent is a screen that says "Saved" when
 * the account never heard about the change. Somebody sets quiet hours on a
 * laptop, sees the tick, and is woken at three in the morning by a phone that
 * was never told.
 *
 * The three outcomes are genuinely different and every one of them is checked:
 * the account acknowledged it, the account could not be REACHED, and the
 * account REFUSED. Only the first is "Saved".
 */

const CHANNELS: readonly NotificationChannelId[] = ["in_app"];

function memoryStorage(seed: Record<string, string> = {}): PreferenceStorage & {
  entries: Record<string, string>;
} {
  const entries = { ...seed };
  return {
    entries,
    getItem: (key) => (key in entries ? entries[key] : null),
    setItem: (key, value) => {
      entries[key] = value;
    },
  };
}

function backendReturning(options: {
  row?: StoredPreferenceRow | null;
  readError?: string;
  saveError?: string;
  revision?: number | null;
  saves?: NotificationPreferences[];
}): PreferenceBackend {
  return {
    read: async () => ({
      row: options.row ?? null,
      error: options.readError ?? null,
    }),
    save: async (preferences) => {
      options.saves?.push(preferences);
      /*
       * `??` would turn an EXPLICIT null — the shape of an unreachable account
       * — back into a revision, and the test for that case would then assert
       * against a save that had actually succeeded. `in` distinguishes "not
       * specified by this test" from "specified as null".
       */
      const revision = "revision" in options ? options.revision! : 7;
      return {
        revision: options.saveError ? null : revision,
        error: options.saveError ?? null,
      };
    },
  };
}

describe("loading", () => {
  it("uses the account copy when there is one", async () => {
    const loaded = await loadNotificationPreferences({
      backend: backendReturning({
        row: {
          mute_optional: true,
          quiet_hours: { enabled: true, fromHour: 21, toHour: 6, timeZone: "Asia/Kolkata" },
          categories: {},
          revision: 4,
        },
      }),
      availableChannelIds: CHANNELS,
      storage: memoryStorage(),
    });
    expect(loaded.source).toBe("account");
    expect(loaded.preferences.muteOptional).toBe(true);
    expect(loaded.preferences.quietHours.timeZone).toBe("Asia/Kolkata");
  });

  it("caches the account copy on the device, so the next paint is instant and offline", async () => {
    const storage = memoryStorage();
    await loadNotificationPreferences({
      backend: backendReturning({
        row: {
          mute_optional: true,
          quiet_hours: { enabled: false, fromHour: 22, toHour: 7, timeZone: "UTC" },
          categories: {},
          revision: 1,
        },
      }),
      availableChannelIds: CHANNELS,
      storage,
    });
    expect(Object.keys(storage.entries)).toHaveLength(1);
    expect(Object.values(storage.entries)[0]).toContain('"muteOptional":true');
  });

  it("pushes the device copy up when the account has no row yet", async () => {
    /*
     * Signing in must not erase preferences somebody already set. An empty
     * server document is the ABSENCE of an answer, not the answer "defaults".
     */
    const saves: NotificationPreferences[] = [];
    const local = { ...defaultPreferences(), muteOptional: true };
    const storage = memoryStorage({
      "ocade.notifications.preferences.v1": JSON.stringify(local),
    });
    const loaded = await loadNotificationPreferences({
      backend: backendReturning({ row: null, saves }),
      availableChannelIds: CHANNELS,
      storage,
    });
    expect(loaded.source).toBe("device");
    expect(loaded.preferences.muteOptional).toBe(true);
    expect(saves).toHaveLength(1);
    expect(saves[0].muteOptional).toBe(true);
  });

  it("falls back to the device copy when the account cannot be read, and says so", async () => {
    const storage = memoryStorage({
      "ocade.notifications.preferences.v1": JSON.stringify({
        ...defaultPreferences(),
        muteOptional: true,
      }),
    });
    const loaded = await loadNotificationPreferences({
      backend: backendReturning({ readError: "network" }),
      availableChannelIds: CHANNELS,
      storage,
    });
    expect(loaded.source).toBe("device");
    expect(loaded.unavailable).toBe("network");
    expect(loaded.preferences.muteOptional).toBe(true);
  });

  it("works signed out, with no backend at all", async () => {
    const loaded = await loadNotificationPreferences({
      backend: null,
      availableChannelIds: CHANNELS,
      storage: memoryStorage(),
    });
    expect(loaded.source).toBe("device");
    expect(loaded.preferences).toEqual(defaultPreferences());
  });

  it("validates whatever the account returns, rather than trusting it", async () => {
    // The row is JSON in a database column and can be anything. A frequency the
    // product does not support, or an hour of 99, must not reach the resolver.
    const loaded = await loadNotificationPreferences({
      backend: backendReturning({
        row: {
          mute_optional: true,
          quiet_hours: { enabled: true, fromHour: 99, toHour: 7, timeZone: "Mars/Olympus" },
          categories: { security: { channels: ["carrier_pigeon"], frequency: "annually" } },
          revision: 1,
        },
      }),
      availableChannelIds: CHANNELS,
      storage: memoryStorage(),
    });
    expect(loaded.preferences.quietHours.fromHour).toBe(22);
    expect(loaded.preferences.quietHours.timeZone).toBe("UTC");
    expect(loaded.preferences.categories.security.frequency).toBe("immediate");
    // A protected category always keeps in-app, whatever the row said.
    expect(loaded.preferences.categories.security.channels).toContain("in_app");
  });
});

describe("saving", () => {
  it("writes the device copy before anything else, so a refresh keeps the choice", async () => {
    const storage = memoryStorage();
    const next = { ...defaultPreferences(), muteOptional: true };
    await saveNotificationPreferences({
      preferences: next,
      backend: backendReturning({ saveError: "refused" }),
      storage,
    });
    expect(Object.values(storage.entries)[0]).toContain('"muteOptional":true');
  });

  it("reports a saved change as saved, with the account's revision", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: backendReturning({ revision: 12 }),
      storage: memoryStorage(),
    });
    expect(outcome).toEqual({ state: "saved", revision: 12 });
  });

  it("reports an unreachable account as device-only rather than as saved", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: backendReturning({ revision: null }),
      storage: memoryStorage(),
    });
    expect(outcome.state).toBe("device_only");
    expect(outcome.state === "device_only" && outcome.reason).toMatch(/this device/i);
  });

  it("reports a refusal as a failure, with what the account said", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: backendReturning({ saveError: "row-level security" }),
      storage: memoryStorage(),
    });
    expect(outcome).toEqual({ state: "failed", reason: "row-level security" });
  });

  it("says plainly that a signed-out change is this browser only", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: null,
      storage: memoryStorage(),
    });
    expect(outcome.state).toBe("device_only");
    expect(outcome.state === "device_only" && outcome.reason).toMatch(/not signed in/i);
  });

  it("never reports saved without a revision from the account", async () => {
    // The revision IS the acknowledgement: the function returns it only after
    // the row is written. A null with no error is a request that never landed.
    const saved = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: { read: vi.fn(), save: async () => ({ revision: null, error: null }) },
      storage: memoryStorage(),
    });
    expect(saved.state).not.toBe("saved");
  });
});
