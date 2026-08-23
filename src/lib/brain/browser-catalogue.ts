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
  /**
   * The context window OCADE runs this tier with, in tokens.
   *
   * Stated here rather than left to the runtime's default, because the default
   * is what decides whether the system prompt fits and a silent library change
   * would silently truncate OCADE's rules. Qwen2.5 is trained to 32k, but a
   * 32k KV cache for a 0.5B model in a browser tab costs more memory than the
   * weights do; 4,096 is the value these tiers are sized and measured for.
   */
  contextTokens: number;
}

/**
 * How much of the window the system message may take.
 *
 * The rest is the conversation. At 4,096 this leaves about 2,700 tokens for
 * history and the answer, which is a usable chat; giving the prompt more would
 * buy stricter rules the user could not then talk to.
 */
export const SYSTEM_PROMPT_BUDGET_FRACTION = 0.35;

/** Tokens available for the system message on a tier. */
export function systemPromptBudgetFor(tier: BrowserModelTier): number {
  return Math.floor(tier.contextTokens * SYSTEM_PROMPT_BUDGET_FRACTION);
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
    contextTokens: 4096,
    because:
      "The smallest Qwen that still holds a conversation. It fits comfortably in browser graphics memory and answers without making this device sluggish.",
  },
  {
    rank: 1,
    label: "OCADE Browser Plus",
    webllmId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    downloadBytes: 900 * MB,
    requiredMemoryBytes: 1880 * MB,
    contextTokens: 4096,
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
    /*
     * EXACT, and it has to be. `469 * MB` was written here beside a comment
     * correctly stating the real size — 382,112 bytes more than the file that
     * actually exists. The download completed and then never opened again:
     * `alreadyHave >= expectedBytes` stayed false, so every later launch
     * re-requested `Range: bytes=491400032-`, the server answered 416, and the
     * engine reported a network failure. A rounded constant permanently
     * bricked on-device inference for anyone who successfully downloaded it.
     *
     * `model-download.ts` no longer trusts this number for completeness — the
     * verified digest decides that — but it stays exact so progress reaches
     * 100% instead of stalling at 99.9%.
     */
    downloadBytes: 491_400_032,
    requiredMemoryBytes: 700 * MB,
    contextTokens: 4096,
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

/**
 * The path this deployment would serve the weights from itself.
 *
 * WHY THIS IS NOT THE SAME QUESTION AS `ggufUrl`. The catalogue URL points at
 * the publisher's host, which is correct for a public deployment and useless
 * for the ones that most need a local engine: an air-gapped install, a site
 * whose egress policy blocks the model host, a fleet that must not fetch
 * anything from a third party on first run. Those are exactly the environments
 * where "download it once while online" is not a step anyone can take.
 *
 * An operator who drops the .gguf into `public/models/` therefore gets a
 * first run with no external request at all, and one who does not is
 * unaffected — this is probed, and a 404 simply means the catalogue URL is
 * used as before. Nothing is assumed present.
 *
 * The digest is enforced identically either way: self-hosting changes where
 * the bytes come from, never whether they are checked.
 */
export function sameOriginGgufUrl(tier: BrowserModelTier): string | null {
  const entry = resolvedFor(tier);
  return entry ? `/models/${entry.path}` : null;
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
  /**
   * Lowest rank that has FAILED on this device — crashed, ran out of memory,
   * or answered slower than the ceiling once actually loaded.
   *
   * Without this, a device that is fast at rank 0 is promoted to rank 1, rank
   * 1 dies, the device falls back to rank 0, is fast again, and is promoted
   * again. The loop is silent and costs the user a large download every time.
   * A recorded failure is what makes the fallback permanent.
   */
  failedRank?: number;
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

    /*
     * 2. A TIER THAT ALREADY FAILED HERE IS NOT OFFERED AGAIN.
     *
     * Checked before the evidence rule, because a device that is fast at the
     * smaller tier is exactly the device the evidence rule would promote —
     * straight back into the crash it just recovered from.
     */
    if (benchmark?.failedRank !== undefined && t.rank >= benchmark.failedRank) {
      skipped.push({
        label: t.label,
        why: "this engine did not run properly on this device last time, so OCADE is staying with the one that works",
      });
      continue;
    }

    /*
     * 3. EVIDENCE — proving the tier BELOW earns a trial of this one.
     *
     * This read `benchmark.provenRank < t.rank` -> skip, which required a
     * device to have already proven rank 1 in order to be offered rank 1.
     * `recordBenchmark` only ever records a rank the device was ALLOWED to
     * run, and every device starts at rank 0, so `provenRank` could never
     * exceed 0 and no device on earth could be promoted. The rule was written
     * as "you must have proven THIS tier" when what it meant was "you must
     * have proven the tier below it".
     *
     * Promotion is still one step at a time: proving rank 0 unlocks a trial of
     * rank 1 and nothing further, so a device climbs only as far as it keeps
     * demonstrating it can.
     */
    if (!benchmark || benchmark.provenRank < t.rank - 1) {
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
