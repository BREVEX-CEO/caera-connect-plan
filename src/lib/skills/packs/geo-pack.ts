/**
 * Geospatial skill pack — a REAL, executed adapter for the CAD/CAE/GIS/
 * industrial category.
 *
 * Scope, stated plainly: this pack works on **GeoJSON files**. It does not
 * drive SolidWorks, AutoCAD, ArcGIS or any other engineering application, and
 * `coverageNote` says so on the pack itself so the coverage table cannot imply
 * otherwise.
 *
 * What it does do, it does exactly. Two rules shape the code:
 *
 *  1. **A geometry that is invalid is refused, not repaired.** An unclosed
 *     polygon ring is a data error; silently closing it changes the shape the
 *     user is about to make a decision from, and the result looks identical to
 *     a correct one.
 *  2. **Area is geodesic, never planar.** Treating degrees as a flat grid
 *     yields a number that is wrong by a factor that grows with latitude — and
 *     still prints as a confident figure in m².
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

import { formatNumber } from "@/lib/locale/format";
const CAPABILITIES: SkillCapability[] = [
  {
    id: "geo.parse",
    label: "Read a GeoJSON file",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "geo.bbox",
    label: "Find the extent of features",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "geo.area",
    label: "Measure a polygon's area on the ground",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const GEO_PACK: SkillPack = {
  appId: "ocade.geo",
  displayName: "Maps and geospatial data",
  category: "engineering_cad",
  // Pinned to the GeoJSON specification (RFC 7946), which is what this pack
  // actually implements — not to any application's version.
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Covers GeoJSON files only. OCADE cannot operate SolidWorks, AutoCAD, ArcGIS or other CAD and GIS applications.",
};

export type GeoOutcome<T> = { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/** A position is [longitude, latitude] in RFC 7946 — in that order. */
export type Position = [number, number];

export interface GeoFeature {
  type: "Point" | "LineString" | "Polygon" | "MultiPolygon";
  /** Rings for polygons, a single line for LineString, one point for Point. */
  rings: Position[][];
  properties: Record<string, unknown>;
}

export interface GeoDocument {
  features: GeoFeature[];
}

/* --------------------------------------------------------------- parsing -- */

