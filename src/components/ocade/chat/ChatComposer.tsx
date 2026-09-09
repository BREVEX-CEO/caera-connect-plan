import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  FolderOpen,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isDecodableBinary } from "@/lib/ocade-decoders";
import {
  DOCUMENT_RETAIN_MAX_CHARS,
  clampForContext,
  classifyFile,
  extractBinaryDocument,
  extractDocument,
  isNativeTextKind,
  type ExtractResult,
} from "@/lib/ocade-documents";
import { describeScan, scanUntrustedContent } from "@/lib/ocade-injection-guard";
import { getOcadeModel } from "@/lib/ocade-models";
import { useChatPrefs } from "@/lib/use-chat-prefs";
import { cn } from "@/lib/utils";
import { dragCarriesFiles, dragDepthAfter } from "./composer-drop";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MODES,
  fileToDataUrl,
  type Attachment,
  type PermissionMode,
} from "./conversation-model";

/**
 * THE COMPOSER OCADE ACTUALLY SHIPS.
 *
 * There were two. This one lived inside the Chat route, five hundred lines
 * down a six-thousand-line file, and it is the one a person types into: it
 * carries the mode and model pickers, the permission selector, hold-to-talk
 * dictation, prompt improvement, regeneration, saving an extracted document
 * into a project, and the on-device document reading that keeps a raw file
 * from ever being uploaded. The other was a standalone `ChatComposer` that
 * nothing rendered and only tests imported — a second answer to "what does the
 * composer do", kept alive by its own test suite.
 *
 * `PLAN.md` Phase 1 allows one authority per subsystem, so the shipped one
 * took the shared name and the unshipped one is gone. What the unshipped one
 * genuinely owned survives: the drag rules it had split into
 * `composer-drop.ts` are now what this uses, instead of the near-identical
 * inline copy it had grown separately.
 *
 * The control people touch most, so it earns the most care:
 *
 *  - **It grows with the text and then stops.** A box that grows without limit
 *    pushes the conversation off screen; one that never grows hides what you
 *    are writing.
 *  - **Send becomes Stop, in the same place.** Moving the button when
 *    generation starts means the click meant to send lands on whatever took
 *    its place.
 *  - **Attachments are removable before sending.** Attaching the wrong file
 *    with no way back is a small thing that feels awful.
 *  - **A screenshot can be pasted and a file can be dropped.** Win+Shift+S then
 *    Ctrl+V is how most people send a picture to an assistant. Dropping also
 *    has to be handled for a harder reason: without a drop handler the browser
 *    NAVIGATES AWAY to the dropped file, and the conversation and draft go
 *    with it.
 */
