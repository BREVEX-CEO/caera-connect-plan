import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { countUnreadNotifications } from "@/lib/notifications/history";

/**
 * THE BELL, POINTING AT SOMETHING THAT EXISTS.
 *
 * It used to link to `/settings/activity` — the account's audit trail, which is
 * a record of what was DONE, not of what OCADE TOLD you. They are different
 * questions, and the second one had no answer until the notification history
 * was built, so the bell was aimed at the nearest thing available.
 *
 * THE COUNT IS COUNTED BY THE DATABASE, not by fetching the history and
 * measuring it. `head: true` with an exact count reads no rows and uses the
 * partial index built for exactly this, so a badge on every screen costs a
 * count rather than a scan that grows for the life of the account.
 *
 * A FAILED COUNT SHOWS NO BADGE, and that is deliberate: the alternative is a
 * bell that displays an error, or worse a zero that looks like "nothing new"
 * when the truth is "OCADE could not ask". Nothing is the honest rendering of
 * an unanswered question, and the page behind it says what went wrong.
 */
export function NotificationBell({ signedIn }: { signedIn: boolean }) {
  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    enabled: signedIn,
    queryFn: countUnreadNotifications,
    // A badge that refetched constantly would be a request per page view for a
    // number that changes rarely; a minute is short enough that somebody who
    // just received one sees it, and long enough not to be noise.
    staleTime: 60_000,
  });

  const count = unread.data?.ok ? unread.data.value : 0;

  return (
    <Link
      to="/ocade/tasks"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-md",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Bell className="h-4 w-4" aria-hidden="true" />
      {count > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-primary-foreground"
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
