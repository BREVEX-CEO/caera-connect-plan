import { Suspense, lazy, useMemo } from "react";
import { ORB_APPEARANCE, type OrbState } from "@/lib/orb/state";
import { cn } from "@/lib/utils";

/**
 * The OCADE orb.
 *
 * One component, every surface. Chat, Cowork, the composer and the mobile bar
 * all render this at different sizes, because "what is OCADE doing" is one
 * question and a person who learns the answer in one room must not have to
 * learn it again in another.
 *
 * WHY THE RENDERER IS LOADED RATHER THAN IMPORTED
 * -----------------------------------------------
 * The renderer carries a raymarching shader, a WebGL setup path and a 2D
 * painter. None of it is needed until something is happening: Chat's first
 * paint is a text box, and shipping a sphere renderer to a person who has not
 * typed anything is bytes spent before the product has done anything.
 *
 * The placeholder below is a plain circle in the state's own colour, drawn with
 * CSS. It appears for the frame or two the chunk takes and reads as the same
 * object arriving rather than as a spinner being replaced.
 *
 * IT IS TEXT AS WELL AS A PICTURE, ALWAYS. The orb carries a live region with
 * the state's label, so a screen-reader user hears "Working on your computer"
 * at the moment a sighted user sees crimson. A status indicator that exists
 * only as colour and motion is not a status indicator for everybody.
 */
const OcadeOrbCanvas = lazy(() =>
  import("./OcadeOrbCanvas").then((module) => ({ default: module.OcadeOrbCanvas })),
);

export function OcadeOrb({
  state,
  amplitude = 0,
  size = 96,
  className,
  decorative = false,
}: {
  state: OrbState;
  /** Live input level, 0–1. Used while listening and speaking. */
  amplitude?: number;
  /** Rendered size in CSS pixels. */
  size?: number;
  className?: string;
  /**
   * True when another element already announces the state in words.
   *
   * The composer shows the label beside the orb, and two live regions saying
   * the same sentence is worse than one — a screen reader reads it twice.
   */
  decorative?: boolean;
}) {
  const look = ORB_APPEARANCE[state];
  const label = useMemo(() => look.label, [look.label]);

  const placeholder = (
    <span
      aria-hidden
      className="block rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 32%, rgb(${to255(look.core)} / 0.95), rgb(${to255(look.core)} / 0.35) 62%, transparent 72%)`,
      }}
    />
  );

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Suspense fallback={placeholder}>
        <OcadeOrbCanvas state={state} amplitude={amplitude} size={size} decorative />
      </Suspense>
      {decorative ? null : (
        <span role="status" aria-live="polite" className="sr-only">
          {label}
        </span>
      )}
    </span>
  );
}

function to255(colour: readonly [number, number, number]): string {
  return colour.map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255)).join(" ");
}
