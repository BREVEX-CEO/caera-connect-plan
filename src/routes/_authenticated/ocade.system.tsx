import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Customize.
 *
 * PLAN.md §4: "Models, devices, permissions, connectors, health, system,
 * activity, knowledge, and labs into Settings or Customize." System WAS the
 * directory of all of those, so it became Customize rather than being folded
 * into something else and losing the list.
 *
 * The forwarding address stays because this is the URL in the rail's "More"
 * link for anybody whose browser cached the old page, and in the history of
 * everybody who used it. `beforeLoad` so the old screen never renders.
 */
export const Route = createFileRoute("/_authenticated/ocade/system")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/customize", replace: true });
  },
});
