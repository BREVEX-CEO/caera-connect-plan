import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ficia")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade", replace: true });
  },
});
