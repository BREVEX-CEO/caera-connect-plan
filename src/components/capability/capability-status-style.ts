import type { CapabilityStatus } from "@/lib/capabilities/types";

/**
 * The single visual vocabulary for capability state.
 *
 * Colour is never the only signal — each status also carries its own word —
 * because a colour-blind or high-contrast reader must be able to tell "ready"
 * from "not configured" without relying on hue.
 */
export const STATUS_STYLE: Record<CapabilityStatus, { text: string; className: string }> = {
  READY: {
    text: "Ready",
    className:
      "border-[color:var(--state-success-line)] bg-[color:var(--state-success-surface)] text-[color:var(--state-success)]",
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
      "border-[color:var(--state-warning-line)] bg-[color:var(--state-warning-surface)] text-[color:var(--state-warning)]",
  },
  OFFLINE: {
    text: "Offline",
    className:
      "border-[color:var(--state-pending-line)] bg-[color:var(--state-pending-surface)] text-[color:var(--state-pending)]",
  },
  DEGRADED: {
    text: "Limited",
    className:
      "border-[color:var(--state-warning-line)] bg-[color:var(--state-warning-wash)] text-[color:var(--state-warning)]",
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
      "border-[color:var(--state-warning-line)] bg-[color:var(--state-warning-wash)] text-[color:var(--state-warning)]",
  },
  COMING_SOON: {
    text: "Coming soon",
    className: "border-white/10 bg-white/5 text-muted-foreground",
  },
};

export function statusLabel(status: CapabilityStatus): string {
  return STATUS_STYLE[status].text;
}
