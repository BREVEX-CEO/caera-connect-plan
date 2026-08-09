import { useCallback, useEffect, useState } from "react";
import { HardDrive, ShieldCheck, ShieldAlert, Trash2, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReadOnlyBanner } from "./SettingsGate";
import { describeGap, type OfflineReadiness } from "@/lib/offline/readiness";
import { measureOfflineReadiness } from "@/lib/offline/measure-readiness";
import {
  measureStorage,
  requestPersistentStorage,
  clearBucket,
  formatBytes,
  type StorageReport,
} from "@/lib/offline/storage-report";

/**
 * What OCADE is keeping on this device so it works without a connection.
 *
 * WHY THIS SCREEN EXISTS AT ALL. OCADE tells people it works offline once an
 * engine has been downloaded, and that claim is only honest if they can see
 * what has actually been downloaded and how much of their disk it costs. A
 * product that says "works offline" while holding nothing is making a promise
 * it breaks on the first flight.
 *
 * Readable without an account, because "how much space will this take" is a
 * question people reasonably want answered before signing up. Clearing is a
 * local action on local data, so it does NOT need an account either — the
 * read-only gate covers synced settings, not the user's own disk.
 */
export function OfflineStoragePanel() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [readiness, setReadiness] = useState<OfflineReadiness | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [storage, offline] = await Promise.all([measureStorage(), measureOfflineReadiness()]);
    setReport(storage);
    setReadiness(offline);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const askPersist = async () => {
    setBusy(true);
    const outcome = await requestPersistentStorage();
    setBusy(false);
    // Reports what actually happened. Chrome grants silently, Firefox prompts,
    // Safari may refuse — claiming success regardless would be the lie.
    (outcome.granted ? toast.success : toast.warning)(outcome.reason);
    void refresh();
  };

  const clear = async (name: string) => {
    setBusy(true);
    const removed = await clearBucket(name);
    setBusy(false);
    if (removed) {
      toast.success("Cleared.", {
        description: "Anything that was cached will be downloaded again next time you are online.",
      });
      void refresh();
    } else {
      toast.error("That cache could not be cleared in this browser.");
    }
  };

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Offline Storage</h3>
      </header>

      <ReadOnlyBanner />

      {/*
        The verdict first, because it is the only question anyone opens this
        screen to answer. Every gap is listed with the action that closes it —
        and the download is called out as the part that cannot be done later,
        since discovering it offline is discovering it too late.
      */}
      {readiness ? (
        <div
          className={cn(
            "rounded-lg border p-3",
            readiness.ready
              ? "border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/5"
              : "border-border/60 bg-secondary/25",
          )}
        >
          <p className="flex items-start gap-2 text-[13px] text-foreground">
            {readiness.ready ? (
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-success)]"
                aria-hidden
              />
            ) : (
              <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span>{readiness.summary}</span>
          </p>

          {readiness.gaps.length > 0 ? (
            <ul className="mt-2.5 flex flex-col gap-2 border-t border-border/50 pt-2.5">
              {readiness.gaps.map((gap) => {
                const { title, action } = describeGap(gap);
                return (
                  <li key={gap} className="text-[11.5px] leading-relaxed">
                    <span className="font-medium text-foreground">{title}.</span>{" "}
                    <span className="text-muted-foreground">{action}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {report === null ? (
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Measuring…
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-border/60 bg-secondary/25 p-3">
            {report.measurable ? (
              <p className="text-[13px] text-foreground">
                <span className="font-medium tabular-nums">{formatBytes(report.usageBytes)}</span>{" "}
                used of <span className="tabular-nums">{formatBytes(report.quotaBytes)}</span> this
                browser allows.
              </p>
            ) : (
              // Not padded with an invented figure: a made-up number here is
              // the user deciding what to delete from something we guessed.
              <p className="text-[13px] text-muted-foreground">
                This browser will not report how much space OCADE is using.
              </p>
            )}

            <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {report.persistent ? (
                <ShieldCheck
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-success)]"
                  aria-hidden
                />
              ) : (
                <ShieldAlert
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-warning)]"
                  aria-hidden
                />
              )}
              <span>
                {report.persistent
                  ? "Protected. The browser will not clear OCADE's downloads to reclaim space."
                  : "Not protected. If this device runs low on space the browser may clear OCADE's cache, and a downloaded engine would need downloading again."}
              </span>
            </p>

            {!report.persistent ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2.5"
                disabled={busy}
                onClick={() => void askPersist()}
              >
                Ask the browser to keep it
              </Button>
            ) : null}
          </div>

          {report.buckets.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              {/*
                The precise state that matters most: nothing cached means
                offline does not work yet, and saying so beats an empty list.
              */}
              Nothing is cached yet, so OCADE cannot open or answer without a connection. Visit a
              page or download an engine while online and it will be kept here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {report.buckets.map((bucket) => (
                <li
                  key={bucket.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-foreground">
                      {bucket.describes}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="tabular-nums">{bucket.entries}</span>{" "}
                      {bucket.entries === 1 ? "file" : "files"} ·{" "}
                      <code className="font-mono">{bucket.name}</code>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void clear(bucket.name)}
                    aria-label={`Clear ${bucket.describes}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            OCADE answers on this device with no network at all — that is what these files are. The
            engine can be downloaded once while online, or installed from a file below on a device
            that never connects.
          </p>
        </>
      )}
    </GlassPanel>
  );
}
