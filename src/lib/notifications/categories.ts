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

export type NotificationCategoryId =
  | "approvals"
  | "task_outcomes"
  | "automation"
  | "security"
  | "account"
  | "billing"
  | "support"
  | "organization"
  | "product_updates"
  | "status_incidents";

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
    id: "approvals",
    title: "Approvals",
    description: "OCADE is waiting for you to allow or refuse something it is about to do.",
    // Optional, but only in the sense that somebody may decide not to be asked
    // on this channel. The approval itself still blocks until answered.
    optional: true,
    frequencies: URGENT_ONLY,
  },
  {
    id: "task_outcomes",
    title: "Task outcomes",
    description: "A long-running task finished, failed, or needs your attention.",
    optional: true,
    frequencies: EVERY_FREQUENCY,
  },
  {
    id: "automation",
    title: "Automations",
    description: "A scheduled or triggered automation ran, or stopped running.",
    optional: true,
    frequencies: EVERY_FREQUENCY,
  },
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
    id: "support",
    title: "Support",
    description: "Replies on your support cases.",
    optional: true,
    frequencies: EVERY_FREQUENCY,
  },
  {
    id: "organization",
    title: "Organization",
    description: "Invitations, role changes and organization policy.",
    optional: true,
    frequencies: EVERY_FREQUENCY,
  },
  {
    id: "product_updates",
    title: "Product updates",
    description: "New capabilities and changes worth knowing about.",
    optional: true,
    frequencies: ["grouped", "digest"],
  },
  {
    id: "status_incidents",
    title: "Status incidents",
    description: "Degraded service and outages that affect you.",
    optional: true,
    frequencies: URGENT_ONLY,
  },
];

const BY_ID = new Map(NOTIFICATION_CATEGORIES.map((category) => [category.id, category]));

/** Is this one of the ten categories §D names? */
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
