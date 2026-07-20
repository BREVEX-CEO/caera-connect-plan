import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare, Building2, Sparkles, Globe2, ArrowRight, Rocket } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { PrivacyBadge } from "@/components/shell/PrivacyBadge";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomePage,
});

const modules = [
  {
    id: "ocade",
    to: "/ocade",
    name: "OCADE",
    desc: "Assistant, projects and files.",
    icon: MessageSquare,
    color: "var(--accent-ocade)",
    status: "planned" as const,
  },
  {
    id: "ficia",
    to: "/ficia",
    name: "FICIA",
    desc: "Commerce & finance workspace.",
    icon: Building2,
    color: "var(--accent-ficia)",
    status: "planned" as const,
  },
  {
    id: "madee",
    to: "/madee",
    name: "MADEE",
    desc: "AI Studio & Resume Builder.",
    icon: Sparkles,
    color: "var(--accent-madee)",
    status: "planned" as const,
  },
  {
    id: "cania",
    to: "/cania",
    name: "CANIA",
    desc: "World intelligence center.",
    icon: Globe2,
    color: "var(--accent-cania)",
    status: "setup_required" as const,
  },
];

function HomePage() {
  const { user } = useSession();
  const greeting = user?.email ?? user?.phone ?? "there";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Foundation Alpha"
        title={`Welcome, ${greeting.split("@")[0]}.`}
        description="Your workspace is ready. Modules light up as each build slice ships."
        actions={<PrivacyBadge mode="private_sync" />}
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.id} to={m.to} className="group">
              <GlassPanel className="flex h-full items-start gap-4 p-5 transition-transform group-hover:-translate-y-0.5">
                <div
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${m.color} 18%, transparent)`,
                    color: m.color,
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{m.name}</h3>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-1" />
              </GlassPanel>
            </Link>
          );
        })}
      </section>

      <section className="mt-8">
        <GlassPanel strong className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex-none rounded-lg bg-primary/15 p-2.5 text-primary">
            <Rocket className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Finish onboarding</h3>
            <p className="text-xs text-muted-foreground">
              Tell us about your workspace so OCADE, FICIA and MADEE can arrive pre-configured.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Continue setup
          </Link>
        </GlassPanel>
      </section>
    </AppShell>
  );
}
