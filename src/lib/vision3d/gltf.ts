/**
 * OCADE Vision/3D — writing geometry out as glTF 2.0.
 *
 * Validated geometry that never leaves memory isn't a deliverable. This turns a
 * checked scene into a real `.gltf` file that Blender, three.js, Windows 3D
 * Viewer and every other conformant tool will open.
 *
 * The spec has a handful of requirements that are easy to omit and that
 * viewers handle by silently doing something wrong rather than erroring:
 *
 *  - **POSITION accessors MUST carry `min` and `max`.** They are how a viewer
 *    frames the model and builds its bounding volume. Omit them and the model
 *    loads, appears off-screen, and looks like a failed export.
 *  - **BufferView offsets must be aligned** to the component size. Misaligned
 *    data reads as garbage vertices on some GPUs and fine on others, so it
 *    passes local testing and fails for someone else.
 *  - **Accessor counts must match the data**, or a viewer walks off the end of
 *    the buffer.
 *
 * Every one of those is asserted before the file is returned, so an export that
 * would open wrongly is refused instead.
 */
import { validateMesh, vertexCount, faceCount, type Mesh } from "./mesh";
import { assessScene, type Material, type Scene } from "./scene";

export type GltfOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/** glTF component types used here. */
const FLOAT = 5126;
const UNSIGNED_INT = 5125;
/** ARRAY_BUFFER / ELEMENT_ARRAY_BUFFER. */
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

export interface GltfFile {
  /** The document, ready to `JSON.stringify`. */
  json: Record<string, unknown>;
  /** Total binary payload size, for the receipt. */
  bufferBytes: number;
}

const align4 = (n: number) => (n + 3) & ~3;

/**
 * Convert bytes to base64 without Node's Buffer, so this runs in the browser
 * too — the export is meant to work on the user's own device.
 */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked to avoid blowing the argument limit on large meshes.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return typeof btoa === "function"
    ? btoa(binary)
    : // eslint-disable-next-line no-undef
      Buffer.from(bytes).toString("base64");
}

/**
 * Write one scene as a self-contained glTF 2.0 document.
 *
 * Geometry is re-validated here rather than trusted: an export is the last
 * point at which a broken mesh can be caught before it becomes someone else's
 * problem in another tool.
 */
export function exportGltf(scene: Scene): GltfOutcome<GltfFile> {
  const sceneCheck = assessScene(scene);
  if (!sceneCheck.ok) {
    return {
      ok: false,
      reason: `This scene can't be exported because its validation failed: ${sceneCheck.reason}`,
    };
  }

  const materialIndex = new Map<string, number>();
  scene.materials.forEach((m, i) => materialIndex.set(m.name, i));

  const chunks: Uint8Array[] = [];
  let offset = 0;

  const bufferViews: Record<string, number>[] = [];
  const accessors: Record<string, unknown>[] = [];
  const meshes: Record<string, unknown>[] = [];
  const nodes: Record<string, unknown>[] = [];

  for (const obj of scene.objects) {
    const check = validateMesh(obj.mesh);
    if (!check.ok) {
      return { ok: false, reason: `“${obj.name}” can't be exported: ${check.reason}` };
    }
    if (!materialIndex.has(obj.material)) {
      return {
        ok: false,
        reason: `“${obj.name}” uses material “${obj.material}”, which isn't in this scene. The export would open with a default grey and look correct.`,
      };
    }

    const positions = new Float32Array(obj.mesh.positions);
    const indices = new Uint32Array(obj.mesh.indices);

    /* --- positions --- */
    const posBytes = new Uint8Array(positions.buffer.slice(0));
    const posPad = align4(offset) - offset;
    if (posPad > 0) {
      chunks.push(new Uint8Array(posPad));
      offset += posPad;
    }
    const posView = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: posBytes.length,
      target: ARRAY_BUFFER,
    });
    chunks.push(posBytes);
    offset += posBytes.length;

    // min/max are REQUIRED on POSITION. Computed from the real data.
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], positions[i + a]);
        max[a] = Math.max(max[a], positions[i + a]);
      }
    }

    const posAccessor = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: FLOAT,
      count: vertexCount(obj.mesh),
      type: "VEC3",
      min,
      max,
    });

    /* --- indices --- */
    const idxBytes = new Uint8Array(indices.buffer.slice(0));
    const idxPad = align4(offset) - offset;
    if (idxPad > 0) {
      chunks.push(new Uint8Array(idxPad));
      offset += idxPad;
    }
    const idxView = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: idxBytes.length,
      target: ELEMENT_ARRAY_BUFFER,
    });
    chunks.push(idxBytes);
    offset += idxBytes.length;

    const idxAccessor = accessors.length;
    accessors.push({
      bufferView: idxView,
      componentType: UNSIGNED_INT,
      count: obj.mesh.indices.length,
      type: "SCALAR",
    });

    meshes.push({
      name: obj.name,
      primitives: [
        {
          attributes: { POSITION: posAccessor },
          indices: idxAccessor,
          material: materialIndex.get(obj.material),
          mode: 4, // TRIANGLES
        },
      ],
    });
    nodes.push({ name: obj.name, mesh: meshes.length - 1 });
  }

  /* --- assemble the binary buffer --- */
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new Uint8Array(total);
  let cursor = 0;
  for (const c of chunks) {
    buffer.set(c, cursor);
    cursor += c.length;
  }

  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "OCADE" },
    scene: 0,
    scenes: [{ name: scene.name, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials: scene.materials.map(toGltfMaterial),
    accessors,
    bufferViews,
    buffers: [
      {
        byteLength: total,
        uri: `data:application/octet-stream;base64,${toBase64(buffer)}`,
      },
    ],
  };

  const verdict = validateGltf(json);
  if (!verdict.ok) {
    // Producing an invalid file and handing it over is exactly the failure this
    // module exists to prevent.
    return { ok: false, reason: `The export failed its own conformance check: ${verdict.reason}` };
  }

  const triangles = scene.objects.reduce((n, o) => n + faceCount(o.mesh), 0);
  return {
    ok: true,
    data: { json, bufferBytes: total },
    evidence: `glTF 2.0, ${scene.objects.length} object${scene.objects.length === 1 ? "" : "s"}, ${triangles} triangles, ${total} bytes of geometry, conformance-checked.`,
  };
}

