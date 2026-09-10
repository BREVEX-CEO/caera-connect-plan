import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Activity.

 * `PLAN.md` §4: "activity into Settings." Settings › Activity is the fuller
 * record: the same operational rows, plus the compliance log and the actions a
 * person can take from it.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/activity")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/activity", replace: true });
  },
});
