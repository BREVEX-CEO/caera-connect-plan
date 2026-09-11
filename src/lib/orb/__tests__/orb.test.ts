import { describe, expect, it } from "vitest";
import {
  accentSwatchStops,
  ORB_ACCENTS,
  ORB_APPEARANCE,
  ORB_STATES,
  orbFrameAt,
  orbStateFor,
  qualityFor,
  tintFrame,
  type OrbState,
} from "../state";
import { ORB_FRAGMENT_SHADER, uniformsFor } from "../render";

/**
 * The orb's claims, checked as numbers rather than trusted as adjectives.
 *
 * "Paused is calmer than thinking" and "stopped genuinely stops" are the sort
 * of thing a comment can assert and be wrong about six months later. Here they
 * are arithmetic.
 */

const frame = (state: OrbState, seconds: number, amplitude?: number) =>
  orbFrameAt(state, seconds, amplitude === undefined ? {} : { amplitude });

describe("every state is covered", () => {
  it("describes all eleven", () => {
    expect(ORB_STATES).toHaveLength(11);
    for (const state of ORB_STATES) {
      expect(ORB_APPEARANCE[state], state).toBeDefined();
      expect(ORB_APPEARANCE[state].label.length).toBeGreaterThan(2);
    }
  });

  it("gives each state a label a person could read aloud", () => {
    for (const state of ORB_STATES) {
      const label = ORB_APPEARANCE[state].label;
      expect(label, state).not.toMatch(/[_{}<>]|webgl|shader|adapter/i);
    }
  });
});

describe("no state is distinguished by colour alone", () => {
  /*
   * The requirement that matters for anybody with a colour vision deficiency,
   * and the one most easily lost in a later tweak. Two states may share a hue
   * only if their energy or their size clearly differs.
   */
  it("differs in motion or size wherever two states share a palette", () => {
    for (const a of ORB_STATES) {
      for (const b of ORB_STATES) {
        if (a === b) continue;
        const one = ORB_APPEARANCE[a];
        const two = ORB_APPEARANCE[b];
        const sameColour = one.core.join() === two.core.join() && one.rim.join() === two.rim.join();
        if (!sameColour) continue;
        const energyGap = Math.abs(one.energy - two.energy);
        const scaleGap = Math.abs(one.scale - two.scale);
        expect(
          energyGap > 0.1 || scaleGap > 0.04,
          `${a} and ${b} share a palette and barely differ otherwise`,
        ).toBe(true);
      }
    }
  });

  it("keeps every rendered colour neutral", () => {
    for (const state of ORB_STATES) {
      for (const colour of [ORB_APPEARANCE[state].core, ORB_APPEARANCE[state].rim]) {
        expect(colour[0], `${state} red/green`).toBe(colour[1]);
        expect(colour[1], `${state} green/blue`).toBe(colour[2]);
      }
    }
  });
});

describe("the states mean what they say", () => {
  it("stopped does not move, at any moment", () => {
    const first = frame("stopped", 0);
    for (const seconds of [0.1, 1, 7.3, 120]) {
      const later = frame("stopped", seconds);
      expect(later.radius).toBe(first.radius);
      expect(later.turbulence).toBe(0);
    }
  });

  it("paused is calmer than thinking", () => {
    expect(ORB_APPEARANCE.paused.energy).toBeLessThan(ORB_APPEARANCE.thinking.energy);
    expect(ORB_APPEARANCE.paused.pulseHz).toBeLessThan(ORB_APPEARANCE.thinking.pulseHz);
  });

  it("browser work is as loud as machine work and a different shape", () => {
    /*
     * The two are the same kind of event — OCADE is changing something — so
     * neither may read as calmer than the other. What separates them is the
     * silhouette: a page is a bounded place and the orb stays open, while the
     * machine is not and it draws tight.
     */
    expect(ORB_APPEARANCE.browsing.energy).toBeGreaterThan(ORB_APPEARANCE.thinking.energy);
    expect(ORB_APPEARANCE.browsing.scale).toBeGreaterThan(ORB_APPEARANCE.acting.scale);
    expect(Math.abs(ORB_APPEARANCE.browsing.energy - ORB_APPEARANCE.acting.energy)).toBeLessThan(
      0.15,
    );
  });

  it("says which of the two is happening, in words", () => {
    expect(ORB_APPEARANCE.browsing.label).not.toBe(ORB_APPEARANCE.acting.label);
    expect(ORB_APPEARANCE.browsing.label).toMatch(/browser/i);
    expect(ORB_APPEARANCE.acting.label).toMatch(/computer/i);
  });

  it("acting is the busiest and the tightest", () => {
    const others = ORB_STATES.filter((state) => state !== "acting");
    for (const state of others) {
      expect(ORB_APPEARANCE.acting.energy).toBeGreaterThanOrEqual(ORB_APPEARANCE[state].energy);
    }
    expect(ORB_APPEARANCE.acting.scale).toBeLessThan(ORB_APPEARANCE.idle.scale);
  });

  it("listening is the most open", () => {
    for (const state of ORB_STATES) {
      expect(ORB_APPEARANCE.listening.scale).toBeGreaterThanOrEqual(ORB_APPEARANCE[state].scale);
    }
  });

  it("takeover is distinguishable from paused", () => {
    expect(ORB_APPEARANCE.takeover.rim.join()).not.toBe(ORB_APPEARANCE.paused.rim.join());
  });

  it("idle actually breathes, so the orb never looks dead", () => {
    const radii = [0, 0.5, 1, 1.5, 2, 2.5].map((s) => frame("idle", s).radius);
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });
});

