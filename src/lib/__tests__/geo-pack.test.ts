import { describe, it, expect } from "vitest";
import {
  GEO_PACK,
  parseGeoJson,
  boundingBox,
  polygonArea,
  type GeoFeature,
} from "../skills/packs/geo-pack";

/**
 * Real geometry, real arithmetic.
 *
 * The area tests do not trust the implementation's own method: they check it
 * against the closed-form area of a spherical rectangle, derived independently.
 * If both were wrong in the same way the test would be worthless, so the two
 * calculations deliberately take different routes to the same number.
 */

const RECT = (w: number, s: number, e: number, n: number) =>
  JSON.stringify({
    type: "Feature",
    properties: { name: "test" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    },
  });

function feature(json: string): GeoFeature {
  const parsed = parseGeoJson(json);
  if (!parsed.ok) throw new Error(`fixture failed: ${parsed.reason}`);
  return parsed.data.features[0];
}

/** Closed form for a lon/lat rectangle: R²·Δλ·(sin φ₂ − sin φ₁). */
function rectangleAreaM2(w: number, s: number, e: number, n: number): number {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  return R * R * rad(e - w) * (Math.sin(rad(n)) - Math.sin(rad(s)));
}

describe("the pack states its own limits", () => {
  it("says plainly that it does not drive CAD applications", () => {
    expect(GEO_PACK.coverageNote).toMatch(/GeoJSON files only/i);
    expect(GEO_PACK.coverageNote).toMatch(/cannot operate SolidWorks/i);
  });

  it("claims no capability it hasn't tested", () => {
    expect(GEO_PACK.capabilities.every((c) => c.tested)).toBe(true);
  });
});

describe("reading GeoJSON", () => {
  it("reads a FeatureCollection and keeps properties", () => {
    const doc = parseGeoJson(
      JSON.stringify({
        type: "FeatureCollection",
        features: [JSON.parse(RECT(0, 0, 1, 1))],
      }),
    );
    expect(doc.ok).toBe(true);
    if (!doc.ok) throw new Error("unreachable");
    expect(doc.data.features).toHaveLength(1);
    expect(doc.data.features[0].properties.name).toBe("test");
    expect(doc.evidence).toBe("1 feature.");
  });

  it("reads a bare geometry, which real exports contain", () => {
    const doc = parseGeoJson(JSON.stringify({ type: "Point", coordinates: [12.5, 41.9] }));
    expect(doc.ok).toBe(true);
  });

  it("refuses an unclosed ring rather than closing it", () => {
    const open = JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    });
    const doc = parseGeoJson(open);
    expect(doc.ok).toBe(false);
    if (doc.ok) throw new Error("unreachable");
    expect(doc.reason).toMatch(/isn't closed/i);
    // The reason must explain WHY it won't be fixed automatically.
    expect(doc.reason).toMatch(/changes the shape/i);
  });

  it("catches swapped longitude and latitude, the commonest GeoJSON error", () => {
    // Rome is [12.5, 41.9]. Written the wrong way round, latitude becomes 12.5
    // and longitude 41.9 — which still parses, and is 3000 km away.
    const doc = parseGeoJson(JSON.stringify({ type: "Point", coordinates: [12.5, 123.4] }));
    expect(doc.ok).toBe(false);
    if (doc.ok) throw new Error("unreachable");
    expect(doc.reason).toMatch(/outside ±90/);
    expect(doc.reason).toMatch(/wrong way round/i);
  });

  it("refuses a geometry type it was never tested against", () => {
    const doc = parseGeoJson(JSON.stringify({ type: "GeometryCollection", geometries: [] }));
    expect(doc.ok).toBe(false);
    if (doc.ok) throw new Error("unreachable");
    expect(doc.reason).toMatch(/hasn't been tested against/i);
  });

  it("refuses a three-position ring, which encloses nothing", () => {
    const doc = parseGeoJson(
      JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0, 0],
          ],
        ],
      }),
    );
    expect(doc.ok).toBe(false);
  });

  it("reports an empty collection rather than returning nothing useful", () => {
    const doc = parseGeoJson(JSON.stringify({ type: "FeatureCollection", features: [] }));
    expect(doc.ok).toBe(false);
    if (doc.ok) throw new Error("unreachable");
    expect(doc.reason).toMatch(/empty/i);
  });
});

