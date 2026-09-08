import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cania")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade", replace: true });
  },
});
