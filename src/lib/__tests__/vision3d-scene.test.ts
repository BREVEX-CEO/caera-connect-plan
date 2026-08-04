import { describe, it, expect } from "vitest";
import {
  validateMaterial,
  validateTrack,
  assessScene,
  RENDER_REALITY,
  type Material,
  type Scene,
} from "../vision3d/scene";
import {
  assessReconstruction,
  RECONSTRUCTION_REALITY,
  MIN_BASELINE_M,
  type Frame,
} from "../vision3d/reconstruction";
import { buildBox } from "../vision3d/mesh";

const cube = () => {
  const b = buildBox(1, 1, 1);
  if (!b.ok) throw new Error("fixture failed");
  return b.data;
};

const material = (over: Partial<Material> = {}): Material => ({
  name: "Plastic",
  baseColor: [0.5, 0.5, 0.5],
  metallic: 0,
  roughness: 0.4,
  ...over,
});

const scene = (over: Partial<Scene> = {}): Scene => ({
  name: "test",
  objects: [{ name: "Cube", mesh: cube(), material: "Plastic" }],
  materials: [material()],
  lights: [{ name: "Key", kind: "sun", intensity: 3, color: [1, 1, 1] }],
  ...over,
});

/* ------------------------------------------------------------- materials -- */

describe("materials are checked against physics", () => {
  it("accepts an ordinary dielectric", () => {
    const r = validateMaterial(material());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data).toEqual([]);
  });

  /**
   * An sRGB byte value that was never converted to linear is the commonest
   * material bug, and it produces a surface that is merely "too bright"
   * rather than obviously broken.
   */
  it("catches a colour channel outside 0–1 and names the likely cause", () => {
    const r = validateMaterial(material({ baseColor: [255, 128, 64] }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/sRGB byte that wasn't converted/i);
  });

  it("refuses an index of refraction below 1", () => {
    const r = validateMaterial(material({ ior: 0.8 }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/vacuum is exactly 1/i);
  });

  it("accepts real refractive indices", () => {
    expect(validateMaterial(material({ ior: 1.33 })).ok).toBe(true);
    expect(validateMaterial(material({ ior: 1.5 })).ok).toBe(true);
  });

  /**
   * Half-metal is not a substance. It is reported rather than refused, because
   * layered materials legitimately produce intermediate values.
   */
  it("warns about intermediate metallic without refusing it", () => {
    const r = validateMaterial(material({ metallic: 0.5 }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.join(" ")).toMatch(/metal or they aren't/i);
  });

  it("warns that a perfect mirror will speckle", () => {
    const r = validateMaterial(material({ metallic: 1, roughness: 0 }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.join(" ")).toMatch(/bright speckle/i);
  });

  it("warns about a diffuse surface brighter than anything real", () => {
    const r = validateMaterial(material({ baseColor: [0.99, 0.99, 0.99] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.join(" ")).toMatch(/No real diffuse surface reflects more than/i);
  });

  it("refuses values outside their ranges", () => {
    expect(validateMaterial(material({ metallic: 1.5 })).ok).toBe(false);
    expect(validateMaterial(material({ roughness: -0.1 })).ok).toBe(false);
    expect(validateMaterial(material({ opacity: 2 })).ok).toBe(false);
    expect(validateMaterial(material({ emissive: [-1, 0, 0] })).ok).toBe(false);
  });
});

/* ------------------------------------------------------------- animation -- */

describe("animation tracks", () => {
  const track = (keyframes: { time: number; value: number }[]) => ({
    target: "Cube",
    property: "position.y",
    keyframes,
  });

  it("accepts an ordered track and measures its duration", () => {
    const r = validateTrack(
      track([
        { time: 0, value: 0 },
        { time: 2.5, value: 10 },
      ]),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.durationSeconds).toBe(2.5);
  });

  /**
   * Ties and reversals play correctly in the editor and jump in the export,
   * because tools break ties differently. Sorting them silently would change
   * the animation the user described, so both are refused.
   */
  it("refuses duplicate keyframe times rather than picking one", () => {
    const r = validateTrack(
      track([
        { time: 1, value: 0 },
        { time: 1, value: 5 },
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/export won't match what you see/i);
  });

  it("refuses out-of-order keyframes rather than sorting them", () => {
    const r = validateTrack(
      track([
        { time: 2, value: 0 },
        { time: 1, value: 5 },
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/won't reorder them/i);
  });

  it("refuses a track that isn't an animation", () => {
    expect(validateTrack(track([])).ok).toBe(false);
    expect(validateTrack(track([{ time: 0, value: 1 }])).ok).toBe(false);
  });

  it("refuses invalid times and values", () => {
    expect(
      validateTrack(
        track([
          { time: -1, value: 0 },
          { time: 1, value: 1 },
        ]),
      ).ok,
    ).toBe(false);
    expect(
      validateTrack(
        track([
          { time: 0, value: NaN },
          { time: 1, value: 1 },
        ]),
      ).ok,
    ).toBe(false);
  });
});

/* ----------------------------------------------------------------- scene -- */

describe("a scene is checked before render time is spent", () => {
  it("accepts a well-formed scene and counts what's in it", () => {
    const r = assessScene(scene());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.objects).toBe(1);
    expect(r.data.triangles).toBe(12);
    expect(r.evidence).toMatch(/1 contributing lights.*static/);
  });

  /**
   * The check that saves the most time. An unlit scene renders a black frame
   * every time, and the renderer reports success while doing it.
   */
  it("REFUSES a scene with no light rather than rendering black", () => {
    const r = assessScene(scene({ lights: [] }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/render completely black/i);
    expect(r.reason).toMatch(/won't spend the render time/i);
  });

  it("refuses a scene lit only by zero-intensity lights", () => {
    const r = assessScene(
      scene({ lights: [{ name: "Off", kind: "point", intensity: 0, color: [1, 1, 1] }] }),
    );
    expect(r.ok).toBe(false);
  });

  it("accepts emissive-only lighting but says it will be noisy", () => {
    const r = assessScene(
      scene({
        lights: [],
        materials: [material({ emissive: [5, 5, 5] })],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.warnings.join(" ")).toMatch(/noisy without a light source/i);
  });

  /** A missing material becomes default grey, and the render "succeeds". */
  it("refuses an object whose material isn't in the scene", () => {
    const s = scene();
    s.objects[0].material = "Missing";
    const r = assessScene(s);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/substitute a default grey and report success/i);
  });

  it("refuses broken geometry, naming the object", () => {
    const s = scene();
    s.objects[0].mesh.indices = s.objects[0].mesh.indices.slice(0, 3);
    const r = assessScene(s);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/^“Cube”:/);
  });

  it("refuses an animation targeting an object that isn't there", () => {
    const r = assessScene(
      scene({
        tracks: [
          {
            target: "Ghost",
            property: "position.y",
            keyframes: [
              { time: 0, value: 0 },
              { time: 1, value: 1 },
            ],
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/silently animate nothing/i);
  });

  it("reports the longest animation as the scene duration", () => {
    const r = assessScene(
      scene({
        tracks: [
          {
            target: "Cube",
            property: "x",
            keyframes: [
              { time: 0, value: 0 },
              { time: 1, value: 1 },
            ],
          },
          {
            target: "Cube",
            property: "y",
            keyframes: [
              { time: 0, value: 0 },
              { time: 4, value: 1 },
            ],
          },
        ],
      }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.durationSeconds).toBe(4);
  });

  it("refuses an empty scene", () => {
    expect(assessScene(scene({ objects: [] })).ok).toBe(false);
  });

  /**
   * "Validated" and "rendered" are different claims, and a system that blurs
   * them will eventually report an image that does not exist.
   */
  it("never claims a render happened", () => {
    expect(RENDER_REALITY).toMatch(/No picture has been rendered/i);
    expect(RENDER_REALITY).toMatch(/won't show you a frame it didn't produce/i);
  });
});

describe("hostile scene inputs fail closed", () => {
  it("rejects duplicate material names because object binding is ambiguous", () => {
    const input = scene();
    input.materials.push({ ...input.materials[0] });
    const r = assessScene(input);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/duplicate material/i);
  });

  it("rejects non-finite or invalid light data", () => {
    const input = scene();
    input.lights[0].intensity = Number.NaN;
    expect(assessScene(input).ok).toBe(false);
    input.lights[0].intensity = 1;
    input.lights[0].color = [1, -1, 1];
    expect(assessScene(input).ok).toBe(false);
  });

  it("rejects duplicate object names when animation targets use names", () => {
    const input = scene();
    input.objects.push({ ...input.objects[0] });
    const r = assessScene(input);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/duplicate object/i);
  });
});

/* -------------------------------------------------------- reconstruction -- */

function frames(count: number, over: (i: number) => Partial<Frame> = () => ({})): Frame[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    timestamp: i * 0.1,
    position: [i * 0.05, 0, 0] as [number, number, number],
    sharpness: 400,
    focalLengthMm: 24,
    ...over(i),
  }));
}

describe("video-to-3D refuses footage that cannot support it", () => {
  it("accepts footage with real camera travel and sharp frames", () => {
    const r = assessReconstruction(frames(20));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.baselineMetres).toBeCloseTo(0.95, 6);
    expect(r.data.usableFrames).toBe(20);
  });

  /**
   * The core refusal. A locked-off or tripod-panned shot contains no parallax,
   * and a solver run on it produces a warped mesh that looks convincing and
   * measures wrongly.
   */
  it("REFUSES a static shot, because depth comes from parallax", () => {
    const r = assessReconstruction(frames(20, () => ({ position: [0, 0, 0] })));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/Depth comes from parallax/i);
    expect(r.shootInstead).toMatch(/Walk around the subject rather than panning/i);
  });

  it("refuses video with no camera pose rather than assuming it moved", () => {
    const r = assessReconstruction(frames(20, () => ({ position: null })));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/cannot tell whether the camera moved/i);
    expect(r.reason).toMatch(/measures wrongly/i);
    expect(r.shootInstead).toMatch(/logs camera pose/i);
  });

  /** Zoom changes the image without adding parallax; a solver reads it as movement. */
  it("catches a zoom standing in for camera movement", () => {
    const r = assessReconstruction(
      frames(20, (i) => ({ position: [i * 0.001, 0, 0], focalLengthMm: 24 + i })),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/Zooming changes the image without adding parallax/i);
    expect(r.shootInstead).toMatch(/Lock the zoom/i);
  });

  it("refuses footage too blurred to find features in", () => {
    const r = assessReconstruction(frames(20, () => ({ sharpness: 10 })));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/Motion blur removes exactly the detail/i);
    expect(r.shootInstead).toMatch(/brighter light/i);
  });

  it("refuses a clip too short to constrain a solve", () => {
    expect(assessReconstruction(frames(3)).ok).toBe(false);
    expect(assessReconstruction([]).ok).toBe(false);
  });

  it("refuses non-finite frame telemetry instead of returning NaN evidence", () => {
    for (const broken of [
      frames(20, (i) => (i === 4 ? { timestamp: Number.NaN } : {})),
      frames(20, (i) => (i === 4 ? { sharpness: Number.POSITIVE_INFINITY } : {})),
      frames(20, (i) => (i === 4 ? { focalLengthMm: Number.NaN } : {})),
      frames(20, (i) => (i === 4 ? { position: [Number.NaN, 0, 0] } : {})),
    ]) {
      const r = assessReconstruction(broken);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.reason).toMatch(/invalid frame telemetry/i);
    }
  });

  it("warns about partial blur without refusing", () => {
    const r = assessReconstruction(frames(20, (i) => ({ sharpness: i < 10 ? 10 : 400 })));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.warnings.join(" ")).toMatch(/sparser than the clip length suggests/i);
  });

  it("warns when frames are missing pose", () => {
    const r = assessReconstruction(frames(20, (i) => (i % 4 === 0 ? { position: null } : {})));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.warnings.join(" ")).toMatch(/will be dropped from the solve/i);
  });

  it("warns when the camera moved too fast for frames to overlap", () => {
    const r = assessReconstruction(frames(20, (i) => ({ position: [i * 1.5, 0, 0] })));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.warnings.join(" ")).toMatch(/may not overlap/i);
  });

  it("sits just the right side of the baseline threshold", () => {
    const justUnder = assessReconstruction(
      frames(20, (i) => ({ position: [(i * MIN_BASELINE_M) / 40, 0, 0] })),
    );
    expect(justUnder.ok).toBe(false);
  });

  /** Passing the gate means a solve is worth attempting, not that one ran. */
  it("never claims a model was built", () => {
    expect(RECONSTRUCTION_REALITY).toMatch(/has not built a model/i);
    expect(RECONSTRUCTION_REALITY).toMatch(/worth the time/i);
  });
});
