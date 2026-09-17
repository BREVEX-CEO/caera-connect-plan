import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { Check, Copy, Paperclip, Pencil, RefreshCw, Trash2 } from "lucide-react";
import type { ChatMessageRecord } from "@/lib/ocade-chat-store";
import { cn } from "@/lib/utils";

/**
 * The transcript.
 *
 * A question is a compact bubble and an answer is plain prose across the
 * column, because that is what each one is: the question is a thing somebody
 * said and the answer is something to read. Giving both the same bubble makes
 * a long answer a wall.
 *
 * ONLY A REAL ANSWER GETS CONTROLS. `docs/PRD.md` forbids rendering a failed
 * request as a reply with controls beside it, so Copy and Regenerate appear on
 * a finished assistant message and on nothing else.
 */
export function MessageList({
  messages,
  streaming,
  loading,
  failed,
  onRetryLoad,
  busy,
  onResend,
  onRemove,
}: {
  messages: ChatMessageRecord[];
  streaming: string;
  loading: boolean;
  /** The transcript read failed. An empty conversation is a different thing. */
  failed: boolean;
  onRetryLoad: () => void;
  busy: boolean;
  /** Edit, Regenerate and Retry all arrive here, naming the question to re-ask. */
  onResend: (userMessageId: string, newText?: string) => void;
  onRemove: (id: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);

  // Follows the answer as it arrives, and lands on the last turn when a
  // conversation is opened.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, streaming]);

  return (
    <div className="ocade-scroll flex-1 overflow-y-auto px-5 pt-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Opening this conversation…
          </p>
        ) : null}

        {failed ? (
          <div role="alert">
            <p className="text-sm text-muted-foreground">This conversation could not be opened.</p>
            <button
              type="button"
              onClick={onRetryLoad}
              className="mt-1 text-sm text-foreground underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        ) : null}

        {messages.map((message, at) => (
          <Turn
            key={message.id}
            message={message}
            busy={busy}
            // The question this answer came from, so Regenerate on an answer
            // re-asks rather than needing its own idea of the history.
            questionId={message.role === "user" ? message.id : questionBefore(messages, at)}
            onResend={onResend}
            onRemove={onRemove}
          />
        ))}

        {streaming ? (
          <div className="text-[15px] leading-7 text-foreground">
            <Prose text={streaming} />
          </div>
        ) : null}

        <div ref={bottom} className="h-2" />
      </div>
    </div>
  );
}

/** The last question at or before `at`, or null when the answer has no question. */
function questionBefore(messages: ChatMessageRecord[], at: number): string | null {
  for (let index = at - 1; index >= 0; index -= 1) {
    if (messages[index]!.role === "user") return messages[index]!.id;
  }
  return null;
}

function Turn({
  message,
  busy,
  questionId,
  onResend,
  onRemove,
}: {
  message: ChatMessageRecord;
  busy: boolean;
  questionId: string | null;
  onResend: (userMessageId: string, newText?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  if (message.role === "user") {
    if (editing) {
      return (
        <div className="flex justify-end">
          <div className="w-full max-w-[85%]">
            <label className="sr-only" htmlFor={`edit-${message.id}`}>
              Edit this message
            </label>
            <textarea
              id={`edit-${message.id}`}
              autoFocus
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="ocade-scroll w-full resize-none rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-6 text-secondary-foreground outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
                className="h-8 rounded-md px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || draft.trim().length === 0}
                onClick={() => {
                  setEditing(false);
                  onResend(message.id, draft);
                }}
                className="h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Send edit
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex flex-col items-end">
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-6 text-secondary-foreground",
            message.unsynced && "opacity-70",
          )}
        >
          {/*
            WHAT THE ANSWER WAS ALLOWED TO READ, shown beside the question
            rather than only in Library. An answer that cites a file is only
            checkable if the transcript says which files went with it.
          */}
          {message.attachments.length > 0 ? (
            <ul className="mb-1.5 flex flex-wrap gap-1" aria-label="Files sent with this message">
              {message.attachments.map((attachment) => (
                <li key={`${attachment.name}-${attachment.sizeBytes}`}>
                  {/*
                    The chip leads to Library, which is the one place that owns
                    a customer's files and already offers preview and download.
                    A second downloader here would be a second copy of the file
                    and a second set of permissions to get right.
                  */}
                  <Link
                    to="/library"
                    title={`Open ${attachment.name} in your Library`}
                    className="flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Paperclip className="h-3 w-3" aria-hidden />
                    <span className="max-w-40 truncate">{attachment.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {message.content}
          {message.unsynced ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              Waiting to be saved to your account.
            </span>
          ) : null}
        </div>
        <Controls>
          <Action label="Copy" icon={Copy} onClick={() => copy(message.content)} />
          <Action
            label="Edit"
            icon={Pencil}
            disabled={busy}
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
          />
          <Action label="Delete" icon={Trash2} onClick={() => onRemove(message.id)} />
        </Controls>
      </div>
    );
  }

  return (
    <div className="group text-[15px] leading-7 text-foreground">
      <Prose text={message.content} />
      <Controls>
        <Action label="Copy" icon={Copy} onClick={() => copy(message.content)} />
        {questionId ? (
          <Action
            label="Regenerate"
            icon={RefreshCw}
            disabled={busy}
            onClick={() => onResend(questionId)}
          />
        ) : null}
        <Action label="Delete" icon={Trash2} onClick={() => onRemove(message.id)} />
      </Controls>
    </div>
  );
}

/**
 * The row under a turn.
 *
 * Hidden until the turn is hovered or something in it has focus, so a long
 * conversation is prose rather than a list of toolbars — and reachable by
 * keyboard regardless, which `focus-within` is what buys.
 */
function Controls({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </div>
  );
}

function Action({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function copy(text: string): void {
  void navigator.clipboard?.writeText(text);
}

/**
 * Markdown, with no HTML plugin and no syntax-highlighting bundle.
 *
 * `react-markdown` escapes HTML by default, which is the property that matters
 * here: a model's output is untrusted text, and a plugin that rendered raw HTML
 * would make every answer a place to put a script tag.
 */
function Prose({ text }: { text: string }) {
  return (
    <div className="[&_a]:text-foreground [&_a]:underline [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:mt-5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-medium [&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_pre]:ocade-scroll [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-secondary [&_pre]:p-3 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_td]:border [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown components={{ pre: CodeBlock }}>{text}</Markdown>
    </div>
  );
}

/**
 * A code block with its own Copy.
 *
 * Copying a whole answer to get one command is how people end up pasting three
 * paragraphs of prose into a terminal. The text comes from the rendered node
 * rather than from the Markdown source, so what is copied is exactly what is
 * on screen.
 */
function CodeBlock({ children, ...rest }: React.ComponentProps<"pre">) {
  const block = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="group/code relative mt-3">
      <pre {...rest} ref={block}>
        {children}
      </pre>
      <button
        type="button"
        aria-label="Copy code"
        title="Copy code"
        onClick={() => {
          copy(block.current?.innerText ?? "");
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-background/70 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
