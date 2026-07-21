import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/weather")({
  head: () => ({ meta: [{ title: "CANIA · Weather" }, { name: "robots", content: "noindex" }] }),
  component: () => <SectionView sectionId="weather" />,
});