/** Map OCADE's material onto glTF's metallic-roughness model. */
function toGltfMaterial(m: Material): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: m.name,
    pbrMetallicRoughness: {
      baseColorFactor: [...m.baseColor, m.opacity ?? 1],
      metallicFactor: m.metallic,
      roughnessFactor: m.roughness,
    },
  };
  if (m.emissive?.some((c) => c > 0)) out.emissiveFactor = m.emissive;
  // glTF requires BLEND for anything not fully opaque, or viewers render it solid.
  if (m.opacity !== undefined && m.opacity < 1) out.alphaMode = "BLEND";
  return out;
}

/* ---------------------------------------------------------- conformance -- */

/**
 * Check a glTF document against the parts of the spec that viewers handle by
 * silently doing something wrong.
 *
 * Exported so a document from anywhere can be checked, not only ones written
 * here.
 */
export function validateGltf(json: Record<string, unknown>): GltfOutcome<{ accessors: number }> {
  const asset = json.asset as { version?: string } | undefined;
  if (asset?.version !== "2.0") {
    return { ok: false, reason: "This document doesn't declare glTF asset version 2.0." };
  }

  const accessors = (json.accessors ?? []) as Record<string, unknown>[];
  const bufferViews = (json.bufferViews ?? []) as Record<string, number>[];
  const buffers = (json.buffers ?? []) as { byteLength: number }[];
  const meshes = (json.meshes ?? []) as Record<string, unknown>[];

  if (accessors.length === 0)
    return { ok: false, reason: "This document has no accessors, so it has no geometry." };

  for (const [i, a] of accessors.entries()) {
    const viewIndex = a.bufferView as number;
    const view = bufferViews[viewIndex];
    if (!view)
      return {
        ok: false,
        reason: `Accessor ${i} points at buffer view ${viewIndex}, which doesn't exist.`,
      };

    const componentSize = a.componentType === FLOAT || a.componentType === UNSIGNED_INT ? 4 : 0;
    if (componentSize === 0) {
      return { ok: false, reason: `Accessor ${i} uses a component type OCADE doesn't write.` };
    }
    const components = a.type === "VEC3" ? 3 : a.type === "SCALAR" ? 1 : 0;
    if (components === 0) {
      return { ok: false, reason: `Accessor ${i} has an unsupported type “${String(a.type)}”.` };
    }

    // Alignment: misaligned data reads as garbage on some GPUs and fine on
    // others, so it passes locally and fails for someone else.
    if (view.byteOffset % componentSize !== 0) {
      return {
        ok: false,
        reason: `Buffer view ${viewIndex} starts at byte ${view.byteOffset}, which isn't aligned to its ${componentSize}-byte components. Some GPUs read this as garbage.`,
      };
    }

    const needed = (a.count as number) * components * componentSize;
    if (needed !== view.byteLength) {
      return {
        ok: false,
        reason: `Accessor ${i} says ${a.count} elements (${needed} bytes) but its buffer view holds ${view.byteLength}. A viewer would read past the end.`,
      };
    }

    if (view.byteOffset + view.byteLength > (buffers[view.buffer]?.byteLength ?? 0)) {
      return { ok: false, reason: `Buffer view ${viewIndex} runs past the end of its buffer.` };
    }
  }

  // POSITION must carry min/max, or the model loads off-screen and looks broken.
  for (const [mi, mesh] of meshes.entries()) {
    const primitives = (mesh.primitives ?? []) as Record<string, unknown>[];
    for (const [pi, p] of primitives.entries()) {
      const attrs = p.attributes as Record<string, number> | undefined;
      const pos = attrs?.POSITION;
      if (pos === undefined) {
        return { ok: false, reason: `Mesh ${mi} primitive ${pi} has no POSITION attribute.` };
      }
      const a = accessors[pos];
      if (!Array.isArray(a?.min) || !Array.isArray(a?.max)) {
        return {
          ok: false,
          reason: `The POSITION accessor for mesh ${mi} has no min/max. The spec requires them — without them a viewer can't frame the model, and it loads off-screen looking like a failed export.`,
        };
      }
      if ((a.min as number[]).length !== 3 || (a.max as number[]).length !== 3) {
        return {
          ok: false,
          reason: `The POSITION accessor for mesh ${mi} has min/max of the wrong length.`,
        };
      }
      for (let k = 0; k < 3; k++) {
        if ((a.min as number[])[k] > (a.max as number[])[k]) {
          return {
            ok: false,
            reason: `The POSITION accessor for mesh ${mi} has min greater than max on axis ${k}.`,
          };
        }
      }
    }
  }

  return {
    ok: true,
    data: { accessors: accessors.length },
    evidence: `${meshes.length} meshes, ${accessors.length} accessors, all aligned and sized correctly.`,
  };
}

/** Serialise for download. Pretty-printed: these files get read by people. */
export function serialiseGltf(file: GltfFile): string {
  return JSON.stringify(file.json, null, 2);
}
