import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/technology")({
  head: () => ({ meta: [{ title: "CANIA · Technology" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="technology" />,
});
