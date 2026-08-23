import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DemoProvider } from "@/lib/demo/context";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo — CARCC CADANE" },
      {
        name: "description",
        content:
          "Try OCADE for 28 minutes without an account. Demo conversations stay temporary and the on-device engine can be prepared for later offline use.",
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
