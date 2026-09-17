/**
 * THE PRODUCT HOME.
 *
 * One centred column, one composer, one history list in the shell's sidebar.
 * The screen this replaces was 4,519 lines and carried a context tray, a side
 * thread panel, an answer receipt panel, an answer diff, a conversation
 * integrity strip, an incognito banner, an engine badge, a second chat search
 * and a wall of suggestion chips.
 *
 * What survives is what `docs/UI UX Brief.md` asks for: `Ask OCADE`, an
 * attachment control, a microphone, a send button, and a compact selector that
 * shows only Auto, OCADE and Offline. Everything it knows comes from
 * `useChat`; this file renders and does not decide.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowLeft, ArrowRight, Mic, Plus, Square, X } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { useSession } from "@/lib/session";
import { useChat, type IntelligenceChoice } from "@/lib/chat/use-chat";
import { useChatShortcuts } from "@/lib/chat/use-shortcuts";
import { useDictation } from "@/lib/chat/use-dictation";
import {
  MAX_ATTACHMENTS,
  forRequest,
  readAttachment,
  type PendingAttachment,
} from "@/lib/chat/attachments";
import {
  describeReset,
  tightestWindow,
  useCommercialUsage,
} from "@/lib/commercial/use-commercial-usage";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";
import { cn } from "@/lib/utils";

const CHOICES: { id: IntelligenceChoice; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "ocade", label: "OCADE" },
  { id: "offline", label: "Offline" },
];

/**
 * A message written before signing in is held here, in this tab, and sent once
 * afterwards. `docs/APP_FLOW.md` is explicit that it must be neither discarded
 * nor duplicated.
 */
const PENDING_KEY = "ocade:pending-message:v1";