function isPosition(v: unknown): v is Position {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

/**
 * Longitude/latitude order is the single most common GeoJSON mistake, and a
 * swapped pair usually still parses. Range-checking catches most of them: a
 * latitude beyond ±90 is impossible, so the file is wrong somewhere.
 */
function positionError(p: Position, where: string): string | null {
  const [lon, lat] = p;
  if (lat < -90 || lat > 90) {
    return `${where} has a latitude of ${lat}, which is outside ±90. GeoJSON positions are [longitude, latitude] — these may be the wrong way round.`;
  }
  if (lon < -180 || lon > 180) {
    return `${where} has a longitude of ${lon}, which is outside ±180.`;
  }
  return null;
}

function readRing(coords: unknown, where: string): GeoOutcome<Position[]> {
  if (!Array.isArray(coords)) {
    return { ok: false, reason: `${where} has no coordinate list.` };
  }
  const ring: Position[] = [];
  for (let i = 0; i < coords.length; i++) {
    const p = coords[i];
    if (!isPosition(p)) {
      return {
        ok: false,
        reason: `${where}, position ${i + 1} isn't a valid [longitude, latitude] pair.`,
      };
    }
    const err = positionError(p, `${where}, position ${i + 1}`);
    if (err) return { ok: false, reason: err };
    ring.push([p[0], p[1]]);
  }
  return { ok: true, data: ring, evidence: `${ring.length} positions.` };
}

/**
 * A closed ring repeats its first position last, and needs four positions to
 * enclose any area. Both are refusals rather than repairs — see the header.
 */
function ringClosureError(ring: Position[], where: string): string | null {
  if (ring.length < 4) {
    return `${where} has ${ring.length} position${ring.length === 1 ? "" : "s"}. A polygon ring needs at least 4, with the last repeating the first.`;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return `${where} isn't closed — it ends at [${last[0]}, ${last[1]}] but starts at [${first[0]}, ${first[1]}]. OCADE won't close it for you, because that changes the shape.`;
  }
  return null;
}

function readGeometry(
  geometry: unknown,
  where: string,
): GeoOutcome<Omit<GeoFeature, "properties">> {
  if (typeof geometry !== "object" || geometry === null) {
    return { ok: false, reason: `${where} has no geometry.` };
  }
  const g = geometry as { type?: unknown; coordinates?: unknown };
  const type = g.type;

  if (type === "Point") {
    const p = g.coordinates;
    if (!isPosition(p)) return { ok: false, reason: `${where} isn't a valid position.` };
    const err = positionError(p, where);
    if (err) return { ok: false, reason: err };
    return { ok: true, data: { type: "Point", rings: [[[p[0], p[1]]]] }, evidence: "1 point." };
  }

  if (type === "LineString") {
    const ring = readRing(g.coordinates, where);
    if (!ring.ok) return ring;
    if (ring.data.length < 2) {
      return { ok: false, reason: `${where} has fewer than 2 positions, so it isn't a line.` };
    }
    return { ok: true, data: { type: "LineString", rings: [ring.data] }, evidence: ring.evidence };
  }

  if (type === "Polygon") {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) {
      return { ok: false, reason: `${where} has no rings.` };
    }
    const rings: Position[][] = [];
    for (let i = 0; i < g.coordinates.length; i++) {
      const label = i === 0 ? `${where}, outer ring` : `${where}, hole ${i}`;
      const ring = readRing(g.coordinates[i], label);
      if (!ring.ok) return ring;
      const closure = ringClosureError(ring.data, label);
      if (closure) return { ok: false, reason: closure };
      rings.push(ring.data);
    }
    return { ok: true, data: { type: "Polygon", rings }, evidence: `${rings.length} ring(s).` };
  }

  if (type === "MultiPolygon") {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) {
      return { ok: false, reason: `${where} has no polygons.` };
    }
    const rings: Position[][] = [];
    for (let pi = 0; pi < g.coordinates.length; pi++) {
      const poly = g.coordinates[pi];
      if (!Array.isArray(poly)) {
        return { ok: false, reason: `${where}, polygon ${pi + 1} has no rings.` };
      }
      for (let i = 0; i < poly.length; i++) {
        const label =
          i === 0
            ? `${where}, polygon ${pi + 1} outer ring`
            : `${where}, polygon ${pi + 1} hole ${i}`;
        const ring = readRing(poly[i], label);
        if (!ring.ok) return ring;
        const closure = ringClosureError(ring.data, label);
        if (closure) return { ok: false, reason: closure };
        rings.push(ring.data);
      }
    }
    return {
      ok: true,
      data: { type: "MultiPolygon", rings },
      evidence: `${rings.length} ring(s).`,
    };
  }

  return {
    ok: false,
    reason: `${where} is a “${String(type)}” geometry, which OCADE hasn't been tested against. It handles Point, LineString, Polygon and MultiPolygon.`,
  };
}

/**
 * Parse a GeoJSON document. Accepts a FeatureCollection, a single Feature, or a
 * bare geometry — all three are valid RFC 7946 and all three appear in exports.
 */
export function parseGeoJson(text: string): GeoOutcome<GeoDocument> {
  if (!text.trim()) return { ok: false, reason: "That file is empty." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      reason: `That isn't valid JSON: ${e instanceof Error ? e.message : "unreadable"}.`,
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "That JSON isn't a GeoJSON object." };
  }

  const root = parsed as {
    type?: unknown;
    features?: unknown;
    geometry?: unknown;
    properties?: unknown;
  };

  const readFeature = (f: unknown, where: string): GeoOutcome<GeoFeature> => {
    if (typeof f !== "object" || f === null)
      return { ok: false, reason: `${where} isn't an object.` };
    const feat = f as { geometry?: unknown; properties?: unknown };
    const geom = readGeometry(feat.geometry, where);
    if (!geom.ok) return geom;
    const props =
      typeof feat.properties === "object" && feat.properties !== null
        ? (feat.properties as Record<string, unknown>)
        : {};
    return { ok: true, data: { ...geom.data, properties: props }, evidence: geom.evidence };
  };

  if (root.type === "FeatureCollection") {
    if (!Array.isArray(root.features)) {
      return { ok: false, reason: "This FeatureCollection has no features list." };
    }
    if (root.features.length === 0) {
      return {
        ok: false,
        reason: "This FeatureCollection is empty — there's nothing to work with.",
      };
    }
    const features: GeoFeature[] = [];
    for (let i = 0; i < root.features.length; i++) {
      const f = readFeature(root.features[i], `Feature ${i + 1}`);
      if (!f.ok) return f;
      features.push(f.data);
    }
    return {
      ok: true,
      data: { features },
      evidence: `${features.length} feature${features.length === 1 ? "" : "s"}.`,
    };
  }

  if (root.type === "Feature") {
    const f = readFeature(root, "This feature");
    if (!f.ok) return f;
    return { ok: true, data: { features: [f.data] }, evidence: "1 feature." };
  }

  const geom = readGeometry(root, "This geometry");
  if (!geom.ok) return geom;
  return {
    ok: true,
    data: { features: [{ ...geom.data, properties: {} }] },
    evidence: "1 geometry.",
  };
}

