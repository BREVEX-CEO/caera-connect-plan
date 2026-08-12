import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  AMBIENT_YAW_RATE,
  CONNECTIONS,
  DEFAULT_CAMERA,
  FLICK_EPSILON,
  IDLE_RETURN_MS,
  MAX_PITCH,
  MAX_ZOOM,
  MIN_ZOOM,
  PLANETS,
  approach,
  approachAngle,
  clampCamera,
  focusPanFor,
  positionsAt,
  stepCamera,
  unfocusedTarget,
  type CameraMotion,
} from "../landing/universe";

/**
 * The camera's motion, and the interconnection.
 *
 * WHAT THIS IS FOR. The scene has to be alive on its own, hand control to the
 * user the instant they touch it, and find its way back afterwards without a
 * seam — and every one of those failures looks like a design choice rather than
 * a bug. A camera that snaps reads as "cheap animation"; one that unwinds six
 * radians the long way round reads as "glitchy"; one that never resumes reads
 * as "finished". None of them throw, and none would fail a geometry test.
 *
 * All pure functions, so the whole motion model is assertable with no canvas,
 * no animation frame and no browser.
 */

const rest = (): CameraMotion => ({
  current: { ...DEFAULT_CAMERA },
  target: { ...DEFAULT_CAMERA },
  yawVelocity: 0,
  pitchVelocity: 0,
});

/** Run the camera for a while at a fixed framerate. */
function run(motion: CameraMotion, seconds: number, idleMs: number, fps = 60): CameraMotion {
  const dt = 1 / fps;
  let m = motion;
  for (let i = 0; i < seconds * fps; i += 1) m = stepCamera(m, dt, idleMs);
  return m;
}

describe("approaching a value", () => {
  it("closes the gap without ever overshooting it", () => {
    let v = 0;
    for (let i = 0; i < 200; i += 1) v = approach(v, 10, 6.5, 1 / 60);
    expect(v).toBeGreaterThan(9.9);
    expect(v).toBeLessThanOrEqual(10);
  });

  it("is framerate independent, which the naive form is not", () => {
    /*
     * `value += (target - value) * 0.1` is a different spring at every
     * framerate: noticeably snappier at 144Hz than at 60, and unusably sluggish
     * on the machine dropping frames — the one that can least afford a camera
     * lagging behind the hand.
     */
    let slow = 0;
    for (let i = 0; i < 30; i += 1) slow = approach(slow, 1, 6.5, 1 / 30);
    let fast = 0;
    for (let i = 0; i < 144; i += 1) fast = approach(fast, 1, 6.5, 1 / 144);
    // Same one second of real time, so the same distance travelled.
    expect(Math.abs(slow - fast)).toBeLessThan(0.01);
  });

  it("returns the value unchanged for a nonsensical timestep", () => {
    // A tab restored from the background can hand the loop a NaN or a negative
    // delta; either would put NaN in the camera and blank the canvas silently.
    expect(approach(3, 9, 6.5, NaN)).toBe(3);
    expect(approach(3, 9, 6.5, -1)).toBe(3);
  });

  it("takes the short way round an angle instead of unwinding", () => {
    // 6.2 -> 0.1 is a tenth of a turn forwards, not six radians backwards.
    const next = approachAngle(6.2, 0.1, 6.5, 1 / 60);
    expect(next).toBeGreaterThan(6.2);
  });

  it("crosses the wrap point rather than stopping at it", () => {
    // Heading forwards past 2π: the camera must sail through the seam, not
    // stall on it and then jerk round the long way.
    let v = 6.2;
    for (let i = 0; i < 120; i += 1) v = approachAngle(v, 0.1 + Math.PI * 2, 6.5, 1 / 60);
    expect(v).toBeGreaterThan(Math.PI * 2);
    expect(v).toBeCloseTo(0.1 + Math.PI * 2, 2);
  });
});

describe("the camera is alive when nobody is touching it", () => {
  it("turns on its own once the idle delay has passed", () => {
    const after = run(rest(), 2, IDLE_RETURN_MS + 1000);
    expect(after.target.yaw).toBeGreaterThan(DEFAULT_CAMERA.yaw);
    // Roughly the ambient rate over two seconds, give or take a frame.
    expect(after.target.yaw - DEFAULT_CAMERA.yaw).toBeCloseTo(AMBIENT_YAW_RATE * 2, 1);
  });

  it("stays put while the user is still considered active", () => {
    const after = run(rest(), 2, 0);
    expect(after.target.yaw).toBe(DEFAULT_CAMERA.yaw);
  });

  it("never drifts fast enough to pull the eye off the page", () => {
    // Ambient presence, not a carousel: a full revolution takes minutes.
    const secondsPerRevolution = (Math.PI * 2) / AMBIENT_YAW_RATE;
    expect(secondsPerRevolution).toBeGreaterThan(120);
  });
});

