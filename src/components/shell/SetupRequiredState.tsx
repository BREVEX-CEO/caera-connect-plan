import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { StatusBadge, type Status } from "./StatusBadge";

export function SetupRequiredState({
  title,
  description,
  detail,
  action,
  status = "setup_required",
}: {
  title: string;
  description?: string;
  /**
   * Underlying error text. Rendered as a clearly-labelled technical detail —
   * never as the explanation, and never spliced into `description`, which is
   * how an internal exception message ended up reading as product copy.
   */
  detail?: string | null;
  action?: ReactNode;
  /**
   * Defaults to "Setup required". Pass "failed" when the cause is NOT a missing
   * setup step — labelling a dropped connection as "Setup required" sends the
   * reader off to configure something that is already correct.
   */
  status?: Status;
}) {
  return (
    <GlassPanel className="flex flex-col items-start gap-3 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[color:var(--state-warning-surface-strong)] p-2 text-[color:var(--state-warning)]">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <StatusBadge status={status} />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {detail ? (
        <p className="text-xs text-muted-foreground/70">
          <span className="font-medium">Technical detail:</span> {detail}
        </p>
      ) : null}
      {action}
    </GlassPanel>
  );
}
