import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  Cable,
  FlaskConical,
  HeartPulse,
  Monitor,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

export const Route = createFileRoute("/_authenticated/ocade/system")({
  head: () => ({ meta: [{ title: "System — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: SystemPage,
});

const ENTRIES = [
  { to: "/ocade/models", label: "Models", detail: "Local and cloud intelligence runtimes.", icon: Boxes },
  { to: "/ocade/devices", label: "Devices", detail: "Registered devices and revocation.", icon: Monitor },
  { to: "/ocade/connectors", label: "Connectors", detail: "Observed runtime connections and provider links.", icon: Cable },
  { to: "/ocade/permissions", label: "Permissions", detail: "Permission-bearing capabilities and their real state.", icon: ShieldCheck },
  { to: "/ocade/activity", label: "Activity", detail: "Recorded account and agent activity.", icon: Activity },
  { to: "/ocade/health", label: "Health", detail: "Truthful capability diagnostics.", icon: HeartPulse },
  { to: "/ocade/lab", label: "Lab", detail: "Engineering diagnostics, research and governed execution.", icon: FlaskConical },
  { to: "/settings", label: "Settings", detail: "Account, privacy, appearance and product preferences.", icon: Settings },
] as const;

function SystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="System"
        description="Advanced controls live here so Chat and the primary tool navigation stay focused."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link key={entry.to} to={entry.to} className="rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/30">
              <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden /> {entry.label}</div>
              <p className="mt-2 text-sm text-muted-foreground">{entry.detail}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
