import { cn } from "@/lib/utils";

/**
 * Permanent, always-visible label indicating the current view is Demo Mode.
 * Never conditionally hidden — it is the contract with the visitor.
 */
export function DemoBadge({
  className,
  floating = false,
}: {
  className?: string;
  floating?: boolean;
}) {
  return (
    <span
      role="status"
      aria-label="Demo mode active"
      className={cn(
        "pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--state-warning)]",
        floating &&
          "fixed bottom-3 right-3 z-50 shadow-lg shadow-[color:var(--state-warning)]/10 sm:bottom-4 sm:right-4",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--state-warning)]" />
      Demo
    </span>
  );
}
