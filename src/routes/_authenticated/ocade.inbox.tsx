import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the Inbox.

 * `PLAN.md` §4: "inbox into Tasks." This page read the same automations and
 * runs the Tasks screen reads, from a second query, on a second screen — so
 * "what is waiting for me" and "what is running" could disagree, and a person
 * had to visit both to know where their work stood.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in. A
 * consolidation that answers those with a 404 has not consolidated anything,
 * it has lost them. `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/inbox")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/tasks", replace: true });
  },
});
