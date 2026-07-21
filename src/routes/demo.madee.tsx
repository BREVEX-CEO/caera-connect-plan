import { createFileRoute } from "@tanstack/react-router";
import { Ban, Download } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useDemo } from "@/lib/demo/context";

export const Route = createFileRoute("/demo/madee")({
  component: DemoMadee,
});

function DemoMadee() {
  const { state } = useDemo();
  const r = state.resume;
  return (
    <DemoShell>
      <PageHeader
        eyebrow="MADEE — Studio demo"
        title="Sample resume"
        description="Explore the resume layout. Editing and exporting are disabled in demo — sign in to save your own."
      />
      <GlassPanel className="mt-6 space-y-4 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{r.name}</h2>
          <p className="text-sm text-muted-foreground">{r.headline}</p>
        </div>
        <p className="text-sm text-foreground">{r.summary}</p>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Experience</h3>
          <ul className="space-y-2 text-sm">
            {r.experience.map((e) => (
              <li key={`${e.company}-${e.period}`} className="flex justify-between gap-4">
                <span className="text-foreground">
                  <span className="font-medium">{e.role}</span> · {e.company}
                </span>
                <span className="text-muted-foreground">{e.period}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {r.skills.map((s) => (
              <span key={s} className="rounded-full border border-border/60 bg-background/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <Ban className="h-3.5 w-3.5 text-amber-300" aria-hidden />
          <span>Editing and exporting are disabled in demo.</span>
          <button disabled className="ml-auto inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border/60 bg-background/30 px-2 py-1 opacity-60">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export PDF
          </button>
        </div>
      </GlassPanel>
    </DemoShell>
  );
}
