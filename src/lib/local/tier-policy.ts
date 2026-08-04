/**
 * Which model this device gets (W3).
 *
 * The plan's §2 matrix names a model per device class in prose. B1 turned that
 * prose into a manifest with real tags, digests, sizes and licences resolved
 * from the runtime's own registry. Until now nothing read it: `grep` for
 * `qwen3` across `src/lib` returned a single comment. This module is what makes
 * the manifest the source of truth it was built to be.
 *
 * THE USER NEVER PICKS A MODEL. That is the requirement, and everything here
 * exists to honour it: measured hardware in, one tier out, with a sentence
 * explaining the choice.
 *
 * TWO RULES COME FROM MEASUREMENT, NOT FROM THE MATRIX
 * ----------------------------------------------------
 * 1. **14B requires a real GPU.** The matrix says "16 GB+ with a GPU", which
 *    reads as a preference. On this programme's own CPU-only 16 GB host,
 *    qwen3:14b managed 1.32 and 2.98 tok/s across two runs — under half of the
 *    8B tier on the same machine, at 50-128 s for one short answer. It did not
 *    fail; it degraded silently, which is worse for a user because nothing
 *    announces it. So the GPU is a requirement here, not a preference.
 *
 * 2. **4B is quarantined.** It leaks chain-of-thought into replies despite
 *    `think: false` — "Okay, the user wants... Hmm, they're probably..." — and
 *    ran to 274 and 448 tokens against a prompt the other tiers answered in
 *    50-56. A tier that cannot produce a clean answer is not shippable at any
 *    speed, so the weak-PC class falls back to 1.7B until that is fixed.
 *
 * Both are recorded in release/OCADE_B2_TIER_BENCHMARK.json and
 * release/OCADE_B3_HEAVY_TIER_EVIDENCE.json.
 */
import type { HardwareProfile } from "../hardware/detect";

/** A tier as resolved by B1. Only the fields a decision or a disclosure needs. */
export interface ManifestTier {
  id: string;
  tag: string;
  deviceClass: string;
  resolved: boolean;
  expectedStorageBytes: number;
  minimumRamBytes: number;
  recommendedRamBytes: number;
  model: { bytes: number; gib: number };
  quantization: string | null;
  licence: { identifierGuess: string } | null;
  rollbackTarget: string | null;
}

export interface TierManifest {
  tiers: ManifestTier[];
}

export type TierRefusal =
  "no_manifest" | "tier_unresolved" | "insufficient_storage" | "insufficient_ram";

export interface TierSelection {
  ok: true;
  tier: ManifestTier;
  /** Plain-language reason, suitable for showing the user verbatim. */
  because: string;
  /** Download size in GiB, for the one consent screen. */
  downloadGib: number;
  /** Set when a more capable tier was skipped, and why. */
  skipped: { tag: string; why: string }[];
}

export interface TierUnavailable {
  ok: false;
  failure: TierRefusal;
  reason: string;
  skipped: { tag: string; why: string }[];
}

export type TierOutcome = TierSelection | TierUnavailable;

const GIB = 1024 ** 3;

/** Tiers withheld from automatic selection, with the reason they are withheld. */
export const QUARANTINED_TAGS: Record<string, string> = {
  "qwen3:4b":
    "leaks its own reasoning into replies despite think:false, producing 274-448 tokens where other tiers use 50-56",
};

/** Tags that need real graphics acceleration to be usable, not merely faster. */
export const GPU_REQUIRED_TAGS = new Set(["qwen3:14b", "qwen3:30b-a3b"]);

/** The mobile tier, fixed regardless of the phone's specification. */
export const MOBILE_TAG = "qwen3:1.7b";

function byTag(manifest: TierManifest, tag: string): ManifestTier | undefined {
  return manifest.tiers.find((t) => t.tag === tag);
}

/**
 * Choose the tier for a device.
 *
 * Walks the manifest from most to least capable and returns the first tier the
 * machine can actually run, recording why each rejected tier was rejected so a
 * surprising choice can be explained rather than guessed at.
 */
