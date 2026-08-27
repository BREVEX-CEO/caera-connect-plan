import { a as __toESM } from "../_runtime.mjs";
import { s as performance_default } from "../_libs/h3+rou3+srvx+unenv.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { i as radiusFor, n as SUN_RADIUS, r as URANUS_MOONS, t as PLANETS } from "./solar-data-CBLxIq3U.mjs";
import { C as Vector2, S as StaticDrawUsage, T as WebGLRenderTarget, _ as PlaneGeometry, a as Color, b as ShaderMaterial, c as InstancedMesh, d as LinearFilter, f as Mesh, g as PerspectiveCamera, h as OrthographicCamera, i as CanvasTexture, l as LineBasicMaterial, m as Object3D, n as BufferAttribute, o as DynamicDrawUsage, p as MeshBasicMaterial, r as BufferGeometry, s as Group, t as WebGLRenderer, u as LineSegments, v as Points, w as Vector3, x as SphereGeometry, y as Scene } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/SolarSystem-KWftfQm0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Every surface in the hero, written rather than downloaded.
*
* NO TEXTURE FILES. This project ships none, and adding eight planet maps plus
* a starfield would be several megabytes of binary assets on the entry route —
* against an asset budget that currently has 750 KiB of headroom. Procedural
* noise costs bytes measured in hundreds, scales to any zoom level without
* pixelating, and needs no network. The trade is that it cannot be photoreal;
* what it can be is convincing at every distance, which is what this scene
* actually needs since the camera flies from system-wide to touching distance.
*/
/**
* Simplex-style value noise and fBm.
*
* Shared by every planet so the whole system looks like it was made by one
* hand. Cheap on purpose: three octaves, no derivatives, no texture lookups —
* this runs per-fragment on integrated graphics.
*/
var NOISE_CHUNK = `
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;
var PLANET_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorld;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
/**
* One fragment shader for all eight planets.
*
* `uBanded` selects between the two surface families rather than compiling a
* shader per planet: gas giants get horizontal bands driven by latitude, rocky
* worlds get isotropic continents. Eight programs would be eight compiles on
* first paint, which is a visible stall on the machine this targets.
*
* LIT FROM THE SUN, which sits at the origin — so the terminator is real
* geometry rather than a gradient chosen to look like one, and it stays correct
* from every camera angle as the planet orbits.
*/
var PLANET_FRAGMENT = `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uTime;
  uniform float uBanded;
  uniform float uCloud;
  uniform float uDetail;
  /** Crater density. Airless rock only — Mercury and, less so, Mars. */
  uniform float uCratered;
  /** Polar cap strength. */
  uniform float uIce;
  /** Jupiter's storm. */
  uniform float uSpot;
  /** Ocean specular. Earth alone, at this scale. */
  uniform float uSpecular;
  /** How much air this body has: drives rim, scattering and terminator width. */
  uniform float uAtmo;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorld;

  ${NOISE_CHUNK}

  /* Ridged noise. Sharp crests rather than fbm's soft hills — this is what
     reads as crater rims and mountain ranges instead of dunes. */
  float ridged(vec3 p, int octaves) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) {
      if (i >= octaves) break;
      float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
      v += n * n * amp;
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  /**
   * The height field used ONLY for the relief gradient.
   *
   * A cheaper twin of height(): the two finest octaves are dropped and the
   * ridged term is halved. Measured at 14.3ms per frame with a cratered planet
   * filling the viewport on integrated graphics — 1.2x headroom on a 16.7ms
   * budget, which is not enough to survive a slower machine. The gradient is
   * sampled twice per fragment, so it dominates the close-up cost.
   *
   * The finest octaves contribute detail far below the scale at which a
   * surface normal changes what the eye sees, so dropping them from the TAPS
   * costs nothing visible while the albedo keeps every octave.
   */
  float heightCoarse(vec3 dir) {
    if (uBanded > 0.5) {
      float lat = dir.y * 3.4;
      float turbulence = fbm(dir * 2.2 + vec3(uTime * 0.02, 0.0, 0.0)) * 1.4;
      return sin(lat * 3.0 + turbulence * 2.2) * 0.5 + 0.5;
    }
    float h = fbm(dir * 2.6 * uDetail) * 0.5 + 0.5;
    h += fbm(dir * 9.0 * uDetail) * 0.18;
    h -= ridged(dir * 5.5 * uDetail, 2) * 0.22 * uCratered;
    return h;
  }

  /**
   * The height field the surface colour AND the relief lighting both read.
   *
   * ONE FUNCTION, SAMPLED FOUR TIMES. The normal is perturbed by finite
   * differences of this same field, so what you see shaded is exactly what is
   * painted — a separate "bump" pattern is the classic way to get a planet
   * whose highlights sit in the wrong places.
   */
  float height(vec3 dir) {
    if (uBanded > 0.5) {
      // Gas giant: latitude bands, warped by turbulence so they are not stripes.
      float lat = dir.y * 3.4;
      float turbulence = fbm(dir * 2.2 + vec3(uTime * 0.02, 0.0, 0.0)) * 1.4;
      float h = sin(lat * 3.0 + turbulence * 2.2) * 0.5 + 0.5;
      // Fine curl at the band edges, where a real gas giant is most detailed.
      h = mix(h, fbm(dir * 6.0 * uDetail + vec3(uTime * 0.015, 0.0, 0.0)), 0.25);
      h += fbm(dir * 14.0 * uDetail) * 0.08 * uDetail;
      return h;
    }
    // Rocky world: continents low, relief high, craters where asked for.
    float h = fbm(dir * 2.6 * uDetail) * 0.5 + 0.5;
    h += fbm(dir * 9.0 * uDetail) * 0.18;
    h += fbm(dir * 22.0 * uDetail) * 0.06 * uDetail;
    h -= ridged(dir * 5.5 * uDetail, 4) * 0.22 * uCratered;
    return h;
  }

  void main() {
    vec3 dir = normalize(vPosition);
    vec3 N = normalize(vNormal);

    float h = height(dir);

    /* RELIEF. Two extra taps along the surface tangents give a gradient, and
       tilting the normal by it makes craters and ranges catch the light from
       the side — the difference between a painted sphere and a modelled one.
       Strength falls with uDetail so distant planets stay clean and cheap. */
    vec3 tangent = normalize(cross(N, abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 bitangent = cross(N, tangent);
    float e = 0.012;
    // The CENTRE tap uses the coarse field too, so all three samples come from
    // the same surface — mixing the full field at the centre with the coarse
    // one at the offsets produces a gradient of the DIFFERENCE between them,
    // which is noise, and it shows up as a faint crawling shimmer.
    float hc = heightCoarse(dir);
    float hx = heightCoarse(normalize(dir + tangent * e));
    float hy = heightCoarse(normalize(dir + bitangent * e));
    float relief = 0.55 * uDetail;
    N = normalize(N - (tangent * (hx - hc) + bitangent * (hy - hc)) * relief / e * 0.02);

    vec3 albedo = mix(uAccent, uColor, clamp(h, 0.0, 1.0));

    /* Polar caps. Latitude-driven and noise-broken so the edge is ragged
       rather than a drawn circle. */
    if (uIce > 0.0) {
      float cap = smoothstep(0.72, 0.94, abs(dir.y) + fbm(dir * 7.0) * 0.12);
      albedo = mix(albedo, vec3(0.93, 0.95, 0.98), cap * uIce);
    }

    /* Jupiter's storm: an ellipse in latitude/longitude, swirled by the same
       turbulence as the bands so it sits IN the atmosphere rather than on it. */
    if (uSpot > 0.0) {
      float lon = atan(dir.z, dir.x) + uTime * 0.01;
      vec2 d = vec2(sin(lon - 1.1) * 1.7, (dir.y + 0.22) * 4.2);
      float storm = smoothstep(1.0, 0.15, length(d) + fbm(dir * 8.0) * 0.35);
      albedo = mix(albedo, vec3(0.72, 0.32, 0.19), storm * uSpot);
    }

    // Cloud deck, drifting slightly faster than the body turns.
    float cloudMask = 0.0;
    if (uCloud > 0.0) {
      float clouds = fbm(dir * 3.2 + vec3(uTime * 0.035, 0.0, uTime * 0.012));
      // A second, slower layer: one drifting field alone reads as a moving
      // texture, two at different rates read as weather.
      clouds = mix(clouds, fbm(dir * 6.4 - vec3(uTime * 0.018, 0.0, 0.0)), 0.35);
      cloudMask = smoothstep(0.18, 0.55, clouds) * uCloud;
      albedo = mix(albedo, vec3(1.0), cloudMask);
    }

    // The sun is at the world origin, so the light direction is the vector from
    // the fragment to it. No light uniform can therefore fall out of sync with
    // where the sun is actually drawn.
    vec3 lightDir = normalize(-vWorld);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float lambert = max(dot(N, lightDir), 0.0);
    // A little ambient, or the night side is pure black and the planet reads as
    // a crescent cut out of the starfield rather than a sphere.
    float lit = 0.06 + 0.94 * lambert;

    /* WATER. A tight specular lobe, masked to the low ground that the albedo
       already paints as ocean and suppressed under cloud. This is what stops
       Earth reading as a matte marble. */
    float spec = 0.0;
    if (uSpecular > 0.0) {
      float ocean = smoothstep(0.52, 0.34, h) * (1.0 - cloudMask);
      vec3 halfway = normalize(lightDir + viewDir);
      spec = pow(max(dot(N, halfway), 0.0), 48.0) * ocean * uSpecular;
    }

    // Rim light: the atmosphere catching the sun at the limb.
    float fres = 1.0 - max(dot(N, viewDir), 0.0);
    float rim = pow(fres, 3.0);

    /* SCATTERING AT THE TERMINATOR. Where the light grazes the surface it
       travels through the most air, so the day/night boundary warms and
       softens instead of being a hard edge. Scaled by the body's own
       atmosphere, so airless rock keeps a crisp terminator. */
    float grazing = pow(1.0 - abs(dot(N, lightDir)), 3.0);
    vec3 scatter = uColor * grazing * uAtmo * 0.5 * step(0.0, dot(N, lightDir) + 0.35);

    vec3 color = albedo * lit
               + vec3(1.0) * spec
               + uColor * rim * (0.28 + uAtmo * 0.5) * (0.25 + 0.75 * lambert)
               + scatter;

    gl_FragColor = vec4(color, 1.0);
  }
`;
/**
* The sun: a turbulent emissive surface, no lighting term at all.
*
* DOMAIN-WARPED CONVECTION. A single fbm reads as static fuzz; warping the
* sample point by a slower fbm makes the cells stretch, merge and drift the way
* real granulation does, for one extra noise evaluation rather than a second
* full octave stack. Supergranulation (large, slow) is layered under
* granulation (small, fast) so the surface has structure at both the distances
* this camera visits.
*/
var SUN_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorld;

  ${NOISE_CHUNK}

  void main() {
    vec3 dir = normalize(vPosition);

    // Warp field: slow, large, and the reason the cells look like they flow.
    vec3 warp = vec3(
      fbm(dir * 1.7 + vec3(uTime * 0.035, 0.0, 0.0)),
      fbm(dir * 1.7 + vec3(0.0, uTime * 0.031, 4.2)),
      fbm(dir * 1.7 + vec3(9.1, 0.0, uTime * 0.028))
    );

    float supergranule = fbm(dir * 2.4 + warp * 0.9 + vec3(uTime * 0.02));
    float granulation  = fbm(dir * 6.5 + warp * 1.6 + vec3(uTime * 0.07));
    float filament     = fbm(dir * 16.0 - vec3(uTime * 0.13));

    float heat = clamp(
      supergranule * 0.45 + granulation * 0.55 + filament * 0.22 + 0.46,
      0.0, 1.0);

    // Faculae: the bright lanes between convection cells.
    float lanes = pow(clamp(granulation * 0.5 + 0.5, 0.0, 1.0), 5.0);

    // Sunspots: RARE, and that is the whole design note. A threshold low enough
    // to be interesting puts a dark blot in the middle of the star at the
    // framing the page opens on, which reads as a rendering fault rather than
    // solar weather. These sit far out on the tail of the slow field.
    float spot = smoothstep(0.62, 0.80, supergranule + fbm(dir * 3.1) * 0.22);
    float umbra = smoothstep(0.74, 0.88, supergranule);

    // Limb darkening, as a real star has.
    float facing = max(dot(normalize(vNormal), normalize(cameraPosition - vWorld)), 0.0);
    float limb = mix(0.68, 1.0, pow(facing, 0.5));

    vec3 color = mix(uEdge, uCore, heat);
    color += uCore * lanes * 0.45;
    color = mix(color, uEdge * 0.66, spot * 0.5);
    color = mix(color, uEdge * 0.34, umbra * 0.5);
    color *= limb;
    // Overdriven on purpose: the bright pass downstream keys off luminance, and
    // a star that only just reaches white does not bloom.
    color *= 1.35;

    // A hot rim: the chromosphere just above the visible surface.
    color += uEdge * pow(1.0 - facing, 3.0) * 0.9;

    gl_FragColor = vec4(color, 1.0);
  }
`;
/**
* The corona: streamers, drawn on a large back-faced shell.
*
* Separate from the ordinary glow shell because a star's outer atmosphere is
* not a smooth halo — it is filamentary, and the filaments are what make the
* sun read as a body with weather rather than a lamp. Additively blended and
* radially faded, so it never occludes anything behind it.
*/
var CORONA_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vPosition;

  ${NOISE_CHUNK}

  void main() {
    vec3 dir = normalize(vPosition);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float edge = 1.0 - abs(dot(normalize(vNormal), viewDir));

    // Streamers: high-frequency in angle, slow in time.
    float streamer = fbm(dir * 5.0 + vec3(uTime * 0.05, uTime * 0.02, 0.0));
    streamer = pow(clamp(streamer * 0.5 + 0.62, 0.0, 1.0), 2.4);

    /* CONFINED TO THE LIMB, HARD.
       A gentle falloff on a shell this large fills the middle of the frame with
       a dim brown disc — measured: the whole hero went muddy and the planets
       behind it lost contrast. Only fragments where the shell is nearly edge-on
       may contribute at all. */
    float falloff = pow(edge, 6.0) * 0.85 + pow(edge, 16.0) * 0.9;
    float alpha = falloff * streamer * uStrength;

    gl_FragColor = vec4(uColor * (0.7 + streamer * 0.6), alpha);
  }
`;
/**
* The aura shell around every body.
*
* Drawn on a slightly larger sphere with `BackSide` and additive blending, so
* it reads as light scattered around the limb rather than a flat halo pasted
* behind it. `uStrength` is the per-planet cap — see PlanetSpec.glowStrength.
*/
var GLOW_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
/**
* TWO FALLOFFS, NOT ONE. A single `pow` gives either a tight ring or a vague
* cloud; summing a tight term and a wide one gives a bright limb sitting inside
* a soft halo, which is what atmospheric scattering actually looks like — and
* it is two instructions, not a second draw.
*/
var GLOW_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    // Strongest where the shell is edge-on to the viewer.
    float edge = 1.0 - abs(dot(normalize(vNormal), viewDir));
    float tight = pow(edge, 3.4);
    float wide  = pow(edge, 1.4) * 0.35;

    // Sunward bias: the halo is brighter on the lit limb, as it must be.
    vec3 lightDir = normalize(-vWorld);
    float lit = 0.35 + 0.65 * clamp(dot(normalize(vNormal), lightDir) * 0.5 + 0.5, 0.0, 1.0);

    gl_FragColor = vec4(uColor, (tight + wide) * uStrength * lit);
  }
`;
/**
* The starfield, as a shader rather than PointsMaterial.
*
* TWINKLE AND COLOUR TEMPERATURE FOR FREE. Every star already carries a size
* attribute; adding a phase and a tint costs two more floats per star in a
* buffer that is uploaded once, and turns a flat white dust into a sky. The
* disc is drawn from `gl_PointCoord` with a soft core, so stars do not read as
* square pixels at high device ratios.
*/
var STAR_VERTEX = `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vTint;

  void main() {
    vTint = tint;
    float twinkle = 0.72 + 0.28 * sin(uTime * 1.6 + phase * 6.283);
    vAlpha = twinkle;
    gl_PointSize = size * uPixelRatio * (0.85 + twinkle * 0.35);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
var STAR_FRAGMENT = `
  varying float vAlpha;
  varying vec3 vTint;

  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float core = pow(1.0 - r, 2.2);
    gl_FragColor = vec4(vTint, core * vAlpha);
  }
`;
/**
* Bright pass for the bloom chain, run at quarter resolution.
*
* A THRESHOLD, NOT A BLUR OF EVERYTHING. Blooming the whole frame greys the
* blacks and the starfield loses its bite; keeping only what is already above
* the threshold means the glow comes from the sun, the lit limbs and the ring
* highlights, which is where a camera would actually bloom.
*/
var BRIGHT_FRAGMENT = `
  uniform sampler2D uScene;
  uniform float uThreshold;
  varying vec2 vUv;

  void main() {
    vec3 c = texture2D(uScene, vUv).rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float keep = max(luma - uThreshold, 0.0) / max(luma, 1e-4);
    gl_FragColor = vec4(c * keep, 1.0);
  }
`;
/**
* Separable Gaussian, nine taps, one axis per pass.
*
* Separable because a 9x9 two-dimensional kernel is 81 samples per fragment and
* this is 9 plus 9 for the same result. At quarter resolution the whole chain
* is under a sixteenth of the frame's fragments.
*/
var BLUR_FRAGMENT = `
  uniform sampler2D uScene;
  uniform vec2 uDirection;
  varying vec2 vUv;

  void main() {
    float w[5];
    w[0] = 0.2270270270;
    w[1] = 0.1945945946;
    w[2] = 0.1216216216;
    w[3] = 0.0540540541;
    w[4] = 0.0162162162;

    vec3 sum = texture2D(uScene, vUv).rgb * w[0];
    for (int i = 1; i < 5; i++) {
      vec2 off = uDirection * float(i);
      sum += texture2D(uScene, vUv + off).rgb * w[i];
      sum += texture2D(uScene, vUv - off).rgb * w[i];
    }
    gl_FragColor = vec4(sum, 1.0);
  }
`;
/**
* The final pass: ripple distortion, bloom, vignette and grain in ONE shader.
*
* A REAL DISTORTION, not an overlay of rings. The scene is rendered to a target
* and resampled here with the UVs pushed along an expanding annulus, so the
* image itself bends — which is what "warp" has to mean to be worth doing.
* `uProgress` runs 0→1 once per zoom and the effect is a no-op outside that.
*
* Everything else is folded in here rather than added as further fullscreen
* passes: each additional pass is another full read and write of the frame, and
* on the integrated GPU this targets that bandwidth, not the arithmetic, is
* what costs milliseconds.
*/
var RIPPLE_FRAGMENT = `
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uBloomStrength;
  uniform vec2 uCenter;
  uniform float uProgress;
  uniform float uAspect;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float band = 0.0;
    float decay = 0.0;

    if (uProgress > 0.0 && uProgress < 1.0) {
      vec2 d = vUv - uCenter;
      d.x *= uAspect;
      float dist = length(d);

      // The wavefront travels outward; amplitude decays as it goes.
      float front = uProgress * 0.9;
      band = smoothstep(0.16, 0.0, abs(dist - front));
      decay = 1.0 - uProgress;

      vec2 offset = normalize(d + 1e-6) * (band * decay * 0.035);
      offset.x /= uAspect;
      uv = vUv - offset;
    }

    vec3 color = texture2D(uScene, uv).rgb;
    color += texture2D(uBloom, uv).rgb * uBloomStrength;

    // A faint brightening on the crest, so the wave is visible on dark sky.
    color += vec3(0.35, 0.55, 0.8) * band * decay * 0.10;

    // Vignette: pulls the eye to the centre of the frame where the system is.
    vec2 v = (vUv - 0.5) * vec2(uAspect, 1.0);
    color *= 1.0 - clamp(dot(v, v) * 0.42, 0.0, 0.45);

    /* GRAIN, AND IT IS NOT DECORATION. Eight-bit output over a large, very dark
       gradient bands visibly; a sub-LSB dither breaks the bands into noise the
       eye integrates away. One hash, no texture. */
    float grain = fract(sin(dot(vUv * vec2(1912.0, 977.0) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.006;

    gl_FragColor = vec4(color, 1.0);
  }
`;
var FULLSCREEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
/**
* The scene did not use this wheel gesture; the page should have it.
*
* A distinct sentinel rather than `null` or `false`, because `null` already
* means "used it, but not toward a particular body" and the two must not be
* confused — conflating them is what made the hero impossible to scroll past.
*/
var DECLINED = Symbol("wheel-declined");
/** How close the camera gets, as a multiple of the target's radius. */
var FOCUS_DISTANCE = 4.2;
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
var HOME_DISTANCE = 96;
var MIN_DISTANCE = 6;
function createSolarScene(canvas, width, height, tier) {
	const disposables = [];
	const track = (item) => {
		disposables.push(item);
		return item;
	};
	const renderer = new WebGLRenderer({
		canvas,
		antialias: tier === "full",
		alpha: true,
		powerPreference: "high-performance"
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === "full" ? 2 : 1.35));
	renderer.setSize(width, height, false);
	renderer.setClearColor(0, 0);
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
	const scene = new Scene();
	const camera = new PerspectiveCamera(46, width / Math.max(1, height), .1, 900);
	const starCount = tier === "full" ? 3400 : tier === "reduced" ? 1300 : 700;
	const starPositions = new Float32Array(starCount * 3);
	const starSizes = new Float32Array(starCount);
	const starPhases = new Float32Array(starCount);
	const starTints = new Float32Array(starCount * 3);
	for (let i = 0; i < starCount; i += 1) {
		const r = 380 + Math.random() * 240;
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(2 * Math.random() - 1);
		starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
		starPositions[i * 3 + 1] = r * Math.cos(phi);
		starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
		starSizes[i] = .5 + Math.pow(Math.random(), 3.2) * 3.1;
		starPhases[i] = Math.random();
		const t = Math.random();
		starTints[i * 3] = .72 + t * .28;
		starTints[i * 3 + 1] = .78 + (1 - Math.abs(t - .5) * 2) * .2;
		starTints[i * 3 + 2] = 1 - t * .35;
	}
	const starGeometry = track(new BufferGeometry());
	starGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
	starGeometry.setAttribute("size", new BufferAttribute(starSizes, 1));
	starGeometry.setAttribute("phase", new BufferAttribute(starPhases, 1));
	starGeometry.setAttribute("tint", new BufferAttribute(starTints, 3));
	const starMaterial = track(new ShaderMaterial({
		vertexShader: STAR_VERTEX,
		fragmentShader: STAR_FRAGMENT,
		uniforms: {
			uTime: { value: 0 },
			uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
		},
		transparent: true,
		depthWrite: false,
		blending: 2
	}));
	scene.add(new Points(starGeometry, starMaterial));
	const sunGeometry = track(new SphereGeometry(SUN_RADIUS, 96, 64));
	const sunMaterial = track(new ShaderMaterial({
		vertexShader: PLANET_VERTEX,
		fragmentShader: SUN_FRAGMENT,
		uniforms: {
			uTime: { value: 0 },
			uCore: { value: new Color(16774354) },
			uEdge: { value: new Color(16738834) }
		}
	}));
	const sun = new Mesh(sunGeometry, sunMaterial);
	scene.add(sun);
	const sunGlowGeometry = track(new SphereGeometry(SUN_RADIUS * 2.4, 32, 24));
	const sunGlowMaterial = track(new ShaderMaterial({
		vertexShader: GLOW_VERTEX,
		fragmentShader: GLOW_FRAGMENT,
		uniforms: {
			uColor: { value: new Color(16754237) },
			uStrength: { value: .85 }
		},
		transparent: true,
		blending: 2,
		side: 1,
		depthWrite: false
	}));
	scene.add(new Mesh(sunGlowGeometry, sunGlowMaterial));
	const coronaGeometry = track(new SphereGeometry(SUN_RADIUS * 3.4, 32, 24));
	const coronaMaterial = track(new ShaderMaterial({
		vertexShader: GLOW_VERTEX,
		fragmentShader: CORONA_FRAGMENT,
		uniforms: {
			uTime: { value: 0 },
			uColor: { value: new Color(16757335) },
			uStrength: { value: .5 }
		},
		transparent: true,
		blending: 2,
		side: 1,
		depthWrite: false,
		depthTest: true
	}));
	const corona = new Mesh(coronaGeometry, coronaMaterial);
	corona.visible = tier !== "reduced";
	scene.add(corona);
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
	const signatureMaterial = track(new MeshBasicMaterial({
		map: track(new CanvasTexture(signatureCanvas)),
		transparent: true,
		opacity: 0,
		depthTest: false,
		depthWrite: false,
		blending: 2
	}));
	const signature = new Mesh(track(new PlaneGeometry(SUN_RADIUS * 1.5, SUN_RADIUS * .75)), signatureMaterial);
	signature.renderOrder = 10;
	scene.add(signature);
	const sphereGeometry = track(new SphereGeometry(1, 48, 36));
	const glowGeometry = track(new SphereGeometry(1, 24, 18));
	const bodies = [];
	for (const spec of PLANETS) {
		const group = new Group();
		const banded = [
			"jupiter",
			"saturn",
			"uranus",
			"neptune"
		].includes(spec.id);
		const material = track(new ShaderMaterial({
			vertexShader: PLANET_VERTEX,
			fragmentShader: PLANET_FRAGMENT,
			uniforms: {
				uTime: { value: 0 },
				uColor: { value: new Color(spec.color) },
				uAccent: { value: new Color(spec.accent) },
				uBanded: { value: banded ? 1 : 0 },
				uCloud: { value: spec.id === "earth" ? .55 : spec.id === "venus" ? .35 : 0 },
				uDetail: { value: 1 },
				uCratered: { value: spec.id === "mercury" ? 1 : spec.id === "mars" ? .55 : 0 },
				uIce: { value: spec.id === "earth" ? .55 : spec.id === "mars" ? .7 : 0 },
				uSpot: { value: spec.id === "jupiter" ? .85 : 0 },
				uSpecular: { value: spec.id === "earth" ? .9 : 0 },
				uAtmo: { value: spec.glowStrength }
			}
		}));
		const mesh = new Mesh(sphereGeometry, material);
		mesh.scale.setScalar(spec.radius);
		group.add(mesh);
		const glow = new Mesh(glowGeometry, track(new ShaderMaterial({
			vertexShader: GLOW_VERTEX,
			fragmentShader: GLOW_FRAGMENT,
			uniforms: {
				uColor: { value: new Color(spec.glow) },
				uStrength: { value: spec.glowStrength }
			},
			transparent: true,
			blending: 2,
			side: 1,
			depthWrite: false
		})));
		glow.scale.setScalar(spec.radius * 1.35);
		group.add(glow);
		scene.add(group);
		bodies.push({
			spec,
			group,
			mesh,
			material,
			glow,
			world: new Vector3()
		});
	}
	const byId = (id) => bodies.find((b) => b.spec.id === id);
	const saturn = byId("saturn");
	const uranus = byId("uranus");
	const ringCount = tier === "full" ? 5200 : tier === "reduced" ? 2200 : 900;
	const rings = new InstancedMesh(track(new SphereGeometry(.012, 5, 4)), track(new MeshBasicMaterial({
		color: 14272928,
		transparent: true,
		opacity: .72
	})), ringCount);
	rings.instanceMatrix.setUsage(StaticDrawUsage);
	const ringDummy = new Object3D();
	const ringColor = new Color();
	for (let i = 0; i < ringCount; i += 1) {
		const band = i % 3;
		const inner = band === 0 ? 1.35 : band === 1 ? 1.72 : 2.05;
		const spread = band === 1 ? .26 : .3;
		const radius = saturn.spec.radius * (inner + Math.random() * spread);
		const angle = Math.random() * Math.PI * 2;
		ringDummy.position.set(Math.cos(angle) * radius, (Math.random() - .5) * saturn.spec.radius * .035, Math.sin(angle) * radius);
		const s = .55 + Math.random() * 1.5;
		ringDummy.scale.setScalar(s);
		ringDummy.updateMatrix();
		rings.setMatrixAt(i, ringDummy.matrix);
		const shade = .72 + Math.random() * .28;
		ringColor.setRGB(shade * .88, shade * .79, shade * .62);
		rings.setColorAt(i, ringColor);
	}
	rings.instanceMatrix.needsUpdate = true;
	if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
	rings.rotation.x = .47;
	saturn.group.add(rings);
	const moons = new InstancedMesh(track(new SphereGeometry(1, 10, 8)), track(new MeshBasicMaterial({ color: 12170926 })), URANUS_MOONS.length);
	moons.instanceMatrix.setUsage(DynamicDrawUsage);
	uranus.group.add(moons);
	const moonDummy = new Object3D();
	const moonWorld = URANUS_MOONS.map(() => new Vector3());
	const sunLinePositions = new Float32Array(PLANETS.length * 6);
	const sunLineGeometry = track(new BufferGeometry());
	sunLineGeometry.setAttribute("position", new BufferAttribute(sunLinePositions, 3));
	const sunLineMaterial = track(new LineBasicMaterial({
		color: 16767392,
		transparent: true,
		opacity: .08,
		depthWrite: false
	}));
	scene.add(new LineSegments(sunLineGeometry, sunLineMaterial));
	const moonLinePositions = new Float32Array(URANUS_MOONS.length * 6);
	const moonLineGeometry = track(new BufferGeometry());
	moonLineGeometry.setAttribute("position", new BufferAttribute(moonLinePositions, 3));
	const moonLineMaterial = track(new LineBasicMaterial({
		color: 11137268,
		transparent: true,
		opacity: .08,
		depthWrite: false
	}));
	scene.add(new LineSegments(moonLineGeometry, moonLineMaterial));
	const bloomDivisor = 4;
	const bloomWidth = () => Math.max(1, Math.floor(viewWidth / bloomDivisor));
	const bloomHeight = () => Math.max(1, Math.floor(viewHeight / bloomDivisor));
	const target = track(new WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
		minFilter: LinearFilter,
		magFilter: LinearFilter
	}));
	const bloomA = track(new WebGLRenderTarget(bloomWidth(), bloomHeight(), {
		minFilter: LinearFilter,
		magFilter: LinearFilter,
		depthBuffer: false,
		stencilBuffer: false
	}));
	const bloomB = track(new WebGLRenderTarget(bloomWidth(), bloomHeight(), {
		minFilter: LinearFilter,
		magFilter: LinearFilter,
		depthBuffer: false,
		stencilBuffer: false
	}));
	const rippleScene = new Scene();
	const rippleCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const rippleGeometry = track(new PlaneGeometry(2, 2));
	const brightMaterial = track(new ShaderMaterial({
		vertexShader: FULLSCREEN_VERTEX,
		fragmentShader: BRIGHT_FRAGMENT,
		uniforms: {
			uScene: { value: target.texture },
			uThreshold: { value: .42 }
		},
		depthTest: false,
		depthWrite: false
	}));
	const blurMaterial = track(new ShaderMaterial({
		vertexShader: FULLSCREEN_VERTEX,
		fragmentShader: BLUR_FRAGMENT,
		uniforms: {
			uScene: { value: bloomA.texture },
			uDirection: { value: new Vector2(0, 0) }
		},
		depthTest: false,
		depthWrite: false
	}));
	const rippleMaterial = track(new ShaderMaterial({
		vertexShader: FULLSCREEN_VERTEX,
		fragmentShader: RIPPLE_FRAGMENT,
		uniforms: {
			uScene: { value: target.texture },
			uBloom: { value: bloomA.texture },
			uBloomStrength: { value: tier === "full" ? .9 : .55 },
			uCenter: { value: new Vector2(.5, .5) },
			uProgress: { value: 0 },
			uAspect: { value: width / Math.max(1, height) },
			uTime: { value: 0 }
		},
		depthTest: false,
		depthWrite: false
	}));
	const passQuad = new Mesh(rippleGeometry, rippleMaterial);
	rippleScene.add(passQuad);
	/** Off when the frame budget is tight; see the note in `frame`. */
	let bloomEnabled = tier === "full";
	const runPass = (material, destination) => {
		passQuad.material = material;
		renderer.setRenderTarget(destination);
		renderer.render(rippleScene, rippleCamera);
	};
	let yaw = .62;
	let pitch = .42;
	let distance = HOME_DISTANCE;
	let targetYaw = yaw;
	let targetPitch = pitch;
	let targetDistance = distance;
	/** What the camera is looking at, and where it is heading. */
	const lookAt = new Vector3();
	const lookTarget = new Vector3();
	let focusId = null;
	let rippleTime = -1;
	const pointer = new Vector2(0, 0);
	const projected = new Vector3();
	let elapsed = 0;
	const applyCamera = () => {
		const cp = Math.max(-1.35, Math.min(1.35, pitch));
		camera.position.set(lookAt.x + distance * Math.cos(cp) * Math.sin(yaw), lookAt.y + distance * Math.sin(cp), lookAt.z + distance * Math.cos(cp) * Math.cos(yaw));
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
	const nearestBody = () => {
		let best = null;
		let bestScore = Infinity;
		for (const body of bodies) {
			projected.copy(body.world).project(camera);
			if (projected.z > 1) continue;
			const dx = projected.x - pointer.x;
			const dy = projected.y - pointer.y;
			const d = Math.hypot(dx, dy);
			if (d < .1 + body.spec.radius * .05 && d < bestScore) {
				bestScore = d;
				best = body;
			}
		}
		projected.set(0, 0, 0).project(camera);
		const dSun = Math.hypot(projected.x - pointer.x, projected.y - pointer.y);
		if (dSun < .16 && dSun < bestScore) return null;
		return best;
	};
	const startRipple = () => {
		rippleTime = 0;
		rippleMaterial.uniforms.uCenter.value.set((pointer.x + 1) / 2, (pointer.y + 1) / 2);
	};
	return {
		setPointer(x, y) {
			pointer.set(x, y);
		},
		orbitBy(dx, dy) {
			targetYaw -= dx * .005;
			targetPitch = Math.max(-1.3, Math.min(1.3, targetPitch + dy * .004));
		},
		zoom(delta) {
			const near = nearestBody();
			projected.set(0, 0, 0).project(camera);
			const overSun = Math.hypot(projected.x - pointer.x, projected.y - pointer.y) < .16;
			if (delta < 0 && (near || overSun)) {
				const id = overSun && !near ? "sun" : near.spec.id;
				if (focusId !== id) startRipple();
				focusId = id;
				const radius = id === "sun" ? SUN_RADIUS : near.spec.radius;
				targetDistance = Math.max(MIN_DISTANCE, radius * FOCUS_DISTANCE);
				return id;
			}
			if (delta > 0 && targetDistance >= HOME_DISTANCE - .5 && focusId === null) return DECLINED;
			const step = delta * .09;
			targetDistance = Math.max(MIN_DISTANCE, Math.min(HOME_DISTANCE, targetDistance + step));
			if (delta > 0 && targetDistance > HOME_DISTANCE * .55) focusId = null;
			return focusId;
		},
		goHome() {
			focusId = null;
			targetDistance = HOME_DISTANCE;
			targetYaw = .62;
			targetPitch = .42;
		},
		moonLabels() {
			const closeness = 1 - Math.min(1, (distance - 6) / 34);
			if (focusId !== "uranus" || closeness <= .05) return [];
			const out = [];
			for (let i = 0; i < URANUS_MOONS.length; i += 1) {
				projected.copy(moonWorld[i]).project(camera);
				if (projected.z > 1) continue;
				out.push({
					name: URANUS_MOONS[i].name,
					x: (projected.x + 1) / 2,
					y: (1 - projected.y) / 2,
					opacity: Math.min(.75, closeness)
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
			viewWidth = w;
			viewHeight = h;
			applyRenderScale();
			target.setSize(Math.max(1, w), Math.max(1, h));
			bloomA.setSize(bloomWidth(), bloomHeight());
			bloomB.setSize(bloomWidth(), bloomHeight());
			rippleMaterial.uniforms.uAspect.value = w / Math.max(1, h);
		},
		frame(dt) {
			const step = Math.min(Math.max(dt, 0), .1);
			frameCost = frameCost * .9 + step * 1e3 * .1;
			if (tier !== "still") {
				if (frameCost > 15 && renderScale > .62) {
					renderScale = Math.max(.62, renderScale - .06);
					applyRenderScale();
				} else if (frameCost < 9 && renderScale < maxRenderScale) {
					renderScale = Math.min(maxRenderScale, renderScale + .03);
					applyRenderScale();
				}
				if (frameCost > 21) bloomEnabled = false;
				else if (frameCost < 11 && tier === "full") bloomEnabled = true;
			}
			if (tier !== "still") elapsed += step;
			sunMaterial.uniforms.uTime.value = elapsed;
			coronaMaterial.uniforms.uTime.value = elapsed;
			starMaterial.uniforms.uTime.value = elapsed;
			rippleMaterial.uniforms.uTime.value = elapsed;
			for (const body of bodies) {
				const a = body.spec.phase + elapsed * body.spec.speed;
				body.group.position.set(Math.cos(a) * body.spec.orbit, Math.sin(a) * body.spec.orbit * Math.sin(body.spec.inclination), Math.sin(a) * body.spec.orbit);
				body.mesh.rotation.y = elapsed * body.spec.spin;
				body.material.uniforms.uTime.value = elapsed;
				body.group.getWorldPosition(body.world);
			}
			for (let i = 0; i < bodies.length; i += 1) {
				const w = bodies[i].world;
				sunLinePositions.set([
					0,
					0,
					0,
					w.x,
					w.y,
					w.z
				], i * 6);
			}
			sunLineGeometry.attributes.position.needsUpdate = true;
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
				moonWorld[i].set(x, y, z).add(uranusWorld);
				moonLinePositions.set([
					uranusWorld.x,
					uranusWorld.y,
					uranusWorld.z,
					moonWorld[i].x,
					moonWorld[i].y,
					moonWorld[i].z
				], i * 6);
			}
			moons.instanceMatrix.needsUpdate = true;
			moonLineGeometry.attributes.position.needsUpdate = true;
			if (focusId) {
				const body = focusId === "sun" ? null : bodies.find((b) => b.spec.id === focusId);
				lookTarget.copy(body ? body.world : new Vector3(0, 0, 0));
			} else lookTarget.set(0, 0, 0);
			const ease = 1 - Math.exp(-3.4 * step);
			lookAt.lerp(lookTarget, ease);
			yaw += (targetYaw - yaw) * ease;
			pitch += (targetPitch - pitch) * ease;
			distance += (targetDistance - distance) * ease;
			applyCamera();
			const sunDistance = camera.position.length();
			const reveal = 1 - Math.min(1, Math.max(0, (sunDistance - SUN_RADIUS * 3.6) / 14));
			signatureMaterial.opacity = Math.pow(reveal, 2.2) * .32;
			signature.position.copy(camera.position).normalize().multiplyScalar(SUN_RADIUS * 1.04);
			signature.lookAt(camera.position);
			if (rippleTime >= 0) {
				rippleTime += step;
				const progress = rippleTime / .85;
				rippleMaterial.uniforms.uProgress.value = progress;
				if (progress >= 1) {
					rippleTime = -1;
					rippleMaterial.uniforms.uProgress.value = 0;
				}
			}
			renderer.setRenderTarget(target);
			renderer.render(scene, camera);
			if (bloomEnabled) {
				brightMaterial.uniforms.uScene.value = target.texture;
				runPass(brightMaterial, bloomA);
				blurMaterial.uniforms.uScene.value = bloomA.texture;
				blurMaterial.uniforms.uDirection.value.set(1.4 / bloomWidth(), 0);
				runPass(blurMaterial, bloomB);
				blurMaterial.uniforms.uScene.value = bloomB.texture;
				blurMaterial.uniforms.uDirection.value.set(0, 1.4 / bloomHeight());
				runPass(blurMaterial, bloomA);
				rippleMaterial.uniforms.uBloom.value = bloomA.texture;
				rippleMaterial.uniforms.uBloomStrength.value = tier === "full" ? .9 : .55;
			} else rippleMaterial.uniforms.uBloomStrength.value = 0;
			rippleMaterial.uniforms.uScene.value = target.texture;
			runPass(rippleMaterial, null);
		},
		dispose() {
			for (const item of disposables) try {
				item.dispose();
			} catch {}
			rings.dispose();
			moons.dispose();
			scene.clear();
			rippleScene.clear();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}
/**
* The hero scene, mounted.
*
* EVERYTHING THE SCENE ALLOCATES IS RELEASED ON UNMOUNT. WebGL does not behave
* like React state: geometries, materials, render targets and the context
* itself outlive the component unless disposed by hand, and a browser will only
* keep a handful of contexts alive before it starts silently killing the oldest
* canvas. `dispose()` is called from the effect's cleanup, not from a route
* guard or a timer.
*
* IDLE RETURN AT FIVE SECONDS, from wherever the camera is — mid-zoom on a
* planet, deep in Uranus's moons, anywhere. It is written to the camera's
* TARGET rather than its position, so the journey home is the same easing every
* other camera move uses and there is no moment where control changes hands
* visibly.
*
* REDUCED MOTION GETS A COMPOSED STILL, not a blank box. The system is drawn
* once, at the framing the page was designed around, and the clock does not
* advance. Dragging and zooming still work — someone who asked for less motion
* asked for things to stop moving on their own, not to be handed a dead
* rectangle where the product's opening image should be.
*/
var IDLE_RETURN_MS = 5e3;
function pickTier(reducedMotion) {
	if (reducedMotion) return "still";
	const nav = navigator;
	const cores = nav.hardwareConcurrency ?? 4;
	const memory = nav.deviceMemory ?? 4;
	if (cores <= 2 || memory <= 2 || window.innerWidth < 640) return "reduced";
	return "full";
}
function SolarSystem({ className }) {
	const wrapRef = (0, import_react.useRef)(null);
	const sceneRef = (0, import_react.useRef)(null);
	const [labels, setLabels] = (0, import_react.useState)([]);
	const [failed, setFailed] = (0, import_react.useState)(false);
	const { reducedMotion, osReducedMotion } = useAppearance();
	const holdStill = reducedMotion || osReducedMotion;
	(0, import_react.useEffect)(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const canvas = document.createElement("canvas");
		canvas.setAttribute("aria-hidden", "true");
		canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;user-select:none;";
		wrap.insertBefore(canvas, wrap.firstChild);
		const tier = pickTier(holdStill);
		let scene;
		try {
			const rect = wrap.getBoundingClientRect();
			scene = createSolarScene(canvas, rect.width || 1, rect.height || 1, tier);
		} catch (error) {
			console.error("[OCADE] The hero scene could not start.", error);
			canvas.remove();
			setFailed(true);
			return;
		}
		setFailed(false);
		sceneRef.current = scene;
		let frame = 0;
		let last = performance_default.now();
		let lastInteraction = performance_default.now();
		let running = true;
		let dragging = false;
		let labelTick = 0;
		const loop = (now) => {
			if (!running) return;
			const elapsed = (now - last) / 1e3;
			const dt = holdStill ? 0 : elapsed;
			last = now;
			if (!holdStill && now - lastInteraction > IDLE_RETURN_MS) scene.goHome();
			scene.frame(dt);
			labelTick += elapsed;
			if (labelTick > .08) {
				labelTick = 0;
				const next = scene.moonLabels();
				setLabels((current) => current.length === 0 && next.length === 0 ? current : next);
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		const touched = () => {
			lastInteraction = performance_default.now();
		};
		const toNdc = (event) => {
			const rect = canvas.getBoundingClientRect();
			return {
				x: (event.clientX - rect.left) / rect.width * 2 - 1,
				y: -((event.clientY - rect.top) / rect.height * 2 - 1)
			};
		};
		const onPointerMove = (event) => {
			const { x, y } = toNdc(event);
			scene.setPointer(x, y);
			if (!dragging) return;
			touched();
			scene.orbitBy(event.movementX, event.movementY);
		};
		const onPointerDown = (event) => {
			dragging = true;
			canvas.setPointerCapture(event.pointerId);
			document.body.style.userSelect = "none";
			touched();
		};
		const endDrag = (event) => {
			dragging = false;
			if (event) canvas.releasePointerCapture(event.pointerId);
			document.body.style.userSelect = "";
			touched();
		};
		const onWheel = (event) => {
			const { x, y } = toNdc(event);
			scene.setPointer(x, y);
			touched();
			if (scene.zoom(event.deltaY) !== DECLINED) event.preventDefault();
		};
		canvas.addEventListener("pointermove", onPointerMove);
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointerup", (e) => endDrag(e));
		canvas.addEventListener("pointerleave", () => endDrag());
		canvas.addEventListener("wheel", onWheel, { passive: false });
		const observer = new ResizeObserver(() => {
			const rect = wrap.getBoundingClientRect();
			scene.resize(rect.width || 1, rect.height || 1);
		});
		observer.observe(wrap);
		return () => {
			running = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("wheel", onWheel);
			document.body.style.userSelect = "";
			scene.dispose();
			canvas.remove();
			sceneRef.current = null;
		};
	}, [holdStill]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: wrapRef,
		className,
		"data-scene": failed ? "unavailable" : "live",
		children: labels.map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"aria-hidden": true,
			className: "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] tracking-wide text-white",
			style: {
				left: `${label.x * 100}%`,
				top: `${label.y * 100}%`,
				opacity: label.opacity,
				textShadow: "0 1px 3px rgba(0,0,0,0.9)"
			},
			children: label.name
		}, label.name))
	});
}
//#endregion
export { SolarSystem };
