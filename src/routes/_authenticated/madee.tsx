import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ComingLater } from "@/components/shell/ComingLater";

export const Route = createFileRoute("/_authenticated/madee")({
  head: () => ({
    meta: [{ title: "MADEE — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <ComingLater name="MADEE" icon={Sparkles} wasGoingToBe="a document and resume builder" />
  ),
});
