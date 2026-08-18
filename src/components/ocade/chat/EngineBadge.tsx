import { Cpu, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngineStatusView } from "./chat-types";

/**
 * OCADE engine badge. The only successful inference locality is this device.
 */
export function EngineBadge({
  status,
  className,
  onClick,
}: {
  status: EngineStatusView;
  className?: string;
  onClick?: () => void;
}) {
  const local = status.locality === "local";
  const Icon = status.preparing ? Loader2 : local ? Cpu : TriangleAlert;
  const tone = status.preparing
    ? "text-muted-foreground"
    : local
      ? "text-[color:var(--state-success)]"
      : "text-[color:var(--state-warning)]";
  const text = status.preparing ? "Preparing local engine" : local ? "On this device" : status.label;
  const title =
    status.detail ??
    (local
      ? "AI answers are generated on this device. No cloud-model fallback exists."
      : "No on-device AI engine is ready. OCADE will not send the request to a cloud model.");

  const content = (
    <>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", tone, status.preparing && "animate-spin")} aria-hidden />
      <span className="truncate">{text}</span>
      {local && !status.preparing ? (
        <ShieldCheck className="h-3 w-3 shrink-0 text-[color:var(--state-success)]" aria-label="local-only" />
      ) : null}
    </>
  );
  const shared = cn(
    "inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[12px] font-medium text-foreground backdrop-blur",
    className,
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={title} className={cn(shared, "transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1")}>
      {content}
    </button>
  ) : (
    <span className={shared} title={title}>{content}</span>
  );
}
