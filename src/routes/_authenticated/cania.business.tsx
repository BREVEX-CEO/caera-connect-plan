import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/business")({
  head: () => ({ meta: [{ title: "CANIA · Business" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="business" />,
});
