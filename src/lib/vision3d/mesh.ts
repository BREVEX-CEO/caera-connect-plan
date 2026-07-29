/**
 * OCADE Vision/3D — geometry that is actually checked.
 *
 * "Generate a 3D model" is easy to fake: emit some triangles, show a
 * thumbnail, call it done. The mesh is then inverted, or full of holes, or has
 * faces wound inconsistently — none of which is visible until someone tries to
 * print it, boolean it, or light it, at which point the failure is expensive
 * and the provenance is long gone.
 *
 * So every mesh this module produces is validated against properties that are
 * true of real solids and cheap to check exactly:
 *
 *  - **Watertight**: every edge is shared by exactly two faces. One face means
 *    a hole; three means non-manifold geometry that most tools silently
 *    mishandle.
 *  - **Euler characteristic**: V − E + F = 2 for a closed surface of genus 0.
 *    A mesh that passes the edge check but fails this has a subtler defect.
 *  - **Consistent winding, outward**: computed from signed volume. An inverted
 *    mesh renders as a dark shell and prints as a void.
 *  - **No degenerate triangles**: zero-area faces produce undefined normals,
 *    and normals are what lighting is made of.
 *
 * `validateMesh` is not optional decoration — `buildBox` and `buildSphere`
 * return a refusal rather than a mesh if their own output fails it.
 */

export type MeshOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

export type Vec3 = readonly [number, number, number];

export interface Mesh {
  /** Flat triples: [x,y,z, x,y,z, …]. */
  positions: number[];
  /** Triangle indices, three per face, counter-clockwise seen from outside. */
  indices: number[];
  name: string;
}

export const vertexCount = (m: Mesh) => m.positions.length / 3;
export const faceCount = (m: Mesh) => m.indices.length / 3;

function vertexAt(m: Mesh, i: number): Vec3 {
  return [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3) => Math.sqrt(dot(a, a));

/* ------------------------------------------------------------ validation -- */

export interface MeshReport {
  vertices: number;
  faces: number;
  edges: number;
  /** V − E + F. Should be 2 for a closed genus-0 surface. */
  eulerCharacteristic: number;
  watertight: boolean;
  /** Positive when faces are wound outward. */
  signedVolume: number;
  surfaceArea: number;
}

/**
 * Check a mesh against the properties a real solid has.
 *
 * Every failure below names what is wrong AND what it will cause downstream,
 * because "non-manifold geometry" tells someone nothing they can act on.
 */
export function validateMesh(mesh: Mesh): MeshOutcome<MeshReport> {
  const v = vertexCount(mesh);
  const f = faceCount(mesh);

  if (mesh.positions.length % 3 !== 0) {
    return { ok: false, reason: "The position list isn't a whole number of vertices." };
  }
  if (mesh.indices.length % 3 !== 0) {
    return { ok: false, reason: "The index list isn't a whole number of triangles." };
  }
  if (f === 0)
    return { ok: false, reason: "This mesh has no faces, so there is nothing to render." };

  const outOfRange = mesh.indices.find((i) => !Number.isInteger(i) || i < 0 || i >= v);
  if (outOfRange !== undefined) {
    return {
      ok: false,
      reason: `A face refers to vertex ${outOfRange}, which doesn't exist. Most tools crash on this rather than reporting it.`,
    };
  }

  // Edge use count, keyed undirected so the two winding directions collapse.
  const edgeUses = new Map<string, number>();
  const directed = new Set<string>();
  let signedVolume = 0;
  let surfaceArea = 0;

  for (let t = 0; t < f; t++) {
    const ia = mesh.indices[t * 3];
    const ib = mesh.indices[t * 3 + 1];
    const ic = mesh.indices[t * 3 + 2];

    if (ia === ib || ib === ic || ia === ic) {
      return {
        ok: false,
        reason: `Triangle ${t} uses the same vertex twice, so it has no area and no defined normal — lighting on it would be undefined.`,
      };
    }

    const a = vertexAt(mesh, ia);
    const b = vertexAt(mesh, ib);
    const c = vertexAt(mesh, ic);
    const n = cross(sub(b, a), sub(c, a));
    const area = length(n) / 2;

    if (area < 1e-12) {
      return {
        ok: false,
        reason: `Triangle ${t} is degenerate — its three points are in a line, so it has no surface to shade.`,
      };
    }
    surfaceArea += area;
    // Signed volume of the tetrahedron to the origin; sums to the enclosed
    // volume for a closed, consistently wound mesh.
    signedVolume += dot(a, cross(b, c)) / 6;

    for (const [x, y] of [
      [ia, ib],
      [ib, ic],
      [ic, ia],
    ]) {
      const key = x < y ? `${x}-${y}` : `${y}-${x}`;
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);

      // Each directed edge must appear once: twice means two faces wound the
      // same way across a shared edge, i.e. inconsistent winding.
      const dir = `${x}>${y}`;
      if (directed.has(dir)) {
        return {
          ok: false,
          reason: `Triangles meeting at edge ${x}–${y} are wound inconsistently. Half this surface would render inside-out.`,
        };
      }
      directed.add(dir);
    }
  }

  const boundary = [...edgeUses.entries()].filter(([, n]) => n === 1);
  const nonManifold = [...edgeUses.entries()].filter(([, n]) => n > 2);

  if (nonManifold.length > 0) {
    return {
      ok: false,
      reason: `${nonManifold.length} edge${nonManifold.length === 1 ? " is" : "s are"} shared by more than two faces. Slicers and boolean operations mishandle this silently.`,
    };
  }
  if (boundary.length > 0) {
    return {
      ok: false,
      reason: `This mesh has ${boundary.length} open edge${boundary.length === 1 ? "" : "s"}, so it isn't a closed solid. It will look fine on screen and fail to print.`,
    };
  }

  const e = edgeUses.size;
  const euler = v - e + f;
  if (euler !== 2) {
    return {
      ok: false,
      reason: `This mesh has Euler characteristic ${euler}, not 2 — it is not a simple closed surface. Something is joined wrongly even though every edge has two faces.`,
    };
  }

  if (signedVolume <= 0) {
    return {
      ok: false,
      reason:
        "This mesh is wound inward, so it encloses negative volume. It would render as a dark shell and print as a void.",
    };
  }

  return {
    ok: true,
    data: {
      vertices: v,
      faces: f,
      edges: e,
      eulerCharacteristic: euler,
      watertight: true,
      signedVolume,
      surfaceArea,
    },
    evidence: `${v} vertices, ${f} triangles, watertight, volume ${signedVolume.toFixed(4)}, area ${surfaceArea.toFixed(4)}.`,
  };
}

