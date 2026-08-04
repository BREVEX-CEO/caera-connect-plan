import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/commodities")({
  head: () => ({
    meta: [{ title: "CANIA · Oil & commodities" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <SectionView sectionId="commodities" />,
});
