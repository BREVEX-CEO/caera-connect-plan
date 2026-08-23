import { Cpu, Cloud, CloudOff, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngineStatusView } from "./chat-types";

/**
 * Where this conversation's answers come from.
 *
 * This badge is the product's central privacy claim rendered as one small
 * control, so it never says anything it cannot back:
 *
 *  - "On this device" appears only when a local engine is actually serving.
 *    It is the strongest claim OCADE makes and the easiest to get wrong.
 *  - "Cloud" is stated plainly rather than softened. A user who has not
 *    noticed they left the device is the failure this badge exists to prevent.
 *  - While the engine is still being fetched it says so, because a badge that
 *    reads "ready" during a download is a lie with a two-minute lifespan.
 *
 * Offline is shown as a STATE, not an error: with a local engine, being
 * offline changes nothing at all, and OCADE should look confident about that.
 */
export function EngineBadge({
  status,
  className,
  onClick,
}: {
  status: EngineStatusView;
  className?: string;
  /** Opens engine settings. Omitted where there is nowhere to go. */
  onClick?: () => void;
}) {
  const local = status.locality === "local";
  const Icon = status.preparing ? Loader2 : local ? Cpu : status.online ? Cloud : CloudOff;

  const tone = status.preparing
    ? "text-muted-foreground"
    : local
      ? "text-[color:var(--state-success)]"
      : status.online
        ? "text-[color:var(--state-info)]"
        : "text-[color:var(--state-warning)]";

  const text = status.preparing
    ? "Preparing engine"
    : local
      ? "On this device"
      : status.online
        ? status.label
        : "Offline";

  const title =
    status.detail ??
    (local
      ? "Answers are generated on this computer. Nothing is sent anywhere."
      : status.online
        ? "This engine is reachable and answering."
        : "No engine is reachable right now.");

  const content = (
    <>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", tone, status.preparing && "animate-spin")}
        aria-hidden
      />
      <span className="truncate">{text}</span>
      {local && !status.preparing ? (
        <ShieldCheck
          className="h-3 w-3 shrink-0 text-[color:var(--state-success)]"
          aria-label="private"
        />
      ) : null}
    </>
  );

  const shared = cn(
    "inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[12px] font-medium text-foreground backdrop-blur",
    className,
  );

  if (!onClick) {
    return (
      <span className={shared} title={title}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        shared,
        "transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      {content}
    </button>
  );
}
