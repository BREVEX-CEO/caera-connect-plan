import { createFileRoute } from "@tanstack/react-router";
import { Newspaper, CloudSun, LineChart, Bell } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { SetupRequiredState } from "@/components/shell/SetupRequiredState";

export const Route = createFileRoute("/demo/cania")({
  component: DemoCania,
});

const tiles = [
  { icon: Newspaper, label: "World news" },
  { icon: CloudSun, label: "Weather & alerts" },
  { icon: LineChart, label: "Markets & currency" },
  { icon: Bell, label: "Profession precautions" },
];

function DemoCania() {
  return (
    <DemoShell>
      <PageHeader
        eyebrow="CANIA — World intelligence demo"
        title="Real signals only from real providers"
        description="Even in demo, CANIA never fabricates news, weather or markets. This screen shows the layout — providers must be connected in a real account to see live data."
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
          description="Data providers are configured in a real account. Sign up to connect news, weather, markets and traffic sources."
        />
      </div>
    </DemoShell>
  );
}
