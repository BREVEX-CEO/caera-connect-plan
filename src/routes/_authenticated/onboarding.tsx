import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for the setup wizard.
 *
 * `PLAN.md` and `docs/APP_FLOW.md` both state it plainly: there is no
 * onboarding wizard. What stood here was five screens between a person and the
 * product — a display name, an account type, a storage-mode choice, a module
 * list holding one module, and a review of the four. Every one of those is a
 * setting, and every one of them is in Settings, where it can be changed rather
 * than only chosen once.
 *
 * The storage-mode step is the reason it could not simply be shortened. It
 * asked somebody to decide where their chats live before they had written one,
 * and `PLAN.md` §2 makes Supabase the single persistent authority for that
 * data, so the question no longer has two answers to choose between.
 *
 * A REDIRECT, NOT A DELETION. This URL is in the history of every account that
 * signed up before now, and in whatever the verification email of that era
 * linked to. Answering those with a 404 loses them for no gain.
 */
export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade", replace: true });
  },
});
