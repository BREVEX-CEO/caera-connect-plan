import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Chrome, Loader2, RefreshCw } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import {
  handshakeWithExtension,
  extensionChannelAvailable,
  type Handshake,
} from "@/lib/native/extension-bridge";

/**
 * Whether OCADE can act in this browser, and what to do when it cannot.
 *
 * THE RULE THIS PANEL EXISTS TO KEEP. It never claims the extension is
 * installed, and it never pretends to install it. A page cannot install a
 * browser extension — only the person can — so the honest options are to say
 * it is missing and show exactly how to add it, or to confirm it is there
 * because it answered a handshake. There is no third state, and in particular
 * there is no "connecting…" that never resolves, which is how a missing
 * extension usually presents itself.
 *
 * PAIRING IS THE HANDSHAKE. There is no separate code to copy: Chrome only
 * delivers a message to the extension when the sending page's origin is listed
 * in `externally_connectable.matches`, so an answer IS proof that this site is
 * one the extension accepts. Anything else would be inventing a ceremony on
 * top of a check the browser already performs.
 */
export function CoworkExtensionGate({
  onReady,
}: {
  /** Called once, when the extension answers and is compatible. */
  onReady?: (handshake: Handshake) => void;
}) {
  const [state, setState] = useState<Handshake | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    const result = await handshakeWithExtension();
    setState(result);
    setChecking(false);
    if (result.installed && result.compatible) onReady?.(result);
  }, [onReady]);

  useEffect(() => {
    void check();
  }, [check]);

  if (checking && state === null) {
    return (
      <GlassPanel className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Looking for the OCADE Cowork extension…
      </GlassPanel>
    );
  }

  if (state?.installed && state.compatible) {
    return (
      <GlassPanel className="flex flex-wrap items-center gap-3 p-4">
        <CheckCircle2 className="h-5 w-5 text-[color:var(--state-success)]" aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Cowork is connected</span>
            <StatusBadge status="connected" />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Extension {state.version ?? "installed"} answered on this site, so OCADE can act in this
            browser — inside the sites you approve in its popup, and nowhere else.
          </p>
        </div>
      </GlassPanel>
    );
  }

  const incompatible = state?.installed && !state.compatible;

  return (
    <GlassPanel className="flex flex-col items-start gap-3 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[color:var(--state-warning-surface-strong)] p-2 text-[color:var(--state-warning)]">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>
        <StatusBadge status="setup_required" />
      </div>

      <h3 className="text-base font-semibold text-foreground">
        {incompatible
          ? "The Cowork extension needs updating"
          : "Cowork needs its browser extension"}
      </h3>

      <p className="text-sm text-muted-foreground">
        {incompatible
          ? state?.reason
          : extensionChannelAvailable()
            ? "OCADE is the brain; the extension is the hands. Without it this page cannot open a tab, read a page, or click anything outside itself — and it should not be able to."
            : "This browser does not support extensions of this kind. Cowork needs Chrome or Edge."}
      </p>

      {!incompatible && extensionChannelAvailable() ? (
        <div className="w-full rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Chrome className="h-4 w-4" aria-hidden />
            Add it yourself — a page cannot install an extension for you
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
            <li>
              Open <code className="rounded bg-muted px-1">chrome://extensions</code> in a new tab.
            </li>
            <li>
              Turn on <strong>Developer mode</strong>, top right.
            </li>
            <li>
              Choose <strong>Load unpacked</strong> and select the{" "}
              <code className="rounded bg-muted px-1">extension</code> folder from your OCADE
              download.
            </li>
            <li>Come back here and press Check again.</li>
          </ol>
          <p className="mt-2 text-[13px] text-muted-foreground">
            OCADE will not ask for access to any site during installation. You approve sites one at
            a time, in the extension&rsquo;s own popup.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void check()}
        disabled={checking}
        className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/30 disabled:opacity-60"
      >
        {checking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        )}
        Check again
      </button>
    </GlassPanel>
  );
}
