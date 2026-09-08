import { useState } from "react";
import { Stethoscope, ShieldCheck, AlertTriangle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import { diagnose, type Diagnosis } from "@/lib/healing/playbooks";

/**
 * Software Error Healing (§11), made usable.
 *
 * Paste an error; OCADE classifies it from the evidence, ranks the likely
 * cause, and proposes the least-invasive repair FIRST — each repair showing how
 * it would be verified and how it rolls back. Every number and every repair
 * here comes from the real `diagnose` engine the tests exercise.
 *
 * The two honesty rules are visible in the surface: a thin signal is shown as a
 * guess with "gather more" rather than a confident repair, and no repair is
 * ever shown without its rollback.
 */

const SAMPLE =
  "Error: Cannot find module 'left-pad'\n    at require (node:internal/modules/cjs/loader)";

export function DiagnosticsPanel() {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<Diagnosis | null>(null);

  function run() {
    // Split into symptom lines; each non-empty line is one observation.
    const symptoms = text
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({ text: t, source: "log" as const }));
    setResult(diagnose(symptoms));
  }

  return (
    <GlassPanel className="p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Stethoscope className="h-4 w-4" aria-hidden /> Diagnose a software error
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Paste an error or log lines. OCADE classifies it, ranks the likely cause, and proposes the
        least-invasive fix first — with how it&rsquo;s verified and how it undoes. A weak signal is
        shown as a guess, not a confident repair.
      </p>

      <label htmlFor="diag-input" className="text-xs font-medium text-foreground">
        Error or log
      </label>
      <textarea
        id="diag-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        spellCheck={false}
        className="mt-1 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 font-mono text-[11px] text-foreground"
      />

      <div className="mt-2">
        <Button size="sm" className="h-8" onClick={run}>
          Diagnose
        </Button>
      </div>

      {result ? (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs",
            result.confidence >= 0.5 && result.repairs.length > 0
              ? "border-[color:var(--state-success-line-strong)] bg-[color:var(--state-success-surface)]"
              : "border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)]",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {result.repairs.length > 0 ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            )}
            {labelFor(result.failureClass)} · {Math.round(result.confidence * 100)}% confidence
          </p>
          <p className="mt-1 text-muted-foreground">{result.rationale}</p>

          {/* A thin signal: gather more, don't change things. */}
          {result.gatherMore ? (
            <p className="mt-1.5 rounded border border-border/60 bg-secondary/25 p-2 text-[11px] text-muted-foreground">
              {result.gatherMore}
            </p>
          ) : null}

          {result.repairs.length > 0 ? (
            <ol className="mt-2 flex flex-col gap-2">
              {result.repairs.map((r, i) => (
                <li key={i} className="rounded-lg border border-border/60 p-2">
                  <p className="text-[12px] font-medium text-foreground">
                    {i + 1}. {r.action}
                    {r.needsCheckpoint ? (
                      <span className="ml-1 rounded bg-[color:var(--state-warning-surface-strong)] px-1 py-0.5 text-[9px] uppercase text-[color:var(--state-warning)]">
                        checkpoint first
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Verify: {r.verifyBy}</p>
                  {/* No repair is shown without its rollback. */}
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                    <Undo2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> Undo: {r.rollback}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </GlassPanel>
  );
}

function labelFor(kind: Diagnosis["failureClass"]): string {
  const labels: Record<Diagnosis["failureClass"], string> = {
    dependency: "Dependency error",
    corrupted_cache: "Corrupted cache",
    permission: "Permission problem",
    missing_runtime: "Missing runtime",
    config: "Configuration error",
    network: "Network failure",
    database: "Database problem",
    low_memory: "Out of memory",
    driver_mismatch: "Driver mismatch",
    broken_plugin: "Broken plugin",
    file_format: "File-format error",
    gpu: "GPU limitation",
    solver_instability: "Solver instability",
    unknown: "Unrecognised error",
  };
  return labels[kind];
}
