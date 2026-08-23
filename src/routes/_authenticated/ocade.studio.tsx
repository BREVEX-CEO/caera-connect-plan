import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  FileOutput,
  Image,
  LayoutTemplate,
  Presentation,
  Sheet,
  Shapes,
  Code2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";
import type { CapabilityStatus } from "@/lib/capabilities/types";
import { CreativeControlPanel } from "@/components/ocade/CreativeControlPanel";

export const Route = createFileRoute("/_authenticated/ocade/studio")({
  head: () => ({
    meta: [{ title: "Studio — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: StudioPage,
});

type StudioEntry = {
  label: string;
  detail: string;
  status: CapabilityStatus;
  to?: string;
  icon: typeof FileText;
};

const ENTRIES: StudioEntry[] = [
  {
    label: "Documents",
    detail:
      "Draft, revise and save document-style outputs through OCADE Chat and the artifact ledger.",
    status: "READY",
    to: "/ocade",
    icon: FileText,
  },
  {
    label: "Reports",
    detail:
      "Research and structured report drafting use OCADE Chat; saved results remain versioned in Artifacts.",
    status: "READY",
    to: "/ocade",
    icon: LayoutTemplate,
  },
  {
    label: "Data analysis",
    detail:
      "Use the Code workspace for executable analysis or Chat for explanation. OCADE will not claim a notebook ran when no execution host exists.",
    status: "READY",
    to: "/ocade/code",
    icon: BarChart3,
  },
  {
    label: "Websites & apps",
    detail:
      "The Code workspace is the real implementation surface for source files, patches, analysis and sandboxed execution where available.",
    status: "READY",
    to: "/ocade/code",
    icon: Code2,
  },
  {
    label: "Exports",
    detail:
      "Saved outputs, versions, integrity checks and exports live in the existing Artifacts workspace.",
    status: "READY",
    to: "/ocade/artifacts",
    icon: FileOutput,
  },
  {
    label: "Images",
    detail:
      "Chat can offer a visual response for supported answers, but a dedicated image-generation studio is not wired in this build.",
    status: "NOT_CONFIGURED",
    icon: Image,
  },
  {
    label: "Diagrams",
    detail: "There is no dedicated diagram editor/generator connected to Studio yet.",
    status: "NOT_CONFIGURED",
    icon: Shapes,
  },
  {
    label: "Presentations",
    detail:
      "A first-class presentation authoring/export runtime has not been connected to OCADE Studio yet.",
    status: "NOT_CONFIGURED",
    icon: Presentation,
  },
  {
    label: "Spreadsheets",
    detail:
      "A first-class spreadsheet workbook editor is not wired here yet; executable data work belongs in Code for now.",
    status: "NOT_CONFIGURED",
    icon: Sheet,
  },
];

function StudioPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Studio"
        description="Create useful outputs. Studio only marks a medium ready when there is a real implementation path behind it; engineering diagnostics have moved to Lab."
        actions={
          <Link
            to="/ocade/lab"
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Open Lab
          </Link>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          const card = (
            <div className="h-full rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/25">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-sm font-medium text-foreground">{entry.label}</h2>
                </div>
                <CapabilityBadge status={entry.status} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.detail}</p>
              {entry.to ? (
                <span className="mt-3 block text-xs text-foreground underline underline-offset-4">
                  Open
                </span>
              ) : null}
            </div>
          );
          return entry.to ? (
            <Link key={entry.label} to={entry.to}>
              {card}
            </Link>
          ) : (
            <div key={entry.label}>{card}</div>
          );
        })}
      </div>

      <div className="mt-5">
        <CreativeControlPanel />
      </div>
    </>
  );
}
