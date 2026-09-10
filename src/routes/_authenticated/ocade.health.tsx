import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Health.

 * `PLAN.md` §4: "health into Settings." "What can this actually do right now?"
 * and "why did it do that?" are the same question asked twice, so capability
 * health now sits in Settings › Diagnostics beside the routing receipt and the
 * error journal.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/health")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/$section", params: { section: "diagnostics" }, replace: true });
  },
});
