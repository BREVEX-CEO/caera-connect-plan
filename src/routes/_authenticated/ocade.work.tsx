import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ocade/work")({
  beforeLoad: () => {
    throw redirect({ to: "/ocade", replace: true });
  },
});
