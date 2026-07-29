import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/government")({
  head: () => ({
    meta: [{ title: "CANIA · Government announcements" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <SectionView sectionId="government" />,
});
