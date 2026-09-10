import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Shared.

 * `PLAN.md` §4: "live outputs into Artifacts." The page also said this build
 * has no share-link service, which stopped being true when Chat gained
 * revocable, expiring conversation links — so the section that replaced it
 * states the boundary as it actually stands rather than as it once did.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/shared")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade/artifacts", replace: true });
  },
});
