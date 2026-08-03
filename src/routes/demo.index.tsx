import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  FolderOpen,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PageHeader } from "@/components/shell/PageHeader";
import { useDemo } from "@/lib/demo/context";

export const Route = createFileRoute("/demo/")({
  component: DemoHome,
});

const tiles = [
  {
    to: "/demo/ocade",
    name: "OCADE",
    desc: "Assistant chat layout with sample messages.",
    icon: MessageSquare,
    color: "var(--accent-ocade)",
  },
  {
    to: "/demo/ficia",
    name: "FICIA",
    desc: "Company dashboard, timesheet, invoices, reports.",
    icon: Building2,
    color: "var(--accent-ficia)",
  },
  {
    to: "/demo/madee",
    name: "MADEE",
    desc: "A sample resume ready to explore.",
    icon: Sparkles,
    color: "var(--accent-madee)",
  },
  {
    to: "/demo/cania",
    name: "CANIA",
    desc: "Provider-required surfaces — honest empty states.",
    icon: Globe2,
    color: "var(--accent-cania)",
  },
  {
    to: "/demo/files",
    name: "Files",
    desc: "Sample files. Downloads and uploads disabled in demo.",
    icon: FolderOpen,
    color: "var(--accent-ocade)",
  },
  {
    to: "/demo/tasks",
    name: "Tasks",
    desc: "Sample task board — mark items done locally.",
    icon: ListChecks,
    color: "var(--accent-ficia)",
  },
];

function DemoHome() {
  const { state } = useDemo();
  return (
    <DemoShell>
      <PageHeader
        eyebrow="Demo mode"
        title={`Welcome to ${state.company.name}`}
        description="Everything here is sample data held only in this browser tab. Nothing writes to real accounts or companies."
      />
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className="group">
              <GlassPanel className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
                <div
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${t.color} 18%, transparent)`,
                    color: t.color,
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-foreground">{t.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-1" />
              </GlassPanel>
            </Link>
          );
        })}
      </section>
      <p className="mt-6 text-xs text-muted-foreground">
        Ready to keep your own data? Create a real account — demo content is never copied
        automatically.{" "}
        <Link to="/auth" className="font-medium text-primary underline underline-offset-4">
          Create your account
        </Link>
        .
      </p>
    </DemoShell>
  );
}
