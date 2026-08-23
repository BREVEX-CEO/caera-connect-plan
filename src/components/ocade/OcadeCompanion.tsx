import { cn } from "@/lib/utils";

/** OCADE's canonical supplied symbol, presented as the local companion. */
export function OcadeCompanion({
  label = "OCADE is standing by",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "ocade-companion group pointer-events-none relative isolate flex items-center gap-3",
        className,
      )}
      aria-label={label}
    >
      <div
        className={cn(
          "relative shrink-0 rounded-full border border-white/15 bg-black/45 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl",
          compact ? "h-14 w-14" : "h-24 w-24 sm:h-28 sm:w-28",
        )}
      >
        <div
          aria-hidden
          className="absolute inset-[-10%] -z-10 rounded-full bg-[conic-gradient(from_180deg,transparent,rgba(116,84,164,.38),transparent_42%,rgba(203,163,82,.3),transparent_78%)] blur-xl"
        />
        <img
          src="/brand/ocade-carcc-mark.png"
          alt=""
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(116,84,164,.24)]"
        />
      </div>
      {!compact ? (
        <figcaption className="hidden max-w-[12rem] rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-[11px] leading-relaxed text-foreground/80 shadow-xl backdrop-blur-xl sm:block">
          <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.22em] text-primary">
            Local companion
          </span>
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}