export function selectTier(profile: HardwareProfile, manifest: TierManifest): TierOutcome {
  const skipped: { tag: string; why: string }[] = [];

  if (!manifest.tiers || manifest.tiers.length === 0) {
    return {
      ok: false,
      failure: "no_manifest",
      reason: "No model manifest is available.",
      skipped,
    };
  }

  /*
   * Mobile is decided before anything else is measured.
   *
   * On a phone the binding constraint is storage, not compute — a device with
   * plenty of RAM still should not spend several gigabytes of a user's storage
   * on weights. So the smallest tier is the answer regardless of specification,
   * and no capability comparison is performed at all.
   */
  if (profile.isMobile) {
    const tier = byTag(manifest, MOBILE_TAG);
    if (!tier || !tier.resolved) {
      return {
        ok: false,
        failure: "tier_unresolved",
        reason: `The mobile tier ${MOBILE_TAG} is not resolved in the manifest.`,
        skipped,
      };
    }
    return {
      ok: true,
      tier,
      because:
        "This is a phone, so OCADE uses its smallest model. On mobile the limit is storage rather than speed, and a larger model would cost gigabytes without being usable offline anyway.",
      downloadGib: Math.round((tier.expectedStorageBytes / GIB) * 100) / 100,
      skipped,
    };
  }

  // Most capable first; the first tier that genuinely fits wins.
  const candidates = [...manifest.tiers]
    .filter((t) => t.resolved)
    .sort((a, b) => b.model.bytes - a.model.bytes);

  if (candidates.length === 0) {
    return {
      ok: false,
      failure: "tier_unresolved",
      reason: "No tier in the manifest resolved to a real model.",
      skipped,
    };
  }

  const totalRamBytes = profile.totalRamGib * GIB;
  const freeStorageBytes = profile.freeStorageGib * GIB;

  for (const tier of candidates) {
    const quarantine = QUARANTINED_TAGS[tier.tag];
    if (quarantine) {
      skipped.push({ tag: tier.tag, why: quarantine });
      continue;
    }

    if (GPU_REQUIRED_TAGS.has(tier.tag) && !profile.hasDiscreteGpu) {
      skipped.push({
        tag: tier.tag,
        why: profile.gpuCertain
          ? "needs a dedicated graphics card; measured at under half the speed of a smaller model without one"
          : "needs a dedicated graphics card, and it could not be confirmed that this machine has one",
      });
      continue;
    }

    if (totalRamBytes > 0 && tier.minimumRamBytes > totalRamBytes) {
      skipped.push({
        tag: tier.tag,
        why: `needs about ${(tier.minimumRamBytes / GIB).toFixed(1)} GB of memory; this machine has ${profile.totalRamGib} GB`,
      });
      continue;
    }

    if (freeStorageBytes > 0 && tier.expectedStorageBytes > freeStorageBytes) {
      skipped.push({
        tag: tier.tag,
        why: `needs ${(tier.expectedStorageBytes / GIB).toFixed(1)} GB of free disk; only ${profile.freeStorageGib} GB is free`,
      });
      continue;
    }

    return {
      ok: true,
      tier,
      because: describeChoice(tier, profile),
      downloadGib: Math.round((tier.expectedStorageBytes / GIB) * 100) / 100,
      skipped,
    };
  }

  // Nothing fitted. Say which constraint bound, rather than a generic failure.
  const ramBound = skipped.some((s) => /memory/.test(s.why));
  return {
    ok: false,
    failure: ramBound ? "insufficient_ram" : "insufficient_storage",
    reason: ramBound
      ? `No model small enough for ${profile.totalRamGib} GB of memory is available.`
      : `There is not enough free disk space for any model. ${profile.freeStorageGib} GB is free.`,
    skipped,
  };
}

function describeChoice(tier: ManifestTier, profile: HardwareProfile): string {
  const gpu = profile.hasDiscreteGpu
    ? "a dedicated graphics card"
    : profile.gpuCertain
      ? "no dedicated graphics card"
      : "no graphics card OCADE could confirm";
  // The raw model name is deliberately absent: the user is told what their
  // machine has and what it costs, not which weights were selected.
  return (
    `This machine has ${profile.totalRamGib} GB of memory and ${gpu}, ` +
    `so OCADE selected the engine matched to that hardware. ` +
    `It downloads about ${(tier.expectedStorageBytes / GIB).toFixed(2)} GB and runs entirely on this computer.`
  );
}

/** One-line disclosure for the consent screen. Never names the raw model. */
export function consentLine(selection: TierSelection): string {
  return `OCADE will download about ${selection.downloadGib.toFixed(2)} GB to run privately on this device.`;
}
