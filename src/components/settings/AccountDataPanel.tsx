import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordAction } from "@/lib/actions";
import { deleteMyAccountDataClass, exportMyAccountData } from "@/lib/account-data.functions";
import type { AccountDataExport, DataClassDeletionReceipt } from "@/lib/account/data-rights";
import {
  ACCOUNT_DATA_CLASSES,
  type AccountDataClass,
  type AccountDataClassId,
} from "@/lib/account/data-classes";

/**
 * ACCESS AND ERASURE, ON THE SCREEN — PLAN.md §O.
 *
 * Two rights, and they read differently on purpose. The export is one button
 * and produces a file; erasure is per class, typed to confirm, and refuses the
 * three classes that must be kept — saying WHY rather than hiding the control,
 * because a missing button is indistinguishable from a broken one.
 *
 * WHAT THIS PANEL DOES NOT CLAIM. It is about the data OCADE holds in its
 * account database. Data a person chose to keep on the device — Browser Only
 * and PC Vault classes — never reached the server and is not in the export;
 * the copy says so rather than letting somebody conclude their local chats are
 * missing from a file that was never going to contain them.
 *
 * THE DOWNLOAD IS BUILT IN THE BROWSER. The export arrives as a value from the
 * server function and becomes a Blob here, so the file never has to be stored
 * anywhere OCADE would then have to protect and expire. The object URL is
 * revoked on the next tick: leaving it alive keeps the whole export in memory
 * for the life of the document, which for a large account is real memory.
 */
export function AccountDataPanel() {
  const runExport = useServerFn(exportMyAccountData);
  const runDelete = useServerFn(deleteMyAccountDataClass);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<AccountDataExport | null>(null);
  const [armed, setArmed] = useState<AccountDataClassId | null>(null);
  const [phrase, setPhrase] = useState("");
  const [busyClass, setBusyClass] = useState<AccountDataClassId | null>(null);
  const [receipt, setReceipt] = useState<DataClassDeletionReceipt | null>(null);

  async function download() {
    setExporting(true);
    void recordAction({ actionId: "account.data.export" });
    try {
      const result = await runExport();
      setExported(result);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ocade-account-data-${result.generatedAt.slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error("Your data could not be exported.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function clear(entry: AccountDataClass) {
    setBusyClass(entry.id);
    void recordAction({ actionId: "account.data.delete_class", metadata: { dataClass: entry.id } });
    try {
      const outcome = await runDelete({ data: { dataClass: entry.id, confirmation: phrase } });
      setReceipt(outcome);
      setArmed(null);
      setPhrase("");
    } catch (error) {
      toast.error(`${entry.label} could not be cleared.`, {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusyClass(null);
    }
  }

  return (
    <GlassPanel className="mt-4 p-5">
      <header className="flex items-center gap-2">
        <Download className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Your data</h3>
      </header>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        Download everything OCADE holds for this account, or clear one kind of it. Data you kept on
        this device only never reached OCADE and is not included in either.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void download()} disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {exporting ? "Preparing your file…" : "Download my data (JSON)"}
        </Button>
        {exported ? (
          <p role="status" className="text-xs text-muted-foreground">
            {exported.rowCount.toLocaleString()} record
            {exported.rowCount === 1 ? "" : "s"} across {exported.classes.length} kinds
            {exported.partial ? " — some tables could not be read; the file says which." : "."}
          </p>
        ) : null}
      </div>

      {receipt ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <strong className="text-foreground">{receipt.label} cleared.</strong>{" "}
          {receipt.cleared.length} table{receipt.cleared.length === 1 ? "" : "s"} emptied at{" "}
          {new Date(receipt.completedAt).toLocaleString()}. Offline Intelligence on this device was
          not touched.
        </p>
      ) : null}

      <ul className="mt-5 divide-y divide-border/40 border-t border-border/40">
        {ACCOUNT_DATA_CLASSES.map((entry) => (
          <li key={entry.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-[13px] font-medium text-foreground">{entry.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {entry.description}
                </p>
                {entry.retention ? (
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground/85">
                    {entry.retention}
                  </p>
                ) : null}
              </div>
              {entry.retention === null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  aria-label={`Clear ${entry.label}`}
                  onClick={() => {
                    setArmed(armed === entry.id ? null : entry.id);
                    setPhrase("");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
                </Button>
              ) : null}
            </div>

            {armed === entry.id ? (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <label className="block text-xs text-muted-foreground">
                  This cannot be undone. Type{" "}
                  <strong className="text-foreground">{entry.label}</strong> to confirm.
                  <Input
                    value={phrase}
                    onChange={(event) => setPhrase(event.target.value)}
                    aria-label={`Type ${entry.label} to confirm`}
                    className="mt-2"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={
                      busyClass === entry.id ||
                      phrase.trim().toLowerCase() !== entry.label.toLowerCase()
                    }
                    onClick={() => void clear(entry)}
                    className="gap-2"
                  >
                    {busyClass === entry.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Clear {entry.label}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setArmed(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
