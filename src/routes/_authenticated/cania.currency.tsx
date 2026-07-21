import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/currency")({
  head: () => ({ meta: [{ title: "CANIA · Currency" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="currency" />,
});
