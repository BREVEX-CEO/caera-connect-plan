import { useState } from "react";
import { FileCode2, ShieldCheck, AlertTriangle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import {
  parseUnifiedDiff,
  applyReversibly,
  applyPatch,
  buildPatchReceipt,
  type PatchReceipt,
} from "@/lib/code/patch";

/**
 * Code edits, applied and undone for real.
 *
 * The whole point of this surface is the refusal: change the file so the
 * patch's context no longer matches, press Apply, and OCADE declines rather
 * than fuzzing the change into roughly the right place. That failure is
 * invisible in review, so it has to be visible here.
 *
 * Undo is a real inverse patch applied to the current text, not a stashed copy.
 */

const START_FILE = ["function greet(name) {", '  return "hi " + name;', "}", ""].join("\n");

const START_DIFF = [
  "--- a/greet.js",
  "+++ b/greet.js",
  "@@ -1,3 +1,3 @@",
  " function greet(name) {",
  '-  return "hi " + name;',
  "+  return `Hello, ${name}`;",
  " }",
  "",
].join("\n");

export function PatchPanel() {
  const [file, setFile] = useState(START_FILE);
  const [diff, setDiff] = useState(START_DIFF);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PatchReceipt | null>(null);
  const [inverse, setInverse] = useState<Parameters<typeof applyPatch>[1] | null>(null);

  function apply() {
    setError(null);
    setReceipt(null);

    const parsed = parseUnifiedDiff(diff);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }

    // Reversible application: the undo is exercised before this counts as done.
    const result = applyReversibly(file, parsed.data);
    if (!result.ok) {
      setError(result.reason);
      return;
    }

    setFile(result.data.content);
    setInverse(result.data.inverse);
    setReceipt(buildPatchReceipt(parsed.data, result.data, true));
  }

  function revert() {
    if (!inverse) return;
    const undone = applyPatch(file, inverse);
    if (!undone.ok) {
      setError(undone.reason);
      return;
    }
    setFile(undone.data.content);
    setInverse(null);
    setReceipt(null);
    setError(null);
  }

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <FileCode2 className="h-4 w-4" aria-hidden /> Apply a code change, reversibly
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        The patch applies only where its context matches exactly. Edit the file below so it no
        longer does, and OCADE will refuse rather than put the change somewhere close — which is how
        an edit lands in the wrong function and still passes review.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="patch-file" className="text-xs font-medium text-foreground">
            File
          </label>
          <textarea
            id="patch-file"
            value={file}
            onChange={(e) => setFile(e.target.value)}
            rows={6}
            spellCheck={false}
            className="mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-foreground"
          />
        </div>
        <div>
          <label htmlFor="patch-diff" className="text-xs font-medium text-foreground">
            Patch
          </label>
          <textarea
            id="patch-diff"
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            rows={6}
            spellCheck={false}
            className="mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-foreground"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" className="h-8" onClick={apply}>
          Apply
        </Button>
        <Button size="sm" variant="ghost" className="h-8" disabled={!inverse} onClick={revert}>
          <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Undo
        </Button>
      </div>

      {error ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs"
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Not applied
          </p>
          {/* Shown verbatim, including the expected/found lines. */}
          <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {error}
          </pre>
        </div>
      ) : null}

      {receipt ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border border-[color:var(--state-success)]/40 bg-[color:var(--state-success)]/10 p-3 text-xs",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Applied, and reversible
          </p>
          <p className="mt-1 text-muted-foreground">{receipt.evidence}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            The undo wasn&rsquo;t just produced — it was applied to the result and checked against
            the original before this was reported as done.
          </p>
        </div>
      ) : null}
    </GlassPanel>
  );
}
