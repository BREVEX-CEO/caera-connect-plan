import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { paintUniverse, makeStars, projectOrbitPoint, type Star } from "../landing/paint";
import {
  PLANETS,
  DEFAULT_CAMERA,
  positionsAt,
  framingFor,
  clampCamera,
  MIN_PITCH,
  MAX_PITCH,
  MIN_DISTANCE,
  MAX_DISTANCE,
  MIN_FOCAL,
  type RenderTier,
} from "../landing/universe";

/**
 * The drawing itself, asserted.
 *
 * WHAT WAS MISSING. The universe had thorough tests for its geometry —
 * projection, hit testing, camera clamping, quality tiers — and none at all for
 * the painting, because the draw loop lived in a closure reachable only through
 * `requestAnimationFrame`. A tab that is not displayed never fires one, so the
 * scene could not be observed in an automated environment and "it renders"
 * rested on somebody having looked at it.
 *
 * A RECORDING CONTEXT closes that gap without a browser. It implements the
 * handful of 2D methods this scene uses and records every call, so the tests
 * below assert what was actually drawn: that pixels are filled at all, that the
 * eight planets appear, that a still tier omits the orbit rings, and that no
 * coordinate is NaN or Infinity — the failure that produces a blank canvas with
 * no error anywhere.
 */

interface Call {
  op: string;
  args: number[];
}

function recordingContext() {
  const calls: Call[] = [];
  const gradient = { addColorStop: () => {} };
  const context = {
    calls,
    globalAlpha: 1,
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    lineWidth: 0,
    clearRect: (...a: number[]) => calls.push({ op: "clearRect", args: a }),
    fillRect: (...a: number[]) => calls.push({ op: "fillRect", args: a }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...a: number[]) => calls.push({ op: "moveTo", args: a }),
    lineTo: (...a: number[]) => calls.push({ op: "lineTo", args: a }),
    arc: (...a: number[]) => calls.push({ op: "arc", args: a }),
    /*
     * The surface and shadow pass needs these. Recorded rather than ignored,
     * because `clip` without a matching `restore` leaks the clip onto every
     * later planet — every subsequent body would be drawn only where the first
     * one already was, which on a real canvas is a scene that loses seven of
     * its eight planets. The balance is asserted below.
     */
    ellipse: (...a: number[]) => calls.push({ op: "ellipse", args: a }),
    save: () => calls.push({ op: "save", args: [] }),
    restore: () => calls.push({ op: "restore", args: [] }),
    clip: () => calls.push({ op: "clip", args: [] }),
    fill: () => calls.push({ op: "fill", args: [] }),
    stroke: () => calls.push({ op: "stroke", args: [] }),
    createRadialGradient: (...a: number[]) => {
      calls.push({ op: "createRadialGradient", args: a });
      return gradient;
    },
  };
  return context as unknown as CanvasRenderingContext2D & { calls: Call[] };
}

const STARS: Star[] = makeStars(
  40,
  (() => {
    // Deterministic: a flaky star field would make every assertion below unstable.
    let seed = 0.42;
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  })(),
);

function paint(tier: RenderTier = "full", time = 3, activePlanetId: string | null = null) {
  const context = recordingContext();
  const positions = paintUniverse(context, {
    width: 1280,
    height: 720,
    time,
    camera: DEFAULT_CAMERA,
    tier,
    stars: STARS,
    activePlanetId,
  });
  return { context, positions };
}

describe("a frame actually draws", () => {
  it("clears and fills the background before anything else", () => {
    const { context } = paint();
    expect(context.calls[0].op).toBe("clearRect");
    // Painting the sky after the planets would erase them — a real ordering bug
    // this pins, and one that looks like "the scene never rendered".
    const firstFill = context.calls.findIndex((c) => c.op === "fillRect");
    const firstArcFill = context.calls.findIndex((c) => c.op === "arc");
    expect(firstFill).toBeLessThan(firstArcFill);
  });

  it("issues a substantial number of drawing calls", () => {
    const { context } = paint();
    // 40 stars + 8 orbit rings + core halo + core body + 8 planets. A frame
    // that draws almost nothing is the blank-canvas failure.
    expect(context.calls.filter((c) => c.op === "fill").length).toBeGreaterThan(45);
    expect(context.calls.filter((c) => c.op === "stroke").length).toBeGreaterThanOrEqual(8);
  });

  it("draws every planet", () => {
    const { positions } = paint();
    expect(positions).toHaveLength(PLANETS.length);
    expect(PLANETS).toHaveLength(8);
  });

  it("builds the gradients that give the spheres their shading", () => {
    const { context } = paint();
    // One per planet (lit), plus core body, core halo and the sky.
    expect(
      context.calls.filter((c) => c.op === "createRadialGradient").length,
    ).toBeGreaterThanOrEqual(PLANETS.length + 3);
  });
});

