import { useRef, useState } from "react";
import { FileDown, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { importModelFile } from "@/lib/brain/model-download";
import { ModelStore } from "@/lib/brain/model-store";
import {
  WASM_TIERS,
  resolvedFor,
  storageKeyFor,
  sha256For,
  formatSize,
} from "@/lib/brain/browser-catalogue";

/**
 * Install the engine from a file on this machine, with no connection.
 *
 * THE GAP THIS CLOSES. Every other route to a working engine starts with a
 * download, so OCADE's offline promise had a step in it that could not be done
 * offline: the first one. On an air-gapped machine, behind an egress policy
 * that blocks the model host, or on a connection nobody will spend 470 MB on,
 * "works offline once the engine is downloaded" meant "does not work here".
 *
 * The imported file is held to the SAME published fingerprint a downloaded one
 * is — see `importModelFile`. A file handed over on a USB stick warrants more
 * scrutiny than one fetched over TLS, not less, and a mismatch deletes it
 * rather than running weights that would load happily and answer nonsense.
 */
export function EngineImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fraction, setFraction] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  // Only the WASM tier is OCADE-managed. WebGPU tiers are fetched and cached by
  // WebLLM itself, so there is no file here to import and none is implied.
  const tier = WASM_TIERS[0];
  const entry = resolvedFor(tier);
  const key = storageKeyFor(tier);
  const supported = ModelStore.isSupported();

  const onPick = async (file: File | undefined) => {
    if (!file || !key) return;
    setBusy(true);
    setFraction(0);
    setOutcome(null);
    try {
      const result = await importModelFile({
        key,
        file,
        sha256: sha256For(tier),
        onProgress: (p) => setFraction(p.fraction),
      });
      if (result.ok) {
        // `verified` is reported, never assumed. A browser with no WebCrypto
        // stores the file and says the digest could not be checked, which is a
        // materially weaker claim than "verified" and is shown as one.
        const message = result.verified
          ? `Engine installed and verified against its published fingerprint (${formatSize(result.bytes)}). OCADE can now answer on this device with no connection.`
          : `Engine installed (${formatSize(result.bytes)}), but this browser could not check its fingerprint. It will be re-checked next time.`;
        setOutcome({ ok: true, message });
        (result.verified ? toast.success : toast.warning)("Engine installed.", {
          description: message,
        });
      } else {
        setOutcome({ ok: false, message: result.reason });
        toast.error("The engine was not installed.", { description: result.reason });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The file could not be read.";
      setOutcome({ ok: false, message });
      toast.error("The engine was not installed.", { description: message });
    } finally {
      setBusy(false);
      // Cleared so choosing the SAME file again still fires a change event —
      // otherwise a retry after a failure silently does nothing.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <FileDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Install the engine from a file</h3>
      </header>

      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        If this device cannot reach the internet, copy the engine file across and select it here.
        Nothing is downloaded and no request leaves this machine.
      </p>

      {entry ? (
        <div className="rounded-lg border border-border/60 bg-secondary/25 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <p className="text-foreground">
            Expected file: <code className="font-mono">{entry.path}</code>
          </p>
          <p className="mt-1">
            <span className="tabular-nums">{formatSize(entry.sizeBytes)}</span> · SHA-256{" "}
            <code className="break-all font-mono">{entry.sha256}</code>
          </p>
        </div>
      ) : null}

      {!supported ? (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-[color:var(--state-warning)]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            This browser cannot store a model between visits, so an imported engine would be lost on
            reload. Importing is disabled rather than allowed to waste the transfer.
          </span>
        </p>
      ) : null}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".gguf"
          className="sr-only"
          aria-label="Engine file"
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !supported || !key}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Installing… <span className="tabular-nums">{Math.round(fraction * 100)}%</span>
            </>
          ) : (
            "Choose engine file"
          )}
        </Button>
      </div>

      {busy ? (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Installing engine"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      ) : null}

      {outcome ? (
        <p
          className={
            outcome.ok
              ? "flex items-start gap-1.5 text-[12px] leading-relaxed text-[color:var(--state-success)]"
              : "flex items-start gap-1.5 text-[12px] leading-relaxed text-destructive"
          }
          role="status"
        >
          {outcome.ok ? (
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span>{outcome.message}</span>
        </p>
      ) : null}
    </GlassPanel>
  );
}
