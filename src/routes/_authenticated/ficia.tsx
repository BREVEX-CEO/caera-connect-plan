import { createFileRoute } from "@tanstack/react-router";
import { Building2, Users, Scale } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";

export const Route = createFileRoute("/_authenticated/ficia")({
  head: () => ({
    meta: [
      { title: "FICIA — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FiciaPage,
});

const areas = [
  {
    icon: Building2,
    title: "Company workspace",
    body: "Company profile, timesheets, invoices, bank reconciliation, tax preparation and reports.",
  },
  {
    icon: Users,
    title: "Family, Marriage & Asset Protection",
    body: "Household setup, marriage and divorce planning, asset protection and government-benefits evidence — lawful guidance only, never evasion.",
  },
  {
    icon: Scale,
    title: "Audit-ready records",
    body: "Every important action is logged with actor, target and reason. Financial calculations use deterministic rules — never raw model arithmetic.",
  },
];

function FiciaPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="FICIA — commerce & finance"
        title="Run your money, your company and your family life"
        description="One workspace for solo, small-business and enterprise finance — with lawful tax optimization and family protection built in."
        actions={<StatusBadge status="planned" />}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {areas.map((a) => {
          const Icon = a.icon;
          return (
            <GlassPanel key={a.title} className="flex flex-col gap-3 p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--accent-ficia)]/15 text-[color:var(--accent-ficia)]">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
              <p className="text-sm text-muted-foreground">{a.body}</p>
            </GlassPanel>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        FICIA modules unlock in upcoming build slices. Foundation Alpha establishes the account,
        privacy mode and audit trail these features depend on.
      </p>
    </AppShell>
  );
}