describe("no coordinate is ever NaN or Infinity", () => {
  /**
   * THE SILENT KILLER. A single non-finite coordinate makes the canvas discard
   * the path with no exception and no console message. The result is a blank or
   * half-drawn scene that looks exactly like "the animation is broken" and
   * gives nothing to debug.
   */
  const tiers: RenderTier[] = ["full", "reduced", "static"];

  it.each(tiers)("%s tier produces only finite coordinates", (tier) => {
    for (const time of [0, 0.016, 1, 7.5, 60, 3600]) {
      const { context } = paint(tier, time);
      for (const call of context.calls) {
        for (const arg of call.args) {
          expect(Number.isFinite(arg), `${call.op}(${call.args.join(", ")}) at t=${time}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("keeps orbit points finite even with the camera inside the orbit", () => {
    // camera.distance below the orbit radius puts the ring behind the eye,
    // which is where the perspective divide blows up without its guard.
    const camera = { ...DEFAULT_CAMERA, distance: 0.2 };
    for (const planet of PLANETS) {
      for (let i = 0; i <= 72; i += 1) {
        const [x, y] = projectOrbitPoint(planet, (i / 72) * Math.PI * 2, camera, 1.78);
        expect(Number.isFinite(x) && Number.isFinite(y), `${planet.id} at step ${i}`).toBe(true);
      }
    }
  });
});

describe("quality tiers change what is drawn, not just a label", () => {
  it("omits orbit rings on the still tier", () => {
    const still = paint("static");
    const full = paint("full");
    // Rings are the per-frame cost that buys least on a machine that cannot
    // animate, so the still tier drops them entirely.
    expect(still.context.calls.filter((c) => c.op === "lineTo").length).toBe(0);
    expect(full.context.calls.filter((c) => c.op === "lineTo").length).toBeGreaterThan(500);
  });

  it("still draws the planets on the still tier", () => {
    // Degrading must not mean showing nothing: a static frame is still the
    // product's first impression.
    const { context, positions } = paint("static");
    expect(positions).toHaveLength(8);
    expect(context.calls.filter((c) => c.op === "fill").length).toBeGreaterThan(40);
  });
});

describe("the scene animates", () => {
  it("moves the planets between frames", () => {
    const a = paint("full", 0).positions;
    const b = paint("full", 2.5).positions;
    const moved = a.some((p, i) => Math.abs(p.sx - b[i].sx) > 1e-6);
    expect(moved, "the planets are in identical positions at t=0 and t=2.5").toBe(true);
  });

  it("pulses the core", () => {
    // The core radius is a function of time; identical radii would mean the
    // clock is not reaching the drawing.
    const radiusAt = (t: number) => {
      const { context } = paint("full", t);
      const arcs = context.calls.filter((c) => c.op === "arc");
      return arcs.map((c) => c.args[2]).join(",");
    };
    expect(radiusAt(0)).not.toBe(radiusAt(1.7));
  });

  it("highlights the active planet with an extra glow and outline", () => {
    const none = paint("full", 3, null);
    const active = paint("full", 3, PLANETS[0].id);
    expect(active.context.calls.filter((c) => c.op === "createRadialGradient").length).toBe(
      none.context.calls.filter((c) => c.op === "createRadialGradient").length + 1,
    );
    expect(active.context.calls.filter((c) => c.op === "stroke").length).toBeGreaterThan(
      none.context.calls.filter((c) => c.op === "stroke").length,
    );
  });
});

describe("every planet stays on screen", () => {
  /**
   * DEFECT LP-01, FIXED — and the reason this file exists.
   *
   * The projection used a hard-coded focal length of 8, which framed the scene
   * for exactly one aspect ratio. At the default camera on an ordinary 16:9
   * window FOUR OF THE EIGHT planets projected outside the viewport:
   * `automations` at sx 1.71, `links` and `voice` past the left edge,
   * `projects` above the top. Half of the capabilities the landing page exists
   * to advertise were simply never drawn.
   *
   * The 32 geometry tests all passed throughout. Every one of them asserted a
   * property of the projection — finite, ordered, correctly hit-tested — and
   * not one asserted that the result lands where a person can see it. It was
   * found by reading pixels back off a real canvas, and this is the assertion
   * that would have caught it.
   */
  const VIEWPORTS: Array<[string, number, number]> = [
    ["desktop 16:9", 1280, 720],
    ["laptop 16:10", 1440, 900],
    ["ultrawide 21:9", 2560, 1080],
    ["phone portrait", 390, 844],
    ["tablet portrait", 768, 1024],
    ["square", 900, 900],
  ];

  it.each(VIEWPORTS)("%s keeps all eight planets in frame for a full orbit", (_l, w, h) => {
    // The slowest planet takes ~165s to come round, so 400s covers every one
    // of them through more than a full revolution. A single instant would miss
    // a planet that only leaves the frame at one point in its orbit.
    const strays: string[] = [];
    for (let t = 0; t <= 400; t += 1.5) {
      for (const p of positionsAt(t, DEFAULT_CAMERA, w / h)) {
        if (p.sx < 0 || p.sx > 1 || p.sy < 0 || p.sy > 1) {
          strays.push(`${p.planet.id} at t=${t} (${p.sx.toFixed(2)}, ${p.sy.toFixed(2)})`);
        }
      }
    }
    expect(strays.slice(0, 5), "planets left the viewport").toEqual([]);
  });

  it("holds for every camera the user can actually reach", () => {
    // Framing that only works at the default camera would break the moment
    // someone dragged the scene, which is the one interaction it invites.
    const strays: string[] = [];
    for (const [, w, h] of VIEWPORTS) {
      for (const pitch of [MIN_PITCH, -0.1, 0.32, 0.7, MAX_PITCH]) {
        for (const distance of [MIN_DISTANCE, 13, MAX_DISTANCE]) {
          for (const yaw of [0, 1.1, 2.4, 4.7]) {
            const camera = clampCamera({ yaw, pitch, distance });
            for (let t = 0; t <= 200; t += 8) {
              for (const p of positionsAt(t, camera, w / h)) {
                if (p.sx < 0 || p.sx > 1 || p.sy < 0 || p.sy > 1) {
                  strays.push(`${p.planet.id} pitch=${pitch.toFixed(2)} d=${distance}`);
                }
              }
            }
          }
        }
      }
    }
    expect(strays.slice(0, 5)).toEqual([]);
  });

  it("keeps planets big enough to see and tap on a phone", () => {
    // The other half of the trade-off: fitting everything by pulling the camera
    // back produced 3px spheres on a 390px screen — technically on screen,
    // useless in practice.
    const positions = positionsAt(4.2, DEFAULT_CAMERA, 390 / 844);
    const smallestPx = Math.min(...positions.map((p) => p.sr * Math.min(390, 844))) * 2;
    expect(smallestPx).toBeGreaterThan(14);
  });

  it("never zooms in past the original framing", () => {
    const { focal } = framingFor(DEFAULT_CAMERA, 16 / 9);
    expect(focal).toBeLessThanOrEqual(8);
    expect(focal).toBeGreaterThanOrEqual(MIN_FOCAL);
  });

  it("compresses the orbits only when legibility demands it", () => {
    // A wide desktop window has room, so nothing should be pulled in there.
    expect(framingFor(DEFAULT_CAMERA, 2560 / 1080).orbitScale).toBeGreaterThan(0.85);
    // A phone does not, so the system draws tighter around the core.
    expect(framingFor(DEFAULT_CAMERA, 390 / 844).orbitScale).toBeLessThan(0.6);
  });

  it("frames the orbit rings with the same numbers as the planets", () => {
    /*
     * The rings and the planets are projected by two different functions. If
     * they ever disagree on the focal length or the orbit compression, planets
     * float off their own rings — a bug that looks like broken physics and is
     * really two copies of one constant.
     */
    const aspect = 1280 / 720;
    for (const planet of PLANETS) {
      const angle = 1.234;
      const [rx, ry] = projectOrbitPoint(planet, angle, DEFAULT_CAMERA, aspect);
      // Place a planet at that same angle by solving for the time that puts it
      // there, then confirm the ring passes through it.
      const t = (angle - planet.phase) / planet.speed;
      const match = positionsAt(t, DEFAULT_CAMERA, aspect).find((p) => p.planet.id === planet.id)!;
      expect(Math.abs(match.sx - rx), `${planet.id} sits off its ring`).toBeLessThan(0.002);
      expect(Math.abs(match.sy - ry), `${planet.id} sits off its ring`).toBeLessThan(0.002);
    }
  });

  it("stays inside the frame budget on a full frame", () => {
    // `focalFor` samples 32 points on 8 orbits, and the ring pass asks for the
    // framing 584 times per frame. Without the memo that is ~150k iterations
    // per frame; this pins that the memo is doing its job.
    const context = recordingContext();
    const stars = makeStars(220);
    const started = performance.now();
    for (let i = 0; i < 60; i += 1) {
      paintUniverse(context, {
        width: 1280,
        height: 720,
        time: i / 60,
        camera: DEFAULT_CAMERA,
        tier: "full",
        stars,
        activePlanetId: null,
      });
    }
    const perFrame = (performance.now() - started) / 60;
    expect(perFrame, `${perFrame.toFixed(2)}ms per frame`).toBeLessThan(16);
  });
});

describe("the universe answers the mouse on every tier", () => {
  const CANVAS = readFileSync("src/components/landing/UniverseCanvas.tsx", "utf8");

  /**
   * DEFECT LP-02, FIXED.
   *
   * The draw loop ended with `if (localTier === "static") return;` — a plain
   * `return` that killed the loop permanently. On every device that got the
   * still tier, which is every machine with `prefers-reduced-motion` and every
   * low-powered one, the scene painted once and then ignored the mouse: a drag
   * rotated the camera in memory while the canvas never redrew, and hover
   * hit-testing stopped with it. It looked like a static image with broken
   * controls, shown to exactly the users least likely to realise it was meant
   * to move.
   *
   * Reduced motion means "do not move on your own", not "do not respond".
   *
   * Verified against the live component in a browser, with the still tier
   * active: idle produced no repaint, while drag, wheel and double-click each
   * changed the painted pixels, and double-click restored the opening frame
   * byte for byte.
   */
  it("repaints on demand rather than ending the loop", () => {
    expect(CANVAS).toMatch(/const requestRepaint = \(\) => \{/);
    expect(CANVAS).toMatch(/repaintRef\.current = requestRepaint/);
  });

  it("asks for a repaint after every camera change", () => {
    // A camera change with no repaint is a control that silently does nothing.
    const handlers = ["onPointerMove", "onWheel", "onDoubleClick"];
    for (const handler of handlers) {
      const start = CANVAS.indexOf(handler);
      expect(start, `${handler} is missing`).toBeGreaterThan(0);
      expect(
        CANVAS.slice(start, start + 900),
        `${handler} changes the camera without repainting`,
      ).toMatch(/repaintRef\.current\?\.\(\)/);
    }
  });

  it("does not stack duplicate frames", () => {
    // Without the guard, a fast drag queues one frame per pointermove and the
    // still tier becomes busier than the animating one.
    expect(CANVAS).toMatch(/if \(!running \|\| frame !== 0\) return;/);
  });

  it("freezes the clock on the still tier instead of jumping on repaint", () => {
    /*
     * If `elapsed` kept accumulating, a drag after ten seconds of stillness
     * would snap the planets ten seconds forward — motion, delivered to a user
     * who asked for none.
     */
    expect(CANVAS).toMatch(
      /if \(!paused && localTier !== "static"\) elapsedRef\.current \+= delta;/,
    );
  });

  it("keeps the clock outside the effect, so a hover cannot rewind the system", () => {
    /*
     * `elapsed` used to be a local inside the draw effect, and the effect
     * depended on `activePlanetId`. Every hover tore the loop down and rebuilt
     * it with the clock back at zero, snapping all eight planets to their t=0
     * positions — so running the pointer along the legend made the system jump
     * backwards eight times. Every geometry test still passed, because the
     * scene was correct at each instant and only the CONTINUITY was broken.
     */
    expect(CANVAS, "the clock is back inside the effect").toMatch(/const elapsedRef = useRef\(0\)/);
    const deps = /\}, \[tier, notifyHover\]\);/;
    expect(CANVAS, "the draw loop restarts on hover or pause again").toMatch(deps);
  });

  it("repaints after a resize, or the still tier shows an empty rectangle", () => {
    /*
     * DEFECT LP-03. Assigning `canvas.width` wipes every pixel and every
     * context setting. `ResizeObserver` delivers its first callback AFTER the
     * animation-frame callbacks of the same frame and before compositing, so
     * the order on load was: paint the scene, blank it, show the blank one.
     *
     * Animating tiers repainted on the next frame and nobody saw it. The still
     * tier has no next frame, so everyone with `prefers-reduced-motion` — and
     * everyone on a low-powered device — got an empty rectangle where the
     * product's opening image belongs, permanently.
     */
    const start = CANVAS.indexOf("const resize = () =>");
    expect(start, "the resize handler is missing").toBeGreaterThan(0);
    const body = CANVAS.slice(start, CANVAS.indexOf("observer.observe"));
    expect(body, "canvas.width is assigned without reapplying the transform").toMatch(
      /context\.setTransform/,
    );
    expect(body, "a resize blanks the canvas and never repaints it").toMatch(
      /repaintRef\.current\?\.\(\)/,
    );
  });

  it("offers a way back to the designed framing", () => {
    expect(CANVAS).toMatch(/onDoubleClick/);
    // Written to the TARGET, not to the live camera: the view has to sail back
    // to the designed framing rather than cut to it.
    expect(CANVAS).toMatch(/target: \{ \.\.\.DEFAULT_CAMERA \}/);
  });

  it("clears the repaint handle on unmount", () => {
    // A retained closure would keep a dead canvas alive through the ref.
    expect(CANVAS).toMatch(/repaintRef\.current = null/);
  });

  it("rotating the camera genuinely changes what is drawn", () => {
    // The behavioural half: the handlers above are only worth wiring if the
    // camera actually reaches the projection.
    const a = positionsAt(20, DEFAULT_CAMERA, 16 / 9);
    const b = positionsAt(
      20,
      clampCamera({ ...DEFAULT_CAMERA, yaw: DEFAULT_CAMERA.yaw + 0.6 }),
      16 / 9,
    );
    expect(a.some((p, i) => Math.abs(p.sx - b[i].sx) > 0.01)).toBe(true);
  });

  it("zooming genuinely changes what is drawn", () => {
    const a = positionsAt(20, DEFAULT_CAMERA, 16 / 9);
    const b = positionsAt(20, clampCamera({ ...DEFAULT_CAMERA, distance: 20 }), 16 / 9);
    expect(a.some((p, i) => Math.abs(p.sr - b[i].sr) > 1e-4)).toBe(true);
  });

  it("keeps every planet on screen at the extremes the mouse can reach", () => {
    // Drag and wheel are clamped, and the clamp has to keep the scene framed
    // or interaction becomes a way to break the page.
    for (const distance of [MIN_DISTANCE, MAX_DISTANCE]) {
      for (const pitch of [MIN_PITCH, MAX_PITCH]) {
        const camera = clampCamera({ yaw: 2.2, pitch, distance });
        for (const p of positionsAt(37, camera, 16 / 9)) {
          expect(p.sx, `${p.planet.id} left the frame`).toBeGreaterThanOrEqual(0);
          expect(p.sx).toBeLessThanOrEqual(1);
          expect(p.sy).toBeGreaterThanOrEqual(0);
          expect(p.sy).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("the star field", () => {
  it("is generated once with values in range", () => {
    const stars = makeStars(120);
    expect(stars).toHaveLength(120);
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
      expect(s.r).toBeGreaterThan(0);
      expect(s.a).toBeGreaterThan(0);
    }
  });

  it("twinkles out of phase rather than pulsing as one", () => {
    // Uniform pulsing reads as a flicker bug. Two stars at the same instant
    // must not share an alpha.
    const stars: Star[] = [
      { x: 0.1, y: 0.2, r: 1, a: 0.5 },
      { x: 0.8, y: 0.7, r: 1, a: 0.5 },
    ];
    const alphas: number[] = [];
    const context = recordingContext();
    Object.defineProperty(context, "globalAlpha", {
      set(v: number) {
        alphas.push(v);
      },
      get: () => 1,
      configurable: true,
    });
    paintUniverse(context, {
      width: 800,
      height: 600,
      time: 2,
      camera: DEFAULT_CAMERA,
      tier: "full",
      stars,
      activePlanetId: null,
    });
    const starAlphas = alphas.filter((a) => a !== 1);
    expect(starAlphas.length).toBeGreaterThanOrEqual(2);
    expect(starAlphas[0]).not.toBe(starAlphas[1]);
  });
});
