import { describe, expect, it } from "vitest";
import {
  CONNECTIONS,
  SYSTEM_EXTENT,
  bodiesAt,
  motionFor,
  paintControlSystem,
  type ControlState,
} from "@/lib/work/control-solar";
import { PLANETS, URANUS_MOONS } from "@/lib/landing/solar-data";

/**
 * The Control + Work system, tested as behaviour rather than as intent.
 *
 * TWO SEPARATE CLAIMS ARE MADE IN THIS FILE, and they are separate on purpose.
 *
 * The first is about IDENTITY: the operational scene shows the same eight
 * planets and the same twenty-eight moons as the approved landing scene,
 * because it shares their data rather than restating it. Anything that reduced
 * the moon count, or added a ninth planet, would show up here — including a
 * change made to `solar-data` for the landing scene's sake.
 *
 * The second is about REPORTING: `paused` really is slower than `idle`, and
 * `stopped` really is stopped. The scene's whole job is to answer "what is
 * OCADE doing to my computer right now?" without words. A state that claims to
 * be frozen while the planets keep drifting is a lie told at exactly the moment
 * the user needs the truth, and no amount of comment prose prevents it.
 */

const ALL_STATES: ControlState[] = [
  "idle",
  "listening",
  "thinking",
  "observing",
  "controlling",
  "speaking",
  "paused",
  "stopped",
  "error",
];

/** A 2D context that records what it was asked to draw. */
function recordingContext() {
  const calls: { op: string; args: unknown[] }[] = [];
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
    };
  const gradient = { addColorStop: record("addColorStop") };
  return {
    calls,
    context: {
      clearRect: record("clearRect"),
      beginPath: record("beginPath"),
      arc: record("arc"),
      fill: record("fill"),
      stroke: record("stroke"),
      moveTo: record("moveTo"),
      lineTo: record("lineTo"),
      setTransform: record("setTransform"),
      save: record("save"),
      restore: record("restore"),
      translate: record("translate"),
      scale: record("scale"),
      fillText: record("fillText"),
      createRadialGradient: () => gradient,
      createLinearGradient: () => gradient,
      lineWidth: 1,
      strokeStyle: "",
      fillStyle: "",
      font: "",
      textAlign: "center",
    } as unknown as CanvasRenderingContext2D,
  };
}

describe("the Control + Work system keeps the OCADE Solar identity", () => {
  it("shows the eight planets, in the same order as the approved scene", () => {
    const { planets } = bodiesAt(0);
    expect(planets).toHaveLength(8);
    expect(planets.map((p) => p.id)).toEqual(PLANETS.map((p) => p.id));
  });

  it("shows Uranus with exactly twenty-eight moons", () => {
    const { moons } = bodiesAt(3.2);
    expect(moons).toHaveLength(28);
    expect(URANUS_MOONS).toHaveLength(28);
    // Named, not anonymous dots: the data carries real moons and the scene uses
    // it rather than generating twenty-eight specks.
    expect(new Set(moons.map((m) => m.name)).size).toBe(28);
  });

  it("orbits the moons around Uranus rather than around the Sun", () => {
    const { moons, uranus } = bodiesAt(5);
    for (const moon of moons) {
      const distance = Math.hypot(moon.x - uranus.x, moon.y - uranus.y);
      expect(distance).toBeLessThan(14);
    }
  });

  it("connects the planets as a ring, never as a full mesh", () => {
    // Every pair would be 28 lines, several of them through the Sun.
    expect(CONNECTIONS).toHaveLength(8);
    for (const [from, to] of CONNECTIONS) {
      expect(Math.abs(from - to) === 1 || Math.abs(from - to) === 7).toBe(true);
    }
  });

  it("frames the whole system, outermost orbit included", () => {
    const outermost = Math.max(...PLANETS.map((p) => p.orbit));
    expect(SYSTEM_EXTENT).toBeGreaterThan(outermost);
  });
});

