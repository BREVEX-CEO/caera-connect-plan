import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the automation builder.

 * `PLAN.md` §4: "Automations, monitors, inbox, notifications, and schedules
 * into Tasks." The builder now opens inside `/ocade/tasks`, behind that
 * screen's primary action, so a person has one destination for the work OCADE
 * does for them rather than five.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in. A
 * consolidation that answers those with a 404 has not consolidated anything,
 * it has lost them. `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/automations")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/tasks", replace: true });
  },
});
