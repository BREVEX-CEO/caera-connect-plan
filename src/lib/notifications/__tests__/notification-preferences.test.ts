import { describe, expect, it } from "vitest";
import {
  findNotificationCategory,
  isMutable,
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryId,
} from "../categories";
import { availableChannels, resolveChannels, type NotificationChannel } from "../channels";
import {
  decideDelivery,
  defaultPreferences,
  hourInZone,
  inQuietHours,
  normalisePreferences,
  type NotificationPreferences,
} from "../preferences";

/**
 * THE RULE THAT OVERRIDES THE PERSON'S OWN SETTING.
 *
 * PLAN.md §D: security, billing, legal, emergency-stop and account-recovery
 * events "remain recorded and are not silently discarded by optional-product
 * mute settings". Everything below is a way of asking whether that survives a
 * setting that says otherwise — because the setting CAN say otherwise. It
 * arrives from storage, from a stale device, from an older build's synced
 * record, or from somebody editing it by hand.
 */

const EVERY_CHANNEL: NotificationChannel[] = resolveChannels({
  emailSender: "notifications@example.test",
  webPushPublicKey: "public-key",
  fcmSenderId: "sender",
  apnsTopic: "topic",
});

const IN_APP_ONLY: NotificationChannel[] = resolveChannels({});

const PROTECTED: NotificationCategoryId[] = ["security", "account"];
const OPTIONAL: NotificationCategoryId[] = ["product_updates"];

function muted(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...defaultPreferences(), muteOptional: true, ...overrides };
}

describe("the categories", () => {
  it("are the three the product can actually send", () => {
    expect(NOTIFICATION_CATEGORIES).toHaveLength(3);
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(category.title.length).toBeGreaterThan(2);
      expect(category.description.length).toBeGreaterThan(20);
      expect(category.frequencies.length).toBeGreaterThan(0);
    }
  });

  /*
   * A CATEGORY MAY ONLY DESCRIBE WHAT THE PRODUCT CAN SEND.
   *
   * "Account and recovery" promised notifications about recovery codes after
   * the application's recovery-code system was removed, on the screen where a
   * person decides what they need to hear about.
   */
  it("describe nothing the product no longer has", () => {
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(category.description).not.toMatch(/recovery code|phone|sms/i);
    }
  });

  it("marks security and account recovery as un-mutable", () => {
    for (const id of PROTECTED) {
      expect(findNotificationCategory(id)?.optional, id).toBe(false);
      expect(isMutable(id), id).toBe(false);
    }
    for (const id of OPTIONAL) expect(isMutable(id), id).toBe(true);
  });

  it("never offers a digest for something whose value is that it is now", () => {
    // "Daily digest of security alerts" is a contradiction.
    for (const id of PROTECTED) {
      expect(findNotificationCategory(id)?.frequencies, id).toEqual(["immediate"]);
    }
  });
});

describe("channels are derived from the deployment, never assumed", () => {
  it("reports in-app as available with nothing configured at all", () => {
    // No provider stands between OCADE and its own screen.
    expect(availableChannels({}).map((channel) => channel.id)).toEqual(["in_app"]);
  });

  it("gives every unavailable channel a reason a person can act on", () => {
    for (const channel of IN_APP_ONLY.filter((entry) => !entry.available)) {
      expect(channel.unavailableReason, channel.id).toBeTruthy();
      // Never the operator's problem: no environment variable names.
      expect(channel.unavailableReason).not.toMatch(/VITE_|process\.env|undefined/);
    }
  });

  it("opens a channel by itself once the deployment is configured", () => {
    expect(availableChannels({ emailSender: "a@b.test" }).map((c) => c.id)).toEqual([
      "in_app",
      "email",
    ]);
    expect(EVERY_CHANNEL.every((channel) => channel.available)).toBe(true);
  });
});

describe("a protected category is delivered whatever the settings say", () => {
  it.each(PROTECTED)("%s survives a global mute", (category) => {
    const decision = decideDelivery({
      category,
      preferences: muted(),
      channels: EVERY_CHANNEL,
    });
    expect(decision.held).toBe(false);
    expect(decision.channels).toContain("in_app");
    expect(decision.recorded).toBe(true);
  });

  it.each(PROTECTED)("%s is not held by quiet hours", (category) => {
    const preferences = defaultPreferences();
    preferences.quietHours = { enabled: true, fromHour: 0, toHour: 24, timeZone: "UTC" };
    const decision = decideDelivery({
      category,
      preferences,
      channels: EVERY_CHANNEL,
      now: new Date("2026-09-03T03:00:00Z"),
    });
    expect(decision.held).toBe(false);
  });

  it("keeps in-app on a protected category even when storage says every channel is off", () => {
    /*
     * The stale-sync case. A preference written by an older build, or edited by
     * hand, must not be able to leave somebody unable to find a security alert
     * when they next open OCADE.
     */
    const normalised = normalisePreferences(
      { categories: { security: { channels: [], frequency: "immediate" } } },
      ["in_app", "email"],
    );
    expect(normalised.categories.security.channels).toContain("in_app");
  });

  it("still records when there is nowhere at all to send", () => {
    const decision = decideDelivery({
      category: "security",
      preferences: { ...defaultPreferences(), categories: {} as never },
      channels: [],
    });
    expect(decision.recorded).toBe(true);
    expect(decision.reason).toMatch(/recorded in OCADE only/i);
  });
});

