import * as THREE from "three";
import { PLANETS, SUN_RADIUS, URANUS_MOONS, radiusFor, type PlanetSpec } from "./solar-data";
import {
  BLUR_FRAGMENT,
  BRIGHT_FRAGMENT,
  CORONA_FRAGMENT,
  FULLSCREEN_VERTEX,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  PLANET_FRAGMENT,
  PLANET_VERTEX,
  RIPPLE_FRAGMENT,
  STAR_FRAGMENT,
  STAR_VERTEX,
  SUN_FRAGMENT,
} from "./solar-shaders";

/**
 * The hero scene.
 *
 * A CLASS RATHER THAN A HOOK, and everything it allocates is tracked. A WebGL
 * scene leaks in a way React state does not: geometries, materials, textures
 * and the context itself survive unmount unless disposed by hand, and a route
 * the user enters and leaves a few times will exhaust the browser's context
 * limit and start silently killing the oldest canvas. `dispose()` walks
 * everything created here, and the React wrapper calls it on unmount.
 *
 * DELTA-TIME THROUGHOUT. Every rotation and orbit multiplies by seconds
 * elapsed, so a 144Hz machine and one dropping to 30fps show the same system at
 * the same moment. Frame-counted animation is the single most common reason a
 * scene like this runs at double speed on the developer's monitor.
 *
 * BUDGETS ARE FIXED, not adaptive-by-hope: 28 moons in one instanced draw, one
 * instanced ring particle system, one instanced starfield, eight planet meshes
 * sharing one compiled program. The whole scene is a few dozen draw calls,
 * which is what holds 60fps on integrated graphics.
 */

export type QualityTier = "full" | "reduced" | "still";

/**
 * The scene did not use this wheel gesture; the page should have it.
 *
 * A distinct sentinel rather than `null` or `false`, because `null` already
 * means "used it, but not toward a particular body" and the two must not be
 * confused — conflating them is what made the hero impossible to scroll past.
 */
export const DECLINED = Symbol("wheel-declined");

