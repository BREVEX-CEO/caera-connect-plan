import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Files, FolderKanban, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";

export const Route = createFileRoute("/_authenticated/ocade/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: KnowledgePage,
});

function KnowledgePage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Knowledge"
        description="Your durable workspace context, without pretending a global retrieval index exists when it does not."
      />
      <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-medium">Global knowledge index</h2>
          </div>
          <CapabilityBadge status="NOT_CONFIGURED" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          OCADE does not currently maintain a separate always-on vector index across every file and
          conversation. Project context, files and authenticated search remain the authoritative
          sources until an indexed knowledge service is implemented and privacy-scoped.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          to="/ocade/projects"
          className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderKanban className="h-4 w-4" aria-hidden />
            Projects
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Durable instructions and workspace context.
          </p>
        </Link>
        <Link
          to="/ocade/artifacts"
          className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Files className="h-4 w-4" aria-hidden />
            Artifacts
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Generated outputs retained by OCADE.</p>
        </Link>
        <Link
          to="/ocade/search"
          className="rounded-xl border border-border/60 p-4 transition hover:bg-accent/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4" aria-hidden />
            Search
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Search authenticated OCADE records that actually exist.
          </p>
        </Link>
      </div>
    </>
  );
}
