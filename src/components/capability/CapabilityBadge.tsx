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
  READY: {
    text: "Ready",
    className:
      "border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]",
  },
  WORKING: {
    text: "Working",
    className:
      "border-[color:var(--accent-ocade)]/30 bg-[color:var(--accent-ocade)]/10 text-[color:var(--accent-ocade)]",
  },
  WAITING: {
    text: "Waiting",
    className:
      "border-[color:var(--accent-ocade)]/20 bg-[color:var(--accent-ocade)]/5 text-[color:var(--accent-ocade)]/80",
  },
  NEEDS_APPROVAL: {
    text: "Needs approval",
    className:
      "border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]",
  },
  OFFLINE: {
    text: "Offline",
    className:
      "border-[color:var(--state-pending)]/30 bg-[color:var(--state-pending)]/10 text-[color:var(--state-pending)]",
  },
  DEGRADED: {
    text: "Limited",
    className:
      "border-[color:var(--state-warning)]/25 bg-[color:var(--state-warning)]/5 text-[color:var(--state-warning)]/90",
  },
  FAILED: {
    text: "Failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  UNAVAILABLE: {
    text: "Not available here",
    className: "border-white/10 bg-white/5 text-muted-foreground",
  },
  NOT_CONFIGURED: {
    text: "Setup required",
    className:
      "border-[color:var(--state-warning)]/20 bg-[color:var(--state-warning)]/5 text-[color:var(--state-warning)]/90",
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