describe("the system reports what OCADE is actually doing", () => {
  it("names every state in words as well as in motion", () => {
    for (const state of ALL_STATES) {
      const motion = motionFor({ state, time: 1 });
      expect(motion.caption.length).toBeGreaterThan(2);
    }
  });

  it("freezes completely when the user stops it", () => {
    const motion = motionFor({ state: "stopped", time: 4 });
    // Zero, not "very slow". A stop that still drifts leaves "did it stop?"
    // unanswerable on the one screen where it must not be.
    expect(motion.orbitRate).toBe(0);
    expect(motion.frozen).toBe(true);
  });

  it("moves slower when paused than when idle, and slower still than working", () => {
    const paused = motionFor({ state: "paused", time: 1 }).orbitRate;
    const idle = motionFor({ state: "idle", time: 1 }).orbitRate;
    const controlling = motionFor({ state: "controlling", time: 1 }).orbitRate;
    expect(paused).toBeLessThan(idle);
    expect(idle).toBeLessThan(controlling);
    expect(paused).toBeGreaterThan(0);
  });

  it("sweeps only while it is looking at the computer", () => {
    expect(motionFor({ state: "observing", time: 1 }).scan).not.toBeNull();
    for (const state of ALL_STATES.filter((s) => s !== "observing")) {
      expect(motionFor({ state, time: 1 }).scan).toBeNull();
    }
  });

  it("pulses the Sun with the voice while speaking, and clamps it", () => {
    const quiet = motionFor({ state: "speaking", time: 0, amplitude: 0 }).sunPulse;
    const loud = motionFor({ state: "speaking", time: 0, amplitude: 1 }).sunPulse;
    const shouting = motionFor({ state: "speaking", time: 0, amplitude: 40 }).sunPulse;
    expect(loud).toBeGreaterThan(quiet);
    // A loud syllable must not be able to flare the centre across the panel.
    expect(shouting).toBe(loud);
    expect(loud).toBeLessThanOrEqual(1);
  });

  it("keeps the connections subtle in every state", () => {
    for (const state of ALL_STATES) {
      const { connectionOpacity } = motionFor({ state, time: 2 });
      expect(connectionOpacity).toBeGreaterThan(0);
      expect(connectionOpacity).toBeLessThanOrEqual(0.25);
    }
  });

  it("pulses while listening, so an open microphone is visible", () => {
    const samples = [0, 0.6, 1.2, 1.8].map(
      (time) => motionFor({ state: "listening", time }).sunPulse,
    );
    expect(new Set(samples).size).toBeGreaterThan(1);
  });
});

describe("painting a frame", () => {
  it("draws the Sun, eight planets, twenty-eight moons and the connections", () => {
    const { calls, context } = recordingContext();
    const painted = paintControlSystem(context, {
      width: 800,
      height: 500,
      motion: motionFor({ state: "idle", time: 1 }),
      phase: 2,
    });

    expect(painted.planets).toHaveLength(8);
    expect(painted.moons).toHaveLength(28);
    expect(calls.filter((c) => c.op === "clearRect")).toHaveLength(1);
    // 8 orbit rings + 8 planets + 28 moons + sun body + sun glow + moon ring.
    expect(calls.filter((c) => c.op === "arc").length).toBeGreaterThanOrEqual(46);
    expect(calls.filter((c) => c.op === "lineTo").length).toBeGreaterThanOrEqual(8);
  });

  it("draws the same scene when stopped — frozen is not blank", () => {
    const { calls, context } = recordingContext();
    paintControlSystem(context, {
      width: 600,
      height: 400,
      motion: motionFor({ state: "stopped", time: 3 }),
      phase: 1,
    });
    expect(calls.filter((c) => c.op === "arc").length).toBeGreaterThanOrEqual(46);
  });

  it("adds the sweep line only while observing", () => {
    const withoutScan = recordingContext();
    paintControlSystem(withoutScan.context, {
      width: 600,
      height: 400,
      motion: motionFor({ state: "idle", time: 1 }),
      phase: 1,
    });
    const withScan = recordingContext();
    paintControlSystem(withScan.context, {
      width: 600,
      height: 400,
      motion: motionFor({ state: "observing", time: 1 }),
      phase: 1,
    });
    const lines = (r: typeof withScan) => r.calls.filter((c) => c.op === "lineTo").length;
    expect(lines(withScan)).toBe(lines(withoutScan) + 1);
  });
});
