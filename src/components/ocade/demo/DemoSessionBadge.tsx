import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRemaining, type DemoSessionState } from "@/lib/demo/session";

/**
 * The demo clock.
 *
 * Present without being loud. A countdown that pulses, reddens and grows is a
 * pressure device, and the product's own charter rules out artificial urgency —
 * so this stays a quiet chip until the last three minutes, when the information
 * genuinely changes what the visitor should do.
 *
 * The progress ring is drawn from the same `elapsedFraction` the session state
 * computes, so the ring and the words can never disagree.
 */
export function DemoSessionBadge({
  session,
  className,
}: {
  session: DemoSessionState;
  className?: string;
}) {
  if (session.phase === "idle") return null;

  const ending = session.phase === "ending" || session.phase === "expired";
  const circumference = 2 * Math.PI * 7;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium tabular-nums transition-colors",
        ending
          ? "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]"
          : "border-border/60 bg-secondary/40 text-muted-foreground",
        className,
      )}
      /*
       * Announced politely and only when it changes phase — a live region that
       * re-read every second would make a screen reader unusable. The label
       * carries the full sentence; the visual chip carries the short form.
       */
      role="status"
      aria-live="polite"
      aria-label={`Demo session: ${formatRemaining(session.remainingMs)}`}
      title="Your demo session. Nothing here is saved."
    >
      {ending ? (
        <Timer className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <svg className="h-4 w-4 -rotate-90" viewBox="0 0 18 18" aria-hidden>
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth="2"
          />
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * session.elapsedFraction}
          />
        </svg>
      )}
      <span aria-hidden>{formatRemaining(session.remainingMs)}</span>
    </span>
  );
}
