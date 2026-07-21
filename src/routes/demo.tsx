import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DemoProvider } from "@/lib/demo/context";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo — CAERA CADANE" },
      {
        name: "description",
        content:
          "Explore CAERA CADANE with sample data — no sign-in required. Nothing you do here writes to real accounts.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <DemoProvider>
      <Outlet />
    </DemoProvider>
  );
}
