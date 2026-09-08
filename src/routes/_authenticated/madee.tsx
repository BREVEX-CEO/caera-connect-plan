import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/madee")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade", replace: true });
  },
});
