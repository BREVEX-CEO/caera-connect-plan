import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { DepthLevel } from "@/lib/motion/depth";

const DEPTH_CLASS: Record<DepthLevel, string> = {
  base: "depth-base",
  raised: "depth-raised",
  elevated: "depth-elevated",
  floating: "depth-floating",
  overlay: "depth-overlay",
  modal: "depth-modal",
};

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  /**
   * Where this surface sits in the scene. Defaults to `raised` — the plane
   * ordinary content panels occupy.
   */
  depth?: DepthLevel;
  /** Lift toward the viewer on hover. For panels that are themselves clickable. */
  lift?: boolean;
  /**
   * Opt out of depth entirely.
   *
   * For surfaces that are already inside another transformed element and would
   * otherwise compound its perspective — a nested card in a tilted panel tilts
   * twice, which is the one way this system produces something that looks
   * broken rather than deep.
   */
  flat?: boolean;
}

/**
 * The application's surface primitive — now a surface at a DEPTH.
 *
 * Nearly every screen in the product is built from these, which is exactly why
 * the third dimension is introduced here rather than page by page: one change
 * gives the whole application consistent depth, and a route written next month
 * gets it without knowing this system exists. That is the same argument
 * `MotionScope` makes for scroll reveal.
 *
 * `depth` defaults to `raised` so the common case needs no prop, and the
 * transform collapses to the identity when `DepthScene` reports a flat device
 * — see styles.css. Nothing about the two-dimensional layout changes.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { className, strong, depth = "raised", lift, flat, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-lg",
        !flat && ["ocade-depth", DEPTH_CLASS[depth], lift && "ocade-depth-lift"],
        className,
      )}
      {...props}
    />
  );
});