describe("an optional category obeys the person", () => {
  it.each(OPTIONAL)("%s is silenced by a global mute", (category) => {
    const decision = decideDelivery({ category, preferences: muted(), channels: EVERY_CHANNEL });
    expect(decision.held).toBe(true);
    expect(decision.channels).toEqual([]);
    // Held, not discarded: the record survives so it is there in the Inbox.
    expect(decision.recorded).toBe(true);
  });

  it.each(OPTIONAL)("%s is held during quiet hours", (category) => {
    const preferences = defaultPreferences();
    preferences.quietHours = { enabled: true, fromHour: 22, toHour: 7, timeZone: "UTC" };
    const decision = decideDelivery({
      category,
      preferences,
      channels: EVERY_CHANNEL,
      now: new Date("2026-09-03T23:30:00Z"),
    });
    expect(decision.held).toBe(true);
    expect(decision.reason).toMatch(/quiet hours/i);
  });

  it("sends outside the quiet window", () => {
    const preferences = defaultPreferences();
    preferences.quietHours = { enabled: true, fromHour: 22, toHour: 7, timeZone: "UTC" };
    const decision = decideDelivery({
      category: "product_updates",
      preferences,
      channels: EVERY_CHANNEL,
      now: new Date("2026-09-03T12:00:00Z"),
    });
    expect(decision.held).toBe(false);
  });

  it("never sends on a channel the deployment does not have", () => {
    const preferences = defaultPreferences();
    preferences.categories.product_updates = {
      channels: ["in_app", "email"],
      frequency: "grouped",
    };
    const decision = decideDelivery({
      category: "product_updates",
      preferences,
      channels: IN_APP_ONLY,
    });
    expect(decision.channels).toEqual(["in_app"]);
  });
});

describe("quiet hours are the person's hours, not the device's", () => {
  it("reads the hour in the chosen zone", () => {
    // 23:30 UTC is 05:00 the next morning in Kolkata: inside a 22–07 window in
    // UTC and inside it in Kolkata too, but for a completely different reason.
    const at = new Date("2026-09-03T23:30:00Z");
    expect(hourInZone(at, "UTC")).toBe(23);
    expect(hourInZone(at, "Asia/Kolkata")).toBe(5);
  });

  it("silences the night in the person's zone rather than the laptop's", () => {
    const quiet = { enabled: true, fromHour: 22, toHour: 7, timeZone: "Asia/Kolkata" };
    // 18:00 UTC is 23:30 in Kolkata — night there, afternoon on a UTC laptop.
    expect(inQuietHours(quiet, new Date("2026-09-03T18:00:00Z"))).toBe(true);
    // 07:00 UTC is 12:30 in Kolkata — the middle of their day.
    expect(inQuietHours(quiet, new Date("2026-09-03T07:00:00Z"))).toBe(false);
  });

  it("treats an equal start and end as no quiet hours rather than all day", () => {
    expect(
      inQuietHours({ enabled: true, fromHour: 9, toHour: 9, timeZone: "UTC" }, new Date()),
    ).toBe(false);
  });

  it("falls back to UTC rather than throwing on a zone the runtime forgot", () => {
    expect(() => hourInZone(new Date(), "Mars/Olympus_Mons")).not.toThrow();
  });
});

describe("stored preferences are validated, not trusted", () => {
  it("returns the defaults for junk", () => {
    for (const junk of [null, "nope", 7, []]) {
      expect(normalisePreferences(junk, ["in_app"])).toEqual(defaultPreferences());
    }
  });

  it("drops a channel this deployment does not have", () => {
    const normalised = normalisePreferences(
      { categories: { product_updates: { channels: ["in_app", "email"], frequency: "grouped" } } },
      ["in_app"],
    );
    expect(normalised.categories.product_updates.channels).toEqual(["in_app"]);
  });

  it("falls back to a frequency the category actually supports", () => {
    const normalised = normalisePreferences(
      { categories: { security: { channels: ["in_app"], frequency: "digest" } } },
      ["in_app"],
    );
    expect(normalised.categories.security.frequency).toBe("immediate");
  });

  it("rejects an hour outside the clock rather than clamping into a window nobody chose", () => {
    const normalised = normalisePreferences(
      { quietHours: { enabled: true, fromHour: 99, toHour: -3, timeZone: "UTC" } },
      ["in_app"],
    );
    expect(normalised.quietHours.fromHour).toBe(22);
    expect(normalised.quietHours.toHour).toBe(7);
  });

  it("rejects a time zone the runtime does not know", () => {
    const normalised = normalisePreferences(
      { quietHours: { enabled: true, fromHour: 22, toHour: 7, timeZone: "Nowhere/At_All" } },
      ["in_app"],
    );
    expect(normalised.quietHours.timeZone).toBe("UTC");
  });

  it("ignores a category that does not exist", () => {
    const normalised = normalisePreferences(
      { categories: { made_up: { channels: ["in_app"], frequency: "immediate" } } },
      ["in_app"],
    );
    expect(Object.keys(normalised.categories).sort()).toEqual(
      NOTIFICATION_CATEGORIES.map((category) => category.id).sort(),
    );
  });
});
