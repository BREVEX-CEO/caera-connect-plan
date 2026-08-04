/**
 * OCADE Vision/3D — scene specification and pre-render validation.
 *
 * A scene can be perfectly well-formed JSON and still render as a black frame,
 * a white-out, or a mirror ball full of fireflies. Those failures cost minutes
 * or hours of render time to discover, and the error they produce afterwards
 * says nothing useful.
 *
 * This module checks the things that are knowable *before* rendering, and
 * refuses on the ones that guarantee a wasted render.
 *
 * WHAT IT DOES NOT DO.
 *
 * It does not render. There is no renderer in this environment, and
 * `RENDER_REALITY` says so in the words the user sees. "Validated" and
 * "rendered" are different claims, and a system that blurs them will eventually
 * report a finished image that does not exist. `assessScene` therefore returns
 * a readiness verdict and never an artefact.
 */
import { validateMesh, type Mesh } from "./mesh";

export type SceneOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/* ------------------------------------------------------------- materials -- */

export interface Material {
  name: string;
  /** Linear RGB, each channel 0–1. */
  baseColor: [number, number, number];
  /** 0 = dielectric, 1 = metal. Values between are physically meaningless. */
  metallic: number;
  /** 0 = mirror, 1 = fully diffuse. */
  roughness: number;
  /** Index of refraction. Must be ≥ 1: below that is not a real material. */
  ior?: number;
  /** Emissive radiance, linear RGB. Unbounded above — real emitters are bright. */
  emissive?: [number, number, number];
  /** 0 = fully transparent, 1 = opaque. */
  opacity?: number;
}

const inUnit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Validate a PBR material.
 *
 * The intermediate-metallic check is the interesting one: a metallic of 0.5 is
 * not "half metal", it is a value no real substance has, and it is almost
 * always a mistake — either a texture that should have been binary, or a value
 * someone tuned by eye to hide a lighting problem. It is reported rather than
 * refused, because layered materials do legitimately produce it.
 */
export function validateMaterial(m: Material): SceneOutcome<string[]> {
  const warnings: string[] = [];

  for (const [i, c] of m.baseColor.entries()) {
    if (!inUnit(c)) {
      return {
        ok: false,
        reason: `“${m.name}” has a base colour channel of ${c}. Linear colour channels run 0–1; a value outside that is either an sRGB byte that wasn't converted, or an error.`,
      };
    }
    if (c > 0.95 && i === 0 && m.baseColor.every((x) => x > 0.95)) {
      warnings.push(
        `“${m.name}” is almost pure white (${m.baseColor.map((x) => x.toFixed(2)).join(", ")}). No real diffuse surface reflects more than about 0.9; this will look washed out and bounce too much light.`,
      );
      break;
    }
  }

  if (!inUnit(m.metallic)) {
    return { ok: false, reason: `“${m.name}” has metallic ${m.metallic}, which is outside 0–1.` };
  }
  if (!inUnit(m.roughness)) {
    return { ok: false, reason: `“${m.name}” has roughness ${m.roughness}, which is outside 0–1.` };
  }
  if (m.metallic > 0.05 && m.metallic < 0.95) {
    warnings.push(
      `“${m.name}” has metallic ${m.metallic.toFixed(2)}. Real substances are metal or they aren't; values in between usually mean a texture that should be binary.`,
    );
  }
  if (m.roughness < 0.02 && m.metallic > 0.95) {
    warnings.push(
      `“${m.name}” is a perfect mirror (roughness ${m.roughness.toFixed(3)}). Path tracers produce bright speckle on these unless the renderer clamps; roughness 0.05 or above is usually what was wanted.`,
    );
  }
  if (m.ior !== undefined && (!Number.isFinite(m.ior) || m.ior < 1)) {
    return {
      ok: false,
      reason: `“${m.name}” has an index of refraction of ${m.ior}. Below 1 doesn't occur in nature — vacuum is exactly 1, water is 1.33, glass about 1.5.`,
    };
  }
  if (m.opacity !== undefined && !inUnit(m.opacity)) {
    return { ok: false, reason: `“${m.name}” has opacity ${m.opacity}, which is outside 0–1.` };
  }
  if (m.emissive?.some((c) => !Number.isFinite(c) || c < 0)) {
    return {
      ok: false,
      reason: `“${m.name}” has a negative emissive channel, which is not a thing.`,
    };
  }

  return {
    ok: true,
    data: warnings,
    evidence:
      warnings.length === 0
        ? `“${m.name}” is physically plausible.`
        : `“${m.name}” is usable, with ${warnings.length} thing${warnings.length === 1 ? "" : "s"} worth checking.`,
  };
}

