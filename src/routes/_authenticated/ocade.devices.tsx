import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The old address for Devices.

 * `PLAN.md` §4: "devices into Settings." Settings › Devices is the fuller
 * screen: the same approved-device list, plus renaming, revocation and the
 * audit that goes with it.
 *
 * A REDIRECT RATHER THAN A DELETION. This URL is in bookmarks, in messages
 * people sent colleagues, and in the history of the browsers they work in.
 * `beforeLoad` so the old screen never renders at all.
 */
export const Route = createFileRoute("/_authenticated/ocade/devices")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/devices", replace: true });
  },
});
