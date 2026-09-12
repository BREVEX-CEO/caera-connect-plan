/**
 * WHAT OCADE CAN NOTIFY SOMEBODY ABOUT, AND WHAT IT MAY NEVER SILENCE.
 *
 * PLAN.md §D lists ten categories and then adds the sentence the whole module
 * is built around:
 *
 *   "Security, billing, legal, emergency-stop, and account-recovery events
 *    remain recorded and are not silently discarded by optional-product mute
 *    settings."
 *
 * That is not a preference rule, it is a safety rule. A person who mutes
 * everything because product announcements were annoying must still be told
 * that somebody signed in from a new country, or that OCADE stopped a run on
 * their machine. Muting those is how a notification system becomes the reason
 * an incident went unnoticed.
 *
 * So "optional" is a PROPERTY OF THE CATEGORY, declared here once, rather than
 * a check each sending path remembers to make. A category that is not optional
 * cannot be muted, cannot be pushed into a digest, and cannot be held by quiet
 * hours — and none of that depends on the caller getting it right.
 */

/*
 * FOUR, BECAUSE THE PRODUCT HAS FOUR THINGS TO SAY.
 *
 * It listed ten while there were Approvals, Tasks, Automations, Support cases,
 * Organizations and a public status page. Six of those cannot emit a
 * notification any more, and a category nothing can send is a row in a settings
 * screen that does nothing when a person changes it. What remains is what the
 * product actually sends today (security) and the three it sends about the
 * account itself.
 */
export type NotificationCategoryId = "security" | "account" | "billing" | "product_updates";

export interface NotificationCategory {
  id: NotificationCategoryId;
  title: string;
  /** What a person misses by turning this off. */
  description: string;
  /**
   * False for the categories §D protects.
   *
   * An optional category can be muted, batched or held. A non-optional one is
   * always recorded and always delivered to the channels that are available.
   */
  optional: boolean;
  /** Frequencies this category genuinely supports. */
  frequencies: readonly NotificationFrequency[];
}

/** How often a category's notifications arrive. */
export type NotificationFrequency = "immediate" | "grouped" | "digest";

/**
 * Only `immediate` for a category that must not wait.
 *
 * A "daily digest of security alerts" is a contradiction: the value of the
 * alert is that it is now. Declaring the supported frequencies per category is
 * what stops a settings screen offering a choice that would be wrong to make.
 */
const URGENT_ONLY: readonly NotificationFrequency[] = ["immediate"];
const EVERY_FREQUENCY: readonly NotificationFrequency[] = ["immediate", "grouped", "digest"];

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  {
    id: "security",
    title: "Security",
    description:
      "New sign-ins, second-factor changes, session revocations and anything OCADE stopped.",
    optional: false,
    frequencies: URGENT_ONLY,
  },
  {
    id: "account",
    title: "Account and recovery",
    description: "Email changes, recovery codes, and anything that affects getting back in.",
    optional: false,
    frequencies: URGENT_ONLY,
  },
  {
    id: "billing",
    title: "Billing",
    description: "Payments, renewals, failures and refunds on your account.",
    optional: false,
    frequencies: URGENT_ONLY,
  },
  {
    id: "product_updates",
    title: "Product updates",
    description: "New capabilities and changes worth knowing about.",
    optional: true,
    frequencies: ["grouped", "digest"],
  },
];

const BY_ID = new Map(NOTIFICATION_CATEGORIES.map((category) => [category.id, category]));

/** Is this one of the four categories the product can send? */
export function isNotificationCategory(value: unknown): value is NotificationCategoryId {
  return (
    typeof value === "string" && NOTIFICATION_CATEGORIES.some((category) => category.id === value)
  );
}

export function findNotificationCategory(
  id: NotificationCategoryId,
): NotificationCategory | undefined {
  return BY_ID.get(id);
}

/**
 * Can this category be muted, batched or held at all?
 *
 * Asked in one place so no sending path can answer it differently.
 */
export function isMutable(id: NotificationCategoryId): boolean {
  return BY_ID.get(id)?.optional === true;
}
