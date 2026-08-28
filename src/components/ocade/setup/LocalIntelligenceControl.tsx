import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInstallation } from "@/lib/brain/use-installation";

/**
 * Remove — or put back — the intelligence OCADE stores on this device.
 *
 * WHY IT IS ONE COMPONENT USED IN THREE PLACES. The brief asks for this control
 * on the public landing page, in signed-in Settings, and on the storage screen.
 * Three implementations would be three chances for one of them to remove a
 * slightly different set of things, and the one that removed too much would be
 * discovered by somebody losing their conversations. There is one uninstall
 * operation, owned by the installation authority, and this is its one button.
 *
 * WHAT IT IS CAREFUL TO SEPARATE. "Remove OCADE Intelligence" is not "Delete
 * account" and not "Clear conversations". It removes model artifacts, staging
 * leftovers, version metadata and the pointer that names the active version —
 * and nothing else. The copy says so, because a destructive control that is
 * vague about its blast radius is one people either avoid or regret.
 *
 * WHAT IT DOES NOT CLAIM. A web page cannot clear another site's storage, see
 * the device's free disk, or open the browser's own settings. So it points at
 * those controls rather than pretending to operate them.
 */

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export interface LocalIntelligenceControlProps {
  /**
   * `full` for a settings panel; `compact` for the quiet line at the bottom of
   * the landing page, where this must be findable without being shouted.
   */
  variant?: "full" | "compact";
  className?: string;
}

export function LocalIntelligenceControl({
  variant = "full",
  className,
}: LocalIntelligenceControlProps) {
  const { state, ready, preparing, line } = useInstallation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installedBytes, setInstalledBytes] = useState<number | null>(null);

  /*
   * WHAT IS ACTUALLY ON DISK, read from the vault rather than inferred from the
   * install state. A version whose metadata was lost — private mode, cleared
   * storage — still occupies real space, and a control that reported "nothing
   * installed" over a gigabyte of files would be the least useful possible
   * version of this screen.
   */
  const refresh = useCallback(async () => {
    try {
      /*
       * Imported here rather than at the top of the file. This control sits in
       * the landing page's footer, and a static import would pull the vault,
       * the storage layer and the model catalogue into the entry bundle for
       * every visitor -- to render one line of text most of them will not read.
       */
      const { modelVault } = await import("@/lib/brain/model-vault");
      const versions = await modelVault.listVersions();
      setInstalledBytes(versions.reduce((total, version) => total + version.bytes, 0));
    } catch {
      setInstalledBytes(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, state.stage]);

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      const { installationAuthority } = await import("@/lib/brain/installation-browser");
      const result = await installationAuthority().uninstall();
      await refresh();
      setConfirming(false);
      toast.success("OCADE Intelligence removed from this device.", {
        description:
          result.removed > 0
            ? "Your conversations and your account are untouched."
            : "There was nothing stored here to remove.",
      });
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const reinstall = useCallback(async () => {
    setBusy(true);
    try {
      const { installationAuthority } = await import("@/lib/brain/installation-browser");
      void installationAuthority().reinstall();
      toast.info("Preparing OCADE on this device…");
    } finally {
      setBusy(false);
    }
  }, []);

  const hasSomething = (installedBytes ?? 0) > 0 || ready;

  if (variant === "compact") {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        {hasSomething ? (
          <>
            <span>OCADE keeps its intelligence on this device. </span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Uninstall OCADE Intelligence
            </button>
            {confirming ? (
              <ConfirmRemoval
                busy={busy}
                bytes={installedBytes}
                onCancel={() => setConfirming(false)}
                onConfirm={remove}
              />
            ) : null}
          </>
        ) : (
          <>
            <span>OCADE Intelligence is not installed on this device. </span>
            <button
              type="button"
              onClick={reinstall}
              disabled={busy || preparing}
              className="underline underline-offset-2 hover:text-foreground disabled:opacity-60"
            >
              {preparing ? "Preparing…" : "Reinstall OCADE"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-xl border border-border/60 bg-secondary/25 p-4", className)}
      data-testid="local-intelligence-control"
    >
      <p className="text-sm font-medium text-foreground">OCADE Intelligence on this device</p>
      <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
        {ready
          ? "Ready. OCADE answers on this device, and works with no connection."
          : preparing
            ? line
            : "Not installed on this device."}
        {installedBytes !== null && installedBytes > 0
          ? ` Using ${formatBytes(installedBytes)} of local storage.`
          : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {hasSomething ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirming(true)}
            disabled={busy}
          >
            Remove OCADE Intelligence
          </Button>
        ) : (
          <Button size="sm" onClick={reinstall} disabled={busy || preparing}>
            {preparing ? "Preparing…" : "Reinstall OCADE"}
          </Button>
        )}
      </div>

      {confirming ? (
        <ConfirmRemoval
          busy={busy}
          bytes={installedBytes}
          onCancel={() => setConfirming(false)}
          onConfirm={remove}
        />
      ) : null}

      {/*
        SAYING WHAT OCADE CANNOT DO IS PART OF THE CONTROL.

        People reasonably expect a "remove my data" button to be able to reach
        everything, and this one genuinely cannot: browser storage belonging to
        other sites is not addressable from here. Naming that is more useful
        than a button that appears to do it and quietly does not.
      */}
      <p className="mt-3 text-[11.5px] leading-5 text-muted-foreground">
        You can also clear OCADE&apos;s site data from your browser or device settings. OCADE
        cannot reach another site&apos;s storage or your device&apos;s own controls, so that part
        is yours to do. Removing OCADE Intelligence here never touches your conversations, your
        account, or anything else on this device.
      </p>
    </div>
  );
}

/**
 * The confirmation, which states the consequence rather than asking "are you
 * sure".
 *
 * "Are you sure" is a question nobody can answer usefully, because it does not
 * say what happens. The two things a person needs are: what will be gone, and
 * what will not.
 */
function ConfirmRemoval({
  busy,
  bytes,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  bytes: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-background/80 p-3 text-left">
      <p className="text-[13px] leading-6 text-foreground">
        This removes OCADE&apos;s intelligence from this device
        {bytes !== null && bytes > 0 ? `, freeing about ${formatBytes(bytes)}` : ""}. OCADE will
        stop working without a connection here until you install it again.
      </p>
      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
        Your conversations, your account and your settings are not affected.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="destructive" onClick={onConfirm} disabled={busy}>
          {busy ? "Removing…" : "Remove"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