describe("voice drives the orb while listening", () => {
  it("a loud room opens it further than a silent one", () => {
    const quiet = frame("listening", 0.25, 0);
    const loud = frame("listening", 0.25, 1);
    expect(loud.glow).toBeGreaterThan(quiet.glow);
  });

  it("silence still breathes", () => {
    const radii = [0, 0.4, 0.8, 1.2].map((s) => frame("listening", s, 0).radius);
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
  });

  it("amplitude is ignored where it would be meaningless", () => {
    expect(frame("thinking", 0.3, 0).glow).toBe(frame("thinking", 0.3, 1).glow);
  });

  it("survives a nonsense amplitude without producing a nonsense frame", () => {
    for (const amplitude of [Number.NaN, Infinity, -5, 99]) {
      const result = frame("listening", 0.3, amplitude);
      expect(Number.isFinite(result.radius)).toBe(true);
      expect(result.glow).toBeGreaterThanOrEqual(0);
      expect(result.glow).toBeLessThanOrEqual(1);
    }
  });
});

describe("fallbacks", () => {
  const env = (patch: Partial<Parameters<typeof qualityFor>[0]> = {}) => ({
    reducedMotion: false,
    webglAvailable: true,
    lowEndDevice: false,
    smallViewport: false,
    ...patch,
  });

  it("gives a capable desktop the full orb", () => {
    expect(qualityFor(env())).toBe("full");
  });

  it("stops the motion only when a person asked for it", () => {
    expect(qualityFor(env({ reducedMotion: true }))).toBe("still");
    // A weak device gets a cheaper orb, never a frozen one: the state readout
    // is the orb's whole job.
    expect(qualityFor(env({ lowEndDevice: true }))).toBe("simple");
    expect(qualityFor(env({ webglAvailable: false }))).toBe("simple");
    expect(qualityFor(env({ smallViewport: true }))).toBe("simple");
  });

  it("prefers the person's preference over every hardware signal", () => {
    expect(
      qualityFor(env({ reducedMotion: true, webglAvailable: true, lowEndDevice: false })),
    ).toBe("still");
  });

  it("a still orb rests, rather than freezing mid-breath", () => {
    const still = orbFrameAt("thinking", 3.7, { quality: "still" });
    expect(still.radius).toBe(ORB_APPEARANCE.thinking.scale);
    expect(still.turbulence).toBe(0);
  });
});

describe("mapping the runtime onto the orb", () => {
  it.each([
    ["listening", "listening"],
    ["thinking", "thinking"],
    ["observing", "thinking"],
    ["controlling", "acting"],
    ["speaking", "speaking"],
    ["paused", "paused"],
    ["stopped", "stopped"],
    ["error", "error"],
    [null, "idle"],
    ["something-new", "idle"],
  ])("maps %s to %s", (phase, expected) => {
    expect(orbStateFor({ phase })).toBe(expected);
  });

  it("an approval outranks whatever the loop was doing", () => {
    expect(orbStateFor({ phase: "controlling", awaitingApproval: true })).toBe("approval");
  });

  it("takeover outranks the phase but not an approval", () => {
    expect(orbStateFor({ phase: "controlling", userHasControl: true })).toBe("takeover");
    expect(
      orbStateFor({ phase: "controlling", userHasControl: true, awaitingApproval: true }),
    ).toBe("approval");
  });

  it("does not colour observation as action", () => {
    // Reading the screen changes nothing; spending the alarm colour on the safe
    // half of the loop is how people stop noticing the dangerous half.
    expect(orbStateFor({ phase: "observing" })).not.toBe("acting");
  });
});

