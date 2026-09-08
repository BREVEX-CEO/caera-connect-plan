/**
 * WHAT A PERSON CHOSE TO BE TOLD, AND THE CHOICES OCADE REFUSES TO HONOUR.
 *
 * PLAN.md §D asks for per-category channel selection, frequency, a global mute
 * for optional notifications, and quiet hours with a timezone. It then makes
 * one of those subject to a rule that overrides the person's own setting:
 * security, account-recovery and billing events "remain recorded and are not
 * silently discarded by optional-product mute settings".
 *
 * THAT RULE IS ENFORCED IN THE RESOLVER, NOT IN THE UI. A settings screen that
 * simply does not offer the toggle is a good screen and a bad guarantee: the
 * preference can arrive from a stale device, a synced record written by an
 * older build, or somebody editing local storage. `decideDelivery` is the only
 * place that answers "does this go?", and it answers it from the category's own
 * declaration every time.
 *
 * QUIET HOURS ARE EVALUATED IN THE PERSON'S ZONE, NOT THE DEVICE'S. Somebody
 * who sets 22:00–07:00 in Asia/Kolkata and opens OCADE on a laptop still set to
 * UTC means 22:00 in Kolkata. Reading the device clock would silence the
 * afternoon and shout through the night, on exactly the device somebody travels
 * with.
 */

import {
  findNotificationCategory,
  isMutable,
  NOTIFICATION_CATEGORIES,
  type NotificationCategoryId,
  type NotificationFrequency,
} from "./categories";
import type { NotificationChannel, NotificationChannelId } from "./channels";

export interface QuietHoursPreference {
  enabled: boolean;
  /** 0–23, inclusive. */
  fromHour: number;
  /** 0–23, exclusive. Wraps past midnight when it is less than `fromHour`. */
  toHour: number;
  /** An IANA zone, e.g. "Asia/Kolkata". */
  timeZone: string;
}

export interface CategoryPreference {
  channels: NotificationChannelId[];
  frequency: NotificationFrequency;
}

export interface NotificationPreferences {
  /** Silences every OPTIONAL category. Never the protected ones. */
  muteOptional: boolean;
  quietHours: QuietHoursPreference;
  categories: Record<NotificationCategoryId, CategoryPreference>;
}

export const DEFAULT_QUIET_HOURS: QuietHoursPreference = {
  enabled: false,
  fromHour: 22,
  toHour: 7,
  timeZone: "UTC",
};

/**
 * The starting point: in-app for everything, immediate where that is the only
 * honest choice, and nothing muted.
 *
 * In-app rather than "every available channel", because turning a person's
 * phone on for them is not a default anybody asked for.
 */
export function defaultPreferences(): NotificationPreferences {
  const categories = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category.id,
      {
        channels: ["in_app"] as NotificationChannelId[],
        frequency: category.frequencies[0],
      },
    ]),
  ) as Record<NotificationCategoryId, CategoryPreference>;
  return { muteOptional: false, quietHours: { ...DEFAULT_QUIET_HOURS }, categories };
}

/**
 * Bring a stored preference back into something the product can act on.
 *
 * VALIDATES RATHER THAN TRUSTS, for the same reason the resolver re-checks the
 * mute rule: this arrives from storage, and storage is writable. An unknown
 * category is dropped, an unsupported frequency falls back to the category's
 * first supported one, an unavailable channel is removed, and an hour outside
 * 0–23 reverts to the default rather than being clamped into a window nobody
 * chose.
 */
