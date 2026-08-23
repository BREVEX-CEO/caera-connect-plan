import { createFileRoute } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";
import { ComingLater } from "@/components/shell/ComingLater";

export const Route = createFileRoute("/_authenticated/cania")({
  head: () => ({
    meta: [{ title: "CANIA — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <ComingLater
      name="CANIA"
      icon={Globe2}
      wasGoingToBe="a country and market intelligence board"
    />
  ),
});
