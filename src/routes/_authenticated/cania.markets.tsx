import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/markets")({
  head: () => ({ meta: [{ title: "CANIA · Markets" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="markets" />,
});
