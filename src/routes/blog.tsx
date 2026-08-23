import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "OCADE journal — CARCC CADANE" },
      {
        name: "description",
        content: "Official OCADE product and engineering notes from CARCC CADANE.",
      },
    ],
  }),
  component: BlogLayout,
});

function BlogLayout() {
  return <Outlet />;
}
