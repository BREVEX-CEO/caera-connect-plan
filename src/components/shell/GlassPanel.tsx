import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const GlassPanel = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { strong?: boolean }
>(function GlassPanel({ className, strong, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(strong ? "glass-strong" : "glass", "rounded-lg", className)}
      {...props}
    />
  );
});
