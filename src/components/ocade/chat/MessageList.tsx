import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessageView, MessageActions } from "./chat-types";

/**
 * The transcript.
 *
 * THE SCROLL RULE, which is the only hard part of a chat transcript:
 * follow the newest text ONLY while the reader is already at the bottom. The
 * moment they scroll up to re-read something, streaming must stop yanking them
 * back down. Almost every chat interface gets this wrong in one direction or
 * the other — either it never follows, or it follows so aggressively you cannot
 * read the previous answer while the next one arrives.
 *
 * When the reader has scrolled away, a "jump to latest" control appears, so
 * the behaviour is discoverable rather than a mystery.
 */

const AT_BOTTOM_SLACK_PX = 80;

/**
 * BOUNDED RENDERING.
 *
 * A long conversation used to mount every message forever, and each one parses
 * Markdown, highlights code and renders receipts. Past a few hundred turns the
 * composer itself starts to lag, because every keystroke re-renders a tree that
 * never stops growing.
 *
 * Windowing from the END rather than measuring pixel offsets is deliberate.
 * These rows have wildly variable heights (a one-word reply and a 300-line code
 * block), so an absolutely-positioned virtualiser needs measurement caches that
 * fight with streaming content and destroy scroll anchoring mid-answer. Keeping
 * a recent slice in normal document flow keeps the browser's own scroll
 * anchoring — which is what makes bottom-follow feel right — and bounds the
 * work. Older turns stay one click away and are never lost.
 */
const WINDOW_SIZE = 60;
const WINDOW_STEP = 60;

export function MessageList({
  messages,
  actions,
  showTimestamps,
  renderMarkdown,
  density = "comfortable",
  emptyState,
  renderFooter,
  conversationKey,
}: {
  messages: ChatMessageView[];
  actions: MessageActions;
  showTimestamps?: boolean;
  renderMarkdown?: boolean;
  density?: "comfortable" | "compact";
  emptyState?: React.ReactNode;
  /** Rendered under each message. Used for the answer receipt. */
  renderFooter?: (message: ChatMessageView) => React.ReactNode;
  /**
   * Identity of the conversation being shown. The window resets when this
   * changes. Passing the real conversation id matters: the first message's id
   * was a stand-in, and it changes whenever older history is PREPENDED — which
   * would collapse the window back to the newest 60 exactly when the reader
   * had just asked for more.
   */
  conversationKey?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  // Track whether the reader is at the bottom. The nearest scrollable ancestor
  // is the shell's main region, so it is resolved rather than assumed.
  useEffect(() => {
    const el = scrollerRef.current?.closest("main");
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setPinned(distance <= AT_BOTTOM_SLACK_PX);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const lastContent = messages.at(-1)?.content ?? "";
  useEffect(() => {
    if (!pinned) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastContent, pinned]);

  const jump = () => {
    setPinned(true);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  /*
   * The window resets when the conversation changes — switching chats should
   * not inherit "show earlier" from the one before it — but NOT when the same
   * conversation grows or gains older history. `conversationKey` is the real
   * identity; the first message's id is only a fallback for callers that have
   * no id to give (the demo builds its transcript in memory).
   */
  const identity = conversationKey ?? messages[0]?.id;
  const [limit, setLimit] = useState(WINDOW_SIZE);
  useEffect(() => setLimit(WINDOW_SIZE), [identity]);

  const hidden = Math.max(0, messages.length - limit);
  const visible = hidden > 0 ? messages.slice(hidden) : messages;

  if (messages.length === 0 && emptyState) {
    return <div ref={scrollerRef}>{emptyState}</div>;
  }

  return (
    <div ref={scrollerRef} className="relative">
      {hidden > 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
          <button
            type="button"
            onClick={() => setLimit((n) => n + WINDOW_STEP)}
            className="w-full rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show earlier messages ({hidden} above)
          </button>
        </div>
      ) : null}
      <ol
        className={cn(
          "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6",
          density === "compact" ? "space-y-4" : "space-y-7",
        )}
      >
        {visible.map((message) => (
          <li key={message.id}>
            <MessageBubble
              message={message}
              actions={actions}
              showTimestamp={showTimestamps}
              renderMarkdown={renderMarkdown}
              density={density}
            />
            {/*
              A render slot rather than a receipt-shaped prop. The transcript
              should not know what a provenance receipt is — the signed-in chat
              and the demo attach different things here, and a component that
              named one of them would have to grow a branch for each.
            */}
            {renderFooter?.(message)}
          </li>
        ))}
      </ol>
      <div ref={endRef} className="h-px" aria-hidden />

      {!pinned ? (
        <button
          type="button"
          onClick={jump}
          className="sticky bottom-4 left-1/2 z-10 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 text-[12px] font-medium text-foreground shadow-lg transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
