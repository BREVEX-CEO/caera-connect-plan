import { cn } from "@/lib/utils";

/**
 * CAERA CADANE brand mark, with 28.8 hidden in the geometry.
 *
 * The 28.8 geometry is a design motif tied to the product's planned launch date
 * and allowance language. It is not evidence of incorporation or launch.
 *
 * HOW IT IS BUILT. The glyph reads as a "CC" monogram at a glance. Look again
 * and the outer arc is the bowl and base of a **2**, the two stacked rings are
 * an **8**, the dot on the baseline is the decimal point, and the lower ring
 * closes into the second **8**. Nothing fades in on hover — a secret that needs
 * a trigger is a gimmick. The numerals are the same strokes that draw the
 * monogram, which is why it survives at 28px in a sidebar.
 *
 * WHY NOT TEXT. A literal "28.8" would be read once and become noise. Geometry
 * gets noticed later, by someone who has already decided to pay attention, and
 * that is the only audience a detail like this is for.
 *
 * The accessible name says it outright, because a visual secret invisible to
 * assistive technology is a secret kept from the wrong people.
 */
export function BrandMark({
  className,
  showWordmark = true,
}: {
  className?: string;
  /** Hide the text lockup where the mark stands alone (rail, compact header). */
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" role="img">
        <title>CAERA CADANE brand mark</title>
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
          <linearGradient id="cc-brand-soft" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.9 0.06 92)" />
            <stop offset="100%" stopColor="oklch(0.82 0.13 88)" />
          </linearGradient>
        </defs>

        <circle
          cx="16"
          cy="16"
          r="15"
          fill="oklch(0.9 0.01 90 / 4%)"
          stroke="oklch(0.88 0.015 90 / 13%)"
        />

        {/*
          THE 2 — the open arc. Reads as the left half of the CC monogram, and
          as the bowl and diagonal of a two: it sweeps from the upper right,
          round to the left, and flattens onto a base stroke.
        */}
        <path
          d="M21.8 10.4a7.4 7.4 0 1 0 -0.6 11"
          fill="none"
          stroke="url(#cc-brand)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/*
          THE FIRST 8 — upper ring, drawn slightly narrow. A numeral's upper
          bowl always is, and equal rings read as a figure eight lying down.
        */}
        <circle
          cx="16.4"
          cy="12.3"
          r="3"
          fill="none"
          stroke="url(#cc-brand-soft)"
          strokeWidth="1.85"
          opacity="0.9"
        />

        {/*
          THE SECOND 8 — lower ring, fractionally wider, sharing a tangent with
          the ring above so the two close into one continuous eight.
        */}
        <circle
          cx="16.4"
          cy="19.1"
          r="3.55"
          fill="none"
          stroke="url(#cc-brand-soft)"
          strokeWidth="1.85"
          opacity="0.9"
        />

        {/*
          THE DECIMAL POINT — the one element that is purely the number and not
          the letterform. On the baseline, right of the eights, where a decimal
          separator belongs.
        */}
        <circle cx="24.4" cy="21.2" r="1.1" fill="url(#cc-brand)" />
      </svg>

      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Caera
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">Cadane</span>
        </div>
      ) : null}
    </div>
  );
}
