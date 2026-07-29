import { Cpu, Gauge, HardDrive, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  RESOURCE_GOVERNOR_RUNTIME_BOUNDARY,
  SYNTHETIC_RESOURCE_PROFILES,
  planResourceTask,
  type ResourceCandidate,
  type ResourceTask,
} from "@/lib/skills/resource-governor-runtime";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const modelCandidates: ResourceCandidate[] = [
  {
    id: "model-lite",
    role: "model",
    quality: "preview",
    qualityScore: 1,
    minAvailableRamBytes: 1 * GB,
    minFreeStorageBytes: 1 * GB,
    requiresGpu: false,
    minVramBytes: 0,
    requiredBackends: [],
    maxParallelism: 1,
    previewScale: 0.4,
    changesEngineeringAccuracy: false,
  },
  {
    id: "model-balanced",
    role: "model",
    quality: "balanced",
    qualityScore: 2,
    minAvailableRamBytes: 6 * GB,
    minFreeStorageBytes: 5 * GB,
    requiresGpu: true,
    minVramBytes: 4 * GB,
    requiredBackends: ["webgpu"],
    maxParallelism: 3,
    previewScale: 0.7,
    changesEngineeringAccuracy: false,
  },
  {
    id: "model-full",
    role: "model",
    quality: "full",
    qualityScore: 3,
    minAvailableRamBytes: 24 * GB,
    minFreeStorageBytes: 20 * GB,
    requiresGpu: true,
    minVramBytes: 16 * GB,
    requiredBackends: ["cuda"],
    maxParallelism: 8,
    previewScale: 1,
    changesEngineeringAccuracy: false,
  },
];

const previewTask: ResourceTask = {
  id: "studio-model-preview",
  kind: "local_inference",
  role: "model",
  workUnits: 100,
  basis: {
    fixedMemoryBytes: 256 * MB,
    memoryBytesPerUnit: { min: 1 * MB, max: 2 * MB },
    storageBytesPerUnit: { min: 10_000, max: 20_000 },
    millisecondsPerUnit: { min: 100, max: 200 },
  },
  candidates: modelCandidates,
  accuracyCritical: false,
  checkpointable: true,
  cancellable: true,
};

const profileRows = (["weak", "medium", "strong"] as const).map((tier) => {
  const result = planResourceTask(previewTask, SYNTHETIC_RESOURCE_PROFILES[tier]);
  if (!result.ok) {
    return { tier, selected: "refused", parallelism: 0, scale: 0 };
  }
  return {
    tier,
    selected: result.data.selected?.id ?? result.data.status,
    parallelism: result.data.profile?.maxParallelism ?? 0,
    scale: result.data.profile?.previewScale ?? 0,
  };
});

export function ResourceGovernorPanel() {
  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Gauge className="h-4 w-4" aria-hidden />
        Resource Governor
      </h3>
      <p className="text-xs text-muted-foreground">
        Heavy local work is admitted only after an authenticated hardware snapshot, bounded
        memory/storage/duration estimates, tool selection, checkpoint planning and a reversible
        session or project profile.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {profileRows.map((profile) => (
          <section key={profile.tier} className="rounded-lg border border-border/70 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium capitalize">
              <Cpu className="h-3.5 w-3.5" aria-hidden />
              {profile.tier} profile
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{profile.selected}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {profile.parallelism} parallel · {Math.round(profile.scale * 100)}% preview
            </p>
          </section>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-[11px] text-muted-foreground">
          <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Disk reserve, current application load, battery, power and thermal state remain part of
          every decision.
        </p>
        <p className="flex items-start gap-2 rounded-lg border border-border/70 p-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Firmware, overclocking, drivers, global GPU settings and accuracy-critical engineering
          assumptions are outside this reversible control surface.
        </p>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Runtime boundary: {RESOURCE_GOVERNOR_RUNTIME_BOUNDARY}
      </p>
    </GlassPanel>
  );
}
