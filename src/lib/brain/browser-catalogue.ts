/**
 * Which model a browser gets, and why.
 *
 * SEPARATE FROM THE DESKTOP MANIFEST ON PURPOSE. The desktop tiers are GGUF
 * weights pulled by a local runtime that already knows the machine. A browser
 * is a different world: the weights must fit in GPU memory it cannot query
 * precisely, arrive over the network as static files, and survive being
 * evicted by the browser at any moment. Sharing one table would force one set
 * of numbers to be wrong for one of them.
 *
 * THE SIZES ARE DELIBERATELY SMALL. A 0.5B model is not impressive on paper;
 * it answers in a second on an integrated GPU and does not make a laptop
 * unusable, which is the entire point of the browser tier. Anything larger is
 * offered only after a real memory check, never on optimism.
 */

import catalogueJson from "../../../release/OCADE_BROWSER_MODEL_CATALOGUE.json";

export type BrowserEngineKind = "webgpu" | "wasm";

/**
 * Resolved facts about each downloadable tier — size, digest and URL — read
 * from the publisher's own file index at review time and committed.
 *
 * Imported rather than hand-written so a tier's declared size and its real
 * size cannot drift apart, and so the digest the downloader enforces is one a
 * human reviewed in a diff. `npm run browser-catalogue` regenerates it.
 */
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
  /** Ordering key: lower is smaller and safer. */
  rank: number;
  /** OCADE capability label. Never shown as a raw id in ordinary chat. */
  label: string;
  /** WebLLM's own model id, used only by the WebGPU adapter. */
  webllmId?: string;
  /**
   * Key into the committed catalogue, for tiers OCADE downloads itself.
   *
   * Absent on WebGPU tiers: WebLLM fetches and caches its own shards, so
   * OCADE has no file to verify there and does not pretend to.
   */
  catalogueId?: string;
  /** Approximate download in bytes, for the storage pre-check. */
  downloadBytes: number;
  /**
   * Approximate GPU memory needed while running. WebLLM publishes these as
   * `vram_required_MB`; they are the figure that decides whether a tier is
   * offered at all.
   */
  requiredMemoryBytes: number;
  /** Plain sentence explaining the pick, shown before any download. */
  because: string;
}

const MB = 1024 * 1024;

/**
 * WebGPU tiers.
 *
 * Ids are WebLLM's prebuilt ones. They are checked against the library's own
 * `prebuiltAppConfig` at probe time rather than trusted, because a hardcoded
 * id that disappears in a library update would otherwise fail as a confusing
 * runtime error instead of an honest "not available".
 */
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
      "A larger Qwen, offered only because this device reported enough graphics memory to run it without stalling.",
  },
];

/**
 * WebAssembly tiers.
 *
 * Only the smallest is offered, and that is a decision rather than an
 * omission. WASM inference runs on the CPU at a fraction of WebGPU speed; a
 * 1.5B model there produces a first token slowly enough that the user assumes
 * the page has hung. The fallback exists to keep a browser WORKING, not to
 * match the WebGPU experience, and pretending otherwise would be worse than
 * the honest limit.
 */
export const WASM_TIERS: BrowserModelTier[] = [
  {
    rank: 0,
    label: "OCADE Browser (compatibility)",
    catalogueId: "wasm-qwen2.5-0.5b-instruct-q4_k_m",
    // The real published size, not an estimate: 491,400,032 bytes.
    downloadBytes: 469 * MB,
    requiredMemoryBytes: 700 * MB,
    because:
      "This browser cannot use its graphics card for OCADE, so the engine runs on the processor instead. It is slower, and it is the reason OCADE still works here at all.",
  },
];

/** The committed, reviewed facts for a tier — or null if OCADE cannot fetch it. */
export function resolvedFor(tier: BrowserModelTier): CatalogueEntry | null {
  return tier.catalogueId ? (RESOLVED.get(tier.catalogueId) ?? null) : null;
}

/** Where a tier's weights are fetched from. Static hosting, no AI server. */
export function ggufUrl(tier: BrowserModelTier): string | null {
  return resolvedFor(tier)?.url ?? null;
}

