import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the browser vault.
 *
 * The page here set a passphrase, issued a recovery kit and reported whether an
 * encrypted IndexedDB store on this one machine was unlocked. `PLAN.md` Phase 2
 * removed that store: an account holds the account's work, and there is no
 * device key standing between a person and their own conversations.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in the settings index of every
 * build that shipped it, in bookmarks, and in the help articles that told
 * people where to export their data. It goes to the screen that answers what
 * they came for.
 */
export const Route = createFileRoute("/_authenticated/settings/vault")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/data", replace: true });
  },
});
