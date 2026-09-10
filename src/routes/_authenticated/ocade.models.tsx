import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the model control centre.

 * `PLAN.md` §4: "Models ... into Settings or Customize." Settings › Local
 * engine already rendered the same two panels this page did, from the same
 * modules, so this was a second address for one screen. It also carried a
 * claim that had gone stale — that nothing you write ever leaves the device —
 * which Phase 5's online intelligence made untrue; the corrected version went
 * to Settings with the rest of it.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/models")({
  beforeLoad: () => {
    throw redirect({
      to: "/settings/$section",
      params: { section: "local-engine" },
      replace: true,
    });
  },
});
