import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  Boxes,
  Brain,
  Cable,
  FileCode2,
  FlaskConical,
  HeartPulse,
  Inbox,
  LayoutTemplate,
  Monitor,
  Package,
  Palette,
  Radar,
  Settings,
  Share2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

export const Route = createFileRoute("/_authenticated/ocade/system")({
  head: () => ({ meta: [{ title: "System — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: SystemPage,
});

const ENTRIES = [
  /*
   * The six that left the sidebar.
   *
   * They are first here, not appended, because these are the ones a person
   * will come looking for: somebody who used Automations yesterday and cannot
   * find it today needs it above the fold, not below Health.
   */
  {
    to: "/ocade/code",
    label: "Code",
    icon: FileCode2,
    detail: "Read, write and run code with OCADE, on this device.",
  },
  {
    to: "/ocade/automations",
    label: "Automations",
    icon: Workflow,
    detail: "Work that runs on a schedule or on a trigger, without you.",
  },
  {
    to: "/ocade/artifacts",
    label: "Files",
    icon: Package,
    detail: "Everything OCADE has produced or been given.",
  },
  {
    to: "/ocade/inbox",
    label: "Inbox",
    icon: Inbox,
    detail: "What needs your answer before OCADE can carry on.",
  },
  {
    to: "/ocade/monitors",
    label: "Monitors",
    icon: Radar,
    detail: "Pages and sources OCADE watches for change.",
  },
  {
    to: "/ocade/studio",
    label: "Studio",
    icon: Palette,
    detail: "Images, audio and video work.",
  },
  {
    to: "/ocade/models",
    label: "Models",
    detail: "Local and cloud intelligence runtimes.",
    icon: Boxes,
  },
  {
    to: "/ocade/devices",
    label: "Devices",
    detail: "Registered devices and revocation.",
    icon: Monitor,
  },
  {
    to: "/ocade/connectors",
    label: "Connectors",
    detail: "Observed runtime connections and provider links.",
    icon: Cable,
  },
  {
    to: "/ocade/permissions",
    label: "Permissions",
    detail: "Permission-bearing capabilities and their real state.",
    icon: ShieldCheck,
  },
  {
    to: "/ocade/activity",
    label: "Activity",
    detail: "Recorded account and agent activity.",
    icon: Activity,
  },
  {
    to: "/ocade/health",
    label: "Health",
    detail: "Truthful capability diagnostics.",
    icon: HeartPulse,
  },
  {
    to: "/ocade/shared",
    label: "Shared",
    detail: "Sharing boundary and external-access status.",
    icon: Share2,
  },
  {
    to: "/ocade/templates",
    label: "Templates",
    detail: "Reusable prompt starters without fake automation claims.",
    icon: LayoutTemplate,
  },
  {
    to: "/ocade/knowledge",
    label: "Knowledge",
    detail: "Durable context and the current indexing boundary.",
    icon: Brain,
  },
  {
    to: "/ocade/notifications",
    label: "Notifications",
    detail: "In-app attention and background-delivery status.",
    icon: Bell,
  },
  {
    to: "/ocade/lab",
    label: "Lab",
    detail: "Engineering diagnostics, research and governed execution.",
    icon: FlaskConical,
  },
  {
    to: "/settings",
    label: "Settings",
    detail: "Account, privacy, appearance and product preferences.",
    icon: Settings,
  },
] as const;

function SystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="More"
        description="Everything OCADE can do that is not on the sidebar. All of it is also reachable with Cmd/Ctrl+K, and most of it by asking in Chat."
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.to}
              to={entry.to}
              className="rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/30"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden /> {entry.label}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{entry.detail}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
