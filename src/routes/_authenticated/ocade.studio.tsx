import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Studio.

 * `PLAN.md` §4: "Studio, templates, generated outputs, and live outputs into
 * Artifacts." Studio was a directory of nine cards about work that happens in
 * Chat, in Code, or not at all in this build. What was true on it now sits in
 * Artifacts, in two cards and one sentence.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/studio")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/artifacts", replace: true });
  },
});
