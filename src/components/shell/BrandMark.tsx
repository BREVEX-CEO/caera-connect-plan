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
          {/*
            Struck gold into champagne, in the direction light would fall on a
            metal edge. Both stops are literals rather than tokens because an
            SVG gradient stop cannot take a CSS variable through `url(#...)`
            reliably across engines; they are the same two values as
            --accent-ocade and --chart-2.
          */}
          <linearGradient id="cc-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.13 88)" />
            <stop offset="100%" stopColor="oklch(0.9 0.06 92)" />
          </linearGradient>
        </defs>
        <circle
          cx="16"
          cy="16"
          r="15"
          fill="oklch(0.9 0.01 90 / 4%)"
          stroke="oklch(0.88 0.015 90 / 13%)"
        />
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
