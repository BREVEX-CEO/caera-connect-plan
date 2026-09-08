import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { readCommercialUsage, type CommercialUsageView } from "@/lib/commercial/usage.functions";
import { readOfflineUsage, type OfflineUsageView } from "@/lib/commercial/offline-usage.functions";

/**
 * WHAT THIS ACCOUNT HAS SPENT, AND WHEN IT COMES BACK.
 *
 * THE SHAPE OF THE ANSWER IS DECIDED ON THE SERVER, and this renders whichever
 * shape arrives. Free is given exact numbers because it has twenty-eight of
 * something to plan around and needs to know where it is. Pro and Max are given
 * a proportion, because a Standard Work Equivalent is not a unit anybody can
 * convert into their own work — quoting it would invite people to optimise
 * against the unit instead of doing the thing they came to do.
 *
 * That split is not a rendering preference. The raw equivalents behind a
 * percentage never leave the server, so this component cannot show them even if
 * a future edit asked it to.
 *
 * IT REPORTS ONLY WHAT WAS MEASURED. No projection, no "at this rate you will
 * run out", no estimate of what the next message will cost. Every number here
 * is a total the ledger actually holds.
 */
export function CommercialUsagePanel() {
  const [usage, setUsage] = useState<CommercialUsageView | null>(null);
  const [offline, setOffline] = useState<OfflineUsageView | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const [result, offlineResult] = await Promise.all([
          readCommercialUsage(),
          readOfflineUsage(),
        ]);
        if (live) {
          setUsage(result);
          setOffline(offlineResult);
          setUnavailable(null);
        }
      } catch {
        /*
         * Named, not hidden behind a zero. "0 used" on an account that has
         * spent its allowance is a worse answer than "we could not read it",
         * because the person would plan around it and then be refused.
         */
        if (live) setUnavailable("Usage could not be read just now.");
      }
    };
    void refresh();
    const updated = () => void refresh();
    window.addEventListener("ocade:offline-usage-updated", updated);
    return () => {
      live = false;
      window.removeEventListener("ocade:offline-usage-updated", updated);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Gauge className="h-4 w-4" aria-hidden /> Allowance
      </h3>

      {/*
        SAID FROM THE FIRST PAINT, not once the numbers arrive.
        A panel whose entire content is "loading" explains nothing while it
        loads and, if the read never returns, explains nothing at all. What the
        allowance IS does not depend on the read, so it is stated immediately
        and the totals fill in beneath it.
      */}
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        One allowance covers everything OCADE does for you, on every surface and wherever the work
        runs. Only successful work counts: a failure, and a stop before anything reached you, are
        never charged.
      </p>

      {usage ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-foreground">
          {usage.tier} plan
        </p>
      ) : null}

      {unavailable ? (
        <p className="text-xs text-muted-foreground">{unavailable}</p>
      ) : !usage ? (
        <p className="text-xs text-muted-foreground">Reading your allowance…</p>
      ) : usage.windows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          This plan has no allowance to report on this device.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {usage.windows.map((window) => (
            <li key={window.kind}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">
                  {window.kind === "session" ? "6h 28m" : "This week"}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {window.display === "raw"
                    ? `${window.remaining} of ${window.allowance} left`
                    : `${window.usedPercent}% used · ${window.remainingPercent}% remaining`}
                </span>
              </div>
              {/*
                A real progress element: assistive technology reads a value from
                it, and the value is a measurement rather than an animation.
              */}
              <progress
                className="mt-1 h-1 w-full"
                value={window.display === "raw" ? (window.used ?? 0) : (window.usedPercent ?? 0)}
                max={window.display === "raw" ? (window.allowance ?? 1) : 100}
                aria-label={
                  window.kind === "session" ? "Session allowance used" : "Weekly allowance used"
                }
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Resets {formatResetAt(window.resetsAt)} (
                {describeReset(Date.parse(window.resetsAt) - now)}).
              </p>
              {(window.onlineReserved ?? window.onlineReservedPercent ?? 0) > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {window.display === "raw"
                    ? `${window.onlineReserved} reserved by work in progress`
                    : `${window.onlineReservedPercent}% reserved by work in progress`}
                </p>
              ) : null}
              {(window.offlineAllocated ?? window.offlineAllocatedPercent ?? 0) > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {window.display === "raw"
                    ? `${window.offlineAllocated} reserved for offline devices`
                    : `${window.offlineAllocatedPercent}% reserved for offline devices`}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {usage && offline ? (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">Offline allocation</p>
          {!offline.configured ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {offline.unavailableReason ?? "Offline usage is not configured."}
            </p>
          ) : offline.leases.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              This account has no device allocation yet.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2" aria-label="Offline device allocations">
              {offline.leases.map((lease) => (
                <li key={lease.leaseId} className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{lease.deviceName}</span>
                  {" · "}
                  {lease.preissued
                    ? `next window · available ${formatResetAt(lease.notBefore)}`
                    : lease.allocated !== undefined
                      ? `${lease.remaining} of ${lease.allocated} left`
                      : `${lease.usedPercent}% used · ${lease.remainingPercent}% remaining`}
                  {" · "}
                  {lease.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </GlassPanel>
  );
}

/** "in 3 hours 12 minutes", refreshed while the panel is visible. */
function describeReset(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  if (minutes === 0) return "resetting now";
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 48) {
    return `in ${hours} hour${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
  }
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"} ${hours % 24} hr`;
}

function formatResetAt(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
