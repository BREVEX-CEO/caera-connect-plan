import { lazy, Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical, Loader2, MessageSquare, Mic, Palette, Puzzle, Settings } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

/**
 * CUSTOMIZE — how OCADE behaves for you, and nothing else.
 *
 * WHAT THIS SCREEN USED TO BE. It was `/ocade/system` renamed: a directory of
 * twenty entries listing every screen in the product, described as "the More
 * surface". `PLAN.md` §17 asks for the opposite of that in as many words —
 * "remove old More, implement sparse Projects/Tasks/Artifacts/Customize ... no
 * wall of buttons".
 *
 * WHY THE DIRECTORY COULD GO. It existed because §4's consolidation had not
 * happened yet: a person who used Automations yesterday needed somewhere to
 * find it after it left the rail. Now Automations, Monitors, Inbox and
 * Notifications ARE Tasks; Studio, Templates and Shared ARE Artifacts; and
 * Models, Devices, Permissions, Connectors, Health and Activity are Settings.
 * A directory of twenty links to eight destinations is not navigation, it is a
 * second, staler copy of it.
 *
 * WHAT IT IS INSTEAD. The four things that change how OCADE behaves for this
 * person — its look, how it talks, how it listens, what it can do — each
 * pointing at the settings section that owns them, plus the engineering Lab,
 * which is real, technical, and opened on purpose rather than stumbled into.
 */
export const Route = createFileRoute("/_authenticated/ocade/customize")({
  head: () => ({ meta: [{ title: "Customize — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: CustomizePage,
});

/*
 * Twelve diagnostic panels, several probing runtimes on mount. They load when
 * somebody opens the Lab, not when somebody opens this page to change a theme.
 */
const EngineeringLab = lazy(() =>
  import("@/components/ocade/customize/EngineeringLab").then((module) => ({
    default: module.EngineeringLab,
  })),
);

const ENTRIES = [
  {
    to: "/settings/appearance" as const,
    label: "Appearance",
    icon: Palette,
    detail: "Theme, density and motion.",
  },
  {
    to: "/settings/$section" as const,
    params: { section: "chat" },
    label: "How OCADE talks",
    icon: MessageSquare,
    detail: "Response style, what it remembers between conversations, and what it may suggest.",
  },
  {
    to: "/settings/voice" as const,
    label: "Voice",
    icon: Mic,
    detail: "Speech input and output, and which device they use.",
  },
  {
    to: "/settings/skills" as const,
    label: "Skills",
    icon: Puzzle,
    detail: "Extensions you have installed, and what each one is allowed to reach.",
  },
];

function CustomizePage() {
  const [labOpen, setLabOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Customize"
        description="How OCADE looks, talks, listens and what it can do for you."
        actions={
          <Link
            to="/settings"
            className="inline-flex min-h-[24px] items-center gap-1.5 px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" aria-hidden /> All settings
          </Link>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <Link
              key={entry.label}
              to={entry.to}
              params={entry.params}
              className="rounded-xl border border-border/60 bg-card/25 p-4 transition hover:bg-accent/25"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                {entry.label}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{entry.detail}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        {labOpen ? (
          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Opening engineering
                diagnostics…
              </div>
            }
          >
            <EngineeringLab />
          </Suspense>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-foreground">Engineering diagnostics</h2>
            <p className="mt-1 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
              What OCADE can prove before a run, a patch, a research claim or a visual output is
              accepted. Technical, and safe to ignore.
            </p>
            <button
              onClick={() => setLabOpen(true)}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-border/60 px-4 text-sm text-foreground hover:bg-accent/30"
            >
              <FlaskConical className="h-4 w-4" aria-hidden /> Open the Lab
            </button>
          </>
        )}
      </div>
    </>
  );
}
