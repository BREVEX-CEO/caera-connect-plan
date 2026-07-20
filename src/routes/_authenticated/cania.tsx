import { createFileRoute } from "@tanstack/react-router";
import { Newspaper, CloudSun, LineChart, Bell } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";
import { StatusBadge } from "@/components/shell/StatusBadge";

export const Route = createFileRoute("/_authenticated/cania")({
  head: () => ({
    meta: [
      { title: "CANIA — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaniaPage,
});

const tiles = [
  { icon: Newspaper, label: "World news" },
  { icon: CloudSun, label: "Weather & alerts" },
  { icon: LineChart, label: "Markets & currency" },
  { icon: Bell, label: "Profession precautions" },
];

function CaniaPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="CANIA — World intelligence center"
        title="Real signals, only from authorized sources"
        description="News, weather, currency, markets, traffic and alerts — powered by providers you connect. Never synthetic."
        actions={<StatusBadge status="setup_required" />}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <GlassPanel key={t.label} className="flex flex-col items-start gap-3 p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--accent-cania)]/15 text-[color:var(--accent-cania)]">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{t.label}</h3>
              <p className="text-xs text-muted-foreground">Provider setup required.</p>
            </GlassPanel>
          );
        })}
      </div>
      <div className="mt-6">
        <SetupRequiredState
          title="Provider setup required"
          description="No public data sources are connected yet. Provider connections (news, weather, markets and traffic) will be configured in a later slice. Until then, CANIA shows structure and states — never fabricated data."
        />
      </div>
    </AppShell>
  );
}
