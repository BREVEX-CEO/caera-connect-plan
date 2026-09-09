import { createFileRoute, Link } from "@tanstack/react-router";
import { Cable, Globe2, HardDrive, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";
import { useCapabilityReports } from "@/lib/capabilities/use-capabilities";
import type { CapabilityId } from "@/lib/capabilities/types";

export const Route = createFileRoute("/_authenticated/ocade/connectors")({
  head: () => ({ meta: [{ title: "Connectors — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: ConnectorsPage,
});

const CONNECTORS: Array<{
  id: CapabilityId;
  label: string;
  description: string;
  to: string;
  icon: typeof Cable;
}> = [
  {
    id: "browser",
    label: "Browser bridge",
    description: "The permissioned bridge OCADE uses for browser control.",
    to: "/settings/browser",
    icon: Globe2,
  },
  {
    id: "accountStorage",
    label: "Account data",
    description: "Where your conversations, projects, tasks and artifacts are kept.",
    to: "/settings/data",
    icon: RefreshCw,
  },
  {
    id: "localAI",
    label: "Local model runtime",
    description: "On-device models and the local inference engine.",
    to: "/ocade/models",
    icon: HardDrive,
  },
];

function ConnectorsPage() {
  const reports = useCapabilityReports();
  const byId = new Map(reports.map((report) => [report.id, report]));
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Connectors"
        description="Connections OCADE can actually observe today. Gmail, Drive, Slack, Notion and other app connectors are not shown as connected until a real connector implementation and account grant exist."
      />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {CONNECTORS.map((connector) => {
          const report = byId.get(connector.id);
          const Icon = connector.icon;
          if (!report) return null;
          return (
            <Link
              key={connector.id}
              to={connector.to}
              className="rounded-xl border border-border/60 bg-card/30 p-4 transition hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-sm font-medium">{connector.label}</h2>
                </div>
                <CapabilityBadge status={report.status} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.detail}</p>
              <p className="mt-2 text-[11px] text-muted-foreground/70">{connector.description}</p>
            </Link>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-dashed border-border/60 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Cable className="h-4 w-4" /> App connectors
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          No first-class Gmail, Google Drive, Slack, Notion, Microsoft 365, Jira, Linear, Figma or
          Canva account connection is configured by this build yet. OCADE will not display fake
          connected accounts.
        </p>
      </div>
    </>
  );
}
