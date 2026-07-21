import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/world")({
  head: () => ({ meta: [{ title: "CANIA · World news" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="world_news" />,
});