/* -------------------------------------------------------------- lighting -- */

export type LightKind = "sun" | "point" | "area" | "environment";

export interface Light {
  name: string;
  kind: LightKind;
  /** Radiant intensity. Zero contributes nothing and is almost always a mistake. */
  intensity: number;
  color: [number, number, number];
}

/* ------------------------------------------------------------- animation -- */

export interface Keyframe {
  /** Seconds from the start. */
  time: number;
  value: number;
}

export interface AnimationTrack {
  target: string;
  property: string;
  keyframes: Keyframe[];
}

/**
 * Validate an animation track.
 *
 * Out-of-order or duplicate keyframe times are the classic source of an
 * animation that plays correctly in the editor and jumps in the export, because
 * different tools sort ties differently. Both are refused rather than sorted
 * silently — sorting would change the animation the user described.
 */
export function validateTrack(track: AnimationTrack): SceneOutcome<{ durationSeconds: number }> {
  const k = track.keyframes;
  if (k.length === 0) {
    return {
      ok: false,
      reason: `“${track.target}.${track.property}” has no keyframes, so it animates nothing.`,
    };
  }
  if (k.length === 1) {
    return {
      ok: false,
      reason: `“${track.target}.${track.property}” has one keyframe, which is a constant value rather than an animation.`,
    };
  }
  if (k.some((f) => !Number.isFinite(f.time) || f.time < 0)) {
    return {
      ok: false,
      reason: `“${track.target}.${track.property}” has a keyframe at an invalid time.`,
    };
  }
  if (k.some((f) => !Number.isFinite(f.value))) {
    return {
      ok: false,
      reason: `“${track.target}.${track.property}” has a keyframe with a non-numeric value.`,
    };
  }

  for (let i = 1; i < k.length; i++) {
    if (k[i].time === k[i - 1].time) {
      return {
        ok: false,
        reason: `“${track.target}.${track.property}” has two keyframes at ${k[i].time}s. Different tools break that tie differently, so the export won't match what you see.`,
      };
    }
    if (k[i].time < k[i - 1].time) {
      return {
        ok: false,
        reason: `“${track.target}.${track.property}” has keyframes out of order (${k[i - 1].time}s then ${k[i].time}s). OCADE won't reorder them — that would change the animation you described.`,
      };
    }
  }

  return {
    ok: true,
    data: { durationSeconds: k[k.length - 1].time - k[0].time },
    evidence: `${k.length} keyframes over ${(k[k.length - 1].time - k[0].time).toFixed(2)}s.`,
  };
}

/* ----------------------------------------------------------------- scene -- */

export interface SceneObject {
  name: string;
  mesh: Mesh;
  material: string;
}

export interface Scene {
  name: string;
  objects: SceneObject[];
  materials: Material[];
  lights: Light[];
  tracks?: AnimationTrack[];
}

export interface SceneReport {
  objects: number;
  triangles: number;
  materials: number;
  lights: number;
  /** Longest animation track, or 0 when the scene is static. */
  durationSeconds: number;
  /** Non-fatal things worth checking before committing render time. */
  warnings: string[];
}

/**
 * Decide whether a scene is worth rendering.
 *
 * The lighting check is the one that saves the most time: a scene with no light
 * and no emissive material renders a black frame, every time, and the renderer
 * reports success while doing it.
 */
