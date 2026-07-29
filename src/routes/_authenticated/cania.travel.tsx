import { createFileRoute } from "@tanstack/react-router";
import { SectionView } from "@/components/cania/SectionView";
export const Route = createFileRoute("/_authenticated/cania/travel")({
  head: () => ({
    meta: [{ title: "CANIA · Travel warnings" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <SectionView sectionId="travel_warnings" />,
});
