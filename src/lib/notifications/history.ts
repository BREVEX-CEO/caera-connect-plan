/**
 * Reading the notification history, and changing the one thing a person may.
 *
 * READS ARE PLAIN SELECTS and row-level security decides what comes back: the
 * policy is `auth.uid() = user_id`, so there is no account filter here to get
 * wrong. WRITES ARE RPCs, because the only permitted change is `read_at` on
 * your own row — a permissive UPDATE policy would also let somebody rewrite the
 * title of a security alert they had just received.
 */

import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { isNotificationCategory, type NotificationCategoryId } from "./categories";
import { parseDeliveryReport, type DeliveryReport } from "./delivery";

export interface NotificationRecord {
  id: string;
  category: NotificationCategoryId;
  title: string;
  body: string;
  deepLink: string | null;
  createdAt: string;
  readAt: string | null;
  delivery: DeliveryReport;
}

export type HistoryOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * HOW MUCH HISTORY ONE SCREEN HOLDS.
 *
 * The table grows for the life of the account, so an unbounded read is a page
 * that works until somebody has been here a year. Fifty is what a person
 * actually reads before deciding they are done; the count below is separate and
 * exact, so "you have 200 unread" stays true beyond the page.
 */
const PAGE_SIZE = 50;

export async function listNotifications(): Promise<HistoryOutcome<NotificationRecord[]>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("ocade_notifications")
      .select("id, category, title, body, deep_link, created_at, read_at, delivery")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) return { ok: false, message: error.message };
    return {
      ok: true,
      value: (data ?? []).map((row) => ({
        id: row.id,
        // A category the client does not know about is shown as `account`
        // rather than dropped: a notification nobody can see is worse than one
        // filed under the wrong heading, and the title still says what it is.
        category: isNotificationCategory(row.category) ? row.category : "account",
        title: row.title,
        body: row.body,
        deepLink: row.deep_link,
        createdAt: row.created_at,
        readAt: row.read_at,
        delivery: parseDeliveryReport(row.delivery),
      })),
    };
  } catch (cause) {
    return { ok: false, message: describe(cause) };
  }
}

export async function markAllNotificationsRead(): Promise<HistoryOutcome<number>> {
  return call("ocade_mark_all_notifications_read", {});
}

async function call(
  name: "ocade_mark_notification_read" | "ocade_mark_all_notifications_read",
  args: Record<string, unknown>,
): Promise<HistoryOutcome<number>> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )(name, args);
    if (error) return { ok: false, message: error.message };
    return { ok: true, value: Number(data ?? 0) };
  } catch (cause) {
    return { ok: false, message: describe(cause) };
  }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The notification history could not be read.";
}
