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
      <div className="mt-6 grid gap-3">
        {state.tasks.map((t) => {
          const done = t.status === "Done";
          return (
            <GlassPanel key={t.id} className="flex items-center gap-4 p-4">
              <button
                onClick={() => markTaskDone(t.id)}
                aria-label={done ? "Already done" : `Mark ${t.title} as done`}
                disabled={done}
                className="text-muted-foreground disabled:text-emerald-400"
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="flex-1">
                <div className={done ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>
                  {t.title}
                </div>
                <div className="text-xs text-muted-foreground">Owner: {t.owner}</div>
              </div>
              <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs text-muted-foreground">
                {t.status}
              </span>
            </GlassPanel>
          );
        })}
      </div>
    </DemoShell>
  );
}