/** The digest the download must match, from the committed catalogue. */
export function sha256For(tier: BrowserModelTier): string | undefined {
  return resolvedFor(tier)?.sha256;
}

/** Stable storage key for a tier's weights. */
export function storageKeyFor(tier: BrowserModelTier): string | null {
  const entry = resolvedFor(tier);
  return entry ? `wasm/${entry.repo.replace(/[^a-z0-9]+/gi, "-")}/${entry.path}` : null;
}

export function tiersFor(kind: BrowserEngineKind): BrowserModelTier[] {
  return kind === "webgpu" ? WEBGPU_TIERS : WASM_TIERS;
}

export interface TierChoice {
  tier: BrowserModelTier;
  /** Tiers passed over, with the measured reason. */
  skipped: { label: string; why: string }[];
}

/**
 * Evidence that a device has actually run a tier successfully.
 *
 * Stored per browser after a real generation completes. This is the ONLY thing
 * that promotes a device to a larger model.
 */
export interface TierBenchmark {
  /** Highest rank this device has completed a real generation on. */
  provenRank: number;
  /** Measured first-token latency at that rank, in milliseconds. */
  firstTokenMs: number;
}

/**
 * The slowest first token OCADE will accept before it stops promoting.
 *
 * Past this the chat stops feeling like a conversation, and a larger model
 * makes it worse rather than better.
 */
export const PROMOTION_LATENCY_CEILING_MS = 4000;

/**
 * Choose a tier for this device.
 *
 * START SMALL, PROMOTE ON EVIDENCE — and note what that rules out.
 *
 * The obvious implementation asks the GPU how much memory it has and picks the
 * biggest model that fits. It does not work, and this is worth recording
 * because the code originally did exactly that: WebGPU's `maxBufferSize` is
 * the largest single ALLOCATION an adapter permits, and browsers report a flat
 * 2 GB default for it on almost everything — including the integrated Intel
 * Iris Xe this was measured on. Treated as a memory budget it promoted nearly
 * every device to the larger tier, which is precisely the optimism that makes
 * a laptop unusable.
 *
 * So the ceiling can only ever EXCLUDE a tier, never justify one. Promotion
 * requires `benchmark` — evidence that this device already completed a real
 * generation at that rank, quickly enough to be worth it. An unmeasured
 * device gets the smallest model, every time.
 */
export function chooseBrowserTier(
  kind: BrowserEngineKind,
  ceilingBytes: number | null,
  benchmark?: TierBenchmark | null,
): TierChoice {
  const tiers = [...tiersFor(kind)].sort((a, b) => a.rank - b.rank);
  const skipped: { label: string; why: string }[] = [];

  let chosen = tiers[0];
  for (const t of tiers.slice(1)) {
    // 1. Hard ceiling. A tier the adapter cannot allocate is impossible.
    if (ceilingBytes !== null && ceilingBytes > 0 && t.requiredMemoryBytes > ceilingBytes) {
      skipped.push({
        label: t.label,
        why: `needs about ${(t.requiredMemoryBytes / MB).toFixed(0)} MB in one allocation; this device permits ${(ceilingBytes / MB).toFixed(0)} MB`,
      });
      continue;
    }

    // 2. Evidence. Nothing else promotes.
    if (!benchmark || benchmark.provenRank < t.rank) {
      skipped.push({
        label: t.label,
        why: "this device has not yet run a smaller engine fast enough to justify a larger one",
      });
      continue;
    }
    if (benchmark.firstTokenMs > PROMOTION_LATENCY_CEILING_MS) {
      skipped.push({
        label: t.label,
        why: `the smaller engine already takes ${(benchmark.firstTokenMs / 1000).toFixed(1)}s to start answering here, so a larger one would be worse`,
      });
      continue;
    }
    chosen = t;
  }
  return { tier: chosen, skipped };
}

/** Bytes → "340 MB", for the one line shown before a download starts. */
export function formatSize(bytes: number): string {
  return bytes >= 1024 * MB
    ? `${(bytes / (1024 * MB)).toFixed(2)} GB`
    : `${Math.round(bytes / MB)} MB`;
}
