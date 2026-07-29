import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/country")({
  head: () => ({
    meta: [{ title: "CANIA · Country news" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <SectionView sectionId="country_news" />,
});
