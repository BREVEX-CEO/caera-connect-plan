/**
 * OCADE Vision/3D — can this video become a 3D model?
 *
 * Photogrammetry and structure-from-motion have a hard requirement that no
 * amount of compute removes: **the camera must move**. Reconstruction recovers
 * depth from parallax, and a locked-off shot, a pure pan from a tripod, or a
 * digital zoom contain none. The pixels look rich and the footage looks usable;
 * the geometry simply isn't in there.
 *
 * The failure mode this module exists to prevent is specific. Given unusable
 * footage, a reconstruction pipeline does not error — it produces a warped,
 * plausible-looking mesh with confident-looking texture. Someone measures off
 * it. So the feasibility gate runs FIRST, and refuses before any compute is
 * spent, naming what to shoot instead.
 *
 * WHAT THIS IS NOT.
 *
 * This does not reconstruct anything. Structure-from-motion needs feature
 * detection and bundle adjustment, which need libraries and a GPU that are not
 * present here. This is the gate in front of that pipeline: it decides whether
 * running it is honest, from frame metadata alone.
 */

export type FeasibilityOutcome =
  | { ok: true; data: FeasibilityReport; evidence: string }
  | { ok: false; reason: string; shootInstead: string };

export interface Frame {
  index: number;
  /** Seconds from the start of the clip. */
  timestamp: number;
  /**
   * Camera position in metres, when the capture reported one (ARKit/ARCore
   * pose, drone telemetry, gimbal log). Null when the video carries no pose.
   */
  position: [number, number, number] | null;
  /** Variance of Laplacian, or any comparable sharpness measure. Higher is sharper. */
  sharpness: number;
  /** Focal length in millimetres, to detect a zoom masquerading as movement. */
  focalLengthMm: number;
}

export interface FeasibilityReport {
  frames: number;
  /** Total camera travel in metres. */
  baselineMetres: number;
  /** Frames sharp enough to contribute features. */
  usableFrames: number;
  medianSharpness: number;
  /** Non-fatal issues that will degrade the result. */
  warnings: string[];
}

/**
 * Minimum camera travel. Below this, triangulation is numerically unstable and
 * the resulting mesh is confidently wrong rather than obviously wrong.
 */
export const MIN_BASELINE_M = 0.15;

/** A frame blurrier than this contributes noise instead of features. */
export const MIN_SHARPNESS = 100;

/** Fewer usable frames than this cannot constrain a solve. */
export const MIN_USABLE_FRAMES = 8;

const distance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Decide whether reconstruction is worth attempting.
 *
 * Every refusal carries `shootInstead`: a refusal that doesn't say what would
 * work leaves the user to guess, and they will usually re-shoot the same way.
 */
