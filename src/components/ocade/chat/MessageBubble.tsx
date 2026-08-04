import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Copy,
  Check,
  Pencil,
  RefreshCw,
  CornerDownRight,
  GitBranch,
  Volume2,
  Bookmark,
  Trash2,
  AlertTriangle,
  RotateCcw,
  FileText,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessageView, MessageActions } from "./chat-types";

/**
 * One turn of the conversation.
 *
 * THREE DECISIONS WORTH STATING
 *
 * 1. **Actions are always in the DOM, not conditionally mounted.** They fade in
 *    on hover, but they are reachable by keyboard at all times. Hover-only
 *    controls that do not exist until the pointer arrives are unusable without
 *    a mouse, and this is where most chat interfaces quietly fail.
 * 2. **A failed message keeps its text and offers a real retry.** Losing what
 *    you wrote because the engine hiccuped is the single most infuriating
 *    thing a chat app can do.
 * 3. **The streaming turn gets a caret, not a spinner.** A spinner says "wait";
 *    a caret on live text says "this is happening", which is what is true.
 */

function ActionButton({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition",
        "hover:bg-accent hover:text-foreground",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        destructive && "hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ActionButton
      label={copied ? "Copied" : "Copy message"}
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            // Reverts on its own: a button stuck on "Copied" stops telling the
            // truth the moment the clipboard changes again.
            window.setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => setCopied(false));
      }}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[color:var(--state-success)]" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </ActionButton>
  );
}

function Attachments({ items }: { items: NonNullable<ChatMessageView["attachments"]> }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {items.map((a, i) => {
        const isImage = a.kind === "image" && a.dataUrl;
        return isImage ? (
          <img
            key={`${a.name}-${i}`}
            src={a.dataUrl}
            alt={a.name}
            className="max-h-44 rounded-lg border border-border/60 object-cover"
          />
        ) : (
          <span
            key={`${a.name}-${i}`}
            className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[12px] text-muted-foreground"
          >
            {a.kind === "image" ? (
              <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span className="truncate">{a.name}</span>
          </span>
        );
      })}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  actions,
  showTimestamp,
  renderMarkdown = true,
  density = "comfortable",
}: {
  message: ChatMessageView;
  actions: MessageActions;
  showTimestamp?: boolean;
  renderMarkdown?: boolean;
  density?: "comfortable" | "compact";
}) {
  const isUser = message.role === "user";
  const time = showTimestamp ? formatTime(message.createdAt) : null;

  const rowActions = (
    <div
      className={cn(
        "flex items-center gap-0.5 transition-opacity",
        // Visible on hover and on keyboard focus. Never removed from the tree.
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        isUser && "justify-end",
      )}
    >
      {message.content ? <CopyButton text={message.content} /> : null}
      {actions.onEdit ? (
        <ActionButton label="Edit and resend" onClick={() => actions.onEdit?.(message)}>
          <Pencil className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
      {actions.onRegenerate ? (
        <ActionButton label="Regenerate answer" onClick={() => actions.onRegenerate?.(message)}>
          <RefreshCw className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
      {actions.onContinue ? (
        <ActionButton label="Continue this answer" onClick={() => actions.onContinue?.(message)}>
          <CornerDownRight className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
      {actions.onBranch ? (
        <ActionButton label="Branch from here" onClick={() => actions.onBranch?.(message)}>
          <GitBranch className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
      {actions.onSpeak ? (
        <ActionButton label="Read aloud" onClick={() => actions.onSpeak?.(message)}>
          <Volume2 className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
      {actions.onSave ? (
        <ActionButton label="Save this answer" onClick={() => actions.onSave?.(message)}>
          <Bookmark className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
      {actions.onDelete ? (
        <ActionButton
          label="Delete message"
          destructive
          onClick={() => actions.onDelete?.(message)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ActionButton>
      ) : null}
    </div>
  );

  if (isUser) {
    return (
      <article
        className={cn("group flex flex-col items-end", density === "compact" ? "gap-1" : "gap-1.5")}
        aria-label="Your message"
      >
        {time ? <span className="text-[11px] text-muted-foreground">{time}</span> : null}
        <div className="max-w-[min(46rem,88%)] rounded-2xl rounded-br-md bg-secondary/80 px-4 py-2.5 text-[14.5px] leading-relaxed text-foreground">
          {message.attachments ? <Attachments items={message.attachments} /> : null}
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        {rowActions}
      </article>
    );
  }

  return (
    <article
      className={cn("group flex flex-col", density === "compact" ? "gap-1" : "gap-1.5")}
      aria-label="OCADE reply"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-ocade)]">
          OCADE
        </span>
        {message.engineLabel ? (
          <span className="text-[11px] text-muted-foreground">{message.engineLabel}</span>
        ) : null}
        {time ? <span className="text-[11px] text-muted-foreground">{time}</span> : null}
      </div>

      {message.attachments ? <Attachments items={message.attachments} /> : null}

      {message.content ? (
        <div className="max-w-[min(52rem,100%)] text-[14.5px] leading-[1.7] text-foreground">
          {renderMarkdown ? (
            <div className="prose prose-sm prose-invert max-w-none break-words [&_code]:text-[13px] [&_h1]:mt-4 [&_h2]:mt-4 [&_li]:my-0.5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:rounded-lg">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px]">
              {message.content}
            </pre>
          )}
          {message.streaming ? (
            <span
              className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-[color:var(--accent-ocade)]"
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}

      {message.error ? (
        <div
          role="alert"
          className="flex max-w-[min(52rem,100%)] items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-foreground">{message.error}</p>
            {actions.onRetry ? (
              <button
                type="button"
                onClick={() => actions.onRetry?.(message)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[12px] font-medium text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!message.streaming ? rowActions : null}
    </article>
  );
});

/** Local time, or nothing. "Invalid Date" in a transcript looks like a crash. */
function formatTime(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
