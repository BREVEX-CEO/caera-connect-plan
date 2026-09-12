import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** A slightly more opaque surface, for panels that sit above other panels. */
  strong?: boolean;
}

/**
 * The application's surface primitive: one hairline, a little transparency, a
 * modest blur, no shadow.
 *
 * It used to carry a six-level depth system that placed each surface at a real
 * Z coordinate inside a perspective scene. That went with the scene. The
 * restrained glass treatment in `docs/DESIGN.md` is the whole of the effect
 * now, and `--blur-glass` is a token so a device that cannot afford the blur
 * loses the blur rather than the layout.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { className, strong, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(strong ? "glass-strong" : "glass", "rounded-lg", className)}
      {...props}
    />
  );
});
