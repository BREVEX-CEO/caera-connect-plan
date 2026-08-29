import { useCallback, useEffect, useState } from "react";
import { HardDrive, ShieldCheck, ShieldAlert, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { modelStore } from "@/lib/brain/model-store";
import { modelVault, type InstallationView } from "@/lib/brain/model-vault";
import { clearBenchmarks } from "@/lib/brain/tier-benchmark-store";

type ProductStorageView = InstallationView & {
  supported: boolean;
  persistent: boolean;
  problem: string | null;
};

/**
 * Product-safe storage controls for OCADE Intelligence.
 *
 * The old panel rendered ModelStore's raw files. That store knows paths and
 * byte counts but not which version ModelVault verified and activated, so it
 * exposed vendor filenames, quantisation, model size and a false "not
 * verified" label for an engine the canonical authority had already approved.
 *
 * This surface now asks ModelVault one question — is the active artifact really
 * present and verified? — and uses only OCADE product language. Raw files and
 * diagnostics remain available to explicit developer tooling, never ordinary
 * Settings.
 */
export function BrowserStoragePanel() {
  const [view, setView] = useState<ProductStorageView | null>(null);
  const [busy, setBusy] = useState<"refresh" | "persist" | "remove" | null>(null);

  const readView = useCallback(async (): Promise<ProductStorageView> => {
    const [installation, storage] = await Promise.all([
      modelVault.installationView(),
      modelStore.report(),
    ]);
    return {
      ...installation,
      supported: storage.supported,
      persistent: storage.persistent,
      problem: storage.problem ?? null,
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      setView(await readView());
    } finally {
      setBusy(null);
    }
  }, [readView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const askPersistence = useCallback(async () => {
    setBusy("persist");
    try {
      const granted = await modelStore.requestPersistence();
      toast[granted ? "success" : "error"](
        granted
          ? "This browser will keep OCADE Intelligence between visits."
          : "The browser may clear OCADE Intelligence when this device runs low on space.",
      );
      setView(await readView());
    } finally {
      setBusy(null);
    }
  }, [readView]);

  const remove = useCallback(async () => {
    setBusy("remove");
    try {
      const { installationAuthority } = await import("@/lib/brain/installation-browser");
      const { removed } = await installationAuthority().uninstall();
      clearBenchmarks();
      toast.success(
        removed === 0
          ? "OCADE Intelligence was not stored on this device."
          : "OCADE Intelligence was removed from this device.",
      );
      setView(await readView());
    } finally {
      setBusy(null);
    }
  }, [readView]);

  if (view && !view.supported) {
    return (
      <GlassPanel className="p-5">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">OCADE Intelligence</h2>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {view.problem ?? "This browser cannot store OCADE Intelligence between visits."}
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-accent" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">OCADE Intelligence</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {view?.ready
                ? "Stored securely on this device"
                : view?.stored
                  ? "Checking the stored intelligence"
                  : "Not stored on this device"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view ? (
            view.ready ? (
              <StatusBadge status="active">
                <ShieldCheck className="mr-1 inline h-3 w-3" />
                Ready
              </StatusBadge>
            ) : (
              <StatusBadge status="setup_required">
                <ShieldAlert className="mr-1 inline h-3 w-3" />
                Not ready
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

      {view?.ready && !view.persistent ? (
        <div className="mt-4 rounded-md border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 p-3">
          <p className="text-[13px] text-muted-foreground">
            This browser may clear OCADE Intelligence if the device runs low on space.
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => void askPersistence()}
            disabled={busy !== null}
          >
            {busy === "persist" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Keep it on this device
          </Button>
        </div>
      ) : null}

      {view?.stored ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={() => void remove()}
          disabled={busy !== null}
        >
          {busy === "remove" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Remove OCADE Intelligence
        </Button>
      ) : null}
    </GlassPanel>
  );
}