describe("the shader", () => {
  it("keeps the orb inside the viewport at its largest state", () => {
    const largest = orbFrameAt("listening", 0, { amplitude: 1 });
    const values = uniformsFor(largest, 0, [256, 256]);
    // The halo reaches 2.2x the radius in the fragment shader; anything past
    // 1.0 in these world units clips at the edge of the canvas.
    expect(values.radius * 2.2).toBeLessThan(1.6);
  });

  it("bounds its march, so a missed surface cannot hang a frame", () => {
    expect(ORB_FRAGMENT_SHADER).toMatch(/for \(int step = 0; step < 32; step\+\+\)/);
    expect(ORB_FRAGMENT_SHADER).toMatch(/travelled > 6\.0/);
  });

  it("uses no texture and no derivative extension, so it runs on weak drivers", () => {
    expect(ORB_FRAGMENT_SHADER).not.toMatch(/sampler2D|texture2D|GL_OES_standard_derivatives/);
  });
});

describe("the accent swatch is derived from the accent, not written down twice", () => {
  /*
   * The picker's swatches were six hex literals in the Jarvis component: a
   * second statement of what each accent looks like, free to drift from the
   * weights the renderer tints with, and non-neutral colour in customer-facing
   * source and in the shipped bundle.
   */
  it("returns two stops per accent, as rgb rather than hex", () => {
    for (const accent of ORB_ACCENTS) {
      const [light, dark] = accentSwatchStops(accent);
      expect(light).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
      expect(dark).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    }
  });

  it("is neutral for silver, which is the identity tint", () => {
    for (const stop of accentSwatchStops("silver")) {
      const [r, g, b] = stop.match(/\d+/g)!.map(Number);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("tints every other accent away from grey, in the direction its weights say", () => {
    // Ember is warm: more red than blue. Tide is the reverse. Moss leads green.
    const channels = (accent: Parameters<typeof accentSwatchStops>[0]) =>
      accentSwatchStops(accent)[1].match(/\d+/g)!.map(Number);
    const [emberR, , emberB] = channels("ember");
    expect(emberR).toBeGreaterThan(emberB);
    const [tideR, , tideB] = channels("tide");
    expect(tideB).toBeGreaterThan(tideR);
    const [mossR, mossG, mossB] = channels("moss");
    expect(mossG).toBeGreaterThan(mossR);
    expect(mossG).toBeGreaterThan(mossB);
  });

  it("keeps the swatch as bright as the grey it came from", () => {
    // The weights average to 1 so an accent cannot double as a brightness
    // control; a swatch that darkened would misdescribe the orb.
    const mean = (stop: string) =>
      stop.match(/\d+/g)!.reduce((total, channel) => total + Number(channel), 0) / 3;
    const silver = mean(accentSwatchStops("silver")[1]);
    for (const accent of ORB_ACCENTS) {
      expect(Math.abs(mean(accentSwatchStops(accent)[1]) - silver)).toBeLessThan(1);
    }
  });
});

describe("an accent tints and never brightens", () => {
  /*
   * The weights must average to 1. `moss` summed to 2.90 and so darkened the
   * orb by three per cent — which matters because most orb states differ by
   * LUMINANCE, and an accent that changes brightness stops those states being
   * told apart.
   */
  it("keeps every accent's channel weights summing to three", () => {
    for (const accent of ORB_ACCENTS) {
      const frame = orbFrameAt("acting", 0);
      const tinted = tintFrame(frame, accent);
      const mean = (colour: readonly [number, number, number]) =>
        (colour[0] + colour[1] + colour[2]) / 3;
      expect(Math.abs(mean(tinted.core) - mean(frame.core))).toBeLessThan(0.005);
      expect(Math.abs(mean(tinted.rim) - mean(frame.rim))).toBeLessThan(0.005);
    }
  });
});
