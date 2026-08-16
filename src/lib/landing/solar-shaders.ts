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
export const NOISE_CHUNK = /* glsl */ `
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

export const PLANET_VERTEX = /* glsl */ `
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
export const PLANET_FRAGMENT = /* glsl */ `
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
export const SUN_FRAGMENT = /* glsl */ `
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
export const CORONA_FRAGMENT = /* glsl */ `
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
export const GLOW_VERTEX = /* glsl */ `
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
export const GLOW_FRAGMENT = /* glsl */ `
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
export const STAR_VERTEX = /* glsl */ `
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

export const STAR_FRAGMENT = /* glsl */ `
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
export const BRIGHT_FRAGMENT = /* glsl */ `
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
export const BLUR_FRAGMENT = /* glsl */ `
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
export const RIPPLE_FRAGMENT = /* glsl */ `
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

export const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

