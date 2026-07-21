import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/traffic")({
  head: () => ({ meta: [{ title: "CANIA · Traffic" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="traffic" />,
});
