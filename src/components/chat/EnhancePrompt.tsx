import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { enhancePrompt, type Enhancement } from "@/lib/chat/enhance-prompt";
import { cn } from "@/lib/utils";

/**
 * THE SPARKLE AT THE COMPOSER'S BOTTOM LEFT (plan 14E.2; UX-06, UX-13, UX-25, UX-34).
 *
 * Pressed, it asks for a clearer version of the draft and shows it beside the original with any
 * detail it dropped. Apply puts it in the composer (Restore puts the original back); Keep mine
 * closes it. Typing while it works discards the answer, so a suggestion never overwrites newer
 * keystrokes. It never sends, starts a task or changes a setting.
 */
export function EnhancePrompt({
  draft,
  onApply,
  disabled,
  surface = "chat",
}: {
  draft: string;
  onApply: (text: string) => void;
  disabled?: boolean;
  surface?: "chat" | "jarvis";
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Enhancement | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const asked = useRef<{ draft: string; controller: AbortController } | null>(null);

  // Typing invalidates a suggestion that is still coming, and one that is shown.
  useEffect(() => {
    if (asked.current && asked.current.draft !== draft) {
      asked.current.controller.abort();
      asked.current = null;
      setPending(false);
      setResult(null);
    }
  }, [draft]);

  const ask = async () => {
    if (!draft.trim() || pending) return;
    const controller = new AbortController();
    asked.current = { draft, controller };
    setPending(true);
    setResult(null);
    const answer = await enhancePrompt(draft, controller.signal, surface);
    if (asked.current?.controller !== controller) return; // stale: the draft changed
    setPending(false);
    setResult(answer);
  };

  const apply = (text: string) => {
    setOriginal(draft);
    asked.current = null;
    setResult(null);
    onApply(text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void ask()}
        disabled={disabled || !draft.trim()}
        aria-label="Enhance prompt"
        title="Enhance prompt: suggest a clearer version (it is not sent)"
        aria-busy={pending}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
          pending && "text-foreground motion-safe:animate-pulse",
        )}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
      </button>
      {original !== null && !result && !pending ? (
        <button
          type="button"
          onClick={() => {
            onApply(original);
            setOriginal(null);
          }}
          className="h-6 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Restore original
        </button>
      ) : null}
      {pending ? (
        <span role="status" className="text-xs text-muted-foreground">
          Suggesting a clearer version…
        </span>
      ) : null}
      {result ? (
        <div
          role="dialog"
          aria-label="Suggested prompt"
          className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-lg border border-border bg-background p-3 shadow-lg motion-safe:transition-opacity"
        >
          {result.state === "suggested" ? (
            <>
              <p className="text-xs text-muted-foreground">Suggested (not sent)</p>
              <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-sm text-foreground">
                {result.text}
              </p>
              {result.lost.length ? (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  Your draft had these, and the suggestion does not: {result.lost.join(", ")}. Check
                  before applying.
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => apply(result.text)}
                  className="h-7 rounded-md border border-border px-2 text-xs text-foreground hover:bg-accent"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => void ask()}
                  className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Keep mine
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p role="alert" className="text-xs text-muted-foreground">
                {result.reason}
              </p>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
