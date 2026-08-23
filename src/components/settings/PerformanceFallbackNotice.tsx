import { Gauge } from "lucide-react";
import { useAppearance } from "@/lib/use-appearance";
import { describeTrigger } from "@/lib/perf-fallback";

/**
 * What the automatic performance fallback changed, and why.
 *
 * A product that quietly turns off half its visuals on a slow machine reads as
 * broken to the person using it. This states the trigger, lists every change
 * in plain language, and offers the way back — so a stepped-down interface is
 * a decision the user can see and reverse, not a mystery.
 *
 * Renders nothing when the detector has never fired: an explanation of
 * something that did not happen is noise.
 */
export function PerformanceFallbackNotice({ className }: { className?: string }) {
  const { perfFallback, keepFullQuality, resumeAutoFallback } = useAppearance();

  if (!perfFallback.active) return null;

  const applied = !perfFallback.overridden;

  return (
    <section
      role="status"
      className={["rounded-lg border border-border/60 bg-secondary/30 p-3", className ?? ""].join(
        " ",
      )}
    >
      <header className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h4 className="text-[12.5px] font-medium text-foreground">
          {applied ? "Visuals reduced for this device" : "Full quality kept on this device"}
        </h4>
      </header>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        {describeTrigger(perfFallback.trigger ?? "device", perfFallback.reason)}
        {applied
          ? ""
          : " You asked OCADE to keep full quality here, so nothing has been turned down — the interface may stutter."}
      </p>

      <p className="mt-2 text-[11.5px] font-medium text-foreground">
        {applied ? "What changed" : "What would change"}
      </p>
      <ul className="mt-1 space-y-1">
        {perfFallback.changes.map((change) => (
          <li
            key={change}
            className="flex gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground"
          >
            <span aria-hidden className="text-muted-foreground/60">
              •
            </span>
            <span>{change}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {applied ? (
          <button
            type="button"
            onClick={keepFullQuality}
            className="h-7 rounded-md border border-border/60 px-2.5 text-[11.5px] text-foreground transition-colors hover:bg-secondary/60"
          >
            Keep full quality anyway
          </button>
        ) : (
          <button
            type="button"
            onClick={resumeAutoFallback}
            className="h-7 rounded-md border border-primary/50 bg-primary/15 px-2.5 text-[11.5px] text-foreground transition-colors hover:bg-primary/25"
          >
            Let OCADE reduce visuals again
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
        This choice is remembered on this browser only, so a faster computer on the same account is
        unaffected.
      </p>
    </section>
  );
}
