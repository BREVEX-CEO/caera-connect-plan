import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  ShieldCheck,
  Cpu,
  Cloud,
  Lock,
} from "lucide-react";
import { MarketingShell } from "@/components/shell/MarketingShell";
import { GlassPanel } from "@/components/shell/GlassPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAERA CADANE — Private AI workspace for people and companies" },
      {
        name: "description",
        content:
          "One private AI workspace: OCADE assistant, FICIA commerce and finance, MADEE studio, and CANIA world intelligence. Device Only, Private Sync, or Cloud Processing — you decide.",
      },
      { property: "og:title", content: "CAERA CADANE — Private AI workspace" },
      {
        property: "og:description",
        content:
          "OCADE, FICIA, MADEE and CANIA in one privacy-first workspace built for solo builders, small businesses and enterprise.",
      },
    ],
  }),
  component: LandingPage,
});

const modules = [
  {
    id: "ocade",
    name: "OCADE",
    tagline: "Your assistant, projects and files.",
    description:
      "Chat, projects, prompt improvement, image understanding and copilot plans — with local or cloud model routing.",
    icon: MessageSquare,
    color: "var(--accent-ocade)",
  },
  {
    id: "ficia",
    name: "FICIA",
    tagline: "Commerce & finance workspace.",
    description:
      "Company setup, timesheets, invoices, bank reconciliation, lawful tax optimization and family / asset protection planning.",
    icon: Building2,
    color: "var(--accent-ficia)",
  },
  {
    id: "madee",
    name: "MADEE",
    tagline: "AI Studio & Resume Builder.",
    description:
      "Save resume projects to your account and edit them anytime, on any approved device.",
    icon: Sparkles,
    color: "var(--accent-madee)",
  },
  {
    id: "cania",
    name: "CANIA",
    tagline: "World intelligence center.",
    description:
      "News, weather, currency, markets and alerts. Providers connect through authorized sources — no synthetic data.",
    icon: Globe2,
    color: "var(--accent-cania)",
  },
] as const;

const pillars = [
  {
    icon: Lock,
    title: "Privacy modes you control",
    body: "Device Only, Private Sync, or Cloud Processing — the badge on every page tells you where your data lives right now.",
  },
  {
    icon: Cpu,
    title: "Local or cloud AI",
    body: "OCADE routes between Ollama on your device and metered cloud models. Never called free. Never hidden.",
  },
  {
    icon: ShieldCheck,
    title: "Copilot with visible plans",
    body: "Automations show plans, permissions, pause, stop and full task replay. No hidden control.",
  },
  {
    icon: Cloud,
    title: "Two devices each, per account",
    body: "Approve up to two mobile and two desktop devices, revoke instantly, and replay every important action.",
  },
];

function LandingPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:pt-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Foundation Alpha — early access
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              A private AI workspace that
              <span className="bg-gradient-to-r from-[color:var(--accent-ocade)] via-[color:var(--accent-madee)] to-[color:var(--accent-ficia)] bg-clip-text text-transparent">
                {" "}
                scales with you.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              OCADE assistant, FICIA commerce, MADEE studio and CANIA world intelligence — one
              workspace, your data, on the devices you approve. Simple for beginners, ready for
              companies.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/10 transition-transform hover:-translate-y-0.5"
              >
                Create your account
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center justify-center rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-5 py-2.5 text-sm font-medium text-[color:var(--state-warning)] transition-colors hover:bg-[color:var(--state-warning)]/20"
              >
                Try Demo — no sign-in
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-lg border border-border/60 bg-background/50 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <GlassPanel key={m.id} className="flex flex-col gap-3 p-5">
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${m.color} 18%, transparent)`,
                    color: m.color,
                  }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{m.name}</h3>
                  <p className="text-xs text-muted-foreground">{m.tagline}</p>
                </div>
                <p className="text-sm text-muted-foreground">{m.description}</p>
              </GlassPanel>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Designed to be trusted before it is used.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            CAERA CADANE is built on four hard rules: your data stays where you decide, models are
            transparent, automations are visible, and destructive actions require confirmation.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <GlassPanel key={p.title} className="flex gap-4 p-5">
                <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      </section>
    </MarketingShell>
  );
}
