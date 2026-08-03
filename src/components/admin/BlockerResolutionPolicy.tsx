import { Route } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { BLOCKER_RESOLUTION_STRATEGIES } from "@/lib/blocker-resolution";

export function BlockerResolutionPolicy() {
  return (
    <GlassPanel className="mt-6 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Route className="h-4 w-4" aria-hidden /> External-blocker proof
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A blocker is external only after every route below has fresh retained evidence. Any
        available route keeps the item resolvable; the last route must name one accountable owner
        action.
      </p>
      <ol className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        {BLOCKER_RESOLUTION_STRATEGIES.map((strategy, index) => (
          <li key={strategy.id} className="flex gap-2 rounded-md border border-border/50 p-2">
            <span className="tabular-nums">{index + 1}.</span>
            <span>{strategy.label}</span>
          </li>
        ))}
      </ol>
    </GlassPanel>
  );
}
