import { Box, CheckCircle2, LockKeyhole, MonitorCog } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { BLENDER_ROUTE_ORDER, CREATIVE_RUNTIME_BOUNDARY } from "@/lib/creative/creative-workflow";

const GUARANTEES = [
  "Versioned project checkpoint verified before mutation",
  "Bounded script process with network, read and write scopes",
  "Scene hierarchy, geometry, modifiers and logs inspected afterward",
  "Render and glTF bytes hashed and format-validated",
  "Verified checkpoint restoration on any incomplete result",
];

/**
 * Honest production surface for the Phase 30 contract. It describes what is
 * implemented without presenting a live Run control before a signed creative
 * adapter and installed application have actually been paired.
 */
export function CreativeControlPanel() {
  return (
    <GlassPanel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Box className="h-4 w-4" aria-hidden /> Creative application control
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Blender-first execution with checkpoints, resource admission, bounded scripts, render
            inspection and verified exports.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] px-2 py-1 text-[10px] font-medium">
          <LockKeyhole className="h-3 w-3" aria-hidden /> Adapter required
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <MonitorCog className="h-3.5 w-3.5" aria-hidden /> Blender route order
          </p>
          <ol className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            {BLENDER_ROUTE_ORDER.map((route, index) => (
              <li key={route}>
                {index + 1}. {route.replaceAll("_", " ")}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Vision/input is observation-only and cannot authorize a project mutation.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Required evidence
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {GUARANTEES.map((guarantee) => (
              <li key={guarantee}>• {guarantee}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-border/60 bg-background/40 p-2 text-[11px] text-muted-foreground">
        {CREATIVE_RUNTIME_BOUNDARY}
      </p>
    </GlassPanel>
  );
}
