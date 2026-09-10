import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Connectors.

 * `PLAN.md` §4: "connectors into Settings." The page was a read-only view of
 * three capability rows; Settings › Connectors owns what a person can actually
 * change.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/connectors")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/$section", params: { section: "connectors" }, replace: true });
  },
});
