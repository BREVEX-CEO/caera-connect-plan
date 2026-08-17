import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { CapabilityReport, CapabilityStatus } from "@/lib/capabilities/types";

/**
 * The single visual vocabulary for capability state.
 *
 * Colour is never the only signal — each status also carries its own word —
 * because a colour-blind or high-contrast reader must be able to tell "ready"
 * from "not configured" without relying on hue.
 */
const STATUS_STYLE: Record<CapabilityStatus, { text: string; className: string }> = {
  READY: { text: "Ready", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  WORKING: { text: "Working", className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" },
  WAITING: { text: "Waiting", className: "border-cyan-400/20 bg-cyan-400/5 text-cyan-100/80" },
  NEEDS_APPROVAL: {
    text: "Needs approval",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  OFFLINE: { text: "Offline", className: "border-slate-400/30 bg-slate-400/10 text-slate-200" },
  DEGRADED: { text: "Limited", className: "border-amber-400/25 bg-amber-400/5 text-amber-100" },
  FAILED: { text: "Failed", className: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
  UNAVAILABLE: {
    text: "Not available here",
    className: "border-white/10 bg-white/5 text-muted-foreground",
  },
  NOT_CONFIGURED: {
    text: "Setup required",
    className: "border-amber-400/20 bg-amber-400/5 text-amber-100/90",
  },
  COMING_SOON: {
    text: "Coming soon",
    className: "border-white/10 bg-white/5 text-muted-foreground",
  },
};

export function statusLabel(status: CapabilityStatus): string {
  return STATUS_STYLE[status].text;
}

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
          className="mt-3 inline-flex text-xs font-medium text-cyan-300 underline-offset-4 hover:underline"
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
