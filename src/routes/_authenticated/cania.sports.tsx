import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/sports")({
  head: () => ({ meta: [{ title: "CANIA · Sports" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="sports" />,
});
