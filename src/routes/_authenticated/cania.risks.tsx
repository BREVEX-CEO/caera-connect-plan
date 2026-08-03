import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/risks")({
  head: () => ({
    meta: [{ title: "CANIA · Business risks" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <SectionView sectionId="business_risks" />,
});
