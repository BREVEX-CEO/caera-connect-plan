import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { CapabilityReport, CapabilityStatus } from "@/lib/capabilities/types";
import { STATUS_STYLE } from "@/components/capability/capability-status-style";

export function CapabilityBadge({
  status,
  className,
}: {
  status: CapabilityStatus;
  className?: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        style.className,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {style.text}
    </span>
  );
}

/**
 * A capability shown in full: what it is, what is true about it, and the one
 * thing the user can do next. Used by the health page and by every empty state
 * that would otherwise have invented an excuse of its own.
 */
export function CapabilityCard({ report }: { report: CapabilityReport }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-foreground">{report.label}</div>
        <CapabilityBadge status={report.status} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.detail}</p>
      {report.action?.to ? (
        <Link
          to={report.action.to}
          params={report.action.params}
          className="mt-3 inline-flex text-xs font-medium text-[color:var(--accent-ocade)] underline-offset-4 hover:underline"
        >
          {report.action.label}
        </Link>
      ) : null}
      {report.evidence ? (
        <p className="mt-2 text-[11px] text-muted-foreground/60">Based on: {report.evidence}</p>
      ) : null}
    </div>
  );
}