/* ------------------------------------------------------------ primitives -- */

/**
 * An axis-aligned box.
 *
 * Each corner is duplicated per face in most exporters so normals stay hard;
 * here the 8 shared corners are used instead, because that is what makes the
 * watertight and Euler checks meaningful. Hard normals belong to the exporter,
 * not the topology.
 */
export function buildBox(width: number, height: number, depth: number): MeshOutcome<Mesh> {
  for (const [name, value] of [
    ["width", width],
    ["height", height],
    ["depth", depth],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, reason: `A box needs a positive ${name}; ${value} isn't one.` };
    }
  }

  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;

  const mesh: Mesh = {
    name: `box ${width}×${height}×${depth}`,
    positions: [
      -x,
      -y,
      -z,
      x,
      -y,
      -z,
      x,
      y,
      -z,
      -x,
      y,
      -z, // back  (z = −z)
      -x,
      -y,
      z,
      x,
      -y,
      z,
      x,
      y,
      z,
      -x,
      y,
      z, // front (z = +z)
    ],
    // Counter-clockwise seen from outside each face.
    indices: [
      4,
      5,
      6,
      4,
      6,
      7, // front
      1,
      0,
      3,
      1,
      3,
      2, // back
      0,
      4,
      7,
      0,
      7,
      3, // left
      5,
      1,
      2,
      5,
      2,
      6, // right
      3,
      7,
      6,
      3,
      6,
      2, // top
      0,
      1,
      5,
      0,
      5,
      4, // bottom
    ],
  };

  const check = validateMesh(mesh);
  if (!check.ok) {
    // The generator producing invalid geometry is a bug here, not the caller's
    // problem — but it must never be returned as if it were fine.
    return { ok: false, reason: `Box generation produced invalid geometry: ${check.reason}` };
  }
  return { ok: true, data: mesh, evidence: check.evidence };
}

/**
 * A UV sphere.
 *
 * The poles are single vertices fanned to the first and last rings, rather than
 * degenerate quads — which is the usual source of zero-area triangles at the
 * top and bottom of a generated sphere.
 */
export function buildSphere(radius: number, segments: number, rings: number): MeshOutcome<Mesh> {
  if (!Number.isFinite(radius) || radius <= 0) {
    return { ok: false, reason: `A sphere needs a positive radius; ${radius} isn't one.` };
  }
  if (!Number.isInteger(segments) || segments < 3) {
    return {
      ok: false,
      reason: "A sphere needs at least 3 segments around, or it isn't a surface.",
    };
  }
  if (!Number.isInteger(rings) || rings < 2) {
    return { ok: false, reason: "A sphere needs at least 2 rings, or the poles meet." };
  }

  const positions: number[] = [];
  const indices: number[] = [];

  // North pole.
  positions.push(0, radius, 0);

  // Interior rings: rings−1 of them, excluding both poles.
  for (let r = 1; r < rings; r++) {
    const phi = (Math.PI * r) / rings;
    const yy = radius * Math.cos(phi);
    const rr = radius * Math.sin(phi);
    for (let s = 0; s < segments; s++) {
      const theta = (2 * Math.PI * s) / segments;
      positions.push(rr * Math.sin(theta), yy, rr * Math.cos(theta));
    }
  }

  // South pole.
  positions.push(0, -radius, 0);

  const north = 0;
  const south = positions.length / 3 - 1;
  const ringStart = (r: number) => 1 + (r - 1) * segments;

  // North cap.
  for (let s = 0; s < segments; s++) {
    const a = ringStart(1) + s;
    const b = ringStart(1) + ((s + 1) % segments);
    indices.push(north, a, b);
  }

  // Bands between interior rings.
  for (let r = 1; r < rings - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const a = ringStart(r) + s;
      const b = ringStart(r) + ((s + 1) % segments);
      const c = ringStart(r + 1) + s;
      const d = ringStart(r + 1) + ((s + 1) % segments);
      indices.push(a, d, b);
      indices.push(a, c, d);
    }
  }

  // South cap.
  for (let s = 0; s < segments; s++) {
    const a = ringStart(rings - 1) + s;
    const b = ringStart(rings - 1) + ((s + 1) % segments);
    indices.push(south, b, a);
  }

  const mesh: Mesh = { name: `sphere r=${radius}`, positions, indices };
  const check = validateMesh(mesh);
  if (!check.ok) {
    return { ok: false, reason: `Sphere generation produced invalid geometry: ${check.reason}` };
  }
  return { ok: true, data: mesh, evidence: check.evidence };
}
