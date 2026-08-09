import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/demo` is the OCADE demo, so it goes straight there.
 *
 * This used to be a tile grid: OCADE, Files and Tasks. Files and Tasks were
 * separate top-level products in the demo, which is not what OCADE is — files
 * are a tool inside a conversation, not a place you visit — and with those two
 * gone the page was a single card asking the visitor to click once more before
 * anything happened.
 *
 * A redirect rather than a deleted route: `/demo` is the URL on the landing
 * page, in the marketing copy and in whatever links already exist. Removing it
 * would break all of them to save one file.
 */
export const Route = createFileRoute("/demo/")({
  beforeLoad: () => {
    throw redirect({ to: "/demo/ocade", replace: true });
  },
});
