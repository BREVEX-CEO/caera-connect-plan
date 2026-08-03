import { useEffect, useState } from "react";
import { detectHardwareFn } from "./hardware.functions";
import { selectTier, type TierManifest } from "./local/tier-policy";
import type { HardwareProfile } from "./hardware/detect";
import type { RoutePolicy } from "./local/router-policy";
import { browserTotalRamBytes } from "./ocade-local";
import manifestJson from "../../release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json";

const manifest = manifestJson as unknown as TierManifest;
const GIB = 1024 ** 3;

/**
 * The device facts model routing needs, measured on the machine rather than
 * guessed at in the browser.
 *
 * WHY THIS EXISTS
 *
 * Chat used to route on `navigator.deviceMemory` alone. That API is coarse by
 * design (capped at 8 GiB for fingerprinting reasons) and absent in Firefox and
 * Safari, and the consequences were not cosmetic on a real 16 GB machine:
 *
 *  - reported 8 GiB → a 0.8 headroom ceiling of 6.9 GB → the installed 5.97 GB
 *    vision model was computed to need 7.2 GB and was EXCLUDED, so image
 *    questions were refused on a machine that answers them;
 *  - no GPU signal at all, so the router kept a tier that needs acceleration
 *    and measured 184 SECONDS to first token here;
 *  - no knowledge of the tier the hardware policy had already chosen, so the
 *    router and `selectTier` disagreed about the same computer.
 *
 * The server function measures the real machine and returns a rounded profile
 * only — no CPU string, no adapter names — so nothing more identifying crosses
 * to the page than what the user is being shown anyway.
 *
 * FALLBACK IS DEGRADED, AND SAYS SO. If measurement fails, the browser figure
 * is used and `measured` is false, so a surface can explain that routing is
 * running on an estimate instead of silently pretending it is not.
 */
export interface DevicePolicy {
  /** Route policy fields, ready to spread into `routeTask`. */
  policy: RoutePolicy;
  profile: HardwareProfile | null;
  /** The tag the tier policy chose, when one could be chosen. */
  deviceMatchedModelId: string | null;
  /** Plain sentence explaining the choice, for the model badge/tooltip. */
  because: string | null;
  /** False when the profile came from the browser estimate, not the machine. */
  measured: boolean;
  loading: boolean;
  /** Set when measurement failed; the estimate is in use. */
  problem: string | null;
}

/**
 * Browser-only estimate. Kept as a fallback rather than a primary source: an
 * undetectable machine still gets a route, it just gets one that says it is
 * unmeasured.
 */
function estimatedPolicy(problem: string | null): DevicePolicy {
  const totalRamBytes = browserTotalRamBytes();
  return {
    policy: {
      // `undefined` disables the fit check rather than substituting a guess,
      // which is the existing documented behaviour of `modelFit`.
      totalRamBytes,
      // Deliberately NOT false: claiming "no GPU" on no evidence would exclude
      // tiers a machine may well handle. Unknown leaves them in play.
      hasDiscreteGpu: undefined,
      deviceMatchedModelId: null,
    },
    profile: null,
    deviceMatchedModelId: null,
    because: null,
    measured: false,
    loading: false,
    problem,
  };
}

export function useDevicePolicy(): DevicePolicy {
  const [state, setState] = useState<DevicePolicy>({
    ...estimatedPolicy(null),
    loading: true,
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const profile = await detectHardwareFn();
        if (!active) return;
        const tier = selectTier(profile, manifest);
        setState({
          policy: {
            totalRamBytes: profile.totalRamGib * GIB,
            // Only assert "no GPU" when the probe was actually certain. An
            // inconclusive probe must not exclude tiers.
            hasDiscreteGpu: profile.gpuCertain ? profile.hasDiscreteGpu : undefined,
            deviceMatchedModelId: tier.ok ? tier.tier.tag : null,
          },
          profile,
          deviceMatchedModelId: tier.ok ? tier.tier.tag : null,
          because: tier.ok ? tier.because : tier.reason,
          measured: true,
          loading: false,
          problem: null,
        });
      } catch (error) {
        if (!active) return;
        setState(
          estimatedPolicy(
            `OCADE could not measure this device, so engine selection is running on a browser estimate: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
