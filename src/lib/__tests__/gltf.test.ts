import { describe, it, expect } from "vitest";
import { exportGltf, validateGltf, serialiseGltf } from "../vision3d/gltf";
import { buildBox, buildSphere } from "../vision3d/mesh";
import type { Scene } from "../vision3d/scene";

/**
 * These decode the exported buffer back into real numbers and check them
 * against the mesh that went in. An export test that only asserted "it produced
 * JSON" would pass on a file that opens as an empty scene.
 */

const cube = () => {
  const b = buildBox(2, 2, 2);
  if (!b.ok) throw new Error("fixture failed");
  return b.data;
};

const scene = (over: Partial<Scene> = {}): Scene => ({
  name: "test",
  objects: [{ name: "Cube", mesh: cube(), material: "Plastic" }],
  materials: [{ name: "Plastic", baseColor: [0.8, 0.2, 0.2], metallic: 0, roughness: 0.5 }],
  lights: [{ name: "Key", kind: "sun", intensity: 3, color: [1, 1, 1] }],
  ...over,
});

function exported(s: Scene = scene()) {
  const r = exportGltf(s);
  if (!r.ok) throw new Error(`export failed: ${r.reason}`);
  return r.data;
}

/** Decode the base64 payload back into bytes, as a viewer would. */
function payload(json: Record<string, unknown>): Uint8Array {
  const buffers = json.buffers as { uri: string }[];
  const b64 = buffers[0].uri.split(",")[1];
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

describe("the export is a real, loadable glTF", () => {
  it("declares glTF 2.0 and a default scene", () => {
    const { json } = exported();
    expect((json.asset as { version: string }).version).toBe("2.0");
    expect(json.scene).toBe(0);
    expect((json.scenes as unknown[]).length).toBe(1);
  });

  it("round-trips through JSON, which is how it will be read", () => {
    const text = serialiseGltf(exported());
    const parsed = JSON.parse(text);
    expect(validateGltf(parsed).ok).toBe(true);
  });

  /**
   * The real check: decode the buffer and confirm the vertices that come back
   * are the vertices that went in.
   */
  it("writes vertex data a viewer can decode back to the original", () => {
    const mesh = cube();
    const { json } = exported();
    const bytes = payload(json);

    const accessors = json.accessors as Record<string, number>[];
    const views = json.bufferViews as Record<string, number>[];
    const posView = views[accessors[0].bufferView];

    const positions = new Float32Array(
      bytes.buffer.slice(posView.byteOffset, posView.byteOffset + posView.byteLength),
    );
    expect(positions.length).toBe(mesh.positions.length);
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]).toBeCloseTo(mesh.positions[i], 5);
    }
  });

  it("writes indices that decode back to the original triangles", () => {
    const mesh = cube();
    const { json } = exported();
    const bytes = payload(json);

    const accessors = json.accessors as Record<string, number>[];
    const views = json.bufferViews as Record<string, number>[];
    const idxView = views[accessors[1].bufferView];

    const indices = new Uint32Array(
      bytes.buffer.slice(idxView.byteOffset, idxView.byteOffset + idxView.byteLength),
    );
    expect([...indices]).toEqual(mesh.indices);
  });

  /**
   * min/max are REQUIRED on POSITION. Without them a model loads off-screen and
   * looks like a failed export — the commonest broken-glTF symptom there is.
   */
  it("computes POSITION min and max from the real data", () => {
    const { json } = exported();
    const pos = (json.accessors as Record<string, unknown>[])[0];
    // A 2×2×2 box centred on the origin.
    expect(pos.min).toEqual([-1, -1, -1]);
    expect(pos.max).toEqual([1, 1, 1]);
  });

  it("aligns every buffer view to its component size", () => {
    const { json } = exported({
      ...scene(),
      objects: [
        { name: "Cube", mesh: cube(), material: "Plastic" },
        { name: "Ball", mesh: sphere(), material: "Plastic" },
      ],
    });
    for (const view of json.bufferViews as Record<string, number>[]) {
      expect(view.byteOffset % 4, `view at ${view.byteOffset}`).toBe(0);
    }
  });

  it("sizes the buffer to hold exactly what the views claim", () => {
    const { json, bufferBytes } = exported();
    const bytes = payload(json);
    expect(bytes.length).toBe(bufferBytes);
    for (const view of json.bufferViews as Record<string, number>[]) {
      expect(view.byteOffset + view.byteLength).toBeLessThanOrEqual(bufferBytes);
    }
  });

  it("exports several objects as separate nodes and meshes", () => {
    const { json } = exported({
      ...scene(),
      objects: [
        { name: "Cube", mesh: cube(), material: "Plastic" },
        { name: "Ball", mesh: sphere(), material: "Plastic" },
      ],
    });
    expect((json.nodes as unknown[]).length).toBe(2);
    expect((json.meshes as unknown[]).length).toBe(2);
    expect((json.accessors as unknown[]).length).toBe(4);
  });

  it("maps materials onto glTF's metallic-roughness model", () => {
    const { json } = exported();
    const m = (json.materials as Record<string, unknown>[])[0];
    const pbr = m.pbrMetallicRoughness as Record<string, unknown>;
    expect(pbr.baseColorFactor).toEqual([0.8, 0.2, 0.2, 1]);
    expect(pbr.metallicFactor).toBe(0);
    expect(pbr.roughnessFactor).toBe(0.5);
  });

  /** Without BLEND, a viewer renders a transparent material fully solid. */
  it("sets alphaMode BLEND for anything not fully opaque", () => {
    const { json } = exported(
      scene({
        materials: [
          { name: "Plastic", baseColor: [1, 1, 1], metallic: 0, roughness: 0.5, opacity: 0.4 },
        ],
      }),
    );
    const m = (json.materials as Record<string, unknown>[])[0];
    expect(m.alphaMode).toBe("BLEND");
    expect((m.pbrMetallicRoughness as Record<string, number[]>).baseColorFactor[3]).toBe(0.4);
  });

  it("carries emissive through when there is any", () => {
    const { json } = exported(
      scene({
        materials: [
          { name: "Plastic", baseColor: [0, 0, 0], metallic: 0, roughness: 1, emissive: [2, 1, 0] },
        ],
      }),
    );
    expect((json.materials as Record<string, unknown>[])[0].emissiveFactor).toEqual([2, 1, 0]);
  });

  it("reports what it wrote", () => {
    const r = exportGltf(scene());
    if (!r.ok) throw new Error("unreachable");
    expect(r.evidence).toMatch(/glTF 2\.0, 1 object, 12 triangles/);
    expect(r.evidence).toMatch(/conformance-checked/);
  });
});

