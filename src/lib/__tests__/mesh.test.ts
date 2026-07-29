import { describe, it, expect } from "vitest";
import {
  buildBox,
  buildSphere,
  validateMesh,
  faceCount,
  vertexCount,
  type Mesh,
} from "../vision3d/mesh";

/**
 * The geometry is checked against quantities with known exact values — a
 * 2×3×4 box has volume 24 and surface area 52, whatever the implementation
 * does. A test that only asserted "it produced some triangles" would pass on a
 * mesh that is inverted, holed, or inside-out.
 */

function mesh(m: MeshOutcomeData): Mesh {
  return m;
}
type MeshOutcomeData = Mesh;

const box = (w = 2, h = 3, d = 4) => {
  const r = buildBox(w, h, d);
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
};

describe("a generated box is a real solid", () => {
  it("has the topology of a cube", () => {
    const r = validateMesh(box());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.vertices).toBe(8);
    expect(r.data.faces).toBe(12);
    expect(r.data.edges).toBe(18);
    // V − E + F = 8 − 18 + 12 = 2, as it must be for a closed genus-0 surface.
    expect(r.data.eulerCharacteristic).toBe(2);
    expect(r.data.watertight).toBe(true);
  });

  it("encloses exactly the right volume and area", () => {
    const r = validateMesh(box(2, 3, 4));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.signedVolume).toBeCloseTo(24, 10);
    // 2(2·3 + 3·4 + 2·4) = 2(6 + 12 + 8) = 52.
    expect(r.data.surfaceArea).toBeCloseTo(52, 10);
  });

  /** Positive volume is what proves the winding is outward, not inward. */
  it("is wound outward", () => {
    const r = validateMesh(box());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.signedVolume).toBeGreaterThan(0);
  });

  it("refuses a box with a non-positive dimension", () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(buildBox(bad, 1, 1).ok, String(bad)).toBe(false);
      expect(buildBox(1, bad, 1).ok, String(bad)).toBe(false);
      expect(buildBox(1, 1, bad).ok, String(bad)).toBe(false);
    }
  });
});

describe("a generated sphere is a real solid", () => {
  it("is watertight at every resolution tried", () => {
    for (const [segments, rings] of [
      [3, 2],
      [8, 4],
      [16, 8],
      [32, 16],
    ]) {
      const s = buildSphere(1, segments, rings);
      expect(s.ok, `segments=${segments} rings=${rings}`).toBe(true);
      if (!s.ok) throw new Error("unreachable");
      const r = validateMesh(s.data);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("unreachable");
      expect(r.data.eulerCharacteristic).toBe(2);
    }
  });

  /**
   * The poles are where generated spheres go wrong: a naive implementation
   * emits zero-area triangles there, which pass a "has faces" check and
   * produce undefined normals.
   */
  it("has no degenerate triangles at the poles", () => {
    const s = buildSphere(1, 12, 6);
    if (!s.ok) throw new Error("unreachable");
    // validateMesh refuses degenerate triangles outright, so success is proof.
    expect(validateMesh(s.data).ok).toBe(true);
  });

  it("converges on the true sphere volume as resolution rises", () => {
    const coarse = buildSphere(1, 8, 4);
    const fine = buildSphere(1, 64, 32);
    if (!coarse.ok || !fine.ok) throw new Error("unreachable");

    const exact = (4 / 3) * Math.PI;
    const coarseErr = Math.abs(validateMeshVolume(coarse.data) - exact);
    const fineErr = Math.abs(validateMeshVolume(fine.data) - exact);

    // An inscribed polyhedron always under-estimates, and the error shrinks.
    expect(fineErr).toBeLessThan(coarseErr);
    expect(fineErr / exact).toBeLessThan(0.005);
  });

  it("refuses resolutions that cannot form a surface", () => {
    expect(buildSphere(1, 2, 4).ok).toBe(false);
    expect(buildSphere(1, 8, 1).ok).toBe(false);
    expect(buildSphere(0, 8, 4).ok).toBe(false);
    expect(buildSphere(1, 8.5, 4).ok).toBe(false);
  });
});

function validateMeshVolume(m: Mesh): number {
  const r = validateMesh(m);
  if (!r.ok) throw new Error(r.reason);
  return r.data.signedVolume;
}

/**
 * Each of these defects renders acceptably on screen and fails later — at the
 * slicer, the boolean, or the print. Catching them at generation is the whole
 * point of validating rather than trusting.
 */
describe("broken geometry is refused, with the consequence named", () => {
  it("catches a hole", () => {
    const holed = box();
    // Drop one triangle: the mesh still looks closed from most angles.
    holed.indices = holed.indices.slice(0, holed.indices.length - 3);
    const r = validateMesh(holed);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/open edge/i);
    expect(r.reason).toMatch(/fail to print/i);
  });

  it("catches an inverted mesh", () => {
    const inverted = box();
    // Reverse every triangle's winding.
    for (let t = 0; t < faceCount(inverted); t++) {
      const i = t * 3;
      [inverted.indices[i + 1], inverted.indices[i + 2]] = [
        inverted.indices[i + 2],
        inverted.indices[i + 1],
      ];
    }
    const r = validateMesh(inverted);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/wound inward|negative volume/i);
  });

  it("catches one face wound the wrong way among many", () => {
    const mixed = box();
    [mixed.indices[1], mixed.indices[2]] = [mixed.indices[2], mixed.indices[1]];
    const r = validateMesh(mixed);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/wound inconsistently/i);
    expect(r.reason).toMatch(/inside-out/i);
  });

  it("catches an index pointing at a vertex that doesn't exist", () => {
    const broken = box();
    broken.indices[0] = vertexCount(broken) + 5;
    const r = validateMesh(broken);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/doesn't exist/i);
  });

  it("catches a triangle that uses one vertex twice", () => {
    const degenerate = box();
    degenerate.indices[1] = degenerate.indices[0];
    const r = validateMesh(degenerate);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/no defined normal/i);
  });

  it("catches three collinear points", () => {
    const flat: Mesh = {
      name: "flat",
      positions: [0, 0, 0, 1, 0, 0, 2, 0, 0],
      indices: [0, 1, 2],
    };
    const r = validateMesh(flat);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/in a line/i);
  });

  it("refuses an empty mesh rather than calling it valid", () => {
    expect(validateMesh({ name: "empty", positions: [], indices: [] }).ok).toBe(false);
  });

  it("refuses a malformed buffer", () => {
    expect(validateMesh({ name: "odd", positions: [0, 0], indices: [0, 1, 2] }).ok).toBe(false);
    expect(
      validateMesh({ name: "odd", positions: [0, 0, 0, 1, 1, 1, 2, 2, 2], indices: [0, 1] }).ok,
    ).toBe(false);
  });
});

describe("the generators police their own output", () => {
  /**
   * A generator that emitted invalid geometry and returned it anyway would put
   * the burden on every caller to re-check. Both build functions run the
   * validator on themselves and refuse rather than hand back a bad mesh.
   */
  it("returns evidence from the validator, not a claim of its own", () => {
    const b = buildBox(1, 1, 1);
    if (!b.ok) throw new Error("unreachable");
    expect(b.evidence).toMatch(/8 vertices, 12 triangles, watertight/);
    expect(b.evidence).toMatch(/volume 1\.0000/);
  });
});