export function assessScene(scene: Scene): SceneOutcome<SceneReport> {
  if (scene.objects.length === 0) {
    return { ok: false, reason: "This scene has no objects in it, so a render would be empty." };
  }

  const warnings: string[] = [];
  const materialNames = new Set(scene.materials.map((m) => m.name));
  if (materialNames.size !== scene.materials.length) {
    return {
      ok: false,
      reason:
        "This scene has a duplicate material name, so an object's material binding is ambiguous.",
    };
  }
  const objectNames = new Set(scene.objects.map((o) => o.name));
  if (objectNames.size !== scene.objects.length) {
    return {
      ok: false,
      reason:
        "This scene has a duplicate object name, so animation targets and exported nodes are ambiguous.",
    };
  }
  let triangles = 0;

  for (const obj of scene.objects) {
    const geometry = validateMesh(obj.mesh);
    if (!geometry.ok) {
      return { ok: false, reason: `“${obj.name}”: ${geometry.reason}` };
    }
    triangles += geometry.data.faces;

    if (!materialNames.has(obj.material)) {
      return {
        ok: false,
        reason: `“${obj.name}” uses material “${obj.material}”, which isn't in this scene. Renderers substitute a default grey and report success even when the result looks correct.`,
      };
    }
  }

  for (const m of scene.materials) {
    const check = validateMaterial(m);
    if (!check.ok) return check;
    warnings.push(...check.data);
  }

  for (const light of scene.lights) {
    if (!Number.isFinite(light.intensity) || light.intensity < 0) {
      return {
        ok: false,
        reason: `“${light.name}” has invalid light intensity ${light.intensity}. Intensity must be finite and non-negative.`,
      };
    }
    if (light.color.some((channel) => !Number.isFinite(channel) || channel < 0)) {
      return {
        ok: false,
        reason: `“${light.name}” has an invalid light colour. Linear light channels must be finite and non-negative.`,
      };
    }
  }

  const contributing = scene.lights.filter((l) => l.intensity > 0);
  const emissive = scene.materials.filter((m) => m.emissive?.some((c) => c > 0));

  if (contributing.length === 0 && emissive.length === 0) {
    return {
      ok: false,
      reason:
        "Nothing in this scene emits light, so it would render completely black. OCADE won't spend the render time to produce that.",
    };
  }
  if (contributing.length === 0) {
    warnings.push(
      `The only light comes from ${emissive.length} emissive material${emissive.length === 1 ? "" : "s"}. That renders, but it will be noisy without a light source.`,
    );
  }
  const dark = scene.lights.filter((l) => l.intensity === 0);
  if (dark.length > 0) {
    warnings.push(
      `${dark.length} light${dark.length === 1 ? " has" : "s have"} zero intensity and contribute${dark.length === 1 ? "s" : ""} nothing.`,
    );
  }

  let durationSeconds = 0;
  const targets = objectNames;
  for (const track of scene.tracks ?? []) {
    const t = validateTrack(track);
    if (!t.ok) return t;
    if (!targets.has(track.target)) {
      return {
        ok: false,
        reason: `An animation targets “${track.target}”, which isn't an object in this scene. It would silently animate nothing.`,
      };
    }
    durationSeconds = Math.max(durationSeconds, t.data.durationSeconds);
  }

  return {
    ok: true,
    data: {
      objects: scene.objects.length,
      triangles,
      materials: scene.materials.length,
      lights: scene.lights.length,
      durationSeconds,
      warnings,
    },
    evidence: `${scene.objects.length} objects, ${triangles} triangles, ${scene.materials.length} materials, ${contributing.length} contributing lights${durationSeconds > 0 ? `, ${durationSeconds.toFixed(2)}s of animation` : ", static"}.`,
  };
}

/**
 * What OCADE is entitled to say after `assessScene` succeeds.
 *
 * Exported as a constant so no caller can accidentally phrase a validation as a
 * finished render. See the module header.
 */
export const RENDER_REALITY =
  "This scene has been checked — geometry is watertight, materials are physically plausible, the lighting will produce an image and the animation is well-formed. No picture has been rendered: there is no renderer in this environment, and OCADE won't show you a frame it didn't produce.";