function sphere() {
  const s = buildSphere(1, 8, 4);
  if (!s.ok) throw new Error("fixture failed");
  return s.data;
}

describe("an export that would open wrongly is refused", () => {
  it("refuses a scene with no objects", () => {
    expect(exportGltf(scene({ objects: [] })).ok).toBe(false);
  });

  it("refuses broken geometry rather than exporting it", () => {
    const s = scene();
    s.objects[0].mesh.indices = s.objects[0].mesh.indices.slice(0, 3);
    const r = exportGltf(s);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/can't be exported/i);
  });

  /** A missing material becomes default grey, and the file looks correct. */
  it("refuses a missing material, naming the consequence", () => {
    const s = scene();
    s.objects[0].material = "Absent";
    const r = exportGltf(s);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/default grey.*report success/i);
  });

  it("re-runs scene validation so callers cannot bypass the export gate", () => {
    const duplicate = scene();
    duplicate.materials.push({ ...duplicate.materials[0] });
    expect(exportGltf(duplicate).ok).toBe(false);

    const invalidLight = scene();
    invalidLight.lights[0].intensity = Number.NaN;
    expect(exportGltf(invalidLight).ok).toBe(false);
  });
});

describe("the conformance checker catches what viewers handle silently", () => {
  it("catches a POSITION accessor with no min/max", () => {
    const { json } = exported();
    delete (json.accessors as Record<string, unknown>[])[0].min;
    const r = validateGltf(json);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/loads off-screen looking like a failed export/i);
  });

  it("catches a misaligned buffer view", () => {
    const { json } = exported();
    (json.bufferViews as Record<string, number>[])[0].byteOffset = 2;
    const r = validateGltf(json);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/Some GPUs read this as garbage/i);
  });

  it("catches an accessor count that doesn't match its data", () => {
    const { json } = exported();
    (json.accessors as Record<string, number>[])[0].count = 99;
    const r = validateGltf(json);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/read past the end/i);
  });

  it("catches a buffer view running past its buffer", () => {
    const { json } = exported();
    (json.buffers as { byteLength: number }[])[0].byteLength = 8;
    expect(validateGltf(json).ok).toBe(false);
  });

  it("catches min greater than max", () => {
    const { json } = exported();
    (json.accessors as Record<string, number[]>[])[0].min = [5, 5, 5];
    const r = validateGltf(json);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/min greater than max/i);
  });

  it("catches a primitive with no POSITION", () => {
    const { json } = exported();
    const prim = (
      (json.meshes as Record<string, unknown>[])[0].primitives as Record<string, unknown>[]
    )[0];
    delete (prim.attributes as Record<string, number>).POSITION;
    expect(validateGltf(json).ok).toBe(false);
  });

  it("refuses a document that isn't glTF 2.0", () => {
    expect(validateGltf({ asset: { version: "1.0" } }).ok).toBe(false);
    expect(validateGltf({}).ok).toBe(false);
  });

  it("never throws on malformed document shapes", () => {
    for (const hostile of [
      { asset: { version: "2.0" }, accessors: null },
      { asset: { version: "2.0" }, accessors: [{}], bufferViews: "nope" },
      { asset: { version: "2.0" }, accessors: [{}], bufferViews: [{}], buffers: [{}] },
      { asset: { version: "2.0" }, accessors: [{}], bufferViews: [], meshes: [{}] },
    ]) {
      expect(() => validateGltf(hostile as Record<string, unknown>)).not.toThrow();
      expect(validateGltf(hostile as Record<string, unknown>).ok).toBe(false);
    }
  });
});
