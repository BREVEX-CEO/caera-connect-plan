import { selectTier, type TierManifest } from "./tier-policy";
import type { RoutePolicy } from "./router-policy";
import type { HardwareProfile } from "../hardware/detect";
import manifestJson from "../../../release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";

/**
 * Turn a measured machine into routing policy — in ONE place.
 *
 * This used to live inside the `useDevicePolicy` hook, which meant it was
 * reachable only from React. Everything else that had to route — the paired
 * bridge serving another device, and the evidence harness — passed an empty
 * policy instead, and an empty policy means "no constraints", which makes
 * `routeTask` pick the LARGEST installed model. On the reference machine that
 * selected a 14B model measured at 184 seconds to the first token, on hardware
 * that answers in seconds with the tier it was actually matched to. Nothing was
 * broken; it was simply routing on nothing.
 *
 * So the rule is now structural: if you route, you build the policy here.
 */
const GIB = 1024 ** 3;
const manifest = manifestJson as unknown as TierManifest;

/**
 * `precise` decides whether the memory figure is used at all.
 *
 * An imprecise total — a browser's capped `deviceMemory`, say — omits
 * `totalRamBytes` entirely rather than passing a number known to be too low.
 * `modelFit` treats an absent total as "do not check", which is the right
 * direction: refusing a model because of a cap the browser imposed is worse
 * than not checking at all.
 */
export function routePolicyFor(profile: HardwareProfile, precise: boolean): RoutePolicy {
  const tier = selectTier(profile, manifest);
  return {
    totalRamBytes: precise && profile.totalRamGib > 0 ? profile.totalRamGib * GIB : undefined,
    // Only assert "no GPU" when the probe was actually certain. An
    // inconclusive probe must not exclude tiers.
    hasDiscreteGpu: profile.gpuCertain ? profile.hasDiscreteGpu : undefined,
    deviceMatchedModelId: tier.ok ? tier.tier.tag : null,
  };
}

/** The tier this machine was matched to, and the sentence explaining why. */
export function tierFor(profile: HardwareProfile) {
  return selectTier(profile, manifest);
}
