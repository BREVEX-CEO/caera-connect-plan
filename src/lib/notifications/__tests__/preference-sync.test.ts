import { describe, expect, it, vi } from "vitest";
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  type PreferenceBackend,
  type StoredPreferenceRow,
} from "../preference-sync";
import { defaultPreferences, type NotificationPreferences } from "../preferences";
import type { NotificationChannelId } from "../channels";

/**
 * WHERE PREFERENCES COME FROM, AND WHAT THE PERSON IS TOLD.
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
 *
 * THERE IS NO BROWSER COPY ANY MORE. It used to be kept as a cache, and it
 * survived sign-out — so the next person to use the browser saw the previous
 * person's quiet hours until the account read landed. `PLAN.md` Phase 2 leaves
 * the account as the only place these are kept, and the tests below assert the
 * fallback is DEFAULTS, labelled as defaults.
 */

const CHANNELS: readonly NotificationChannelId[] = ["in_app"];

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
    });
    expect(loaded.source).toBe("account");
    expect(loaded.preferences.muteOptional).toBe(true);
    expect(loaded.preferences.quietHours.timeZone).toBe("Asia/Kolkata");
  });

  it("WRITES NOTHING TO THE BROWSER while reading the account copy", async () => {
    /*
     * The cache this replaced survived sign-out, so the next person to use the
     * browser was shown the previous person's quiet hours until the account
     * answered. Asserted as behaviour rather than as a missing import: a
     * reintroduced cache would be a write, and there are none to make.
     */
    const written: string[] = [];
    vi.stubGlobal("localStorage", { setItem: (key: string) => written.push(key) });
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
    });
    expect(written).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("treats an account with no row as somebody who has never changed a setting", async () => {
    /*
     * No row is not a failure and not a gap to fill. It means the defaults are
     * what the product is actually acting on for this person, and writing a row
     * here would record a choice they never made.
     */
    const saves: NotificationPreferences[] = [];
    const loaded = await loadNotificationPreferences({
      backend: backendReturning({ row: null, saves }),
      availableChannelIds: CHANNELS,
    });
    expect(loaded.source).toBe("account");
    expect(loaded.preferences).toEqual(defaultPreferences());
    expect(saves, "an unasked-for preference row was written").toHaveLength(0);
  });

  it("falls back to the DEFAULTS when the account cannot be read, and says so", async () => {
    const loaded = await loadNotificationPreferences({
      backend: backendReturning({ readError: "network" }),
      availableChannelIds: CHANNELS,
    });
    expect(loaded.source).toBe("defaults");
    expect(loaded.unavailable).toBe("network");
    expect(loaded.preferences).toEqual(defaultPreferences());
  });

  it("works signed out, with no backend at all", async () => {
    const loaded = await loadNotificationPreferences({
      backend: null,
      availableChannelIds: CHANNELS,
    });
    expect(loaded.source).toBe("defaults");
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
    });
    expect(loaded.preferences.quietHours.fromHour).toBe(22);
    expect(loaded.preferences.quietHours.timeZone).toBe("UTC");
    expect(loaded.preferences.categories.security.frequency).toBe("immediate");
    // A protected category always keeps in-app, whatever the row said.
    expect(loaded.preferences.categories.security.channels).toContain("in_app");
  });
});

describe("saving", () => {
  it("reports a saved change as saved, with the account's revision", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: backendReturning({ revision: 12 }),
    });
    expect(outcome).toEqual({ state: "saved", revision: 12 });
  });

  it("reports an unreachable account as session-only rather than as saved", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: backendReturning({ revision: null }),
    });
    expect(outcome.state).toBe("session_only");
    // It has to say BOTH things: that this tab honours the choice, and that the
    // person's other devices have not been told.
    expect(outcome.state === "session_only" && outcome.reason).toMatch(/saved choices/i);
    expect(outcome.state === "session_only" && outcome.reason).toMatch(/every device/i);
  });

  it("reports a refusal as a failure, with what the account said", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: backendReturning({ saveError: "row-level security" }),
    });
    expect(outcome).toEqual({ state: "failed", reason: "row-level security" });
  });

  it("says plainly that a signed-out change lasts only as long as the tab", async () => {
    const outcome = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: null,
    });
    expect(outcome.state).toBe("session_only");
    expect(outcome.state === "session_only" && outcome.reason).toMatch(/not signed in/i);
  });

  it("never reports saved without a revision from the account", async () => {
    // The revision IS the acknowledgement: the function returns it only after
    // the row is written. A null with no error is a request that never landed.
    const saved = await saveNotificationPreferences({
      preferences: defaultPreferences(),
      backend: { read: vi.fn(), save: async () => ({ revision: null, error: null }) },
    });
    expect(saved.state).not.toBe("saved");
  });
});
