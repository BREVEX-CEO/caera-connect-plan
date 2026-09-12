/**
 * THE ONE ARTIFACT OFFLINE INTELLIGENCE INSTALLS, AND EVERYTHING KNOWN ABOUT IT.
 *
 * It was a catalogue of two engine families and four tiers, with a benchmark
 * store that promoted a device to a larger model after a fast generation and
 * demoted it again after a crash. Two families meant two differently compiled
 * copies of the same weights, and a promotion meant a second multi-gigabyte
 * download of a model the person already had. Neither survives install-once,
 * so there is one artifact.
 *
 * ITS FACTS ARE READ, NOT TYPED. Size, digest and URL come from the committed
 * `release/OCADE_MODEL_CATALOGUE.json`, which was generated from the
 * publisher's own file index and reviewed in a diff. A rounded constant here
 * once bricked on-device inference for everyone who successfully downloaded
 * the file: the size was 382,112 bytes too large, completeness never became
 * true, and every launch re-requested a range the server answered with 416.
 *
 * THE MODEL'S NAME IS NOT A CUSTOMER-FACING FACT. `label` is what a person may
 * see; the repository, the file name, the quantisation and the digest are
 * implementation detail. `describeInstall` is the one place a line about the
 * model reaches a person, and it names none of them.
 */

import catalogueJson from "../../../release/OCADE_MODEL_CATALOGUE.json";

const MB = 1024 * 1024;

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

export interface OfflineModel {
  /** OCADE capability label. Never a raw model id. */
  label: string;
  /** Key into the committed catalogue. */
  catalogueId: string;
  /**
   * Immutable identity of these bytes.
   *
   * INDEPENDENT OF THE APPLICATION BUILD, which is the whole of rule 5 in
   * `docs/RULES.md`: a deploy, a commit or a service-worker update changes the
   * website and changes nothing here, so a verified model is reused rather
   * than fetched again.
   */
  version: string;
  /** Published size in bytes, exact. Used for the storage pre-check. */
  downloadBytes: number;
  /** Approximate working set while running. */
  requiredMemoryBytes: number;
  contextTokens: number;
  /**
   * Whether deliberating before answering is worth it here.
   *
   * False, and that is the honest half of a Fast/Thinking switch: this engine
   * runs on the processor, where thinking multiplies the tokens produced
   * without improving the answer and turns a slow reply into a page that looks
   * hung.
   */
  thinkingSuitable: boolean;
}

export const OFFLINE_MODEL: OfflineModel = {
  label: "Offline Intelligence",
  catalogueId: "wasm-qwen2.5-1.5b-instruct-q4_k_m",
  version: "qwen2.5-1.5b-instruct-q4_k_m",
  downloadBytes: 1_117_320_736,
  requiredMemoryBytes: 1600 * MB,
  contextTokens: 4096,
  thinkingSuitable: false,
};

/** How much of the context window a system prompt may take. */
export const SYSTEM_PROMPT_BUDGET_FRACTION = 0.35;

export function systemPromptBudgetTokens(): number {
  return Math.floor(OFFLINE_MODEL.contextTokens * SYSTEM_PROMPT_BUDGET_FRACTION);
}

/**
 * How much more than the published requirement the engine must be allowed.
 *
 * The published figure is the weights plus the KV cache at the configured
 * context. It is not the tab: the page, the compositor and whatever else the
 * browser is drawing share the same device.
 */
export const MEMORY_HEADROOM_FRACTION = 0.15;

export function runtimeMemoryBytes(): number {
  return Math.round(OFFLINE_MODEL.requiredMemoryBytes * (1 + MEMORY_HEADROOM_FRACTION));
}

/** The committed, reviewed facts — or null when the catalogue lost the entry. */
export function resolved(): CatalogueEntry | null {
  return RESOLVED.get(OFFLINE_MODEL.catalogueId) ?? null;
}

/** Where the weights are fetched from. Static hosting, never an AI server. */
export function publisherUrl(): string | null {
  return resolved()?.url ?? null;
}

/**
 * The path this deployment would serve the weights from itself.
 *
 * The catalogue URL points at the publisher's host, which is correct for a
 * public deployment and useless for the installs that most need an on-device
 * engine: an air-gapped machine, a site whose egress policy blocks the model
 * host, a fleet that must not touch a third party on first run.
 *
 * An operator who serves the file from this origin at `/models/<file>` gets a
 * first run with no third-party request; one who does not is unaffected,
 * because this is probed and a 404 simply falls back. The digest is enforced
 * identically either way: self-hosting changes where the bytes come from,
 * never whether they are checked.
 *
 * Do not implement that route by copying the model into `public/models/` for
 * the Cloudflare Workers build — Workers rejects a static asset above 25 MiB.
 * Use a separate approved, range-capable model origin.
 */
export function sameOriginUrl(): string | null {
  const entry = resolved();
  return entry ? `/models/${entry.path}` : null;
}

/** The digest the download must match. */
export function expectedSha256(): string | undefined {
  return resolved()?.sha256;
}

/** Stable storage key for the weights. */
export function storageKey(): string | null {
  const entry = resolved();
  return entry ? `wasm/${entry.repo.replace(/[^a-z0-9]+/gi, "-")}/${entry.path}` : null;
}

/** Bytes → "1.04 GB", for the one line shown before a download starts. */
export function formatSize(bytes: number): string {
  return bytes >= 1024 * MB
    ? `${(bytes / (1024 * MB)).toFixed(2)} GB`
    : `${Math.round(bytes / MB)} MB`;
}
