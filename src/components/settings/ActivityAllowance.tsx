import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { inspect, type LimitBucket } from "@/lib/limits/use-limits";
import type { LimitDecision } from "@/lib/limits/policy";
import { cn } from "@/lib/utils";

/**
 * How much OCADE has done recently, said in a way that is worth reading.
 *
 * WHY THIS IS SHOWN AT ALL, GIVEN THE PRODUCT IS FREE
 * ---------------------------------------------------
 * Not as a meter, and not as an upsell. There is a resource governor in the
 * product — it stops a loop that got away from consuming the device — and a
 * limit that can stop somebody's work while being invisible until the moment it
 * does is a limit that reads as a fault. This is where a person can look before
 * that happens.
 *
 * It shows a bar rather than a number of "credits", because credits imply a
 * currency and there is none: nobody is charged, nothing is deducted from an
 * allowance anybody bought, and the counter resets by itself.
 *
 * WHAT IT DOES NOT SAY. The window durations. "This session" and "today" are
 * what the numbers mean; "5h / 8h / 28h rolling windows" is what they are
 * implemented as, and a settings page is not the place for that. Advanced
 * diagnostics has the exact figures.
 */

const BUCKETS: { id: LimitBucket; label: string; detail: string }[] = [
  {
    id: "inference",
    label: "Conversations and tasks",
    detail: "Answers, thinking and work OCADE does on this device.",
  },
  {
    id: "research",
    label: "Looking things up",
    detail: "Fetching current information from the web.",
  },
  { id: "control", label: "Using this computer", detail: "Actions OCADE takes on your machine." },
];

export function ActivityAllowance() {
  const [readings, setReadings] = useState<Record<string, LimitDecision> | null>(null);

  useEffect(() => {
    /*
     * Read after mount rather than during render: the state lives in
     * localStorage, and reading it on the server produces a first paint that
     * disagrees with the second one.
     */
    const read = () =>
      setReadings(Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, inspect(bucket.id)])));
    read();
    const timer = window.setInterval(read, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!readings) return null;

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            OCADE paces heavy work so one runaway job cannot tie up your device. Nothing here is
            billed, and it clears on its own.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-4">
        {BUCKETS.map((bucket) => {
          const decision = readings[bucket.id];
          if (!decision) return null;
          // The window closest to its limit is the one worth showing: it is the
          // one that will stop the person first.
          const tightest = decision.windows.reduce((a, b) =>
            a.utilization >= b.utilization ? a : b,
          );
          const pct = Math.round(tightest.utilization * 100);
          return (
            <li key={bucket.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-foreground">{bucket.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {pct < 1 ? "Barely used" : `${pct}% of what OCADE allows ${tightest.label}`}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary/40"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${bucket.label}: ${pct}% used ${tightest.label}`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    decision.outcome === "rejected"
                      ? "bg-destructive"
                      : decision.outcome === "allowed_warning"
                        ? "bg-primary"
                        : "bg-primary/50",
                  )}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                {decision.message ?? bucket.detail}
              </p>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
