/**
 * The bodies in the hero scene, and the numbers behind them.
 *
 * SEPARATE FROM THE RENDERER, for the same reason `universe.ts` is: sizes,
 * orbits, colours and moon tables are pure data, so they can be argued with and
 * tested without a WebGL context, a GPU or a browser.
 *
 * THE SCALE IS ARTISTIC AND SAYS SO. Literal astronomical scale makes an
 * interactive scene unusable — at Jupiter's real distance Mercury is a subpixel
 * and Neptune is off the map. What IS preserved is internal consistency: the
 * ordering of radii matches reality, so Jupiter is the largest planet here
 * exactly as it is out there, and no body is enlarged for convenience in a way
 * that reorders it against its neighbours.
 */

export interface PlanetSpec {
  id: string;
  name: string;
  /** Sphere radius in scene units. Ordering matches real radii. */
  radius: number;
  /** Orbit radius in scene units. */
  orbit: number;
  /** Radians per second. Inner planets orbit faster, as they do in reality. */
  speed: number;
  /** Starting angle so the eight do not line up at t=0. */
  phase: number;
  /** Axial rotation, radians per second. */
  spin: number;
  /** Base surface colour, from published reference imagery. */
  color: number;
  /** Secondary colour the procedural surface mixes toward. */
  accent: number;
  /** Aura tint. Usually the base colour, brightened. */
  glow: number;
  /**
   * Aura strength, 0–1, capped PER PLANET.
   *
   * A single global glow multiplier is what makes one of these scenes look
   * blown out: Jupiter at the same intensity as Mercury drowns Mars and Saturn
   * either side of it. These are set so no aura can dominate the frame or wash
   * out a neighbour, which is a composition rule rather than a physical one.
   */
  glowStrength: number;
  /** Orbit inclination, radians — what makes it a system rather than a dial. */
  inclination: number;
}

/**
 * The eight, in order from the sun.
 *
 * Colours are the standard reference appearance for each body: Mercury
 * grey-brown, Venus pale yellow-white, Earth blue and green under white cloud,
 * Mars rust, Jupiter banded tan and orange, Saturn pale gold, Uranus pale cyan,
 * Neptune deep blue.
 */
export const PLANETS: PlanetSpec[] = [
  {
    id: "mercury",
    name: "Mercury",
    radius: 0.38,
    orbit: 9,
    speed: 0.196,
    phase: 0.4,
    spin: 0.09,
    color: 0x8c7f75,
    accent: 0x5b5049,
    glow: 0x9c8d80,
    glowStrength: 0.22,
    inclination: 0.06,
  },
  {
    id: "venus",
    name: "Venus",
    radius: 0.72,
    orbit: 12.4,
    speed: 0.145,
    phase: 2.1,
    spin: -0.04,
    color: 0xe8d5a3,
    accent: 0xc9a86a,
    glow: 0xf3e3ba,
    glowStrength: 0.34,
    inclination: -0.04,
  },
  {
    id: "earth",
    name: "Earth",
    radius: 0.78,
    orbit: 16.2,
    speed: 0.118,
    phase: 3.6,
    spin: 0.22,
    color: 0x2f6fb5,
    accent: 0x3f8f4a,
    glow: 0x6fb4ff,
    glowStrength: 0.4,
    inclination: 0.03,
  },
  {
    id: "mars",
    name: "Mars",
    radius: 0.52,
    orbit: 20.1,
    speed: 0.096,
    phase: 5.2,
    spin: 0.2,
    color: 0xb4512d,
    accent: 0x7d3620,
    glow: 0xd86a3f,
    glowStrength: 0.27,
    inclination: -0.07,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    radius: 2.35,
    orbit: 27.5,
    speed: 0.052,
    phase: 1.1,
    spin: 0.46,
    color: 0xc9a882,
    accent: 0x8a6244,
    glow: 0xe0be93,
    glowStrength: 0.3,
    inclination: 0.02,
  },
  {
    id: "saturn",
    name: "Saturn",
    radius: 1.95,
    orbit: 35.4,
    speed: 0.038,
    phase: 4.4,
    spin: 0.42,
    color: 0xd8c48d,
    accent: 0xa9905c,
    glow: 0xeeddac,
    glowStrength: 0.26,
    inclination: -0.05,
  },
  {
    id: "uranus",
    name: "Uranus",
    radius: 1.35,
    orbit: 44.2,
    speed: 0.027,
    phase: 2.8,
    spin: 0.3,
    color: 0x8fd8dd,
    accent: 0x5fa9bd,
    glow: 0xa9f0f4,
    glowStrength: 0.36,
    inclination: 0.09,
  },
  {
    id: "neptune",
    name: "Neptune",
    radius: 1.28,
    orbit: 52.6,
    speed: 0.021,
    phase: 0.9,
    spin: 0.31,
    color: 0x2f52c4,
    accent: 0x1d3382,
    glow: 0x5a7dff,
    glowStrength: 0.38,
    inclination: -0.03,
  },
];

export const SUN_RADIUS = 4.2;

