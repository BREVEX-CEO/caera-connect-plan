import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Permissions.

 * `PLAN.md` §4: "permissions into Settings." This page listed capability
 * statuses and linked to the settings that actually change them. The statuses
 * are in Settings › Diagnostics, from the same registry, and the policy editor
 * is here.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/permissions")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/$section", params: { section: "permissions" }, replace: true });
  },
});
