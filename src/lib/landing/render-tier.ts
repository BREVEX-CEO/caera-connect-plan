/**
 * HOW MUCH TO DRAW, DECIDED FROM WHAT THE DEVICE CAN CARRY.
 *
 * Its own module, and the reason is measurable rather than tidy. `DepthScene`
 * is mounted on EVERY route and needs exactly one function from here — but it
 * used to import it from `landing/universe.ts`, which also carries the planet
 * table, the camera maths, the framing solver and the star fields. That put
 * 31 KiB of solar system on the first paint of every page in the product,
 * including pages with no solar system on them.
 *
 * Nothing here depends on anything else, so the split costs nothing and the
 * landing visuals load when a landing page does.
 */

export type RenderTier = "full" | "reduced" | "static";

/**
 * How much to draw, decided from what the device can carry.
 *
 * `prefers-reduced-motion` is absolute and wins over everything: someone who
 * has asked their operating system to stop animations has usually done it
 * because animation makes them ill, and a landing page is not the place to
 * second-guess that.
 */
export function chooseRenderTier(input: {
  reducedMotion: boolean;
  /** navigator.hardwareConcurrency, when available. */
  cores?: number;
  /** navigator.deviceMemory in GB, when available. */
  memoryGb?: number;
  /** Narrow viewports are usually phones running on a battery. */
  viewportWidth: number;
  /** Set once a frame budget has actually been missed. */
  droppedFrames?: boolean;
}): RenderTier {
  if (input.reducedMotion) return "static";
  if (input.droppedFrames) return "reduced";
  const cores = input.cores ?? 4;
  const memory = input.memoryGb ?? 4;
  if (cores <= 2 || memory <= 2) return "reduced";
  if (input.viewportWidth < 640 && cores <= 4) return "reduced";
  return "full";
}

/** Star count for a tier. Zero on static: a still field is just noise. */
export function starCountFor(tier: RenderTier): number {
  switch (tier) {
    case "full":
      return 520;
    case "reduced":
      return 160;
    default:
      return 0;
  }
}
