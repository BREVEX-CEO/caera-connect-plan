import { cn } from "@/lib/utils";

/**
 * Permanent, always-visible label indicating the current view is Demo Mode.
 * Never conditionally hidden — it is the contract with the visitor.
 */
export function DemoBadge({ className, floating = false }: { className?: string; floating?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Demo mode active"
      className={cn(
        "pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300 backdrop-blur",
        floating &&
          "fixed bottom-3 right-3 z-50 shadow-lg shadow-amber-500/10 sm:bottom-4 sm:right-4",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
      Demo — sample data
    </span>
  );
}
