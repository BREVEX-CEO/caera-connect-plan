/**
 * THE ONLY THING IN OCADE THAT MAY WRITE A NOTIFICATION.
 *
 * `ocade_record_notification` is granted to `service_role` alone, and every
 * table write is refused for `authenticated`, so a browser cannot write itself
 * a security alert. PLAN.md §D calls this "server-side audience authorization
 * immediately before send", and it means something specific: the audience is
 * decided HERE, from the account the server already verified, and never from a
 * parameter a caller supplied alongside a message.
 *
 * WHAT THIS DOES AND DOES NOT PROMISE. In-app delivery is the row existing —
 * there is no provider between OCADE and the screen, so "sent" is true by
 * construction. Every other channel is reported by what the deployment actually
 * has: `unavailable` when nothing is configured, `held` when the person's
 * preferences say not now. Nothing here calls a push provider, because there is
 * none configured, and pretending otherwise is the exact failure §D names.
 *
 * IDEMPOTENCY IS THE CALLER'S JOB AND THE DATABASE'S GUARANTEE. The key
 * describes the EVENT — "session-revoked:<session id>", not a timestamp — so a
 * retried request records one notification. The unique constraint makes that
 * true even for two requests in flight at once, which a read-then-write cannot.
 */

import type { Json } from "@/integrations/supabase/types";
import { sqlNullable } from "@/lib/supabase/rpc-null";
import {
  deploymentChannelConfiguration,
  resolveChannels,
  type NotificationChannel,
} from "./channels";
import type { NotificationCategoryId } from "./categories";
import { deliveryReport, type DeliveryReport } from "./delivery";
import { decideDelivery, defaultPreferences, normalisePreferences } from "./preferences";

export interface NotificationToSend {
  /** The account this is about. Never taken from a request body. */
  userId: string;
  category: NotificationCategoryId;
  title: string;
  body?: string;
  /**
   * A same-origin path, or nothing. The database refuses anything else — an
   * absolute URL and a protocol-relative one both — so this cannot become an
   * open redirect even if a future caller forgets.
   */
  deepLink?: string | null;
  /** Describes the EVENT, so a retry records one notification. */
  idempotencyKey: string;
}

export interface SendOutcome {
  /** The notification's id, whether this call created it or found it. */
  id: string | null;
  delivery: DeliveryReport;
  /** Why it was held, when it was. Empty when it went out. */
  heldReason: string;
}

/**
 * Record one notification for one account.
 *
 * NEVER THROWS INTO THE CALLER'S WORK. Every caller is a server function doing
 * something else — revoking a session, issuing recovery codes — and that work
 * has already happened by the time this runs. A notification that could not be
 * written must not turn a completed action into a failure the person then
 * retries: they would revoke the session twice and be told it failed both
 * times. The outcome says what happened instead.
 */
export async function sendNotification(input: NotificationToSend): Promise<SendOutcome> {
  const channels = resolveChannels(deploymentChannelConfiguration());
  try {
    const preferences = await readPreferences(input.userId, channels);
    const decision = decideDelivery({
      category: input.category,
      preferences,
      channels,
    });
    const delivery = deliveryReport(decision, channels);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("ocade_record_notification", {
      p_user_id: input.userId,
      p_category: input.category,
      p_title: input.title,
      p_body: input.body ?? "",
      p_deep_link: sqlNullable(input.deepLink),
      p_idempotency_key: input.idempotencyKey,
      p_delivery: delivery as unknown as Json,
    });
    if (error) return { id: null, delivery, heldReason: error.message };
    return {
      id: (data as string | null) ?? null,
      delivery,
      heldReason: decision.held ? decision.reason : "",
    };
  } catch (cause) {
    return {
      id: null,
      delivery: unavailableEverywhere(channels),
      heldReason: cause instanceof Error ? cause.message : "The notification could not be written.",
    };
  }
}

/**
 * The account's preferences, or the defaults.
 *
 * A person who has never opened the settings has no row, and that is not an
 * error — it is the ordinary case, and the defaults are what §D says they
 * should get. A read that FAILED also falls back to the defaults rather than
 * dropping the notification: a security alert withheld because a preference
 * lookup timed out is the worst possible trade.
 */
async function readPreferences(userId: string, channels: readonly NotificationChannel[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const availableIds = channels.filter((channel) => channel.available).map((channel) => channel.id);
  const { data } = await supabaseAdmin
    .from("ocade_notification_preferences")
    .select("mute_optional, quiet_hours, categories")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return defaultPreferences();
  return normalisePreferences(
    {
      muteOptional: data.mute_optional,
      quietHours: data.quiet_hours,
      categories: data.categories,
    },
    availableIds,
  );
}

function unavailableEverywhere(channels: readonly NotificationChannel[]): DeliveryReport {
  const report: DeliveryReport = {};
  for (const channel of channels) report[channel.id] = "unavailable";
  return report;
}
