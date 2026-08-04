import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { StatusBadge } from "./StatusBadge";

export function SetupRequiredState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <GlassPanel className="flex flex-col items-start gap-3 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[color:var(--state-warning)]/15 p-2 text-[color:var(--state-warning)]">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <StatusBadge status="setup_required" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </GlassPanel>
  );
}
