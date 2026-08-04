import type { GpuPresence, HardwareProfile, HardwareSnapshot } from "./detect";
import { profileFrom } from "./detect";

/**
 * Measure the USER'S device, from the user's device.
 *
 * WHY THIS EXISTS — a defect, not a preference.
 *
 * Hardware detection was a server function. In local development the server IS
 * the user's machine, so it looked correct for a year. Hosted, it is not: the
 * first-run screen told a person on a laptop that "this machine has 251.69 GB
 * of memory", because that is how much memory the datacentre box running the
 * OCADE server had. The same mistake told them the local engine was "not
 * installed in any known location on this machine" — true of the server, false
 * of their computer, and unactionable either way.
 *
 * A web page cannot read RAM, disk or CPU the way an operating system can, and
 * pretending otherwise is what caused the bug. So every field here is either
 * measured through a real browser API or explicitly marked unknown, and the
 * consumer decides what to do with an unknown rather than receiving a
 * confident wrong number.
 *
 * WHAT EACH FIGURE IS REALLY WORTH
 *
 *  - `deviceMemory` is quantised to 0.25/0.5/1/2/4/8 and CAPPED AT 8 for
 *    fingerprinting reasons, and is absent in Firefox and Safari. A machine
 *    reporting 8 may have 8, 16, 32 or 256. It is therefore treated as a
 *    LOWER BOUND, never as the amount of memory present.
 *  - `storage.estimate()` returns the origin's quota, which is a fraction of
 *    free disk, not free disk. Useful as "there is at least this much", no more.
 *  - WebGPU is the only honest GPU signal available to a page, and its adapter
 *    info is deliberately vague. A software adapter is not acceleration and is
 *    reported as absent.
 */

export interface BrowserHardwareSnapshot extends HardwareSnapshot {
  /**
   * True when every figure came from a real browser API rather than a
   * fallback. False means at least one field is a floor, not a measurement.
   */
  precise: false;
  /** Memory figure is a lower bound imposed by the browser, not the real total. */
  memoryIsLowerBound: boolean;
}

const GIB = 1024 ** 3;

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean; platform?: string };
}

/**
 * `navigator.gpu` is typed by `@webgpu/types`, but it is NOT present in every
 * browser — Firefox and Safari have shipped without it. The real type says it
 * always exists, so it is read through an optional view rather than trusted,
 * and `requestAdapterInfo` is declared here because it is the older spelling
 * some browsers still ship in place of `adapter.info`.
 */
type MaybeWebGpuNavigator = Omit<Navigator, "gpu"> & { gpu?: GPU };
type AdapterWithLegacyInfo = GPUAdapter & {
  requestAdapterInfo?: () => Promise<GPUAdapterInfo>;
};

/** Vendors whose adapters genuinely accelerate inference. */
const ACCELERATING_VENDOR = /nvidia|amd|apple|intel/i;
/** A software rasteriser is not a GPU for our purposes. */
const SOFTWARE_ADAPTER = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;

async function probeGpu(): Promise<{
  present: GpuPresence;
  adapters: string[];
  discrete: string[];
  reason: string;
}> {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as MaybeWebGpuNavigator);
  if (!nav?.gpu) {
    return {
      present: "unknown",
      adapters: [],
      discrete: [],
      reason: "this browser does not expose WebGPU, so graphics capability cannot be measured",
    };
  }
  try {
    const adapter = (await nav.gpu.requestAdapter({
      powerPreference: "high-performance",
    })) as AdapterWithLegacyInfo | null;
    if (!adapter) {
      return {
        present: false,
        adapters: [],
        discrete: [],
        reason: "WebGPU reported no adapter at all",
      };
    }
    const info =
      adapter.info ??
      (adapter.requestAdapterInfo
        ? await adapter.requestAdapterInfo().catch(() => undefined)
        : undefined);
    const described = [info?.vendor, info?.architecture, info?.device, info?.description]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .trim();
    const name = described || "an unnamed adapter";
    if (SOFTWARE_ADAPTER.test(name)) {
      return {
        present: false,
        adapters: [name],
        discrete: [],
        reason: "the only adapter is a software renderer, which does not accelerate models",
      };
    }
    /*
     * WebGPU will not say whether an adapter is discrete. Rather than guess,
     * this reports acceleration as UNKNOWN when the vendor is recognised but
     * the class is not — an integrated Intel and a discrete NVIDIA both answer
     * here, and treating them alike is how a laptop ends up running a tier
     * meant for a workstation.
     */
    if (!described) {
      return {
        present: "unknown",
        adapters: [name],
        discrete: [],
        reason: "WebGPU exposed an adapter but withheld its identity",
      };
    }
    const accelerating = ACCELERATING_VENDOR.test(described) && !/intel/i.test(described);
    return {
      present: accelerating ? true : "unknown",
      adapters: [name],
      discrete: accelerating ? [name] : [],
      reason: accelerating
        ? `WebGPU reported ${name}`
        : `WebGPU reported ${name}, which may or may not accelerate models`,
    };
  } catch (error) {
    return {
      present: "unknown",
      adapters: [],
      discrete: [],
      reason: `the graphics probe failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function probeStorage(): Promise<number> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return 0;
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const used = estimate.usage ?? 0;
    // Quota is what this origin may use, not free disk. Reported as-is minus
    // what is already used, which is the honest "at least this much" figure.
    return Math.max(0, quota - used);
  } catch {
    return 0;
  }
}

/** Is this a phone or tablet shell? Storage, not speed, binds on those. */
export function detectMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithHints;
  if (typeof nav.userAgentData?.mobile === "boolean") return nav.userAgentData.mobile;
  return /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent ?? "");
}

/**
 * Is the OCADE server running on the SAME machine as this browser?
 *
 * This is the question that decides whether server-side measurement means
 * anything. On a desktop build or in local development the answer is yes and
 * the operating system's own figures are far better than anything a page can
 * see. Hosted, the answer is no, and server figures describe someone else's
 * computer entirely.
 */
export function serverIsThisMachine(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

/**
 * Measure what this browser is willing to reveal about the device.
 *
 * Never throws: a probe that fails contributes an unknown, because a settings
 * screen that crashes is worse than one that says it could not tell.
 */
export async function measureBrowserHardware(): Promise<BrowserHardwareSnapshot> {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as NavigatorWithHints);
  const [gpu, freeStorageBytes] = await Promise.all([probeGpu(), probeStorage()]);

  const memoryGib = typeof nav?.deviceMemory === "number" ? nav.deviceMemory : 0;
  const totalRamBytes = memoryGib > 0 ? memoryGib * GIB : 0;

  return {
    totalRamBytes,
    // No browser API reports free memory. Zero, not a guess.
    availableRamBytes: 0,
    freeStorageBytes,
    cpuCount: nav?.hardwareConcurrency ?? 0,
    cpuModel: null,
    arch: "unknown",
    platform: nav?.userAgentData?.platform ?? "browser",
    gpuPresent: gpu.present,
    gpuAdapters: gpu.adapters,
    gpuDiscrete: gpu.discrete,
    gpuReason: gpu.reason,
    isMobile: detectMobile(),
    measuredAt: new Date().toISOString(),
    precise: false,
    // 8 is the documented cap. At exactly 8 the real figure is unknowable here.
    memoryIsLowerBound: memoryGib >= 8,
  };
}

/** The same profile shape the rest of the product already consumes. */
export async function measureBrowserProfile(): Promise<HardwareProfile> {
  return profileFrom(await measureBrowserHardware());
}
