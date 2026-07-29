import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  className,
  strong,
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div className={cn(strong ? "glass-strong" : "glass", "rounded-lg", className)} {...props} />
  );
}
