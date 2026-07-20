import { cn } from "@/lib/utils";

/**
 * CAERA CADANE brand mark. Original geometric glyph — two intersecting
 * arcs forming a "CC" monogram inside a soft glow. Not derivative.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <defs>
          <linearGradient id="cc-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.14 210)" />
            <stop offset="100%" stopColor="oklch(0.7 0.17 300)" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill="oklch(1 0 0 / 4%)" stroke="oklch(1 0 0 / 12%)" />
        <path
          d="M22 10.5a8 8 0 1 0 0 11"
          fill="none"
          stroke="url(#cc-brand)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M18 12.5a5 5 0 1 0 0 7"
          fill="none"
          stroke="url(#cc-brand)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Caera
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">Cadane</span>
      </div>
    </div>
  );
}
