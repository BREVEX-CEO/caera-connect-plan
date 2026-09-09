import { useState } from "react";
import { EyeOff } from "lucide-react";
import { INCOGNITO_CLAIMS, INCOGNITO_SUMMARY, INCOGNITO_TITLE } from "@/lib/chat/incognito";

/**
 * WHAT AN INCOGNITO CONVERSATION IS, WHILE YOU ARE IN ONE — PLAN.md §8.
 *
 * Above the transcript rather than tucked into a menu, because the whole value
 * of the mode is that somebody KNOWS which one they are in. A privacy mode a
 * person is not sure they are in is a privacy mode they will act as if they are
 * not in.
 *
 * Both halves are shown. The four promises are what people came for; the three
 * limits are the ones somebody might otherwise assume away, and the middle one
 * — that the provider answering an online request keeps its own records — is
 * the only sentence on this screen that could get somebody into trouble if it
 * were left out.
 */
export function IncognitoBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[13px]"
      role="status"
      aria-label="Incognito conversation"
    >
      <div className="flex flex-wrap items-center gap-2">
        <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground">{INCOGNITO_TITLE}</span>
        <span className="min-w-0 text-muted-foreground">{INCOGNITO_SUMMARY}</span>
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs text-foreground underline underline-offset-2 hover:bg-accent/40"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {open ? "Hide the detail" : "What this does and does not do"}
        </button>
      </div>
      {open ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-foreground">What OCADE does</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {INCOGNITO_CLAIMS.kept.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">What it does not do</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {INCOGNITO_CLAIMS.notKept.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
