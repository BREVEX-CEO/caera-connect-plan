import { DraftingCompass, FileCheck2, Gauge, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  CAD_ROUTE_ORDER,
  ENGINEERING_RUNTIME_BOUNDARY,
} from "@/lib/engineering/engineering-workflow";

const INVARIANTS = [
  "Original project stays byte-identical; work occurs in a verified duplicate",
  "Units and every dimension, material, contact, load and tolerance are compared",
  "Rebuild, constraints, references, warnings and errors must pass",
  "STEP, STL, DXF or DWG bytes are hashed and independently reopened",
  "Fixture solver metrics can never become an engineering conclusion",
];

/** Honest source-capability view; no execution control exists before pairing. */
export function EngineeringControlPanel() {
  return (
    <GlassPanel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <DraftingCompass className="h-4 w-4" aria-hidden /> CAD and engineering control
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Duplicate-first CAD/CAE work with locked assumptions, rebuild proof, verified exchange
            files and solver-result boundaries.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-2 py-1 text-[10px] font-medium">
          <ShieldAlert className="h-3 w-3" aria-hidden /> Licensed app required
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Gauge className="h-3.5 w-3.5" aria-hidden /> Preferred control routes
          </p>
          <ol className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            {CAD_ROUTE_ORDER.map((route, index) => (
              <li key={route}>
                {index + 1}. {route.replaceAll("_", " ")}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Vision/input is never accepted as the sole mutating engineering route.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden /> Non-negotiable evidence
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {INVARIANTS.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-border/60 bg-background/40 p-2 text-[11px] text-muted-foreground">
        {ENGINEERING_RUNTIME_BOUNDARY}
      </p>
    </GlassPanel>
  );
}
