import { createFileRoute, Link } from "@tanstack/react-router";
import { Share2, FolderKanban, PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";

export const Route = createFileRoute("/_authenticated/ocade/shared")({
  head: () => ({ meta: [{ title: "Shared — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: SharedPage,
});

function SharedPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Shared"
        description="A truthful boundary for content sharing. This build has no public-share link service, so nothing is published merely because a project or artifact exists."
      />
      <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-medium">Public and external sharing</h2>
          </div>
          <CapabilityBadge status="NOT_CONFIGURED" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No share token, public URL, recipient grant, or anonymous read path is configured. OCADE will not imply that an item was shared when no sharing backend exists.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/ocade/projects" className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30">
          <div className="flex items-center gap-2 text-sm font-medium"><FolderKanban className="h-4 w-4" aria-hidden />Projects</div>
          <p className="mt-1 text-xs text-muted-foreground">Keep work private inside your authenticated workspace.</p>
        </Link>
        <Link to="/ocade/artifacts" className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30">
          <div className="flex items-center gap-2 text-sm font-medium"><PackageOpen className="h-4 w-4" aria-hidden />Artifacts</div>
          <p className="mt-1 text-xs text-muted-foreground">Review generated outputs without creating a public link.</p>
        </Link>
      </div>
    </>
  );
}
