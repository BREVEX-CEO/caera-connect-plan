import { cn } from "@/lib/utils";

/** Compact, accessible lockup built from the official supplied OCADE mark. */
export function BrandMark({
  className,
  showWordmark = true,
}: {
  className?: string;
  /** Hide the text lockup where the mark stands alone (rail, compact header). */
  showWordmark?: boolean;
}) {
  return (
    <div
      className={cn("ocade-brand-lockup inline-flex items-center gap-2.5", className)}
      aria-label="OCADE by CAERA CADANE"
    >
      <span className="ocade-brand-mark relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px]">
        <img
          src="/icons/ocade-128.png"
          alt=""
          width={32}
          height={32}
          className="h-full w-full object-cover"
          decoding="async"
        />
      </span>

      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold uppercase tracking-[0.22em] text-foreground">
            OCADE
          </span>
          <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            By CAERA CADANE
          </span>
        </div>
      ) : null}
    </div>
  );
}
