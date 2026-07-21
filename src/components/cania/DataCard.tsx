import type { ReactNode } from "react";
import { AlertCircle, Clock, Info, Lock, RefreshCcw, Signal, Wifi } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { cn } from "@/lib/utils";
import { CANIA_DATA_LABELS, type CaniaDataLabel } from "@/lib/cania-sections";

/**
 * Truthful data card. Every visible enabled control must correspond to a
 * real action; when no live data is available, the card must display a
 * Setup Required, Native Companion Required or Provider Error state.
 *
 * Required metadata:
 * - source          (name of the actual source, e.g. "OpenWeather")
 * - retrievedAt     (ISO string of when the payload was fetched; null when none)
 * - label           (live / delayed / estimated / ai_summary)
 * - providerStatus  (connected / setup_required / disconnected / failed)
 * - permission      (granted / denied / not_required / needs_prompt)
 * - staleAfterMs    (renders a warning past this age; 0 disables)
 * - error / onRetry (renders the error state + retry button)
 */

export interface DataCardMeta {
  source: string;
  retrievedAt: string | null;
  label: CaniaDataLabel;
  providerStatus: "connected" | "setup_required" | "disconnected" | "failed";
  permission: "granted" | "denied" | "not_required" | "needs_prompt";
  staleAfterMs?: number;
  error?: { message: string; onRetry?: () => void };
  demo?: boolean;
}

export function DataCard({
  title,
  meta,
  children,
  actions,
  className,
}: {
  title: string;
  meta: DataCardMeta;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const age = meta.retrievedAt ? Date.now() - new Date(meta.retrievedAt).getTime() : null;
  const stale = age !== null && meta.staleAfterMs && meta.staleAfterMs > 0 && age > meta.staleAfterMs;

  return (
    <GlassPanel className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <LabelChip label={meta.label} />
            {meta.demo ? (
              <span className="rounded-full bg-[color:var(--state-warning)]/15 px-2 py-0.5 text-[color:var(--state-warning)]">
                Sample content (Demo Mode)
              </span>
            ) : null}
          </div>
        </div>
        <StatusBadge status={meta.providerStatus === "connected" ? "connected" : meta.providerStatus === "failed" ? "failed" : "setup_required"} />
      </div>

      {meta.providerStatus !== "connected" && !meta.demo ? (
        <SetupInlineNotice source={meta.source} status={meta.providerStatus} />
      ) : null}

      {meta.permission === "denied" ? (
        <PermissionNotice />
      ) : meta.permission === "needs_prompt" ? (
        <InlineHint icon={Lock} tone="warning" text="This section needs your location — grant permission on the CANIA settings page." />
      ) : null}

      {meta.error ? (
        <ErrorInline message={meta.error.message} onRetry={meta.error.onRetry} />
      ) : null}

      {stale ? (
        <InlineHint icon={Clock} tone="warning" text="This data is stale. Refresh to pull the latest from the provider." />
      ) : null}

      {children ? <div className="text-sm text-foreground">{children}</div> : null}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Info className="h-3 w-3" aria-hidden />
          Source: <span className="text-foreground">{meta.source}</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" aria-hidden />
          {meta.retrievedAt
            ? `Retrieved ${formatAge(meta.retrievedAt)}`
            : "Not yet retrieved"}
        </div>
        {actions}
      </div>
    </GlassPanel>
  );
}

function LabelChip({ label }: { label: CaniaDataLabel }) {
  const tone =
    label === "live" ? "success" : label === "delayed" ? "info" : label === "estimated" ? "warning" : "muted";
  const tones: Record<string, string> = {
    success: "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]",
    info: "bg-[color:var(--state-info)]/15 text-[color:var(--state-info)]",
    warning: "bg-[color:var(--state-warning)]/15 text-[color:var(--state-warning)]",
    muted: "bg-muted text-muted-foreground",
  };
  const Icon = label === "live" ? Wifi : label === "delayed" ? Signal : label === "estimated" ? Clock : Info;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", tones[tone])}>
      <Icon className="h-3 w-3" aria-hidden /> {CANIA_DATA_LABELS[label]}
    </span>
  );
}

function SetupInlineNotice({ source, status }: { source: string; status: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/10 p-2 text-xs text-[color:var(--state-warning)]">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5" aria-hidden />
      <span>
        {status === "failed"
          ? `${source} returned an error and no cached data is available.`
          : `${source} is not connected yet. Configure the provider in the admin surface to enable this card.`}
      </span>
    </div>
  );
}

function PermissionNotice() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
      <Lock className="mt-0.5 h-3.5 w-3.5" aria-hidden />
      <span>Location permission was denied. This card cannot render without it.</span>
    </div>
  );
}

function InlineHint({
  icon: Icon,
  text,
  tone,
}: {
  icon: typeof AlertCircle;
  text: string;
  tone: "warning" | "info";
}) {
  const cls =
    tone === "warning"
      ? "border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]"
      : "border-[color:var(--state-info)]/30 bg-[color:var(--state-info)]/10 text-[color:var(--state-info)]";
  return (
    <div className={cn("flex items-start gap-2 rounded-md border p-2 text-xs", cls)}>
      <Icon className="mt-0.5 h-3.5 w-3.5" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

function ErrorInline({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded border border-destructive/30 px-1.5 py-0.5"
        >
          <RefreshCcw className="h-3 w-3" /> Retry
        </button>
      ) : null}
    </div>
  );
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}