export function Composer(props: {
  draft: string;
  setDraft: (v: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  onSubmit: () => void;
  /**
   * Cancel the in-flight response. OPTIONAL on purpose: a surface that has
   * nothing cancellable must omit it rather than pass a no-op, because the Stop
   * button is only rendered when a real handler exists. A required prop forced
   * `onStop={() => {}}` on the home composer, which put a red Stop button on
   * screen that did nothing when clicked.
   */
  onStop?: () => void;
  /** Something is in flight. With `onStop`, shows Stop; without it, disables Send. */
  streaming: boolean;
  permission: PermissionMode;
  setPermission: (p: PermissionMode) => void;
  model: string;
  setModel: (m: string) => void;
  chatsMode: "browser_only" | "pc_vault" | "private_sync";
  onImprove?: () => void;
  improving?: boolean;
  onToggleVoice?: () => void;
  listening?: boolean;
  onRegenerate?: () => void;
  floating?: boolean;
  projectAssigned?: boolean;
  onSaveAttachmentToProject?: (attachment: Attachment) => Promise<void>;
  /**
   * Called on the first keystroke. Optional because a surface with no local
   * engine has nothing to warm, and a required no-op prop is how dead
   * handlers get introduced.
   */
  onTypingStarted?: () => void;
}) {
  const {
    draft,
    setDraft,
    attachments,
    setAttachments,
    onSubmit,
    onStop,
    streaming,
    permission,
    setPermission,
    model,
    setModel,
    chatsMode,
    onImprove,
    improving,
    onToggleVoice,
    listening,
    onRegenerate,
    floating,
    projectAssigned,
    onSaveAttachmentToProject,
    onTypingStarted,
  } = props;
  const modelInfo = getOcadeModel(model);
  // Read directly rather than threaded through props: the composer is mounted
  // from two different screens and this is a per-browser display preference,
  // not conversation state either caller owns.
  const { prefs: composerPrefs } = useChatPrefs();
  const sendKey = composerPrefs.sendKey;
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  // React may not rerender between pointer-down and pointer-up on a short
  // press, so remember whether this gesture started recognition.
  const voiceHoldStartedRef = useRef(false);
  // And when it started, so a click can be told from a hold.
  const voicePressStartedAtRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  // The counter lives in `composer-drop.ts` with the rest of the drag rules,
  // which is where it is tested; this only holds the running total.
  const dragDepth = useRef(0);

  async function handleFiles(files: FileList | null, imagesOnly: boolean) {
    if (!files) return;
    const next: Attachment[] = [...attachments];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name}: exceeds 20 MB limit`);
        continue;
      }
      if (imagesOnly && !f.type.startsWith("image/")) continue;
      const isImage = f.type.startsWith("image/");
      const dataUrl = isImage ? await fileToDataUrl(f) : undefined;

      // Read readable documents on-device and extract text (Plan §18). The raw
      // file is never uploaded — only the extracted text becomes model context.
      let extractedText: string | undefined;
      let extractNote: string | undefined;
      // Hoisted so the extraction metadata survives past this block — the
      // citation locator is derived from it.
      let result: ExtractResult | undefined;
      if (!isImage) {
        const kind = classifyFile(f.name, f.type);
        // PDF / DOCX / XLSX are decoded on-device by the real decoders; text
        // formats are read directly. Either way the raw file stays local.
        if (isDecodableBinary(kind)) {
          /*
           * A large PDF or workbook can take seconds to decode on-device. The
           * decoder has always honoured an AbortSignal, but nothing passed one,
           * so "Stop" was unreachable and the user had to wait it out.
           */
          const controller = new AbortController();
          const toastId = toast.loading(`${f.name}: reading on your device…`, {
            action: { label: "Stop", onClick: () => controller.abort() },
            duration: Infinity,
          });
          try {
            result = await extractBinaryDocument(
              {
                name: f.name,
                mime: f.type,
                sizeBytes: f.size,
                buffer: await f.arrayBuffer(),
              },
              controller.signal,
            );
          } finally {
            toast.dismiss(toastId);
          }
          // A cancelled read adds nothing at all — not an errored attachment.
          if (result.status === "cancelled") {
            toast.info(`${f.name}: ${result.reason ?? "Reading was cancelled."}`);
            continue;
          }
        } else {
          const content = isNativeTextKind(kind) ? await f.text() : undefined;
          result = extractDocument({
            name: f.name,
            mime: f.type,
            sizeBytes: f.size,
            content,
          });
        }
        if (result.status === "ok" && result.text) {
          // Retain the whole document so retrieval can search all of it. The
          // send budget is applied later, to the passages retrieval chose.
          extractedText = clampForContext(result.text, DOCUMENT_RETAIN_MAX_CHARS).text;
          // File contents are untrusted input: warn immediately if the document
          // tries to issue instructions (Plan §31). It is wrapped as data on send.
          const scan = scanUntrustedContent(extractedText);
          if (scan.risk === "high") {
            toast.warning(`${f.name}: ${describeScan(scan)}`);
          } else {
            toast.success(`${f.name}: read on your device and added as context.`);
          }
        } else {
          extractNote = result.reason;
          toast.info(`${f.name}: attached. ${result.reason ?? "No text could be read."}`);
        }
      }

      next.push({
        kind: isImage ? "image" : "file",
        name: f.name,
        mime: f.type || "application/octet-stream",
        sizeBytes: f.size,
        dataUrl,
        extractedText,
        extractNote,
        // Carry the clamped text inside the result so the citation index and
        // the model context are built from exactly the same string.
        extract: result ? { ...result, text: extractedText ?? result.text } : undefined,
      });
    }
    setAttachments(next);
  }

  return (
    <div
      data-testid="composer-dropzone"
      className={cn(
        "relative rounded-xl border border-border/70 bg-card/80 shadow-sm backdrop-blur",
        floating && "shadow-md",
        dragging && "border-primary/70",
      )}
      /*
       * Dropping a file onto the composer.
       *
       * Without this the browser NAVIGATES AWAY to the dropped file — the
       * conversation is gone and the draft with it. That is the real reason
       * every drop target here calls preventDefault, not the overlay.
       */
      onDragEnter={(e) => {
        if (!dragCarriesFiles(e.dataTransfer?.types)) return;
        e.preventDefault();
        dragDepth.current = dragDepthAfter(dragDepth.current, "enter");
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!dragCarriesFiles(e.dataTransfer?.types)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = dragDepthAfter(dragDepth.current, "leave");
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        const files = e.dataTransfer?.files;
        if (!files?.length) return;
        e.preventDefault();
        dragDepth.current = dragDepthAfter(dragDepth.current, "drop");
        setDragging(false);
        if (streaming) {
          toast.error("Wait for the current reply to finish before adding files.");
          return;
        }
        // Same path as the Attach button: one place decides the size limit, the
        // attachment count, and what gets read on this device.
        void handleFiles(files, false);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/70 bg-background/85 text-[13px] font-medium text-foreground">
          <Paperclip className="mr-2 h-4 w-4" aria-hidden />
          Drop to attach — files are read on this device
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-3 py-2">
          {attachments.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-[11px]"
            >
              {a.kind === "image" ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              <span className="max-w-[160px] truncate">{a.name}</span>
              {a.extractedText && onSaveAttachmentToProject ? (
                <button
                  type="button"
                  onClick={() => void onSaveAttachmentToProject(a)}
                  title="Save extracted text to this project"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Save className="h-3 w-3" />
                  <span className="sr-only">Save {a.name} to project</span>
                </button>
              ) : null}
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Textarea
        id="ocade-chat-composer"
        /*
         * NAMED, NOT JUST PLACEHELD. The box carried only a placeholder, and a
         * placeholder is not an accessible name: a screen reader announced the
         * product's primary control as "edit text, blank". The visible hint
         * still states which key sends, and this states what the box is.
         */
        aria-label="Message OCADE"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          // Typing is the first honest signal that a message is coming. Warm
          // the on-device engine now so the send does not pay a cold start.
          onTypingStarted?.();
        }}
        /*
         * Pasting a screenshot.
         *
         * This is how most people send an image to an assistant — Win+Shift+S,
         * then Ctrl+V — and without it the paste dropped a filename or nothing
         * at all into the box. Text pastes are left entirely alone: the guard
         * is on `files.length`, so ordinary copy-paste keeps the browser's own
         * behaviour including undo.
         */
        onPaste={(e) => {
          const files = e.clipboardData?.files;
          if (!files || files.length === 0) return;
          e.preventDefault();
          if (streaming) {
            toast.error("Wait for the current reply to finish before adding files.");
            return;
          }
          void handleFiles(files, false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          /*
           * Settings › Chat › Sending messages. Someone who writes long
           * multi-paragraph prompts loses them constantly to an Enter that
           * sends, so the choice is theirs — and the placeholder below states
           * whichever one is in force rather than a fixed sentence that would
           * be wrong half the time.
           */
          if (sendKey === "mod_enter") {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              onSubmit();
            }
            return;
          }
          if (!e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={2}
        placeholder={
          sendKey === "mod_enter"
            ? "Ask OCADE or describe an outcome…  (Ctrl+Enter to send, Enter for newline)"
            : "Ask OCADE or describe an outcome…  (Enter to send, Shift+Enter for newline)"
        }
        className="min-h-[52px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0"
        disabled={streaming}
      />

      <div className="flex flex-wrap items-center gap-1 border-t border-border/60 px-2 py-1.5">
        {/* Left cluster: attachments / voice */}
        <ComposerIcon
          title="Attach files (max 10, 20 MB each)"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
        </ComposerIcon>
        <input
          aria-label="Attach files"
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files, false);
            e.currentTarget.value = "";
          }}
        />
        <ComposerIcon title="Attach images" onClick={() => imageRef.current?.click()}>
          <Sparkles className="h-3.5 w-3.5" />
        </ComposerIcon>
        <input
          aria-label="Attach images"
          ref={imageRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files, true);
            e.currentTarget.value = "";
          }}
        />
        {onToggleVoice ? (
          /*
           * Push-to-talk AND click-to-toggle — which it did not actually do.
           *
           * Hold is the privacy-safer default: the microphone stops the moment
           * you let go, so walking away can never leave it live. A plain toggle
           * on its own has exactly that failure mode. That part was right.
           *
           * What was wrong is that there was no threshold between the two.
           * `pointerdown` started recognition and `pointerup` stopped it, so a
           * CLICK — press and release inside a few milliseconds — started the
           * microphone and stopped it again before a word could be said. The
           * tooltip promised "click to toggle" and clicking could never toggle;
           * the only path that did was `onClick` with `detail === 0`, which is
           * keyboard activation. On a touch screen, where every interaction is
           * a tap, the control was therefore inert, and inert in the way that
           * looks broken rather than unavailable.
           *
           * A release inside HOLD_TO_TALK_MS is a click: recognition stays on.
           * A release after it is the end of a hold: recognition stops. Both
           * sentences in the tooltip are now true, on every input device.
           */
          <ComposerIcon
            title={
              listening
                ? "Release to stop — or click to toggle"
                : "Hold to talk, or click to toggle"
            }
            onPointerDown={() => {
              voicePressStartedAtRef.current = Date.now();
              voiceHoldStartedRef.current = !listening;
              if (!listening) onToggleVoice();
            }}
            onPointerUp={() => {
              const held = Date.now() - voicePressStartedAtRef.current;
              if (voiceHoldStartedRef.current) {
                voiceHoldStartedRef.current = false;
                // Long enough to be a hold: releasing ends it. Short enough to
                // be a click: leave it listening for the next press to stop.
                if (held >= HOLD_TO_TALK_MS) onToggleVoice();
                return;
              }
              // The microphone was already open when this press began, so this
              // press is the one that closes it.
              if (listening) onToggleVoice();
            }}
            onPointerLeave={() => {
              // Dragging off mid-hold must not strand the microphone open.
              if (voiceHoldStartedRef.current) {
                voiceHoldStartedRef.current = false;
                onToggleVoice();
              }
            }}
            onPointerCancel={() => {
              if (voiceHoldStartedRef.current) {
                voiceHoldStartedRef.current = false;
                onToggleVoice();
              }
            }}
            // Keyboard users get the toggle: Enter/Space fire click, and there
            // is no reliable key-hold equivalent that does not repeat.
            onClick={(e) => {
              // Pointer already handled it; only act for real keyboard activation.
              if (e.detail === 0) onToggleVoice();
            }}
            active={listening}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </ComposerIcon>
        ) : null}

        {/* Project assignment is managed on the live Projects surface. */}
        <Link
          to="/ocade/projects"
          title="Manage this conversation's project"
          className="ml-1 hidden items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground/70 sm:inline-flex"
        >
          <FolderOpen className="h-3 w-3" />{" "}
          {projectAssigned ? "Project assigned" : "Choose project"}
        </Link>

        {/* Permission mode */}
        <Select value={permission} onValueChange={(v) => setPermission(v as PermissionMode)}>
          <SelectTrigger className="ml-1 hidden h-7 w-[128px] border-border/60 bg-background/40 text-[11px] sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual" className="text-xs">
              Manual
            </SelectItem>
            <SelectItem value="assisted" className="text-xs">
              Assisted
            </SelectItem>
            <SelectItem value="autonomous" className="text-xs">
              Autonomous with approval
            </SelectItem>
          </SelectContent>
        </Select>

        {/*
          The model picker stood here and listed a dozen hosted models. It
          cannot mean anything now: generation happens on this device whatever
          is selected, so the control would persist a value and change nothing.
          The engine OCADE is actually running is shown on /ocade/models, which
          is a page about the engine rather than a dropdown pretending to
          choose one.
        */}

        {/* Privacy indicator */}
        <span
          className="ml-1 hidden items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline-flex"
          title={`Storage mode: ${chatsMode}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {chatsMode === "private_sync"
            ? "Private sync"
            : chatsMode === "pc_vault"
              ? "PC vault"
              : "Browser only"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {onImprove ? (
            <button
              onClick={onImprove}
              disabled={improving || streaming || !draft.trim()}
              title="Improve prompt"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {improving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Improve
            </button>
          ) : null}
          {onRegenerate ? (
            <ComposerIcon title="Retry in a new branch" onClick={onRegenerate}>
              <RefreshCcw className="h-3.5 w-3.5" />
            </ComposerIcon>
          ) : null}
          {/* Stop is offered ONLY when there is a real handler to cancel with. */}
          {streaming && onStop ? (
            <button
              onClick={onStop}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-destructive/90 px-2.5 text-[11px] font-medium text-destructive-foreground hover:bg-destructive"
            >
              <Square className="h-3 w-3" /> Stop
            </button>
          ) : (
            <button
              onClick={onSubmit}
              /* While something is in flight with nothing to cancel, Send is
                 disabled — honest "working" feedback, not a fake Stop. */
              disabled={streaming || (!draft.trim() && attachments.length === 0)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
            >
              <Send className="h-3 w-3" /> Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * How long a press has to last before releasing it counts as ending a hold.
 *
 * Below this it is a click, and a click toggles. Chosen well above a fast tap
 * (~80-150ms) and well below the point where somebody holding to speak would
 * have finished a word.
 */
const HOLD_TO_TALK_MS = 400;

function ComposerIcon({
  children,
  title,
  onClick,
  active,
  ...pointer
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
} & Pick<
  React.ComponentPropsWithoutRef<"button">,
  "onPointerDown" | "onPointerUp" | "onPointerLeave" | "onPointerCancel"
>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...pointer}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "relative inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
        // Holding to talk must not select surrounding text or fire the OS
        // touch-and-hold menu.
        "select-none touch-none",
        /*
         * OPEN MICROPHONE, UNMISTAKABLY.
         *
         * The ring is drawn OUTSIDE `motion-safe`, deliberately. The pulse is
         * decoration and respects `prefers-reduced-motion`; the ring is the
         * indicator that says a microphone is listening, and losing that to an
         * accessibility preference would be a privacy failure wearing an
         * accessibility badge.
         */
        active && "text-destructive ring-2 ring-destructive/60",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inline-flex h-7 w-7 rounded-md bg-destructive/25 motion-safe:animate-ping"
        />
      ) : null}
      {children}
    </button>
  );
}
