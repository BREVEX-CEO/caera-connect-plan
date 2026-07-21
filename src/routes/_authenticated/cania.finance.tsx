import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/finance")({
  head: () => ({ meta: [{ title: "CANIA · Finance" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="finance" />,
});
