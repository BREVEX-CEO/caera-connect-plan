import { createFileRoute } from "@tanstack/react-router";
import { CaniaLayout } from "@/components/cania/CaniaLayout";

export const Route = createFileRoute("/_authenticated/cania")({
  head: () => ({
    meta: [
      { title: "CANIA — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaniaLayout,
});
