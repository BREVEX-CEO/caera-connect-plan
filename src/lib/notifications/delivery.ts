/**
 * WHAT "DELIVERED" MEANS, PER CHANNEL, IN WORDS THE PRODUCT CAN DEFEND.
 *
 * PLAN.md §D asks for delivery state, retry and dead-letter handling, and it is
 * blunt about the failure mode: "Never claim push works because an abstraction
 * exists." So there is no state here that means "probably arrived". Every one of
 * the five says something the deployment can actually establish:
 *
 *   sent          the channel accepted it. For in-app that is the row existing,
 *                 which is the whole delivery — there is no provider between
 *                 OCADE and the screen.
 *   held          deliberately not sent yet: muted, or inside quiet hours. It is
 *                 RECORDED either way; §D requires that, and the decision
 *                 authority never suppresses the record.
 *   unavailable   this deployment has no provider for that channel. Not a
 *                 failure — a capability that was never configured, and saying
 *                 "failed" would blame the wrong thing.
 *   failed        a provider was asked and refused, with attempts remaining.
 *   dead_letter   a provider was asked, refused, and the attempts are spent.
 *                 The notification stays in the history; what died is the
 *                 delivery, not the record.
 *
 * The distinction that matters most is `unavailable` against `dead_letter`. One
 * is "we never promised this" and the other is "we promised and could not", and
 * a person reading their history deserves to be told which.
 */

import type { NotificationChannel, NotificationChannelId } from "./channels";
import type { DeliveryDecision } from "./preferences";

const DELIVERY_STATES = ["sent", "held", "unavailable", "failed", "dead_letter"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

/** The per-channel map stored in `ocade_notifications.delivery`. */
export type DeliveryReport = Partial<Record<NotificationChannelId, DeliveryState>>;

/**
 * How many times a channel is asked before its delivery is dead-lettered.
 *
 * Three, and the reason it is not larger: a provider that has refused three
 * times in a row is not having a moment, and a queue that keeps retrying a
 * permanently rejected token spends the account's send budget on a device that
 * no longer exists. §D asks for expired-token cleanup for the same reason.
 */
export const DELIVERY_ATTEMPTS = 3;

export function isDeliveryState(value: unknown): value is DeliveryState {
  return typeof value === "string" && (DELIVERY_STATES as readonly string[]).includes(value);
}

/**
 * The delivery map for a notification, from the decision and what exists.
 *
 * EVERY CHANNEL THE DEPLOYMENT KNOWS ABOUT APPEARS, including the ones that did
 * not get it. A map holding only the channels that succeeded cannot answer "why
 * didn't I get an email?", which is the question a delivery state exists to
 * answer.
 */
export function deliveryReport(
  decision: DeliveryDecision,
  channels: readonly NotificationChannel[],
): DeliveryReport {
  const report: DeliveryReport = {};
  const chosen = new Set(decision.channels);
  for (const channel of channels) {
    if (!channel.available) {
      report[channel.id] = "unavailable";
      continue;
    }
    report[channel.id] = chosen.has(channel.id) ? "sent" : "held";
  }
  return report;
}

/**
 * The state after one more refusal from a provider.
 *
 * Attempts are counted by the caller because they belong to the queue, not to
 * the record; what this decides is only the word.
 */
export function afterFailedAttempt(attempt: number): DeliveryState {
  return attempt >= DELIVERY_ATTEMPTS ? "dead_letter" : "failed";
}

/** Read a stored `delivery` column back, discarding anything unrecognised. */
export function parseDeliveryReport(value: unknown): DeliveryReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const report: DeliveryReport = {};
  for (const [channel, state] of Object.entries(value as Record<string, unknown>)) {
    if (isDeliveryState(state)) report[channel as NotificationChannelId] = state;
  }
  return report;
}

/**
 * What to tell somebody about one channel, in a sentence.
 *
 * Written here rather than in the screen so the history and any future digest
 * say the same thing, and so the wording is testable.
 */
export function describeDelivery(channel: NotificationChannel, state: DeliveryState): string {
  switch (state) {
    case "sent":
      return `Sent to ${channel.title.toLowerCase()}.`;
    case "held":
      return `Held for ${channel.title.toLowerCase()} — muted, in quiet hours, or not enabled for this kind.`;
    case "unavailable":
      return `${channel.title} is not configured on this deployment, so nothing was promised there.`;
    case "failed":
      return `${channel.title} refused it. OCADE will try again.`;
    case "dead_letter":
      return `${channel.title} refused it every time. OCADE has stopped trying; the notification is still here.`;
  }
}

/** True when any channel's delivery has been given up on. */
export function hasDeadLetter(report: DeliveryReport): boolean {
  return Object.values(report).some((state) => state === "dead_letter");
}
