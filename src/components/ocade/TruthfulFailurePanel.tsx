import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TruthfulFailurePanelProps {
  title: string;
  failed: string;
  safe: string;
  notDone: string;
  alternative?: string;
  diagnosticId?: string;
  retry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Errors must say what failed without implying that an action happened. This
 * shared panel deliberately separates failure, safety, and non-execution so a
 * user can tell the difference between "the request failed" and "the action
 * partially happened". Callers must only describe facts they can actually
 * prove; the component never manufactures a success state.
 */
export function TruthfulFailurePanel({
  title,
  failed,
  safe,
  notDone,
  alternative,
  diagnosticId,
  retry,
  retryLabel = "Try again",
  className,
}: TruthfulFailurePanelProps) {
  return (
    <section
      role="alert"
      className={cn("rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4", className)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <dl className="mt-3 grid gap-2 text-xs leading-relaxed">
            <div>
              <dt className="font-medium text-foreground">What failed</dt>
              <dd className="text-muted-foreground">{failed}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">What is safe</dt>
              <dd className="text-muted-foreground">{safe}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">What OCADE did not do</dt>
              <dd className="text-muted-foreground">{notDone}</dd>
            </div>
            {alternative ? (
              <div>
                <dt className="font-medium text-foreground">Alternative</dt>
                <dd className="text-muted-foreground">{alternative}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {retry ? (
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {retryLabel}
              </button>
            ) : null}
            {diagnosticId ? (
              <code className="text-[10px] text-muted-foreground">Diagnostic {diagnosticId}</code>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
