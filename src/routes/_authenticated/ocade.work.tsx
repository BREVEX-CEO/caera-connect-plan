import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Cowork.
 *
 * PLAN.md §4: "Migrate /ocade/work to Cowork." The room moved to
 * `/ocade/cowork`; this is the forwarding address, and it exists rather than
 * being deleted because people have this URL — in a bookmark, in a message they
 * sent a colleague, in the history of a browser they use for work. A migration
 * that answers those with a 404 has not migrated anything, it has lost them.
 *
 * A REDIRECT IN `beforeLoad`, NOT A COMPONENT THAT NAVIGATES. Redirecting from
 * an effect means the old page renders first — a frame of Cowork's chrome
 * appearing and vanishing — and it means a crawler, a screen reader and a
 * prefetch all see the wrong route. `beforeLoad` never renders this at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/work")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/cowork", replace: true });
  },
});