export interface SceneHandles {
  /** Advance and draw one frame. `dt` in seconds. */
  frame: (dt: number) => void;
  /** Pointer moved, in normalised device coordinates. */
  setPointer: (x: number, y: number) => void;
  /** Drag the camera around the system. */
  orbitBy: (dx: number, dy: number) => void;
  /**
   * Wheel. Positive is away. Returns the body zoomed toward, if any.
   *
   * Returns `DECLINED` when the scene did not use the gesture — the camera is
   * already pulled all the way out and the reader is trying to leave the hero.
   * The caller must not `preventDefault` in that case, or the page cannot be
   * scrolled at all. That is distinct from `null`, which means "used, but not
   * aimed at a particular body".
   */
  zoom: (delta: number) => string | null | typeof DECLINED;
  /** Ease the camera home. Called after the idle delay. */
  goHome: () => void;
  /** Screen-space positions for the moon labels, when close enough to read. */
  moonLabels: () => { name: string; x: number; y: number; opacity: number }[];
  /** 0–1: how legible the sun's hidden signature currently is. */
  sunSignature: () => number;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

interface Body {
  spec: PlanetSpec;
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  glow: THREE.Mesh;
  /** Current world position, refreshed each frame. */
  world: THREE.Vector3;
}

/** How close the camera gets, as a multiple of the target's radius. */
const FOCUS_DISTANCE = 4.2;
/**
 * Default framing distance from the origin.
 *
 * Neptune's orbit is 52.6 units, so fitting the whole system at a 46° vertical
 * field needs about 124. This sits deliberately inside that: the outermost
 * orbit runs slightly wide of the frame, which fills the shot with the bodies
 * people came to look at instead of centring a mostly-empty disc. Measured at
 * 124 the planets occupied under 2% of the frame — technically the whole
 * system, visually a starfield with specks in it.
 */
const HOME_DISTANCE = 96;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 210;

export function createSolarScene(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  tier: QualityTier,
): SceneHandles {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier === "full",
    alpha: true,
    powerPreference: "high-performance",
  });
  // Capped at 2 — a 3x display triples fragment cost for a difference nobody
  // can see on a gradient, and this scene is almost entirely gradients.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === "full" ? 2 : 1.35));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);

  /*
   * The resolution the scene is currently drawn at, as a fraction of the
   * device pixel ratio it would like. Driven by measured frame cost in
   * `frame()`; see the note there for why this and not a cheaper shader.
   */
  const maxRenderScale = 1;
  let renderScale = 1;
  let frameCost = 8;
  let viewWidth = width;
  let viewHeight = height;
  const basePixelRatio = Math.min(window.devicePixelRatio || 1, tier === "full" ? 2 : 1.35);
  const applyRenderScale = () => {
    renderer.setPixelRatio(basePixelRatio * renderScale);
    renderer.setSize(viewWidth, viewHeight, false);
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, width / Math.max(1, height), 0.1, 900);

  /* ------------------------------------------------------------ starfield -- */
  /*
   * One `Points` draw for the whole sky. A mesh per star at this count is
   * thousands of draw calls and is the classic way to make a scene like this
   * unusable before a single planet is added.
   *
   * COLOUR TEMPERATURE AND TWINKLE come from two extra per-star attributes
   * uploaded once, animated entirely on the GPU. Nothing here touches the CPU
   * per frame, which is why the sky can be this alive without costing anything.
   */
  const starCount = tier === "full" ? 3400 : tier === "reduced" ? 1300 : 700;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);
  const starTints = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    // Distributed on a shell well outside the system so no star can sit
    // between the camera and a planet.
    const r = 380 + Math.random() * 240;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    // A few bright ones among many faint: a uniform distribution of sizes
    // reads as noise, a skewed one reads as a sky.
    starSizes[i] = 0.5 + Math.pow(Math.random(), 3.2) * 3.1;
    starPhases[i] = Math.random();
    // Blue-white through to amber, weighted toward neutral.
    const t = Math.random();
    starTints[i * 3] = 0.72 + t * 0.28;
    starTints[i * 3 + 1] = 0.78 + (1 - Math.abs(t - 0.5) * 2) * 0.2;
    starTints[i * 3 + 2] = 1.0 - t * 0.35;
  }
  const starGeometry = track(new THREE.BufferGeometry());
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
  starGeometry.setAttribute("phase", new THREE.BufferAttribute(starPhases, 1));
  starGeometry.setAttribute("tint", new THREE.BufferAttribute(starTints, 3));
  const starMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(new THREE.Points(starGeometry, starMaterial));

  /* ------------------------------------------------------------------ sun -- */
  const sunGeometry = track(new THREE.SphereGeometry(SUN_RADIUS, 96, 64));
  const sunMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: PLANET_VERTEX,
      fragmentShader: SUN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uCore: { value: new THREE.Color(0xfff4d2) },
        uEdge: { value: new THREE.Color(0xff6a12) },
      },
    }),
  );
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  const sunGlowGeometry = track(new THREE.SphereGeometry(SUN_RADIUS * 2.4, 32, 24));
  const sunGlowMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: {
        uColor: { value: new THREE.Color(0xffa63d) },
        uStrength: { value: 0.85 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  scene.add(new THREE.Mesh(sunGlowGeometry, sunGlowMaterial));

  /*
   * THE CORONA. One more back-faced shell, far larger and filamentary, so the
   * star has an outer atmosphere that moves independently of its surface. Off
   * on the low tier: it is the single most expensive transparent surface in the
   * scene because of how much of the frame it covers.
   */
  const coronaGeometry = track(new THREE.SphereGeometry(SUN_RADIUS * 4.6, 32, 24));
  const coronaMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: CORONA_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffb257) },
        uStrength: { value: 0.42 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
  corona.renderOrder = -1;
  corona.visible = tier !== "reduced";
  scene.add(corona);

  /*
   * THE HIDDEN SIGNATURE.
   *
   * Drawn to a canvas and used as a texture rather than shipped as an image or
   * a font file — the scene loads no external assets, and this is the only text
   * in it. It sits just outside the sun's surface facing the camera, at an
   * opacity driven entirely by how close the camera is: invisible at every
   * normal distance, barely legible at the closest approach. A signature, not a
   * headline.
   */
  const signatureCanvas = document.createElement("canvas");
  signatureCanvas.width = 512;
  signatureCanvas.height = 256;
  const sigContext = signatureCanvas.getContext("2d");
  if (sigContext) {
    sigContext.clearRect(0, 0, 512, 256);
    sigContext.fillStyle = "#ffffff";
    sigContext.textAlign = "center";
    sigContext.textBaseline = "middle";
    sigContext.font = "600 62px system-ui, sans-serif";
    sigContext.fillText("HAANS", 256, 74);
    sigContext.font = "500 46px system-ui, sans-serif";
    sigContext.fillText("44/8", 256, 140);
    sigContext.font = "500 40px system-ui, sans-serif";
    sigContext.fillText("28", 256, 196);
  }
  const signatureTexture = track(new THREE.CanvasTexture(signatureCanvas));
  const signatureMaterial = track(
    new THREE.MeshBasicMaterial({
      map: signatureTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const signatureGeometry = track(new THREE.PlaneGeometry(SUN_RADIUS * 1.5, SUN_RADIUS * 0.75));
  const signature = new THREE.Mesh(signatureGeometry, signatureMaterial);
  signature.renderOrder = 10;
  scene.add(signature);

  /* -------------------------------------------------------------- planets -- */
  const sphereGeometry = track(new THREE.SphereGeometry(1, 48, 36));
  const glowGeometry = track(new THREE.SphereGeometry(1, 24, 18));
  const bodies: Body[] = [];

  for (const spec of PLANETS) {
    const group = new THREE.Group();
    const banded = ["jupiter", "saturn", "uranus", "neptune"].includes(spec.id);

    const material = track(
      new THREE.ShaderMaterial({
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(spec.color) },
          uAccent: { value: new THREE.Color(spec.accent) },
          uBanded: { value: banded ? 1 : 0 },
          // Earth is the only body with a real cloud deck at this scale.
          uCloud: { value: spec.id === "earth" ? 0.55 : spec.id === "venus" ? 0.35 : 0 },
          uDetail: { value: 1 },
          /*
           * PER-BODY CHARACTER, and the reason the eight do not read as one
           * shader with the hue changed. Each value is the property that makes
           * that world recognisable at a glance: Mercury is cratered and
           * airless, Mars is cratered with polar caps, Earth alone has oceans
           * that catch the sun, Jupiter has the storm, and the ice giants get
           * the deepest atmospheres.
           */
          uCratered: { value: spec.id === "mercury" ? 1 : spec.id === "mars" ? 0.55 : 0 },
          uIce: { value: spec.id === "earth" ? 0.55 : spec.id === "mars" ? 0.7 : 0 },
          uSpot: { value: spec.id === "jupiter" ? 0.85 : 0 },
          uSpecular: { value: spec.id === "earth" ? 0.9 : 0 },
          // Reuses the glow strength the data already declares, so a body's
          // halo and its terminator can never disagree about how much air it
          // has.
          uAtmo: { value: spec.glowStrength },
        },
      }),
    );

    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.scale.setScalar(spec.radius);
    group.add(mesh);

    const glowMaterial = track(
      new THREE.ShaderMaterial({
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color(spec.glow) },
          uStrength: { value: spec.glowStrength },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.scale.setScalar(spec.radius * 1.35);
    group.add(glow);

    scene.add(group);
    bodies.push({ spec, group, mesh, material, glow, world: new THREE.Vector3() });
  }

  const byId = (id: string) => bodies.find((b) => b.spec.id === id)!;
  const saturn = byId("saturn");
  const uranus = byId("uranus");

  /* --------------------------------------------------------- saturn rings -- */
  /*
   * MADE OF PARTICLES, not a textured disc.
   *
   * A single transparent annulus is convincing from far away and collapses the
   * moment the camera comes in — it is visibly one flat sheet. These are
   * instanced specks in three density bands with a gap between them, so the
   * ring still reads as countless small bodies at touching distance, which is
   * where the camera in this scene is allowed to go.
   */
  const ringCount = tier === "full" ? 5200 : tier === "reduced" ? 2200 : 900;
  const ringGeometry = track(new THREE.SphereGeometry(0.012, 5, 4));
  const ringMaterial = track(
    new THREE.MeshBasicMaterial({ color: 0xd9c9a0, transparent: true, opacity: 0.72 }),
  );
  const rings = new THREE.InstancedMesh(ringGeometry, ringMaterial, ringCount);
  rings.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const ringDummy = new THREE.Object3D();
  const ringColor = new THREE.Color();
  for (let i = 0; i < ringCount; i += 1) {
    // Three bands with a Cassini-style gap, so the structure is not uniform.
    const band = i % 3;
    const inner = band === 0 ? 1.35 : band === 1 ? 1.72 : 2.05;
    const spread = band === 1 ? 0.26 : 0.3;
    const radius = saturn.spec.radius * (inner + Math.random() * spread);
    const angle = Math.random() * Math.PI * 2;
    ringDummy.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * saturn.spec.radius * 0.035,
      Math.sin(angle) * radius,
    );
    const s = 0.55 + Math.random() * 1.5;
    ringDummy.scale.setScalar(s);
    ringDummy.updateMatrix();
    rings.setMatrixAt(i, ringDummy.matrix);
    // Subtle variation across the bands rather than one flat gold.
    const shade = 0.72 + Math.random() * 0.28;
    ringColor.setRGB(shade * 0.88, shade * 0.79, shade * 0.62);
    rings.setColorAt(i, ringColor);
  }
  rings.instanceMatrix.needsUpdate = true;
  if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
  rings.rotation.x = 0.47;
  saturn.group.add(rings);

  /* ---------------------------------------------------------- uranus moons -- */
  const moonGeometry = track(new THREE.SphereGeometry(1, 10, 8));
  const moonMaterial = track(new THREE.MeshBasicMaterial({ color: 0xb9b6ae }));
  const moons = new THREE.InstancedMesh(moonGeometry, moonMaterial, URANUS_MOONS.length);
  moons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  uranus.group.add(moons);
  const moonDummy = new THREE.Object3D();
  const moonWorld = URANUS_MOONS.map(() => new THREE.Vector3());

  /* ------------------------------------------------------------- the lines -- */
  /*
   * EIGHT FROM THE SUN, TWENTY-EIGHT FROM URANUS, and they are the same style
   * on purpose — that is what says "this planet is a system in its own right".
   * `LineSegments` puts all of each set in ONE draw call; a `Line` per link
   * would be thirty-six.
   */
  const sunLinePositions = new Float32Array(PLANETS.length * 6);
  const sunLineGeometry = track(new THREE.BufferGeometry());
  sunLineGeometry.setAttribute("position", new THREE.BufferAttribute(sunLinePositions, 3));
  const sunLineMaterial = track(
    new THREE.LineBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  scene.add(new THREE.LineSegments(sunLineGeometry, sunLineMaterial));

  const moonLinePositions = new Float32Array(URANUS_MOONS.length * 6);
  const moonLineGeometry = track(new THREE.BufferGeometry());
  moonLineGeometry.setAttribute("position", new THREE.BufferAttribute(moonLinePositions, 3));
  const moonLineMaterial = track(
    new THREE.LineBasicMaterial({
      color: 0xa9f0f4,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  scene.add(new THREE.LineSegments(moonLineGeometry, moonLineMaterial));

  /* ------------------------------------------------- bloom + composite pass -- */
  /*
   * THE GLOW IS A POST PASS, NOT MORE GEOMETRY.
   *
   * Bigger additive shells were the obvious way to make the sun bloom, and they
   * are the wrong one: each shell covers a large part of the frame and costs
   * full-resolution transparent fill, which is exactly the budget this scene
   * has least of. A threshold-and-blur chain at QUARTER resolution touches a
   * sixteenth of the fragments, blooms everything bright in the frame rather
   * than one hand-placed object, and is composited in the pass the ripple
   * already required — so the added cost is measured in fractions of a
   * millisecond, not milliseconds.
   */
  const bloomDivisor = 4;
  const bloomWidth = () => Math.max(1, Math.floor(viewWidth / bloomDivisor));
  const bloomHeight = () => Math.max(1, Math.floor(viewHeight / bloomDivisor));

  const target = track(
    new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }),
  );
  const bloomA = track(
    new THREE.WebGLRenderTarget(bloomWidth(), bloomHeight(), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    }),
  );
  const bloomB = track(
    new THREE.WebGLRenderTarget(bloomWidth(), bloomHeight(), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    }),
  );

  const rippleScene = new THREE.Scene();
  const rippleCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rippleGeometry = track(new THREE.PlaneGeometry(2, 2));

  const brightMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: BRIGHT_FRAGMENT,
      uniforms: { uScene: { value: target.texture }, uThreshold: { value: 0.42 } },
      depthTest: false,
      depthWrite: false,
    }),
  );
  const blurMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      uniforms: {
        uScene: { value: bloomA.texture },
        uDirection: { value: new THREE.Vector2(0, 0) },
      },
      depthTest: false,
      depthWrite: false,
    }),
  );
  const rippleMaterial = track(
    new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: RIPPLE_FRAGMENT,
      uniforms: {
        uScene: { value: target.texture },
        uBloom: { value: bloomA.texture },
        uBloomStrength: { value: tier === "full" ? 0.9 : 0.55 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uProgress: { value: 0 },
        uAspect: { value: width / Math.max(1, height) },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    }),
  );

  // ONE quad, re-materialised per pass. Three quads would be three geometries
  // and three scene graphs for a draw that is identical every time.
  const passQuad = new THREE.Mesh(rippleGeometry, rippleMaterial);
  rippleScene.add(passQuad);

  /** Off when the frame budget is tight; see the note in `frame`. */
  let bloomEnabled = tier === "full";

  const runPass = (
    material: THREE.ShaderMaterial,
    destination: THREE.WebGLRenderTarget | null,
  ) => {
    passQuad.material = material;
    renderer.setRenderTarget(destination);
    renderer.render(rippleScene, rippleCamera);
  };

  /* --------------------------------------------------------------- camera -- */
  let yaw = 0.62;
  let pitch = 0.42;
  let distance = HOME_DISTANCE;
  let targetYaw = yaw;
  let targetPitch = pitch;
  let targetDistance = distance;
  /** What the camera is looking at, and where it is heading. */
  const lookAt = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let focusId: string | null = null;
  let rippleTime = -1;

  const pointer = new THREE.Vector2(0, 0);
  const projected = new THREE.Vector3();
  let elapsed = 0;

  const applyCamera = () => {
    const cp = Math.max(-1.35, Math.min(1.35, pitch));
    camera.position.set(
      lookAt.x + distance * Math.cos(cp) * Math.sin(yaw),
      lookAt.y + distance * Math.sin(cp),
      lookAt.z + distance * Math.cos(cp) * Math.cos(yaw),
    );
    camera.lookAt(lookAt);
  };
  applyCamera();

  /**
   * The body nearest the cursor on screen, if the cursor is near one at all.
   *
   * SCREEN-SPACE PROXIMITY, NOT A RAYCAST. A raycast requires the pointer to be
   * ON the sphere, and Mercury at system distance is four pixels wide — the
   * user would be asked to hit a target smaller than the cursor. Proximity in
   * projected space gives every planet a generous, size-aware catchment, which
   * is what "hover near a planet and scroll" has to mean to be usable.
   */
  const nearestBody = (): Body | null => {
    let best: Body | null = null;
    let bestScore = Infinity;
    for (const body of bodies) {
      projected.copy(body.world).project(camera);
      if (projected.z > 1) continue; // behind the camera
      const dx = projected.x - pointer.x;
      const dy = projected.y - pointer.y;
      const d = Math.hypot(dx, dy);
      // Bigger planets claim a wider catchment, so Jupiter is not as fiddly to
      // reach as Mercury despite covering ten times the screen.
      const reach = 0.1 + body.spec.radius * 0.05;
      if (d < reach && d < bestScore) {
        bestScore = d;
        best = body;
      }
    }
    // The sun, which is not in `bodies`.
    projected.set(0, 0, 0).project(camera);
    const dSun = Math.hypot(projected.x - pointer.x, projected.y - pointer.y);
    if (dSun < 0.16 && dSun < bestScore) return null; // handled by caller via id
    return best;
  };

  const startRipple = () => {
    rippleTime = 0;
    rippleMaterial.uniforms.uCenter.value.set((pointer.x + 1) / 2, (pointer.y + 1) / 2);
  };

  const handles: SceneHandles = {
    setPointer(x, y) {
      pointer.set(x, y);
    },

    orbitBy(dx, dy) {
      targetYaw -= dx * 0.005;
      targetPitch = Math.max(-1.3, Math.min(1.3, targetPitch + dy * 0.004));
    },

    zoom(delta) {
      const near = nearestBody();
      // Over the sun: proximity to the origin in screen space.
      projected.set(0, 0, 0).project(camera);
      const overSun = Math.hypot(projected.x - pointer.x, projected.y - pointer.y) < 0.16;

      if (delta < 0 && (near || overSun)) {
        // Zooming IN with a body under the cursor: go to that body.
        const id = overSun && !near ? "sun" : near!.spec.id;
        if (focusId !== id) startRipple();
        focusId = id;
        const radius = id === "sun" ? SUN_RADIUS : near!.spec.radius;
        targetDistance = Math.max(MIN_DISTANCE, radius * FOCUS_DISTANCE);
        return id;
      }

      /*
       * THE WHEEL HAS TO BE GIVEN BACK, and this is where it happens.
       *
       * THE DEFECT THIS FIXES. The caller prevented default on every wheel
       * event over the canvas, and the canvas covers the entire first screen.
       * So a visitor who read "Scroll down to sign in or get started" and did
       * exactly that got nothing: eight wheel events, eight preventDefaults,
       * `scrollY` still 0. The one instruction on the page was impossible to
       * follow, and the hero was a trap.
       *
       * Zooming OUT while already at the outer limit is the moment the scene
       * has nothing left to do with the gesture — so it declines it, the caller
       * skips preventDefault, and the page scrolls on to the next section.
       * Every other wheel is still the camera's.
       */
      const pulledAllTheWayOut = targetDistance >= HOME_DISTANCE - 0.5 && focusId === null;
      if (delta > 0 && pulledAllTheWayOut) return DECLINED;

      // Empty space, or zooming out: the whole system.
      const step = delta * 0.09;
      // Clamped at HOME rather than MAX so the outward journey ends at the
      // composed shot the page was designed around, which is also the point
      // where the wheel is handed back.
      targetDistance = Math.max(MIN_DISTANCE, Math.min(HOME_DISTANCE, targetDistance + step));
      if (delta > 0 && targetDistance > HOME_DISTANCE * 0.55) focusId = null;
      return focusId;
    },

    goHome() {
      focusId = null;
      targetDistance = HOME_DISTANCE;
      targetYaw = 0.62;
      targetPitch = 0.42;
    },

    moonLabels() {
      // Only when the camera is close enough that the moons are separable.
      const closeness = 1 - Math.min(1, (distance - 6) / 34);
      if (focusId !== "uranus" || closeness <= 0.05) return [];
      const out: { name: string; x: number; y: number; opacity: number }[] = [];
      for (let i = 0; i < URANUS_MOONS.length; i += 1) {
        projected.copy(moonWorld[i]).project(camera);
        if (projected.z > 1) continue;
        out.push({
          name: URANUS_MOONS[i].name,
          x: (projected.x + 1) / 2,
          y: (1 - projected.y) / 2,
          opacity: Math.min(0.75, closeness),
        });
      }
      return out;
    },

    sunSignature() {
      return signatureMaterial.opacity;
    },

    resize(w, h) {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      // Remembered so the adaptive scale can re-apply the size without asking
      // the DOM again; a resize must not silently reset the chosen quality.
      viewWidth = w;
      viewHeight = h;
      applyRenderScale();
      target.setSize(Math.max(1, w), Math.max(1, h));
      bloomA.setSize(bloomWidth(), bloomHeight());
      bloomB.setSize(bloomWidth(), bloomHeight());
      rippleMaterial.uniforms.uAspect.value = w / Math.max(1, h);
    },

    frame(dt) {
      const step = Math.min(Math.max(dt, 0), 0.1);

      /*
       * ADAPTIVE RESOLUTION, and it is the only lever that touches the real
       * bottleneck.
       *
       * At the system view this scene costs 3.5ms a frame; with a planet
       * filling the viewport it costs 14.7ms on the integrated GPU this
       * product targets — inside the 16.7ms budget, but with almost no margin,
       * and a slower machine would miss it. The cost is FILL RATE: a close-up
       * runs the full surface shader over every one of 921,600 fragments.
       *
       * Cheapening the shader was tried first and measured NEUTRAL (14.28 →
       * 14.69ms), which is the evidence that the arithmetic per fragment is not
       * what hurts — the number of fragments is. So the response is to render
       * fewer of them and let the browser scale the result back up, which costs
       * sharpness on a surface that is mostly soft gradients and costs nothing
       * anywhere else.
       *
       * Hysteresis is wide on purpose: a threshold that both raises and lowers
       * at the same frame time oscillates once per frame, and the resolution
       * flicker is far more objectionable than either resolution.
       */
      frameCost = frameCost * 0.9 + step * 1000 * 0.1;
      if (tier !== "still") {
        if (frameCost > 15 && renderScale > 0.62) {
          renderScale = Math.max(0.62, renderScale - 0.06);
          applyRenderScale();
        } else if (frameCost < 9 && renderScale < maxRenderScale) {
          renderScale = Math.min(maxRenderScale, renderScale + 0.03);
          applyRenderScale();
        }
        /*
         * THE GLOW IS THE FIRST THING DROPPED, and it is dropped before the
         * resolution has bottomed out. Bloom is the only part of the frame that
         * is purely decorative — the planets are the product. A machine that
         * cannot hold the budget gets a slightly plainer sun rather than a
         * soft, low-resolution one, and the threshold sits well above the
         * resolution ladder's so the two never fight.
         */
        if (frameCost > 21) bloomEnabled = false;
        else if (frameCost < 11 && tier === "full") bloomEnabled = true;
      }
      // The still tier holds the clock: the system is composed, not moving.
      if (tier !== "still") elapsed += step;

      sunMaterial.uniforms.uTime.value = elapsed;
      coronaMaterial.uniforms.uTime.value = elapsed;
      starMaterial.uniforms.uTime.value = elapsed;
      rippleMaterial.uniforms.uTime.value = elapsed;

      /* Orbits and spin — never paused, whatever the camera is doing. */
      for (const body of bodies) {
        const a = body.spec.phase + elapsed * body.spec.speed;
        body.group.position.set(
          Math.cos(a) * body.spec.orbit,
          Math.sin(a) * body.spec.orbit * Math.sin(body.spec.inclination),
          Math.sin(a) * body.spec.orbit,
        );
        body.mesh.rotation.y = elapsed * body.spec.spin;
        body.material.uniforms.uTime.value = elapsed;
        body.group.getWorldPosition(body.world);
      }

      /* The eight lines, rebuilt from where the planets actually are. */
      for (let i = 0; i < bodies.length; i += 1) {
        const w = bodies[i].world;
        sunLinePositions.set([0, 0, 0, w.x, w.y, w.z], i * 6);
      }
      sunLineGeometry.attributes.position.needsUpdate = true;

      /* Moons, in one instanced draw, plus their lines back to Uranus. */
      const uranusWorld = uranus.world;
      for (let i = 0; i < URANUS_MOONS.length; i += 1) {
        const m = URANUS_MOONS[i];
        const a = m.phase + elapsed * m.speed;
        const x = Math.cos(a) * m.orbit;
        const z = Math.sin(a) * m.orbit;
        const y = Math.sin(a) * m.orbit * Math.sin(m.inclination);
        moonDummy.position.set(x, y, z);
        moonDummy.scale.setScalar(radiusFor(m.km));
        moonDummy.updateMatrix();
        moons.setMatrixAt(i, moonDummy.matrix);
        // Local -> world, for the labels and the lines.
        moonWorld[i].set(x, y, z).add(uranusWorld);
        moonLinePositions.set(
          [
            uranusWorld.x,
            uranusWorld.y,
            uranusWorld.z,
            moonWorld[i].x,
            moonWorld[i].y,
            moonWorld[i].z,
          ],
          i * 6,
        );
      }
      moons.instanceMatrix.needsUpdate = true;
      moonLineGeometry.attributes.position.needsUpdate = true;

      /* Camera easing. Framerate-independent, so nothing snaps. */
      if (focusId) {
        const body = focusId === "sun" ? null : bodies.find((b) => b.spec.id === focusId);
        lookTarget.copy(body ? body.world : new THREE.Vector3(0, 0, 0));
      } else {
        lookTarget.set(0, 0, 0);
      }
      const ease = 1 - Math.exp(-3.4 * step);
      lookAt.lerp(lookTarget, ease);
      yaw += (targetYaw - yaw) * ease;
      pitch += (targetPitch - pitch) * ease;
      distance += (targetDistance - distance) * ease;
      applyCamera();

      /* The signature, legible only at the closest approach to the sun. */
      const sunDistance = camera.position.length();
      const reveal = 1 - Math.min(1, Math.max(0, (sunDistance - SUN_RADIUS * 3.6) / 14));
      signatureMaterial.opacity = Math.pow(reveal, 2.2) * 0.32;
      signature.position
        .copy(camera.position)
        .normalize()
        .multiplyScalar(SUN_RADIUS * 1.04);
      signature.lookAt(camera.position);

      /* Ripple, if one is running. */
      if (rippleTime >= 0) {
        rippleTime += step;
        const progress = rippleTime / 0.85;
        rippleMaterial.uniforms.uProgress.value = progress;
        if (progress >= 1) {
          rippleTime = -1;
          rippleMaterial.uniforms.uProgress.value = 0;
        }
      }

      /* The scene, once, into a target the post chain reads. */
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);

      if (bloomEnabled) {
        // Threshold at quarter resolution, then blur across and down. Two
        // targets ping-pong: a shader cannot read the target it is writing.
        brightMaterial.uniforms.uScene.value = target.texture;
        runPass(brightMaterial, bloomA);

        blurMaterial.uniforms.uScene.value = bloomA.texture;
        blurMaterial.uniforms.uDirection.value.set(1.4 / bloomWidth(), 0);
        runPass(blurMaterial, bloomB);

        blurMaterial.uniforms.uScene.value = bloomB.texture;
        blurMaterial.uniforms.uDirection.value.set(0, 1.4 / bloomHeight());
        runPass(blurMaterial, bloomA);

        rippleMaterial.uniforms.uBloom.value = bloomA.texture;
        rippleMaterial.uniforms.uBloomStrength.value = tier === "full" ? 0.9 : 0.55;
      } else {
        rippleMaterial.uniforms.uBloomStrength.value = 0;
      }

      rippleMaterial.uniforms.uScene.value = target.texture;
      runPass(rippleMaterial, null);
    },

    dispose() {
      for (const item of disposables) {
        try {
          item.dispose();
        } catch {
          /* A double dispose must not stop the rest from being released. */
        }
      }
      rings.dispose();
      moons.dispose();
      scene.clear();
      rippleScene.clear();
      // Releases the WebGL context itself. Without it, a few navigations
      // exhaust the browser's context limit and older canvases go black.
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  return handles;
}
