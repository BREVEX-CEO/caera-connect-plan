import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Monitors.

 * `PLAN.md` §4: "monitors into Tasks." Defining something to watch is
 * scheduling work, and it belongs beside the rest of it. The section that
 * replaced this page keeps the old page's honesty intact: saving a monitor
 * stores a definition, and no runner is polling it.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in. A
 * consolidation that answers those with a 404 has not consolidated anything,
 * it has lost them. `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/monitors")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/tasks", replace: true });
  },
});