export function normalisePreferences(
  stored: unknown,
  availableChannelIds: readonly NotificationChannelId[],
): NotificationPreferences {
  const base = defaultPreferences();
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return base;
  const input = stored as Partial<NotificationPreferences>;

  const quiet = input.quietHours;
  const quietHours: QuietHoursPreference =
    quiet && typeof quiet === "object"
      ? {
          enabled: quiet.enabled === true,
          fromHour: validHour(quiet.fromHour, DEFAULT_QUIET_HOURS.fromHour),
          toHour: validHour(quiet.toHour, DEFAULT_QUIET_HOURS.toHour),
          timeZone: validTimeZone(quiet.timeZone),
        }
      : { ...DEFAULT_QUIET_HOURS };

  const categories = { ...base.categories };
  const storedCategories = input.categories;
  if (storedCategories && typeof storedCategories === "object") {
    for (const category of NOTIFICATION_CATEGORIES) {
      const entry = (storedCategories as Record<string, unknown>)[category.id];
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as Partial<CategoryPreference>;
      const channels = Array.isArray(candidate.channels)
        ? candidate.channels.filter(
            (channel): channel is NotificationChannelId =>
              typeof channel === "string" &&
              (availableChannelIds as readonly string[]).includes(channel),
          )
        : base.categories[category.id].channels;
      const frequency =
        typeof candidate.frequency === "string" &&
        (category.frequencies as readonly string[]).includes(candidate.frequency)
          ? (candidate.frequency as NotificationFrequency)
          : category.frequencies[0];
      /*
       * A protected category always keeps in-app. Somebody who removed every
       * channel from "security" — deliberately or through a stale sync — must
       * still be able to find the alert when they next open OCADE.
       */
      const withFloor: NotificationChannelId[] =
        category.optional || channels.includes("in_app") ? channels : ["in_app", ...channels];
      categories[category.id] = { channels: [...new Set(withFloor)], frequency };
    }
  }

  return { muteOptional: input.muteOptional === true, quietHours, categories };
}

function validHour(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : fallback;
}

/**
 * A time zone the runtime actually knows.
 *
 * An unknown zone makes `Intl.DateTimeFormat` throw, and a quiet-hours check
 * that throws is a notification that never sends — so it is checked once, here,
 * rather than discovered at delivery time.
 */
function validTimeZone(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_QUIET_HOURS.timeZone;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_QUIET_HOURS.timeZone;
  }
}

/** The hour of day at `now`, in the given zone. */
export function hourInZone(now: Date, timeZone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone,
    }).format(now);
    const hour = Number.parseInt(formatted, 10);
    return Number.isFinite(hour) ? hour % 24 : now.getUTCHours();
  } catch {
    // A zone that was valid when it was stored and is not now: better to use
    // UTC than to suppress or send everything.
    return now.getUTCHours();
  }
}

/** Is the clock inside the quiet window, in the person's own zone? */
export function inQuietHours(quiet: QuietHoursPreference, now: Date): boolean {
  if (!quiet.enabled) return false;
  if (quiet.fromHour === quiet.toHour) return false;
  const hour = hourInZone(now, quiet.timeZone);
  return quiet.fromHour < quiet.toHour
    ? hour >= quiet.fromHour && hour < quiet.toHour
    : hour >= quiet.fromHour || hour < quiet.toHour;
}

export interface DeliveryDecision {
  /** Channels this notification should be sent on, now. */
  channels: NotificationChannelId[];
  /** True when it is recorded but held rather than sent. */
  held: boolean;
  /** Why, in words, for a delivery log and for the person. */
  reason: string;
  /**
   * Always true. §D: protected events "remain RECORDED" whatever the settings
   * say, so a decision never suppresses the record — only the sending.
   */
  recorded: true;
}

/**
 * Decide where one notification goes.
 *
 * THE ONE PLACE THE PROTECTION RULE IS APPLIED. Mute and quiet hours are read
 * from the preference; whether they may apply at all is read from the category.
 */
export function decideDelivery(input: {
  category: NotificationCategoryId;
  preferences: NotificationPreferences;
  channels: readonly NotificationChannel[];
  now?: Date;
}): DeliveryDecision {
  const category = findNotificationCategory(input.category);
  if (!category) {
    return { channels: [], held: true, reason: "Unknown notification category.", recorded: true };
  }

  const availableIds = new Set(
    input.channels.filter((channel) => channel.available).map((channel) => channel.id),
  );
  const chosen = (input.preferences.categories[category.id]?.channels ?? ["in_app"]).filter(
    (channel) => availableIds.has(channel),
  );

  const mutable = isMutable(category.id);

  if (mutable && input.preferences.muteOptional) {
    return {
      channels: [],
      held: true,
      reason: "Optional notifications are muted, and this one is optional.",
      recorded: true,
    };
  }

  if (mutable && inQuietHours(input.preferences.quietHours, input.now ?? new Date())) {
    return {
      channels: [],
      held: true,
      reason: "Held until quiet hours end.",
      recorded: true,
    };
  }

  if (chosen.length === 0) {
    return {
      channels: [],
      held: true,
      reason: mutable
        ? "No channel is enabled for this category on this deployment."
        : "No channel is available for this deployment, so it is recorded in OCADE only.",
      recorded: true,
    };
  }

  return {
    channels: chosen,
    held: false,
    reason: mutable ? "Sent." : "Sent; this category cannot be muted or held.",
    recorded: true,
  };
}
