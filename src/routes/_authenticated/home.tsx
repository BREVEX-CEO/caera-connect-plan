import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/home` is OCADE.
 *
 * This was a tile grid introducing four workspaces. Three of them are now
 * reserved names behind one-sentence placeholders, so the page had become a
 * chooser between the product and three ways of not using it — a step between
 * the user and the thing they came for.
 *
 * Kept as a redirect rather than deleted: `/home` is where onboarding finishes,
 * where the shell's fallback used to land, and wherever existing links point.
 */
export const Route = createFileRoute("/_authenticated/home")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade", replace: true });
  },
});