describe("a flick keeps going, then lets go", () => {
  it("carries the target onwards after the pointer has lifted", () => {
    const flicked: CameraMotion = { ...rest(), yawVelocity: 1.4 };
    const after = run(flicked, 0.5, 0);
    expect(after.target.yaw).toBeGreaterThan(DEFAULT_CAMERA.yaw + 0.2);
  });

  it("comes to rest rather than spinning forever", () => {
    const after = run({ ...rest(), yawVelocity: 1.4 }, 6, 0);
    expect(Math.abs(after.yawVelocity)).toBeLessThanOrEqual(FLICK_EPSILON);
  });

  it("glides for long enough to feel like mass, not like a scrollbar", () => {
    const half = run({ ...rest(), yawVelocity: 1.4 }, 0.75, 0);
    expect(Math.abs(half.yawVelocity), "the glide died almost immediately").toBeGreaterThan(0.05);
  });

  it("does not add the ambient drift on top of a glide", () => {
    /*
     * Both write to the target's yaw. Applied together, a flick that happened
     * to land after the idle delay would spin faster than either alone and then
     * visibly slow down as the glide died — a speed change with no cause the
     * user can see.
     */
    const gliding = run({ ...rest(), yawVelocity: 1.4 }, 0.2, IDLE_RETURN_MS + 5000);
    const glidingOnly = run({ ...rest(), yawVelocity: 1.4 }, 0.2, 0);
    expect(gliding.target.yaw).toBeCloseTo(glidingOnly.target.yaw, 6);
  });
});

describe("nothing the camera does can snap", () => {
  it("eases towards a distant target instead of arriving at it", () => {
    const motion: CameraMotion = {
      ...rest(),
      target: clampCamera({ ...DEFAULT_CAMERA, yaw: DEFAULT_CAMERA.yaw + 2, pitch: MAX_PITCH }),
    };
    const oneFrame = stepCamera(motion, 1 / 60, 0);
    // Moved, but nowhere near arrived — that gap IS the easing.
    expect(oneFrame.current.yaw).toBeGreaterThan(DEFAULT_CAMERA.yaw);
    expect(oneFrame.current.yaw).toBeLessThan(DEFAULT_CAMERA.yaw + 0.5);
  });

  it("arrives eventually, so a target is a promise and not a direction", () => {
    const motion: CameraMotion = {
      ...rest(),
      target: clampCamera({ ...DEFAULT_CAMERA, distance: 20 }),
    };
    const after = run(motion, 3, 0);
    expect(after.current.distance).toBeCloseTo(20, 1);
  });

  it("keeps the camera inside its limits however hard it is pushed", () => {
    const motion: CameraMotion = {
      ...rest(),
      target: clampCamera({ ...DEFAULT_CAMERA, pitch: 99, distance: -99 }),
      yawVelocity: 40,
      pitchVelocity: 40,
    };
    const after = run(motion, 4, 0);
    expect(after.current.pitch).toBeLessThanOrEqual(MAX_PITCH + 1e-9);
    expect(after.current.distance).toBeGreaterThanOrEqual(8 - 1e-9);
    expect(Number.isFinite(after.current.yaw)).toBe(true);
  });

  it("never produces a non-finite camera, whatever the timestep", () => {
    // A NaN here removes the entire scene with no error anywhere.
    for (const dt of [0, NaN, Infinity, -1, 10]) {
      const after = stepCamera({ ...rest(), yawVelocity: 2 }, dt, 0);
      expect(Number.isFinite(after.current.yaw), `dt=${dt}`).toBe(true);
      expect(Number.isFinite(after.current.pitch), `dt=${dt}`).toBe(true);
      expect(Number.isFinite(after.current.distance), `dt=${dt}`).toBe(true);
      expect(Number.isFinite(after.current.zoom ?? 1), `dt=${dt}`).toBe(true);
    }
  });
});