/**
 * Uranus's 28 moons.
 *
 * `km` is the published mean radius in kilometres, so the relative sizes here
 * are real: Titania and Oberon dominate, the inner shepherds are an order of
 * magnitude smaller, and the outer irregulars smaller again.
 *
 * WHY A MINIMUM SIZE FLOOR. Titania is 788 km and Cupid is 9 km — a ratio of
 * 88:1. Rendered linearly at a size where Titania is readable, Cupid is a third
 * of a pixel: present in the scene, invisible on the screen, and impossible to
 * hover. `radiusFor` compresses the range so the smallest is still findable
 * while the ORDERING and the visible gap between large and small survive. The
 * alternative — dropping the small ones — would be a scene that claims 28 and
 * shows 12.
 */
export interface MoonSpec {
  name: string;
  /** Published mean radius, km. */
  km: number;
  /** Orbit radius in scene units, ordered as the real system is. */
  orbit: number;
  /** Radians per second. */
  speed: number;
  phase: number;
  /** Orbit inclination, radians. The irregulars are steeply inclined. */
  inclination: number;
}

export const URANUS_MOONS: MoonSpec[] = [
  { name: "Cordelia", km: 20, orbit: 2.2, speed: 0.62, phase: 0.0, inclination: 0.01 },
  { name: "Ophelia", km: 21, orbit: 2.38, speed: 0.58, phase: 0.7, inclination: 0.02 },
  { name: "Bianca", km: 26, orbit: 2.62, speed: 0.53, phase: 1.4, inclination: 0.01 },
  { name: "Cressida", km: 40, orbit: 2.74, speed: 0.5, phase: 2.1, inclination: 0.0 },
  { name: "Desdemona", km: 32, orbit: 2.84, speed: 0.48, phase: 2.8, inclination: 0.01 },
  { name: "Juliet", km: 47, orbit: 2.98, speed: 0.46, phase: 3.5, inclination: 0.02 },
  { name: "Portia", km: 68, orbit: 3.08, speed: 0.44, phase: 4.2, inclination: 0.01 },
  { name: "Rosalind", km: 36, orbit: 3.3, speed: 0.41, phase: 4.9, inclination: 0.02 },
  { name: "Cupid", km: 9, orbit: 3.44, speed: 0.39, phase: 5.6, inclination: 0.01 },
  { name: "Belinda", km: 45, orbit: 3.56, speed: 0.38, phase: 0.3, inclination: 0.0 },
  { name: "Perdita", km: 15, orbit: 3.66, speed: 0.37, phase: 1.0, inclination: 0.02 },
  { name: "Puck", km: 81, orbit: 3.88, speed: 0.34, phase: 1.7, inclination: 0.01 },
  { name: "Mab", km: 12, orbit: 4.06, speed: 0.32, phase: 2.4, inclination: 0.03 },
  { name: "Miranda", km: 236, orbit: 4.5, speed: 0.28, phase: 3.1, inclination: 0.07 },
  { name: "Ariel", km: 579, orbit: 5.2, speed: 0.24, phase: 3.8, inclination: 0.01 },
  { name: "Umbriel", km: 585, orbit: 5.9, speed: 0.2, phase: 4.5, inclination: 0.02 },
  { name: "Titania", km: 788, orbit: 6.9, speed: 0.16, phase: 5.2, inclination: 0.01 },
  { name: "Oberon", km: 761, orbit: 7.7, speed: 0.14, phase: 5.9, inclination: 0.02 },
  { name: "Francisco", km: 11, orbit: 8.6, speed: 0.11, phase: 0.6, inclination: 0.62 },
  { name: "Caliban", km: 36, orbit: 9.2, speed: 0.1, phase: 1.3, inclination: 0.51 },
  { name: "Stephano", km: 16, orbit: 9.7, speed: 0.094, phase: 2.0, inclination: 0.49 },
  { name: "Trinculo", km: 9, orbit: 10.1, speed: 0.088, phase: 2.7, inclination: 0.58 },
  { name: "Sycorax", km: 78, orbit: 10.7, speed: 0.081, phase: 3.4, inclination: 0.55 },
  { name: "Margaret", km: 10, orbit: 11.2, speed: 0.076, phase: 4.1, inclination: 0.4 },
  { name: "Prospero", km: 25, orbit: 11.7, speed: 0.071, phase: 4.8, inclination: 0.63 },
  { name: "Setebos", km: 24, orbit: 12.2, speed: 0.067, phase: 5.5, inclination: 0.66 },
  { name: "Ferdinand", km: 10, orbit: 12.7, speed: 0.063, phase: 0.2, inclination: 0.61 },
  { name: "S/2023 U1", km: 4, orbit: 13.2, speed: 0.059, phase: 0.9, inclination: 0.57 },
];

/** The smallest a moon may be drawn, in scene units. Below this it vanishes. */
export const MOON_MIN_RADIUS = 0.028;
/** The largest — Titania. Everything else is proportional beneath it. */
export const MOON_MAX_RADIUS = 0.15;

/**
 * A moon's drawn radius from its real one.
 *
 * A CUBE ROOT, NOT A LINEAR MAP. Linear scaling of an 88:1 range puts almost
 * every moon on the floor and makes the whole set look uniform — the exact
 * information the real sizes were meant to carry is lost to the clamp. The cube
 * root compresses the range while keeping the order strictly intact, so Titania
 * still reads as far larger than Puck and Puck as larger than Cupid.
 */
export function radiusFor(km: number): number {
  const largest = Math.max(...URANUS_MOONS.map((m) => m.km));
  const t = Math.cbrt(Math.max(0, km) / largest);
  return MOON_MIN_RADIUS + t * (MOON_MAX_RADIUS - MOON_MIN_RADIUS);
}
