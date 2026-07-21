import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/madee")({
  head: () => ({
    meta: [
      { title: "MADEE — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});
