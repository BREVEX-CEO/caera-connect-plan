import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Inbox,
  Loader2,
  Settings,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";
import { useSession } from "@/lib/session";
import { deploymentChannelConfiguration, resolveChannels } from "@/lib/notifications/channels";
import { findNotificationCategory } from "@/lib/notifications/categories";
import { describeDelivery, hasDeadLetter } from "@/lib/notifications/delivery";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
} from "@/lib/notifications/history";

export const Route = createFileRoute("/_authenticated/ocade/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: NotificationsPage,
});

/**
 * THE NOTIFICATION HISTORY — PLAN.md §D.
 *
 * The tables, the idempotent recorder and the two mark-read functions existed
 * and were proven against real PostgreSQL, and nothing read them. A history
 * nobody can open is a table, not a feature, and it was recorded as a gap
 * (NOTIFY-003) rather than counted as done.
 *
 * WHAT IS SHOWN AND WHY EACH PART IS THERE:
 *
 *   The list, newest first, with unread state — §D's "notification history" and
 *   "read/unread state".
 *   Mark one read, and mark all read — both §D, both through the two functions
 *   that change `read_at` and nothing else.
 *   PER-CHANNEL DELIVERY STATE, which is the part a product usually skips. §D
 *   asks for it, and the reason is the question it answers: "why didn't I get
 *   an email?" is unanswerable from a list of titles. `unavailable` and
 *   `dead_letter` are shown as different things, because one means "we never
 *   promised this" and the other means "we promised and could not".
 *
 * WHAT IS STILL NOT CLAIMED. No push channel is configured on this deployment,
 * so the panel below says so instead of offering a switch that does nothing.
 * §D: "Never claim push works because an abstraction exists."
 */
function NotificationsPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showRead, setShowRead] = useState(true);

  const channels = useMemo(() => resolveChannels(deploymentChannelConfiguration()), []);
  const pushChannels = channels.filter((channel) => channel.id !== "in_app");
  const anyPush = pushChannels.some((channel) => channel.available);

  const history = useQuery({
    queryKey: ["notifications", "history", user?.id],
    enabled: Boolean(user?.id),
    queryFn: listNotifications,
  });

  const records = history.data?.ok ? history.data.value : [];
  const unread = records.filter((record) => !record.readAt);
  const shown = showRead ? records : unread;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markOne = async (record: NotificationRecord) => {
    setBusy(record.id);
    setProblem(null);
    const result = await markNotificationRead(record.id);
    setBusy(null);
    if (!result.ok) setProblem(result.message);
    else await refresh();
  };

  const markEverything = async () => {
    setBusy("all");
    setProblem(null);
    const result = await markAllNotificationsRead();
    setBusy(null);
    if (!result.ok) setProblem(result.message);
    else await refresh();
  };

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Notifications"
        description="What OCADE has told this account, when, and where each one actually went."
        actions={
          unread.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "all"}
              onClick={() => void markEverything()}
            >
              {busy === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck aria-hidden="true" />
              )}
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {problem ? (
        <GlassPanel className="mt-4 p-4" role="alert">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        </GlassPanel>
      ) : null}

      <GlassPanel className="mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            History
            {unread.length > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                {unread.length} unread
              </span>
            ) : null}
          </h2>
          {records.length > unread.length ? (
            <Button size="sm" variant="ghost" onClick={() => setShowRead((value) => !value)}>
              {showRead ? "Show unread only" : "Show everything"}
            </Button>
          ) : null}
        </div>

        {history.isLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading your notifications…
          </p>
        ) : null}

        {history.data && !history.data.ok ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {history.data.message}
          </p>
        ) : null}

        {history.data?.ok && shown.length === 0 ? (
          /*
           * An empty history is a true statement about this account, not a
           * failure — and it says which, so nobody reads a working page as a
           * broken one.
           */
          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {records.length === 0
              ? "Nothing yet. OCADE records security, account and organization events here as they happen."
              : "Everything here has been read."}
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-border">
          {shown.map((record) => {
            const category = findNotificationCategory(record.category);
            const unreadRow = !record.readAt;
            return (
              <li key={record.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {unreadRow ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      ) : null}
                      {record.title}
                    </p>
                    {record.body ? (
                      <p className="mt-1 text-sm text-muted-foreground">{record.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category?.title ?? record.category} ·{" "}
                      <time dateTime={record.createdAt}>
                        {new Date(record.createdAt).toLocaleString()}
                      </time>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.deepLink ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={record.deepLink}>Open</Link>
                      </Button>
                    ) : null}
                    {unreadRow ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === record.id}
                        onClick={() => void markOne(record)}
                      >
                        {busy === record.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check aria-hidden="true" />
                        )}
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/*
                  WHERE IT WENT, PER CHANNEL. The list is short and it is the
                  answer to the question a person actually has when a
                  notification surprises them.
                */}
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {channels.map((channel) => {
                    const state = record.delivery[channel.id];
                    if (!state) return null;
                    return (
                      <li
                        key={channel.id}
                        className={
                          state === "dead_letter" || state === "failed"
                            ? "text-xs text-[color:var(--state-warning)]"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {describeDelivery(channel, state)}
                      </li>
                    );
                  })}
                </ul>
                {hasDeadLetter(record.delivery) ? (
                  <p className="mt-1 text-xs text-[color:var(--state-warning)]">
                    OCADE has stopped retrying that channel. This notification is still here, and
                    nothing about it was lost.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-medium">Background push notifications</h2>
          </div>
          <CapabilityBadge status={anyPush ? "READY" : "NOT_CONFIGURED"} />
        </div>
        {anyPush ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Configured on this deployment:{" "}
            {pushChannels
              .filter((channel) => channel.available)
              .map((channel) => channel.title)
              .join(", ")}
            .
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              No web-push, APNs, FCM or email channel is configured by this build, so OCADE does not
              promise an alert outside the open application. Everything above is recorded here
              whatever the delivery state says.
            </p>
            <ul className="mt-2 space-y-1">
              {pushChannels.map((channel) => (
                <li key={channel.id} className="text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">{channel.title}</strong> —{" "}
                  {channel.unavailableReason ?? "not configured."}
                </li>
              ))}
            </ul>
          </>
        )}
      </GlassPanel>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          to="/ocade/inbox"
          className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Inbox className="h-4 w-4" aria-hidden="true" />
            Inbox
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Approvals, blocked work and terminal automation outcomes, read from real run records.
          </p>
        </Link>
        <Link
          to="/settings/privacy"
          className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Notification preferences
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Which kinds reach you, on which channels, and when OCADE holds them.
          </p>
        </Link>
      </div>
    </>
  );
}
