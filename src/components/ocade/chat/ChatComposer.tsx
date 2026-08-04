import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Paperclip, ImagePlus, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatAttachmentView, EngineStatusView } from "./chat-types";
import { EngineBadge } from "./EngineBadge";

/**
 * The composer.
 *
 * This is the control people touch most, so it earns the most care:
 *
 *  - **It grows with the text and then stops.** A box that grows without limit
 *    eventually pushes the conversation off screen; one that never grows hides
 *    what you are writing. It expands to roughly eight lines and scrolls.
 *  - **Send becomes Stop, in the same place.** Moving the button when
 *    generation starts means the click that was meant to send lands on
 *    whatever took its place.
 *  - **The send key is the user's choice** and the hint below states whichever
 *    is in force, rather than a fixed sentence that is wrong for half of them.
 *  - **Attachments are removable before sending.** Attaching the wrong file and
 *    having no way back is a small thing that feels awful.
 */

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Present only when there is something real to cancel. */
  onStop?: () => void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  attachments?: ChatAttachmentView[];
  onAddFiles?: (files: FileList | null, imagesOnly: boolean) => void;
  onRemoveAttachment?: (index: number) => void;
  /** Disabled with a stated reason rather than hidden, when vision is absent. */
  imageDisabledReason?: string | null;
  engine?: EngineStatusView;
  onOpenEngineSettings?: () => void;
  sendKey?: "enter" | "mod_enter";
  /** Fired on the first keystroke, so the engine can warm while they type. */
  onTypingStarted?: () => void;
  /** Rendered above the input — quick prompts, warnings, anything contextual. */
  children?: React.ReactNode;
}

const MAX_ROWS_PX = 200;

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming = false,
  disabled = false,
  placeholder,
  attachments = [],
  onAddFiles,
  onRemoveAttachment,
  imageDisabledReason,
  engine,
  onOpenEngineSettings,
  sendKey = "enter",
  onTypingStarted,
  children,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const typedOnce = useRef(false);
  const [focused, setFocused] = useState(false);

  // Auto-grow to a ceiling, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [value]);

  const canSend = !disabled && !streaming && (value.trim().length > 0 || attachments.length > 0);
  const hint =
    sendKey === "mod_enter"
      ? "Ctrl+Enter to send · Enter for a new line"
      : "Enter to send · Shift+Enter for a new line";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      {children}

      <div
        className={cn(
          "rounded-2xl border bg-card/80 shadow-sm backdrop-blur transition",
          focused ? "border-[color:var(--accent-ocade)]/50 shadow-md" : "border-border/70",
        )}
      >
        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 border-b border-border/60 p-2.5">
            {attachments.map((a, index) => (
              <li
                key={`${a.name}-${index}`}
                className="group relative inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 py-1 pl-2 pr-1.5 text-[12px]"
              >
                {a.kind === "image" && a.dataUrl ? (
                  <img src={a.dataUrl} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="truncate text-foreground">{a.name}</span>
                {onRemoveAttachment ? (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(index)}
                    aria-label={`Remove ${a.name}`}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <label htmlFor="ocade-composer" className="sr-only">
          Message OCADE
        </label>
        <textarea
          id="ocade-composer"
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={disabled}
          placeholder={placeholder ?? "Message OCADE…"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!typedOnce.current) {
              typedOnce.current = true;
              onTypingStarted?.();
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (sendKey === "mod_enter") {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (canSend) onSubmit();
              }
              return;
            }
            if (!e.shiftKey) {
              e.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          className="max-h-[200px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          {onAddFiles ? (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="sr-only"
                aria-label="Attach files"
                onChange={(e) => {
                  onAddFiles(e.target.files, false);
                  e.target.value = "";
                }}
              />
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Attach images"
                onChange={(e) => {
                  onAddFiles(e.target.files, true);
                  e.target.value = "";
                }}
              />
              <ComposerIcon label="Attach a file" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </ComposerIcon>
              <ComposerIcon
                label={imageDisabledReason ?? "Attach an image"}
                disabled={!!imageDisabledReason}
                onClick={() => imageRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
              </ComposerIcon>
            </>
          ) : null}

          <div className="mx-1 min-w-0 flex-1">
            {engine ? <EngineBadge status={engine} onClick={onOpenEngineSettings} /> : null}
          </div>

          {streaming && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-[13px] font-medium text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              aria-label="Send message"
              title={canSend ? "Send message" : "Write a message first"}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-xl transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                canSend
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ComposerIcon({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // The label IS the reason when disabled, so no control is ever grey and
      // silent — that is the no-dead-button rule at the smallest scale.
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        disabled &&
          "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
