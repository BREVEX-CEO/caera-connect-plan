import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Knowledge.

 * `PLAN.md` §4: "knowledge into Settings or Customize. Project files ARE the
 * knowledge a person adds, so it belongs with Projects rather than beside it."
 * The page's one substantive statement — that OCADE keeps no always-on index
 * across every file and conversation — moved to Projects with it.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/knowledge")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/projects", replace: true });
  },
});