describe("measuring area on the ground, not on a flat grid", () => {
  it("matches the closed-form spherical rectangle at the equator", () => {
    const area = polygonArea(feature(RECT(0, 0, 1, 1)));
    expect(area.ok).toBe(true);
    if (!area.ok) throw new Error("unreachable");

    const expected = rectangleAreaM2(0, 0, 1, 1);
    // Within 0.01% of an independently derived figure.
    expect(Math.abs(area.data.squareMetres - expected) / expected).toBeLessThan(0.0001);
  });

  /**
   * The test that a planar shoelace would fail. The same 1°×1° box near the
   * pole covers far less ground than at the equator; a flat calculation gives
   * both the identical answer.
   */
  it("shrinks with latitude, as real ground does", () => {
    const equator = polygonArea(feature(RECT(0, 0, 1, 1)));
    const north = polygonArea(feature(RECT(0, 60, 1, 61)));
    if (!equator.ok || !north.ok) throw new Error("unreachable");

    expect(north.data.squareMetres).toBeLessThan(equator.data.squareMetres);
    // cos(60.5°) ≈ 0.492 — roughly half.
    const ratio = north.data.squareMetres / equator.data.squareMetres;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.55);
  });

  it("subtracts a hole instead of ignoring it", () => {
    const withHole: GeoFeature = {
      type: "Polygon",
      properties: {},
      rings: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
        [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.75, 0.75],
          [0.25, 0.75],
          [0.25, 0.25],
        ],
      ],
    };
    const solid = polygonArea(feature(RECT(0, 0, 1, 1)));
    const holed = polygonArea(withHole);
    if (!solid.ok || !holed.ok) throw new Error("unreachable");

    expect(holed.data.squareMetres).toBeLessThan(solid.data.squareMetres);
    const holeSize = rectangleAreaM2(0.25, 0.25, 0.75, 0.75);
    expect(
      Math.abs(solid.data.squareMetres - holed.data.squareMetres - holeSize) / holeSize,
    ).toBeLessThan(0.001);
  });

  it("refuses to report 0 m² for a line", () => {
    const line = feature(
      JSON.stringify({
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
    );
    const area = polygonArea(line);
    expect(area.ok).toBe(false);
    if (area.ok) throw new Error("unreachable");
    expect(area.reason).toMatch(/reads as a measurement/i);
  });

  it("refuses when a hole is larger than its outer ring", () => {
    const inverted: GeoFeature = {
      type: "Polygon",
      properties: {},
      rings: [
        [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.75, 0.75],
          [0.25, 0.75],
          [0.25, 0.25],
        ],
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    const area = polygonArea(inverted);
    expect(area.ok).toBe(false);
    if (area.ok) throw new Error("unreachable");
    expect(area.reason).toMatch(/ring order/i);
  });

  it("reports km² for large areas and m² for small ones", () => {
    const big = polygonArea(feature(RECT(0, 0, 1, 1)));
    const small = polygonArea(feature(RECT(0, 0, 0.001, 0.001)));
    if (!big.ok || !small.ok) throw new Error("unreachable");
    expect(big.evidence).toMatch(/km²/);
    expect(small.evidence).not.toMatch(/km²/);
    expect(small.evidence).toMatch(/m²/);
  });
});

describe("extent", () => {
  it("measures the box across every feature", () => {
    const doc = parseGeoJson(
      JSON.stringify({
        type: "FeatureCollection",
        features: [JSON.parse(RECT(-2, -1, 0, 1)), JSON.parse(RECT(3, 4, 5, 6))],
      }),
    );
    if (!doc.ok) throw new Error("unreachable");
    const box = boundingBox(doc.data);
    expect(box.ok).toBe(true);
    if (!box.ok) throw new Error("unreachable");
    expect(box.data).toEqual({ west: -2, south: -1, east: 5, north: 6 });
  });

  /**
   * A set spanning most of the globe is either antimeridian-crossing or
   * corrupt. A west<east box would be silently inside-out, so it is refused.
   */
  it("refuses a box that would be misleading", () => {
    const doc = parseGeoJson(
      JSON.stringify({
        type: "FeatureCollection",
        features: [JSON.parse(RECT(-179, 0, -178, 1)), JSON.parse(RECT(178, 0, 179, 1))],
      }),
    );
    if (!doc.ok) throw new Error("unreachable");
    const box = boundingBox(doc.data);
    expect(box.ok).toBe(false);
    if (box.ok) throw new Error("unreachable");
    expect(box.reason).toMatch(/antimeridian/i);
  });
});
