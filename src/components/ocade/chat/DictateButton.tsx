import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DictationState } from "@/lib/voice/use-dictation";

/**
 * The microphone.
 *
 * FOUR STATES, FOUR APPEARANCES, and the difference matters because a
 * microphone that looks identical whether or not it is recording is the single
 * most alarming control a product can ship:
 *
 *   unsupported — struck through, disabled, with the reason on hover.
 *   idle        — plain.
 *   listening   — a live ring, so "the microphone is open" is unmistakable.
 *   hearing     — the ring animates, because words are arriving.
 *
 * The ring is drawn rather than animated with a shadow so it stays visible
 * under `prefers-reduced-motion`, where the pulse is dropped but the ring is
 * not. Losing the recording indicator to a motion preference would be a
 * privacy failure dressed as an accessibility feature.
 */
export function DictateButton({
  state,
  supported,
  error,
  onToggle,
  languageLabel,
  className,
}: {
  state: DictationState;
  supported: boolean;
  error: string | null;
  onToggle: () => void;
  /** Shown in the tooltip, so it is obvious which language is being heard. */
  languageLabel: string;
  className?: string;
}) {
  const active = state === "listening" || state === "hearing";

  const title = !supported
    ? "This browser has no speech input. Chrome, Edge and Safari support it."
    : error
      ? error
      : active
        ? `Listening in ${languageLabel} — click to stop`
        : `Dictate in ${languageLabel}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!supported}
      aria-label={active ? "Stop dictating" : "Dictate a message"}
      aria-pressed={active}
      title={title}
      className={cn(
        // shrink-0 because flexbox will happily squash a 36px icon button to 20px
        // on a narrow screen, and it did: measured 20x28 at 390px wide.
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !supported && "cursor-not-allowed text-muted-foreground/40",
        supported && !active && "text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-[color:var(--state-danger)]/12 text-[color:var(--state-danger)]",
        className,
      )}
    >
      {!supported ? (
        <MicOff className="h-4 w-4" aria-hidden />
      ) : state === "hearing" ? (
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
      ) : (
        <Mic className="h-4 w-4" aria-hidden />
      )}

      {active ? (
        <>
          {/* Always drawn: the "we are recording" signal must not depend on
              motion being allowed. */}
          <span
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[color:var(--state-danger)]/60"
            aria-hidden
          />
          {/* The pulse is the part that is decorative, so it is the part that
              respects the preference. */}
          <span
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[color:var(--state-danger)]/40 motion-safe:animate-ping"
            aria-hidden
          />
        </>
      ) : null}
    </button>
  );
}
