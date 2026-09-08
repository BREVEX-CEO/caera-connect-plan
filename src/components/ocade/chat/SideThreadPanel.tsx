import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Loader2, MessageSquareQuote, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SideMessage } from "@/lib/chat/side-conversations";

/**
 * A SIDE CONVERSATION, RENDERED UNDER ITS ANCHOR — PLAN.md §8.
 *
 * The whole point of the feature is spatial: the question and its answer sit
 * BESIDE one message, visibly not part of the thread. So this is deliberately
 * not a message bubble and not a modal.
 *
 *  - Not a bubble, because a side question drawn like a turn is a turn as far
 *    as the reader is concerned, and they would reasonably expect it to be in
 *    the transcript they read back tomorrow. The indent, the rule down the left
 *    and the muted type say "annotation" the way a margin note does.
 *  - Not a modal, because the answer is about the passage above it. Covering
 *    the passage to ask about it is the one thing a reader cannot afford, and
 *    modals also lose the reader's place in a long transcript.
 *
 * A COLLAPSED THREAD STILL SHOWS THAT IT EXISTS. Someone who asked a side
 * question yesterday must be able to find it, and a control that hides its own
 * content with no trace is how notes get lost.
 */
export function SideThreadPanel({
  thread,
  open,
  busy,
  stream,
  onAsk,
  onOpen,
  onClose,
  onDiscard,
}: {
  thread: readonly SideMessage[];
  open: boolean;
  busy: boolean;
  /** The answer as it arrives. Not yet a turn — see the chat surface. */
  stream?: string;
  onAsk: (question: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onDiscard: () => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /*
   * Focus follows the disclosure, because the control that opens this panel is
   * a one-line icon button in a hover row: a keyboard user who activates it and
   * lands nowhere has been given a panel they cannot reach without hunting for
   * it. Focus moves only when the panel OPENS, never on every render, so it
   * does not steal the caret back while somebody is reading the answer.
   */
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onAsk(text);
  };

  if (!open) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpen}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-card/30 px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageSquareQuote className="h-3 w-3" aria-hidden />
          {thread.length === 1 ? "1 side question" : `${thread.length} messages in a side question`}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <section aria-label="Side question" className="mt-2 border-l-2 border-border/70 pl-3">
        <header className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-muted-foreground">
            {/*
              Stated, not implied. The guarantee this feature makes is that the
              side question stays out of the conversation, and a guarantee the
              user has to infer from the layout is one they will not rely on.
            */}
            Side question — kept out of this conversation
          </p>
          <div className="flex items-center gap-1">
            {thread.length > 0 ? (
              <button
                type="button"
                onClick={onDiscard}
                title="Discard this side question. The conversation is unchanged."
                className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                <span className="sr-only">Discard this side question</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden />
              <span className="sr-only">Close the side question</span>
            </button>
          </div>
        </header>

        {thread.length > 0 ? (
          <ol className="mt-2 space-y-2">
            {thread.map((message) => (
              <li
                key={message.id}
                className={cn(
                  "text-[13px] leading-relaxed whitespace-pre-wrap",
                  message.role === "user" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {message.content}
              </li>
            ))}
          </ol>
        ) : null}

        {busy ? (
          <p
            className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground"
            aria-live="polite"
          >
            {/*
              The partial answer IS the progress indicator once text starts
              arriving. A spinner shown next to visible text tells the reader
              nothing they cannot already see.
            */}
            {stream ? (
              stream
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Answering…
              </span>
            )}
          </p>
        ) : null}

        <div className="mt-2 flex items-end gap-1.5">
          <label className="sr-only" htmlFor="side-question-input">
            Ask a side question about this message
          </label>
          <textarea
            id="side-question-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the same contract as
              // the main composer. A side question that behaved differently
              // would be a second, contradictory rule for the same gesture.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              // Escape closes without discarding: leaving is not deleting.
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Ask about this message…"
            disabled={busy}
            className="min-h-8 w-full resize-none rounded-md border border-border/60 bg-background/60 px-2 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !draft.trim()}
            title="Ask"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <CornerDownLeft className="h-3 w-3" aria-hidden />
            Ask
          </button>
        </div>
      </section>
    </div>
  );
}
