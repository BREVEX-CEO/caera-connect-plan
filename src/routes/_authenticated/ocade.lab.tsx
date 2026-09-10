import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the Lab.

 * `PLAN.md` §4: "labs into Settings or Customize." Twelve engineering
 * diagnostics do not need a destination of their own; they open from Customize
 * when somebody wants them.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/lab")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/customize", replace: true });
  },
});
