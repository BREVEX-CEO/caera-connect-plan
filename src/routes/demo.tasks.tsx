import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useDemo } from "@/lib/demo/context";

export const Route = createFileRoute("/demo/tasks")({
  component: DemoTasks,
});

function DemoTasks() {
  const { state, markTaskDone } = useDemo();
  return (
    <DemoShell>
      <PageHeader
        eyebrow="Tasks — demo"
        title="Sample tasks"
        description="Mark tasks done to see the state change locally. Nothing is saved to real accounts."
      />
      <GlassPanel className="mt-6 overflow-hidden">
        <ul className="divide-y divide-border/40">
          {state.tasks.map((t) => {
            const done = t.status === "Done";
            return (
              <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
                <button
                  onClick={() => markTaskDone(t.id)}
                  aria-label={done ? "Already done" : `Mark ${t.title} as done`}
                  disabled={done}
                  className="text-muted-foreground disabled:text-emerald-400"
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </button>
                <span className={done ? "flex-1 text-muted-foreground line-through" : "flex-1 text-foreground"}>
                  {t.title}
                </span>
                <span className="text-xs text-muted-foreground">{t.owner}</span>
                <span className="rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {t.status}
                </span>
              </li>
            );
          })}
        </ul>
      </GlassPanel>
    </DemoShell>
  );
}
