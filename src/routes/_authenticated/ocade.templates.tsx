import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Templates.

 * `PLAN.md` §4: "templates into Artifacts." Four reusable starting prompts do
 * not need a destination of their own; they are a section beside the outputs
 * they help produce.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/templates")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/artifacts", replace: true });
  },
});
