import { Cpu, Download, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { planLocalJob, type LocalJobDecision } from "@/lib/skills/local-job-plan";
import type { LocalProfile } from "@/lib/skills/hardware-profile";
import type { HardwareSnapshot, JobSpec } from "@/lib/skills/resource-governor";

/**
 * Where a local job would run — the placement decision, surfaced.
 *
 * `planLocalJob` composes the hardware-profile recommender and the resource
 * governor into one verdict: run locally, install first (with approval), or
 * refuse. It was fully implemented and tested but reached by no
 * route or panel, and it is the only consumer of `hardware-profile`, so both sat
 * unreachable from the product.
 *
 * HONESTY: these are DECLARED machine snapshots, not a reading of the machine
 * you are on. The browser cannot see installed RAM, free disk, GPU or battery,
 * and inventing those numbers is exactly the fabrication this project forbids.
 * What is real here is the DECISION — the same function the runtime calls,
 * producing the same verdicts, including its refusals.
 */

const GB = 1024 ** 3;

/** Two profiles: one small and already present, one capable but not installed. */
const PROFILES: LocalProfile[] = [
  {
    id: "compact",
    label: "Compact local model",
    minRamBytes: 2 * GB,
    installBytes: 2 * GB,
    downloadBytes: 0,
    requiresGpu: false,
    installed: true,
    tier: 1,
  },
  {
    id: "full",
    label: "Full local model",
    minRamBytes: 16 * GB,
    installBytes: 12 * GB,
    downloadBytes: 12 * GB,
    requiresGpu: true,
    installed: false,
    tier: 3,
  },
];

const JOB: JobSpec = {
  kind: "local_inference",
  workUnits: 4_000,
  bytesPerUnit: 96 * 1024,
  msPerUnit: 4,
  fixedMemoryBytes: 1 * GB,
};

const MACHINES: { label: string; note: string; hw: HardwareSnapshot }[] = [
  {
    label: "Laptop on battery",
    note: "8 GB RAM, no GPU, 35% battery",
    hw: {
      totalRamBytes: 8 * GB,
      availableRamBytes: 2.5 * GB,
      freeStorageBytes: 20 * GB,
      hasGpu: false,
      batteryPercent: 35,
      thermalState: "warm",
    },
  },
  {
    label: "Low-memory netbook",
    note: "4 GB RAM, no GPU, little free",
    hw: {
      totalRamBytes: 4 * GB,
      availableRamBytes: 1.2 * GB,
      freeStorageBytes: 6 * GB,
      hasGpu: false,
      thermalState: "nominal",
    },
  },
  {
    label: "Desktop",
    note: "32 GB RAM, GPU, mains power",
    hw: {
      totalRamBytes: 32 * GB,
      availableRamBytes: 18 * GB,
      freeStorageBytes: 300 * GB,
      hasGpu: true,
      thermalState: "nominal",
    },
  },
  {
    label: "Thermally throttled",
    note: "32 GB RAM, GPU, running hot",
    hw: {
      totalRamBytes: 32 * GB,
      availableRamBytes: 18 * GB,
      freeStorageBytes: 300 * GB,
      hasGpu: true,
      thermalState: "critical",
    },
  },
];

/** Presentation for each verdict. The refusals are shown, not hidden. */
function describe(decision: LocalJobDecision): {
  icon: typeof Cpu;
  headline: string;
  detail: string;
} {
  switch (decision.where) {
    case "local":
      return {
        icon: Cpu,
        headline: `Runs locally · ${decision.profileLabel}`,
        detail: decision.recommendation.reason,
      };
    case "needs_install":
      return {
        icon: Download,
        headline: `Needs ${decision.profileLabel}`,
        detail: `${decision.reason} Never installed without approval.`,
      };
    case "blocked":
      return {
        icon: ShieldAlert,
        headline: "Refused by the resource governor",
        detail: decision.recommendation.reason,
      };
    case "unavailable":
      return {
        icon: ShieldAlert,
        headline: "No supported local runtime",
        detail: decision.reason,
      };
  }
}

const ROWS = MACHINES.map((machine) => {
  const outcome = planLocalJob(JOB, machine.hw, PROFILES);
  return { ...machine, outcome };
});

export function LocalJobPlanPanel() {
  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Cpu className="h-4 w-4" aria-hidden />
        Local job placement
      </h3>
      <p className="text-xs text-muted-foreground">
        Where a job would run, given the machine it is asked to run on. The profile recommender and
        the resource governor both have to agree; either one can refuse, and neither refusal is
        softened.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {ROWS.map((row) => {
          if (!row.outcome.ok) {
            return (
              <section key={row.label} className="rounded-lg border border-border/70 p-3">
                <p className="text-xs font-medium">{row.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>
                <p className="mt-1 text-[11px] text-destructive">{row.outcome.reason}</p>
              </section>
            );
          }
          const shown = describe(row.outcome.data);
          const Icon = shown.icon;
          return (
            <section key={row.label} className="rounded-lg border border-border/70 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {row.label}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{row.note}</p>
              <p className="mt-1.5 text-[11px] font-medium">{shown.headline}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{shown.detail}</p>
            </section>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Runtime boundary: these are declared machine snapshots, not a reading of your hardware. A
        browser cannot see installed RAM, free disk, GPU or battery. The decision logic shown is the
        same code the runtime calls; the machine descriptions are not measurements.
      </p>
    </GlassPanel>
  );
}
