import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ficia")({
  head: () => ({
    meta: [{ title: "FICIA — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <Outlet />,
});