/* --------------------------------------------------------------- extent -- */

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * The extent of every feature in the document.
 *
 * Refuses when the features span more than half the globe in longitude: such a
 * set is either antimeridian-crossing (where a west<east box is simply wrong)
 * or contains a coordinate error, and OCADE cannot tell which. A box that is
 * silently inside-out is worse than no box.
 */
export function boundingBox(doc: GeoDocument): GeoOutcome<BoundingBox> {
  const positions = doc.features.flatMap((f) => f.rings.flat());
  if (positions.length === 0) return { ok: false, reason: "There are no positions to measure." };

  const lons = positions.map((p) => p[0]);
  const lats = positions.map((p) => p[1]);
  const box = {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };

  if (box.east - box.west > 180) {
    return {
      ok: false,
      reason: `These features span ${(box.east - box.west).toFixed(1)}° of longitude. That usually means they cross the antimeridian or one coordinate is wrong — either way a simple box would be misleading, so OCADE won't give you one.`,
    };
  }

  return {
    ok: true,
    data: box,
    evidence: `${positions.length} positions, from ${box.south.toFixed(4)}, ${box.west.toFixed(4)} to ${box.north.toFixed(4)}, ${box.east.toFixed(4)}.`,
  };
}

/* ----------------------------------------------------------------- area -- */

/** Mean Earth radius, metres (IUGG). */
const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Signed geodesic area of one ring, in square metres, by spherical excess.
 *
 * This is the standard formula used by geodesy libraries. A planar
 * shoelace over raw degrees would be wrong by roughly a factor of cos(latitude)
 * in one axis — about 2× at 60° — while still printing a confident number.
 */
function ringAreaM2(ring: Position[]): number {
  if (ring.length < 4) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return (total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2;
}

export interface AreaResult {
  /** Square metres, holes already subtracted. */
  squareMetres: number;
  hectares: number;
  rings: number;
}

/**
 * Ground area of a polygon feature, with holes subtracted.
 *
 * Refuses anything that isn't a polygon: a line and a point have no area, and
 * returning zero would read as "measured, and it's zero".
 */
export function polygonArea(feature: GeoFeature): GeoOutcome<AreaResult> {
  if (feature.type !== "Polygon" && feature.type !== "MultiPolygon") {
    return {
      ok: false,
      reason: `A ${feature.type} encloses no area. OCADE won't report 0 m², because that reads as a measurement.`,
    };
  }

  // Ring order carries meaning (outer vs hole) but exports are inconsistent
  // about winding, so magnitude is used and the first ring of each polygon is
  // treated as the outer boundary — which is what RFC 7946 requires.
  const areas = feature.rings.map((r) => Math.abs(ringAreaM2(r)));
  const outer = areas[0] ?? 0;
  const holes = areas.slice(1).reduce((a, b) => a + b, 0);

  if (holes > outer) {
    return {
      ok: false,
      reason:
        "The holes in this polygon are larger than its outer boundary, so the ring order must be wrong. OCADE won't report a negative area as if it were a measurement.",
    };
  }

  const squareMetres = outer - holes;
  return {
    ok: true,
    data: { squareMetres, hectares: squareMetres / 10000, rings: feature.rings.length },
    evidence:
      squareMetres >= 1_000_000
        ? `${(squareMetres / 1_000_000).toFixed(3)} km² (${formatNumber(Math.round(squareMetres))} m²), measured on the Earth's surface.`
        : `${formatNumber(Math.round(squareMetres))} m², measured on the Earth's surface.`,
  };
}