export function ChatWorkspace() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const chat = useChat();
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState<IntelligenceChoice>("auto");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  /*
   * Dictation appends rather than replaces, so speaking after typing continues
   * the sentence. The composer grows to fit on the next frame the same way it
   * does for a keystroke.
   */
  const dictation = useDictation((said) => {
    setDraft((current) => (current ? `${current.trimEnd()} ${said}` : said));
    window.setTimeout(grow, 0);
  });
  const queryClient = useQueryClient();

  /*
   * A held message comes back to the composer on every visit, not only after a
   * successful sign-in. The restore used to be gated on `user`, which lost the
   * message in the case that actually happens: somebody presses Send, decides
   * not to sign in, and comes back to Chat.
   *
   * It is removed from storage when it is SENT, so it is neither discarded nor
   * sent twice.
   */
  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem(PENDING_KEY);
      if (pending) setDraft((current) => (current.length > 0 ? current : pending));
    } catch {
      /* Storage can be blocked; the composer still works. */
    }
  }, [user]);

  /*
   * NEW CHAT ACTUALLY STARTS ONE.
   *
   * The sidebar link navigates to `/?new=true`, and nothing was listening: the
   * URL changed, the open conversation stayed on screen, and the next message
   * was appended to it. `useChat` had `newConversation` the whole time and no
   * caller. Found by the online journey, which needed a clean transcript to
   * tell a refusal apart from the answer above it.
   *
   * The parameter is consumed and removed, so a reload is not a second reset.
   */
  const startNew = useRouterState({
    select: (state) => (state.location.search as { new?: unknown }).new === true,
  });
  const newConversation = chat.newConversation;

  useChatShortcuts({
    composer: () => textarea.current,
    onNewChat: () => {
      newConversation();
      setDraft("");
    },
  });

  useEffect(() => {
    if (!startNew) return;
    newConversation();
    setDraft("");
    void navigate({ to: "/", search: {}, replace: true });
  }, [startNew, newConversation, navigate]);

  /*
   * `+` ATTACHES THE FILE TO THE QUESTION, AND KEEPS IT IN THE LIBRARY.
   *
   * It used to do only the second half: a person attached a spreadsheet, OCADE
   * said it was saved, and the answer was written as though no file existed.
   * The file now rides with the question — labelled, so the answer can say
   * which file a figure came from — and it is still in Library afterwards,
   * because that is where somebody looks for it later.
   */
  async function attach(files: File[]) {
    const room = MAX_ATTACHMENTS - pending.length;
    if (room <= 0) return;

    const accepted = files.slice(0, room);
    const reading: PendingAttachment[] = accepted.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
      state: "reading",
    }));
    setPending((current) => [...current, ...reading]);

    await Promise.all(
      accepted.map(async (file, index) => {
        const id = reading[index]!.id;
        const read = await readAttachment(file, id);
        setPending((current) => current.map((entry) => (entry.id === id ? read : entry)));
        if (read.state !== "ready") return;

        /*
         * Library is a copy, not the path to the model. It is best-effort on
         * purpose: a Library write that fails must not stop a person asking
         * their question about a file OCADE has already read.
         */
        try {
          const { addLibraryItem } = await import("@/lib/library/library.functions");
          await addLibraryItem({
            data: {
              name: file.name,
              mime: read.mime,
              kind: read.image ? "image" : "file",
              source: "upload",
              conversationId: chat.conversationId,
              contentBase64: read.image ?? btoa(unescape(encodeURIComponent(read.text ?? ""))),
            },
          });
          void queryClient.invalidateQueries({ queryKey: ["library", "items"] });
        } catch {
          /* The attachment still reaches the question. */
        }
      }),
    );
  }

  function grow() {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }

  async function send() {
    const message = draft.trim();
    if (!message) return;

    if (!user) {
      try {
        window.sessionStorage.setItem(PENDING_KEY, message);
      } catch {
        /* The draft stays in the composer either way. */
      }
      void navigate({ to: "/auth", search: { next: "/" } });
      return;
    }

    setDraft("");
    if (textarea.current) textarea.current.style.height = "auto";
    try {
      window.sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* Nothing to recover: the message is on its way. */
    }
    const carried = forRequest(pending);
    const held = pending;
    setPending([]);
    /*
     * A REFUSED SEND GIVES THE QUESTION BACK.
     *
     * The composer used to clear on the way in, so an exhausted allowance or an
     * unreachable gate took the typed question and its attachments with it —
     * the person watched a toast fade and had nothing left to press Send on.
     * Nothing was sent, written or charged, so the work is still theirs.
     */
    if (await chat.send(message, choice, carried)) return;
    setDraft((current) => (current.length > 0 ? current : message));
    setPending((current) => (current.length > 0 ? current : held));
    window.setTimeout(grow, 0);
  }

  const empty = chat.messages.length === 0 && chat.streaming.length === 0;
  const signedOut = !loading && !user;
  const lastQuestionId =
    [...chat.messages].reverse().find((message) => message.role === "user")?.id ?? null;
  const rejected = pending.find((attachment) => attachment.state === "rejected");

  return (
    <AppShell
      sidebarExtra={
        user ? (
          <ConversationList
            conversations={chat.conversations}
            activeId={chat.conversationId}
            loading={chat.loadingConversations}
            failed={chat.conversationsFailed}
            onRetry={() => void chat.reloadConversations()}
            onOpen={chat.openConversation}
            onRename={chat.rename}
            onArchive={(id) => chat.setArchived(id, true)}
            onTrash={chat.trash}
          />
        ) : null
      }
    >
      <div className="flex h-[calc(100vh-3rem)] flex-col md:h-screen">
        {/*
          EMPTY IS ONE CENTRED GROUP, NOT A HEADING ADRIFT FROM A COMPOSER PINNED
          TO THE FLOOR. The reference puts the question and the thing you answer
          it with together, slightly above the middle; once there is a
          conversation the composer drops to the bottom where it belongs.
        */}
        {empty ? null : (
          <MessageList
            messages={chat.messages}
            streaming={chat.streaming}
            loading={chat.loadingMessages}
            busy={chat.busy}
            onResend={(id, text) => void chat.resend(id, choice, text)}
            onRemove={(id) => void chat.removeMessage(id)}
          />
        )}

        <div className={cn("px-5", empty ? "flex flex-1 flex-col justify-center pb-24" : "pb-6")}>
          <div className="mx-auto w-full max-w-3xl">
            {empty ? (
              <h1 className="mb-6 text-center text-[28px] font-semibold tracking-tight text-foreground">
                Ask OCADE
              </h1>
            ) : null}
            <div
              className={cn(
                "glass rounded-2xl px-4 pb-3 pt-4 transition-shadow",
                dragging && "ring-1 ring-foreground/30",
              )}
              onDragOver={(event) => {
                if (!user) return;
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const files = [...(event.dataTransfer.files ?? [])];
                if (files.length > 0 && user) void attach(files);
              }}
            >
              {pending.length > 0 ? (
                <AttachmentTray
                  attachments={pending}
                  onRemove={(id) =>
                    setPending((current) => current.filter((entry) => entry.id !== id))
                  }
                  onMove={(id, by) =>
                    setPending((current) => {
                      const at = current.findIndex((entry) => entry.id === id);
                      const to = at + by;
                      if (at < 0 || to < 0 || to >= current.length) return current;
                      const next = [...current];
                      const [moved] = next.splice(at, 1);
                      next.splice(to, 0, moved!);
                      return next;
                    })
                  }
                />
              ) : null}

              <label className="sr-only" htmlFor="ocade-composer">
                Message OCADE
              </label>
              <textarea
                id="ocade-composer"
                ref={textarea}
                rows={1}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  grow();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                onPaste={(event) => {
                  // A screenshot pasted into the composer is a file, and the
                  // person expects it to become one rather than nothing.
                  const files = [...(event.clipboardData.files ?? [])];
                  if (files.length > 0 && user) {
                    event.preventDefault();
                    void attach(files);
                  }
                }}
                placeholder="Ask anything"
                className="ocade-scroll max-h-60 w-full resize-none bg-transparent px-1 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              />

              <div className="mt-2 flex items-center gap-1">
                <IconButton
                  label="Attach a file"
                  disabled={!user || pending.length >= MAX_ATTACHMENTS}
                  title={user ? "Attach a file to this question" : "Sign in to attach a file"}
                  onClick={() => picker.current?.click()}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </IconButton>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  className="hidden"
                  aria-label="Attach files"
                  onChange={(event) => {
                    const files = [...(event.target.files ?? [])];
                    event.target.value = "";
                    if (files.length > 0) void attach(files);
                  }}
                />

                <div className="ml-auto flex items-center gap-1">
                  <div className="mr-1 flex rounded-md border border-border p-0.5">
                    {CHOICES.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setChoice(entry.id)}
                        aria-pressed={choice === entry.id}
                        className={cn(
                          "h-6 rounded px-2 text-xs transition-colors",
                          choice === entry.id
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>

                  {dictation.supported ? (
                    <IconButton
                      label={dictation.listening ? "Stop dictating" : "Dictate"}
                      title={dictation.listening ? "Stop dictating" : "Dictate"}
                      onClick={dictation.toggle}
                    >
                      <Mic
                        className={cn("h-4 w-4", dictation.listening && "text-foreground")}
                        aria-hidden
                      />
                    </IconButton>
                  ) : null}

                  {chat.busy ? (
                    <button
                      type="button"
                      onClick={chat.stop}
                      aria-label="Stop"
                      className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-secondary-foreground transition-opacity hover:opacity-90"
                    >
                      <Square className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={draft.trim().length === 0}
                      aria-label="Send"
                      className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/*
              ONE LINE, AND ONLY ONE OF THEM AT A TIME. A failure and a
              sign-in prompt stacked together is two instructions for a person
              who has not managed to do one thing yet.
            */}
            {chat.problem ? (
              <p className="mt-3 text-center text-[13px] text-foreground" role="alert">
                {chat.problem}{" "}
                {/*
                  RETRY IS REGENERATE ON THE LAST QUESTION. A failed generation
                  leaves the question in the transcript and no answer under it,
                  so the thing to try again is already identified.
                */}
                {lastQuestionId ? (
                  <button
                    type="button"
                    disabled={chat.busy}
                    onClick={() => void chat.resend(lastQuestionId, choice)}
                    className="text-foreground underline underline-offset-2 disabled:opacity-40"
                  >
                    Try again
                  </button>
                ) : null}
              </p>
            ) : rejected ? (
              <p className="mt-3 text-center text-[13px] text-muted-foreground" role="status">
                {rejected.name}: {rejected.reason}
              </p>
            ) : signedOut ? (
              <p className="mt-3 text-center text-[13px] text-muted-foreground">
                Sending needs an account. Your message is kept while you sign in.
              </p>
            ) : (
              <LowAllowanceNotice signedIn={Boolean(user)} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * A QUIET WARNING BEFORE THE ALLOWANCE RUNS OUT, AND A TRUTHFUL ONE AFTER.
 *
 * Nothing at all until the last few requests, because a meter that shouts at
 * twenty-eight remaining is a meter people stop reading by the time it matters.
 * The full breakdown lives under Settings; this is one line.
 */
const LOW_ALLOWANCE = 3;

function LowAllowanceNotice({ signedIn }: { signedIn: boolean }) {
  const usage = useCommercialUsage(signedIn);
  const window = tightestWindow(usage.data);
  if (!window || window.remaining > LOW_ALLOWANCE) return null;

  return (
    <p className="mt-3 text-center text-[13px] text-muted-foreground" role="status">
      {window.remaining === 0
        ? `You have used this ${window.kind === "week" ? "week" : "session"}'s allowance. It resets ${describeReset(window.resetsInMs)}.`
        : `${window.remaining} request${window.remaining === 1 ? "" : "s"} left · resets ${describeReset(window.resetsInMs)}`}{" "}
      {/* The way out of the limit, next to the limit. Nowhere else on this
          screen would a person look for it. */}
      <Link to="/pricing" className="text-foreground underline underline-offset-2">
        See plans
      </Link>
    </p>
  );
}

/**
 * WHAT IS ABOUT TO GO WITH THE QUESTION.
 *
 * Order matters to the model, so it is something a person can change; a file
 * OCADE cannot read says so here rather than after the answer comes back
 * without it.
 */
function AttachmentTray({
  attachments,
  onRemove,
  onMove,
}: {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
}) {
  return (
    <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Attached files">
      {attachments.map((attachment, at) => (
        <li
          key={attachment.id}
          className={cn(
            "flex items-center gap-1 rounded-md border border-border/60 py-1 pl-2 pr-1 text-xs",
            attachment.state === "rejected" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          <span className="max-w-40 truncate" title={attachment.reason ?? attachment.name}>
            {attachment.name}
          </span>
          {attachment.state === "reading" ? (
            <span className="text-muted-foreground">reading…</span>
          ) : null}
          {attachment.state === "rejected" ? (
            <span className="text-muted-foreground">can&rsquo;t read</span>
          ) : null}
          {attachments.length > 1 ? (
            <>
              <TrayButton
                label={`Move ${attachment.name} earlier`}
                disabled={at === 0}
                onClick={() => onMove(attachment.id, -1)}
              >
                <ArrowLeft className="h-3 w-3" aria-hidden />
              </TrayButton>
              <TrayButton
                label={`Move ${attachment.name} later`}
                disabled={at === attachments.length - 1}
                onClick={() => onMove(attachment.id, 1)}
              >
                <ArrowRight className="h-3 w-3" aria-hidden />
              </TrayButton>
            </>
          ) : null}
          <TrayButton label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment.id)}>
            <X className="h-3 w-3" aria-hidden />
          </TrayButton>
        </li>
      ))}
    </ul>
  );
}

function TrayButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  children,
  disabled,
  title,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
