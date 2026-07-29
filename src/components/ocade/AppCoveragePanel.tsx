import { AppWindow, HelpCircle } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { AppCoverageRegistry, type AppCoverageInfo } from "@/lib/providers/app-coverage-registry";

/**
 * Which applications OCADE can drive — and, here, why it cannot say.
 *
 * This panel exists because the honest answer in a browser is "I cannot see
 * your machine", and that answer needs somewhere to be said. A registry that
 * knows it is blocked but has no surface is just a silent gap the user reads as
 * "no supported applications".
 *
 * This panel previously could not have existed truthfully: `runCoverageScan`
 * hardcoded Blender as detected at version 4.0.2 with FULL coverage, so any
 * surface built on it would have shown fabricated application support. It now
 * requires an injected prober and reports BLOCKED when nothing has looked, so
 * what renders below is a real verdict from the real function.
 *
 * BLOCKED means unknown, not absent. The browser has no process execution and
 * no filesystem, so presence genuinely cannot be determined from here.
 */

const CANDIDATES: { id: string; name: string }[] = [
  { id: "app.blender", name: "Blender" },
  { id: "app.freecad", name: "FreeCAD" },
  { id: "app.calculix", name: "CalculiX" },
];

/**
 * Reads the real registry's state for applications nothing has probed.
 *
 * No scan is started. A scan is asynchronous, and firing one without awaiting
 * it — then reading the result synchronously — would depend on the scan
 * happening to complete before its first suspension point. The registered state
 * is already the honest answer here, and it is produced by the registry itself
 * rather than written into this component.
 */
function currentCoverage(): AppCoverageInfo[] {
  const registry = new AppCoverageRegistry();
  for (const candidate of CANDIDATES) {
    registry.registerAppProfile(candidate.id, candidate.name);
  }
  return registry.getCoverageReport();
}

const ROWS = currentCoverage();

export function AppCoveragePanel() {
  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <AppWindow className="h-4 w-4" aria-hidden />
        Application coverage
      </h3>
      <p className="text-xs text-muted-foreground">
        Which applications OCADE can drive on this machine. Nothing here is assumed: an application
        is only reported as supported when a probe has actually found it and said how.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {ROWS.map((row) => (
          <section key={row.id} className="rounded-lg border border-border/70 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {row.name}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {row.coverageLevel}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{row.evidence.join(" ")}</p>
          </section>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-border/70 p-3">
        <p className="text-[11px] font-medium">To turn this into a real answer</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Run OCADE with the desktop companion connected. It can execute a version probe and report
          what it actually found. Until then these read BLOCKED — meaning{" "}
          <span className="font-medium">not determined</span>, not{" "}
          <span className="font-medium">not installed</span>. The two are different answers and
          OCADE will not merge them.
        </p>
      </div>
    </GlassPanel>
  );
}
