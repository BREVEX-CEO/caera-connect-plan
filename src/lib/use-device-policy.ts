import { useEffect, useState } from "react";
import { detectHardwareFn } from "./hardware.functions";
import type { HardwareProfile } from "./hardware/detect";
import type { RoutePolicy } from "./local/router-policy";
import { measureBrowserProfile, serverIsThisMachine } from "./hardware/detect.browser";
import { routePolicyFor } from "./local/device-route-policy";
import { FIXED_MODEL, OCADE_MODEL_ID } from "./local/fixed-model";

/**
 * The device facts model routing needs — measured on the machine that will
 * actually run the model.
 *
 * THE DEFECT THIS EXISTS TO CLOSE
 *
 * This used to call a SERVER function and present the result as the user's
 * hardware. In local development the server is the user's machine, so it was
 * right by accident. Hosted, it was not: a person on a laptop was told "this
 * machine has 251.69 GB of memory" — the datacentre box's RAM — and, from the
 * same mistake, that their local engine was "not installed in any known
 * location on this machine". Both statements were about a computer they have
 * never touched.
 *
 * So the source is now chosen by a question with a real answer: is the OCADE
 * server running on this same machine? When it is (desktop build, local
 * development), the operating system's own figures are used, because nothing a
 * web page can see comes close. When it is not, the browser measures what it
 * can and says plainly that some of it is a floor rather than a fact.
 *
 * A LOWER BOUND IS NOT A MEASUREMENT. `navigator.deviceMemory` is capped at 8
 * GiB, so a 16 GB laptop and a 256 GB workstation both report 8. Treating that
 * as the total would exclude models the machine runs comfortably — which is
 * exactly what it did: the installed 5.97 GB vision model was computed to need
 * more than the ceiling and dropped. Where the figure is a known floor, the
 * memory-fit check is DISABLED rather than run on a number that is wrong in a
 * known direction.
 */
export type DeviceSource = "this_machine" | "browser_estimate" | "unavailable";

export interface DevicePolicy {
  /** Route policy fields, ready to spread into `routeTask`. */
  policy: RoutePolicy;
  profile: HardwareProfile | null;
  /** Where the numbers came from. Never hidden from the surfaces that show them. */
  source: DeviceSource;
  /** The tag the tier policy chose, when one could be chosen. */
  deviceMatchedModelId: string | null;
  /** Plain sentence explaining the choice, for the model badge/tooltip. */
  because: string | null;
  /** True only when the figures describe the user's own machine precisely. */
  measured: boolean;
  loading: boolean;
  /** Set when a probe failed. Never used to imply the device is weak. */
  problem: string | null;
}

const EMPTY: DevicePolicy = {
  policy: { totalRamBytes: undefined, hasDiscreteGpu: undefined, deviceMatchedModelId: null },
  profile: null,
  source: "unavailable",
  deviceMatchedModelId: null,
  because: null,
  measured: false,
  loading: true,
  problem: null,
};

/*
 * Policy construction lives in `local/device-route-policy` so that the paired
 * bridge and the evidence harness build the SAME policy this screen does.
 * While it lived here it was reachable only from React, and every non-React
 * caller therefore routed with no constraints at all — which selects the
 * largest installed model rather than the one this machine was matched to.
 */
const toPolicy = (profile: HardwareProfile, precise: boolean): RoutePolicy =>
  routePolicyFor(profile, precise);

export function useDevicePolicy(): DevicePolicy {
  const [state, setState] = useState<DevicePolicy>(EMPTY);

  useEffect(() => {
    let active = true;

    void (async () => {
      /*
       * The precise path, taken only when the server genuinely is this
       * machine. Anything else and these figures describe a stranger's
       * computer, which is the bug this whole module exists to prevent.
       */
      if (serverIsThisMachine()) {
        try {
          const profile = await detectHardwareFn();
          if (!active) return;
          setState({
            policy: toPolicy(profile, true),
            profile,
            source: "this_machine",
            /*
             * Measured, and reported — but no longer used to pick anything.
             * These figures still size the context window and drive the
             * diagnostics screen; the engine is the same on every machine.
             */
            deviceMatchedModelId: OCADE_MODEL_ID,
            because: `OCADE runs ${FIXED_MODEL.family} ${FIXED_MODEL.parameters} on every device, so nothing here changes which engine answers.`,
            measured: true,
            loading: false,
            problem: null,
          });
          return;
        } catch {
          // Fall through to the browser probe rather than surfacing an error:
          // the page can still measure something useful without the server.
        }
      }

      try {
        const profile = await measureBrowserProfile();
        if (!active) return;
        setState({
          policy: toPolicy(profile, false),
          profile,
          source: "browser_estimate",
          deviceMatchedModelId: OCADE_MODEL_ID,
          because: `OCADE runs ${FIXED_MODEL.family} ${FIXED_MODEL.parameters} on every device, so nothing here changes which engine answers.`,
          measured: false,
          loading: false,
          problem: null,
        });
      } catch (error) {
        if (!active) return;
        setState({
          ...EMPTY,
          loading: false,
          source: "unavailable",
          problem: `OCADE could not measure this device: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return state;
}

/** One sentence a surface can show verbatim about where the figures came from. */
export function describeDeviceSource(policy: DevicePolicy): string {
  switch (policy.source) {
    case "this_machine":
      return "Measured on this computer.";
    case "browser_estimate":
      return "Estimated in your browser. Browsers report memory as a capped lower bound, so OCADE does not use it to rule engines out.";
    default:
      return policy.problem ?? "This device could not be measured.";
  }
}
