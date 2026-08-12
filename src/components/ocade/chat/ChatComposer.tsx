import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, X, FileText, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatAttachmentView, EngineStatusView } from "./chat-types";
import { EngineBadge } from "./EngineBadge";
import { dragCarriesFiles, dragDepthAfter, acceptsFiles } from "./composer-drop";
import { ComposerMenu } from "./ComposerMenu";
import { DictateButton } from "./DictateButton";
import type { DictationState } from "@/lib/voice/use-dictation";

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
 *  - **A screenshot can be pasted and a file can be dropped.** Win+Shift+S then
 *    Ctrl+V is how most people send a picture to an assistant; requiring the
 *    file dialog for it makes the product feel a decade old. Dropping also has
 *    to be handled for a harder reason: without a drop handler the browser
 *    NAVIGATES AWAY to the dropped file and the conversation and draft are gone.
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
  /** Start a new conversation, offered inside the + menu. */
  onNewChat?: () => void;
  /** Capture a URL, offered inside the + menu. */
  onAddLink?: () => void;
  /**
   * False on the demo, where text chat is fully open but anything that stores a
   * file needs an account. The + menu answers with a sign-in prompt rather than
   * greying the item out — see ComposerMenu.
   */
  signedIn?: boolean;
  /**
   * Dictation wiring. Absent means no microphone is offered at all, which is
   * correct for a surface that cannot accept speech — an always-present button
   * that never works is worse than none.
   */
  dictation?: {
    state: DictationState;
    supported: boolean;
    error: string | null;
    toggle: () => void;
    languageLabel: string;
  };
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
  onNewChat,
  onAddLink,
  signedIn = true,
  dictation,
  onTypingStarted,
  children,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const typedOnce = useRef(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  /*
   * dragenter/dragleave fire for every child the pointer crosses, so a plain
   * boolean flickers the overlay off as soon as the cursor moves over the
   * textarea inside the zone. Counting is the only way to know it really left.
   */
  const dragDepth = useRef(0);

  const acceptDropped = (files: FileList | null) => {
    if (
      !acceptsFiles({
        hasHandler: !!onAddFiles,
        disabled,
        streaming,
        fileCount: files?.length ?? 0,
      })
    ) {
      return;
    }
    // Same entry point as the Attach button, so the size limit, the count and
    // what gets read on this device are decided in exactly one place.
    onAddFiles!(files, false);
  };

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
        data-testid="composer-dropzone"
        className={cn(
          "relative rounded-2xl border bg-card/80 shadow-sm backdrop-blur transition",
          focused ? "border-[color:var(--accent-ocade)]/50 shadow-md" : "border-border/70",
          dragging && "border-primary/70",
        )}
        onDragEnter={(e) => {
          if (!onAddFiles || !dragCarriesFiles(e.dataTransfer?.types)) return;
          e.preventDefault();
          dragDepth.current = dragDepthAfter(dragDepth.current, "enter");
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!onAddFiles || !dragCarriesFiles(e.dataTransfer?.types)) return;
          // Without preventDefault here the drop never fires and the browser
          // opens the file instead, taking the conversation with it.
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          dragDepth.current = dragDepthAfter(dragDepth.current, "leave");
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          if (!onAddFiles) return;
          e.preventDefault();
          dragDepth.current = dragDepthAfter(dragDepth.current, "drop");
          setDragging(false);
          acceptDropped(e.dataTransfer?.files ?? null);
        }}
      >
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/70 bg-background/85 text-[13px] font-medium text-foreground">
            <Paperclip className="mr-2 h-4 w-4" aria-hidden />
            Drop to attach — read on this device
          </div>
        ) : null}

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
          onPaste={(e) => {
            const files = e.clipboardData?.files;
            // Guarded on files only: an ordinary text paste keeps the browser's
            // own behaviour, including undo, which preventDefault would break.
            if (!files || files.length === 0) return;
            e.preventDefault();
            acceptDropped(files);
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
              {/*
                One + rather than a growing row of icons. It opens UPWARD so it
                never covers the message being written — see ComposerMenu.
              */}
              <ComposerMenu
                onNewChat={onNewChat}
                onUploadFile={() => fileRef.current?.click()}
                onUploadImage={() => imageRef.current?.click()}
                onAddLink={onAddLink}
                imageDisabledReason={imageDisabledReason}
                signedIn={signedIn}
              />
            </>
          ) : null}

          {dictation ? (
            <DictateButton
              state={dictation.state}
              supported={dictation.supported}
              error={dictation.error}
              onToggle={dictation.toggle}
              languageLabel={dictation.languageLabel}
            />
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