describe("settling the view on one planet", () => {
  const positions = positionsAt(12, DEFAULT_CAMERA, 16 / 9);

  it("points the camera at that planet rather than at the core", () => {
    const pan = focusPanFor(positions, "voice")!;
    const target = positions.find((p) => p.planet.id === "voice")!;
    expect(pan.panX).toBe(target.x);
    expect(pan.panY).toBe(target.y);
  });

  it("actually centres it once the camera has arrived", () => {
    const pan = focusPanFor(positions, "offline")!;
    const framed = positionsAt(12, { ...DEFAULT_CAMERA, ...pan, zoom: 2.9 }, 16 / 9);
    const target = framed.find((p) => p.planet.id === "offline")!;
    expect(Math.abs(target.sx - 0.5), "not horizontally centred").toBeLessThan(0.02);
    expect(Math.abs(target.sy - 0.5), "not vertically centred").toBeLessThan(0.02);
  });

  it("magnifies it, or 'zoom in' means nothing", () => {
    const plain = positionsAt(12, DEFAULT_CAMERA, 16 / 9).find((p) => p.planet.id === "chat")!;
    const zoomed = positionsAt(12, { ...DEFAULT_CAMERA, zoom: 2.9 }, 16 / 9).find(
      (p) => p.planet.id === "chat",
    )!;
    expect(zoomed.sr).toBeGreaterThan(plain.sr * 2.5);
  });

  it("distinguishes an unknown planet from the core", () => {
    // Returning a zero pan for a typo would make a broken id look like a
    // working un-focus, and the bug would never surface.
    expect(focusPanFor(positions, "no-such-planet")).toBeNull();
  });

  it("lets go back to the framing that fits everything", () => {
    const released = unfocusedTarget({ ...DEFAULT_CAMERA, panX: 3, panY: -2, zoom: 3 });
    expect(released.panX).toBe(0);
    expect(released.panY).toBe(0);
    expect(released.zoom).toBe(1);
  });

  it("keeps the zoom inside its limits", () => {
    expect(clampCamera({ ...DEFAULT_CAMERA, zoom: 99 }).zoom).toBe(MAX_ZOOM);
    expect(clampCamera({ ...DEFAULT_CAMERA, zoom: 0.01 }).zoom).toBe(MIN_ZOOM);
  });

  it("leaves an unfocused camera projecting exactly as it always did", () => {
    /*
     * The invariant the rest of the suite rests on. Pan and zoom are optional,
     * and absent must mean "unchanged" — otherwise every fit-everything
     * assertion in universe-paint.test.ts is quietly testing a different scene
     * from the one that ships.
     */
    const before = positionsAt(21, DEFAULT_CAMERA, 16 / 9);
    const after = positionsAt(21, { ...DEFAULT_CAMERA, panX: 0, panY: 0, zoom: 1 }, 16 / 9);
    for (let i = 0; i < before.length; i += 1) {
      expect(after[i].sx).toBeCloseTo(before[i].sx, 12);
      expect(after[i].sy).toBeCloseTo(before[i].sy, 12);
      expect(after[i].sr).toBeCloseTo(before[i].sr, 12);
    }
  });
});

describe("the eight are visibly interconnected", () => {
  it("has exactly as many wires as planets", () => {
    // Eight orbits, eight worlds, eight links: the number is the identity.
    expect(CONNECTIONS).toHaveLength(8);
    expect(PLANETS).toHaveLength(8);
  });

  it("closes into a ring, so every planet carries two links", () => {
    const degree = new Map<number, number>();
    for (const [a, b] of CONNECTIONS) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    expect([...degree.keys()].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const [planet, count] of degree) {
      expect(count, `planet ${planet} is not linked at both ends`).toBe(2);
    }
  });

  it("indexes real planets, so a reorder moves the wires with them", () => {
    for (const [a, b] of CONNECTIONS) {
      expect(PLANETS[a]).toBeDefined();
      expect(PLANETS[b]).toBeDefined();
      expect(a).not.toBe(b);
    }
  });
});

describe("every body turns on its own axis", () => {
  it("gives all eight a spin, an axial tilt and an atmosphere", () => {
    for (const planet of PLANETS) {
      expect(planet.spin, `${planet.id} has no spin`).not.toBe(0);
      expect(Math.abs(planet.axialTilt), `${planet.id} is on its side`).toBeLessThan(0.6);
      expect(planet.atmosphere, `${planet.id} atmosphere out of range`).toBeGreaterThan(0);
      expect(planet.atmosphere).toBeLessThanOrEqual(1);
    }
  });

  it("turns much faster than it orbits, or the rotation is invisible", () => {
    // A body whose day equalled its year would show no rotation at all at the
    // scale it is drawn, which is the same as not having implemented it.
    for (const planet of PLANETS) {
      expect(Math.abs(planet.spin), `${planet.id} barely turns`).toBeGreaterThan(
        Math.abs(planet.speed) * 2,
      );
    }
  });

  it("does not turn them all the same way", () => {
    const retrograde = PLANETS.filter((p) => p.spin < 0);
    expect(retrograde.length).toBeGreaterThan(0);
    expect(retrograde.length).toBeLessThan(PLANETS.length);
  });

  it("advances the spin with time, and carries it on the position", () => {
    const a = positionsAt(0, DEFAULT_CAMERA, 16 / 9).find((p) => p.planet.id === "chat")!;
    const b = positionsAt(4, DEFAULT_CAMERA, 16 / 9).find((p) => p.planet.id === "chat")!;
    expect(b.spinAngle).not.toBeCloseTo(a.spinAngle, 3);
  });

  it("computes the spin in one place, so surface and sphere cannot disagree", () => {
    // Two copies of `t * spin` in different modules is the same class of bug as
    // the focal length the orbit rings once duplicated.
    const paint = readFileSync("src/lib/landing/paint.ts", "utf8");
    expect(paint, "the renderer recomputes the spin instead of reading it").not.toMatch(
      /t \* (planet\.)?spin/,
    );
    expect(paint).toMatch(/position\.spinAngle/);
  });
});
