import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { ComingLater } from "@/components/shell/ComingLater";

export const Route = createFileRoute("/_authenticated/ficia")({
  head: () => ({
    meta: [{ title: "FICIA — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <ComingLater name="FICIA" icon={Building2} wasGoingToBe="a workforce and company directory" />
  ),
});
