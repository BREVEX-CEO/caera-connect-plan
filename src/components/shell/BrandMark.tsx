import { cn } from "@/lib/utils";

/** The supplied OCADE mark, optionally with its wordmark. */
export function BrandMark({
  className,
  showWordmark = false,
}: {
  className?: string;
  /** The rail shows the mark alone; public pages show the full lockup. */
  showWordmark?: boolean;
}) {
  return (
    // An image of the name: a label on a plain span is not read (and is not allowed).
    <span
      role="img"
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="OCADE by CARCC"
    >
      <img
        src="/icons/ocade-192.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-md object-cover"
        decoding="async"
      />
      {showWordmark ? (
        <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-foreground">
          OCADE
        </span>
      ) : null}
    </span>
  );
}
