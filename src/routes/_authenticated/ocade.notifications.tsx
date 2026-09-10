import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the notification history.

 * `PLAN.md` §4: "notifications into Tasks. Preferences remain in Settings,
 * which is a choice." Reading what happened is work; deciding what should
 * happen is a setting. The history, its read state and its per-channel
 * delivery detail all moved intact.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in. A
 * consolidation that answers those with a 404 has not consolidated anything,
 * it has lost them. `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/tasks", replace: true });
  },
});