export function assessReconstruction(frames: Frame[]): FeasibilityOutcome {
  if (frames.length === 0) {
    return {
      ok: false,
      reason: "There are no frames to work from.",
      shootInstead: "Record a short clip walking around the subject.",
    };
  }
  if (frames.length < MIN_USABLE_FRAMES) {
    return {
      ok: false,
      reason: `Only ${frames.length} frames. A solve needs at least ${MIN_USABLE_FRAMES} to be constrained at all.`,
      shootInstead: "Record for longer — 20–30 seconds of steady movement is usually plenty.",
    };
  }
  const invalidTelemetry = frames.find(
    (frame) =>
      !Number.isInteger(frame.index) ||
      frame.index < 0 ||
      !Number.isFinite(frame.timestamp) ||
      frame.timestamp < 0 ||
      !Number.isFinite(frame.sharpness) ||
      frame.sharpness < 0 ||
      !Number.isFinite(frame.focalLengthMm) ||
      frame.focalLengthMm <= 0 ||
      (frame.position !== null &&
        (frame.position.length !== 3 ||
          frame.position.some((coordinate) => !Number.isFinite(coordinate)))),
  );
  if (invalidTelemetry) {
    return {
      ok: false,
      reason: `Frame ${invalidTelemetry.index} has invalid frame telemetry. Timestamps, sharpness, focal length and every supplied camera coordinate must be finite.`,
      shootInstead:
        "Export the camera track again without missing, infinite or non-numeric telemetry values.",
    };
  }

  const ordered = [...frames].sort((a, b) => a.timestamp - b.timestamp);
  const warnings: string[] = [];

  /* --- pose --- */
  const posed = ordered.filter((f) => f.position !== null);
  if (posed.length === 0) {
    return {
      ok: false,
      reason:
        "This video carries no camera positions, so OCADE cannot tell whether the camera moved. It won't reconstruct geometry on the assumption that it did — a static shot produces a warped mesh that looks convincing and measures wrongly.",
      shootInstead:
        "Record with a device that logs camera pose (most phone AR capture apps, or a drone with telemetry), or supply the camera track from your existing software.",
    };
  }
  if (posed.length < ordered.length) {
    warnings.push(
      `${ordered.length - posed.length} of ${ordered.length} frames have no camera position and will be dropped from the solve.`,
    );
  }

  let baselineMetres = 0;
  for (let i = 1; i < posed.length; i++) {
    baselineMetres += distance(posed[i - 1].position!, posed[i].position!);
  }

  /* --- zoom masquerading as movement --- */
  const focals = ordered.map((f) => f.focalLengthMm);
  const focalRange = Math.max(...focals) - Math.min(...focals);
  if (focalRange > 0.01 && baselineMetres < MIN_BASELINE_M * 4) {
    return {
      ok: false,
      reason: `The focal length changes across this clip (${Math.min(...focals)}–${Math.max(...focals)} mm) while the camera barely moves. Zooming changes the image without adding parallax, and a solver will read it as movement and produce a distorted scale.`,
      shootInstead: "Lock the zoom and move the camera instead.",
    };
  }

  if (baselineMetres < MIN_BASELINE_M) {
    return {
      ok: false,
      reason: `The camera moved ${baselineMetres.toFixed(3)} m in total. Depth comes from parallax, and below about ${MIN_BASELINE_M} m there isn't enough to triangulate — the result would be a plausible-looking mesh with no real geometry behind it.`,
      shootInstead:
        "Walk around the subject rather than panning from one spot. Rotation alone gives no parallax, however smooth it is.",
    };
  }
  if (focalRange > 0.01) {
    warnings.push(
      "The focal length changes during the clip. The solve will need to treat it as a varying intrinsic, which is slower and less accurate than a locked lens.",
    );
  }

  /* --- sharpness --- */
  const usable = ordered.filter((f) => f.sharpness >= MIN_SHARPNESS);
  if (usable.length < MIN_USABLE_FRAMES) {
    return {
      ok: false,
      reason: `Only ${usable.length} of ${ordered.length} frames are sharp enough to find features in. Motion blur removes exactly the detail a solve depends on.`,
      shootInstead: "Move more slowly, or record in brighter light so the shutter can be faster.",
    };
  }
  if (usable.length < ordered.length * 0.6) {
    warnings.push(
      `${ordered.length - usable.length} of ${ordered.length} frames are too blurred to use. The reconstruction will be sparser than the clip length suggests.`,
    );
  }

  const sorted = [...ordered.map((f) => f.sharpness)].sort((a, b) => a - b);
  const medianSharpness = sorted[Math.floor(sorted.length / 2)];

  /* --- coverage --- */
  const duration = ordered[ordered.length - 1].timestamp - ordered[0].timestamp;
  if (duration > 0 && baselineMetres / duration > 3) {
    warnings.push(
      `The camera averaged ${(baselineMetres / duration).toFixed(1)} m/s. That is fast enough that consecutive frames may not overlap, which breaks feature tracking.`,
    );
  }

  return {
    ok: true,
    data: {
      frames: ordered.length,
      baselineMetres,
      usableFrames: usable.length,
      medianSharpness,
      warnings,
    },
    evidence: `${usable.length} usable frames over ${baselineMetres.toFixed(2)} m of camera travel — enough parallax to attempt a solve.`,
  };
}

/**
 * What OCADE may say when the gate passes.
 *
 * Passing means the footage COULD support a reconstruction, not that one has
 * happened. Kept as a constant so the distinction cannot erode.
 */
export const RECONSTRUCTION_REALITY =
  "This footage has enough camera movement and sharp detail to attempt a reconstruction. OCADE has not built a model: structure-from-motion needs a solver that isn't available in this environment. What has been established is that running one would be worth the time, rather than producing a mesh with no real geometry behind it.";
