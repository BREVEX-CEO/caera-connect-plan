/** Browser-local model tiers and conservative promotion policy. */
import catalogueJson from "../../../release/OCADE_BROWSER_MODEL_CATALOGUE.json";

export type BrowserEngineKind = "webgpu" | "wasm";

interface CatalogueEntry {
  id: string;
  repo: string;
  path: string;
  sizeBytes: number;
  sha256: string;
  url: string;
}

const RESOLVED = new Map<string, CatalogueEntry>(
  (catalogueJson.entries as CatalogueEntry[]).map((entry) => [entry.id, entry]),
);

export interface BrowserModelTier {
  rank: number;
  label: string;
  webllmId?: string;
  catalogueId?: string;
  downloadBytes: number;
  requiredMemoryBytes: number;
  because: string;
}

const MB = 1024 * 1024;

export const WEBGPU_TIERS: BrowserModelTier[] = [
  {
    rank: 0,
    label: "OCADE Browser",
    webllmId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    downloadBytes: 340 * MB,
    requiredMemoryBytes: 950 * MB,
    because:
      "The smallest Qwen that still holds a conversation. It fits comfortably in browser graphics memory and answers without making this device sluggish.",
  },
  {
    rank: 1,
    label: "OCADE Browser Plus",
    webllmId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    downloadBytes: 900 * MB,
    requiredMemoryBytes: 1880 * MB,
    because:
      "A larger Qwen, offered only after this browser has proven the smaller tier runs quickly enough and the adapter does not rule the larger allocation out.",
  },
];

export const WASM_TIERS: BrowserModelTier[] = [
  {
    rank: 0,
    label: "OCADE Browser (compatibility)",
    catalogueId: "wasm-qwen2.5-0.5b-instruct-q4_k_m",
    downloadBytes: 491_400_032,
    requiredMemoryBytes: 700 * MB,
    because:
      "This browser cannot use its graphics card for OCADE, so the engine runs on the processor instead. It is slower, and it is the reason OCADE still works here at all.",
  },
];

export function resolvedFor(tier: BrowserModelTier): CatalogueEntry | null {
  return tier.catalogueId ? (RESOLVED.get(tier.catalogueId) ?? null) : null;
}

export function ggufUrl(tier: BrowserModelTier): string | null {
  return resolvedFor(tier)?.url ?? null;
}

export function sameOriginGgufUrl(tier: BrowserModelTier): string | null {
  const entry = resolvedFor(tier);
  return entry ? `/models/${entry.path}` : null;
}

export function sha256For(tier: BrowserModelTier): string | undefined {
  return resolvedFor(tier)?.sha256;
}

export function storageKeyFor(tier: BrowserModelTier): string | null {
  const entry = resolvedFor(tier);
  return entry ? `wasm/${entry.repo.replace(/[^a-z0-9]+/gi, "-")}/${entry.path}` : null;
}

export function tiersFor(kind: BrowserEngineKind): BrowserModelTier[] {
  return kind === "webgpu" ? WEBGPU_TIERS : WASM_TIERS;
}

export interface TierChoice {
  tier: BrowserModelTier;
  skipped: { label: string; why: string }[];
}

/** Evidence from the most capable browser tier this device actually completed. */
export interface TierBenchmark {
  provenRank: number;
  firstTokenMs: number;
}

export const PROMOTION_LATENCY_CEILING_MS = 4000;

/**
 * Start small, then move up AT MOST ONE tier for each piece of measured proof.
 *
 * Previous code required `benchmark.provenRank >= candidate.rank`. That is
 * circular: an unmeasured device chose rank 0, recorded rank 0, and could never
 * satisfy the rank-1 requirement because it had to run rank 1 before being
 * allowed to choose rank 1. The larger tier was therefore unreachable.
 *
 * A candidate is justified by proof of the tier immediately below it. If more
 * tiers are added later, the loop deliberately stops after one promotion so a
 * single fast run can never leap several memory classes at once.
 */
export function chooseBrowserTier(
  kind: BrowserEngineKind,
  ceilingBytes: number | null,
  benchmark?: TierBenchmark | null,
): TierChoice {
  const tiers = [...tiersFor(kind)].sort((a, b) => a.rank - b.rank);
  const skipped: { label: string; why: string }[] = [];
  let chosen = tiers[0];

  for (const candidate of tiers.slice(1)) {
    if (
      ceilingBytes !== null &&
      ceilingBytes > 0 &&
      candidate.requiredMemoryBytes > ceilingBytes
    ) {
      skipped.push({
        label: candidate.label,
        why: `needs about ${(candidate.requiredMemoryBytes / MB).toFixed(0)} MB in one allocation; this device permits ${(ceilingBytes / MB).toFixed(0)} MB`,
      });
      continue;
    }

    if (!benchmark || benchmark.provenRank < chosen.rank) {
      skipped.push({
        label: candidate.label,
        why: "this device has not yet run the smaller engine fast enough to justify a larger one",
      });
      continue;
    }

    if (benchmark.firstTokenMs > PROMOTION_LATENCY_CEILING_MS) {
      skipped.push({
        label: candidate.label,
        why: `the smaller engine already takes ${(benchmark.firstTokenMs / 1000).toFixed(1)}s to start answering here, so a larger one would be worse`,
      });
      continue;
    }

    // Sequential evidence only: one measured tier can unlock one next tier.
    if (candidate.rank !== chosen.rank + 1) {
      skipped.push({
        label: candidate.label,
        why: "a nearer tier must be proven before this larger engine is considered",
      });
      continue;
    }

    chosen = candidate;
    break;
  }

  return { tier: chosen, skipped };
}

export function formatSize(bytes: number): string {
  return bytes >= 1024 * MB
    ? `${(bytes / (1024 * MB)).toFixed(2)} GB`
    : `${Math.round(bytes / MB)} MB`;
}
