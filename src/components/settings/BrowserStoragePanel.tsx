import { useCallback, useEffect, useState } from "react";
import { HardDrive, ShieldCheck, ShieldAlert, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { modelStore, type StorageReport } from "@/lib/brain/model-store";
import { clearBenchmarks } from "@/lib/brain/tier-benchmark-store";

/**
 * What OCADE is keeping in this browser, and the controls to change it.
 *
 * This is the surface that makes the browser engines honest. Weights are
 * hundreds of megabytes; a product that stores them and gives no way to see or
 * delete them has taken over part of someone's device without saying so. Every
 * control here performs a real operation on real storage — nothing is a
 * placeholder.
 *
 * PERSISTENCE IS ASKED FOR, NOT ASSUMED. Without it the browser may evict the
 * weights whenever the device is short of space, so a user who downloaded 400
 * MB finds it gone. The browser is allowed to refuse, and a refusal is
 * reported as such rather than retried until it looks like it worked.
 */

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "not reported";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function BrowserStoragePanel() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      setReport(await modelStore.report());
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const askPersistence = useCallback(async () => {
    setBusy("persist");
    try {
      const granted = await modelStore.requestPersistence();
      toast[granted ? "success" : "error"](
        granted
          ? "This browser will now keep OCADE's engine between visits."
          : "The browser declined to make this storage permanent. The engine still works, but it may be cleared when the device runs low on space.",
      );
      setReport(await modelStore.report());
    } finally {
      setBusy(null);
    }
  }, []);

  const removeOne = useCallback(async (key: string) => {
    setBusy(key);
    try {
      const removed = await modelStore.remove(key);
      toast[removed ? "success" : "error"](
        removed ? "Engine removed from this browser." : "That engine could not be removed.",
      );
      setReport(await modelStore.report());
    } finally {
      setBusy(null);
    }
  }, []);

  const removeAll = useCallback(async () => {
    setBusy("all");
    try {
      const removed = await modelStore.clear();
      // Measurements describe engines that are no longer here, so they go too.
      clearBenchmarks();
      toast.success(
        removed === 0
          ? "There was nothing stored to remove."
          : `Removed ${removed} stored engine${removed === 1 ? "" : "s"}.`,
      );
      setReport(await modelStore.report());
    } finally {
      setBusy(null);
    }
  }, []);

  if (report && !report.supported) {
    return (
      <GlassPanel className="p-5">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Engine storage</h2>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">{report.problem}</p>
        <p className="mt-2 text-[12px] text-muted-foreground">
          OCADE will still answer using a device engine or a cloud engine — it just cannot keep a
          browser engine here between visits.
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Engine storage in this browser</h2>
        </div>
        <div className="flex items-center gap-2">
          {report ? (
            report.persistent ? (
              <StatusBadge status="active">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                Permanent
              </StatusBadge>
            ) : (
              <StatusBadge status="setup_required">
                <ShieldAlert className="mr-1 inline h-3 w-3" />
                Can be cleared
              </StatusBadge>
            )
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refresh()}
            disabled={busy !== null}
          >
            {busy === "refresh" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Used by this site</dt>
          <dd className="text-foreground">{formatBytes(report?.usedBytes ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Allowed in total</dt>
          <dd className="text-foreground">{formatBytes(report?.quotaBytes ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Engines stored</dt>
          <dd className="text-foreground">{report?.models.length ?? 0}</dd>
        </div>
      </dl>

      {report && !report.persistent ? (
        <div className="mt-4 rounded-md border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 p-3">
          <p className="text-[13px] text-muted-foreground">
            This browser may delete OCADE's engine when the device runs low on space, which would
            mean downloading it again.
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => void askPersistence()}
            disabled={busy !== null}
          >
            {busy === "persist" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ask the browser to keep it
          </Button>
        </div>
      ) : null}

      {report && report.models.length > 0 ? (
        <ul className="mt-4 divide-y divide-border/60 rounded-md border border-border/60">
          {report.models.map((model) => (
            <li key={model.key} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[12px] text-foreground">{model.key}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span>{formatBytes(model.bytes)}</span>
                  <span>·</span>
                  {/*
                    "Unverified" is stated rather than hidden. It means OCADE
                    could not check the file against a published fingerprint —
                    not that the file is known to be bad, and not that it is
                    known to be good.
                  */}
                  <span>{model.verified ? "fingerprint verified" : "not verified"}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void removeOne(model.key)}
                disabled={busy !== null}
              >
                {busy === model.key ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">
          No engine is stored in this browser yet. One is downloaded the first time OCADE needs to
          answer here without a device engine.
        </p>
      )}

      {report && report.models.length > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => void removeAll()}
          disabled={busy !== null}
        >
          {busy === "all" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Remove every stored engine
        </Button>
      ) : null}
    </GlassPanel>
  );
}
