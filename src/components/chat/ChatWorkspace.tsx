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
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { useSession } from "@/lib/session";
import { useChat, type IntelligenceChoice } from "@/lib/chat/use-chat";
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
  useEffect(() => {
    if (!startNew) return;
    newConversation();
    setDraft("");
    void navigate({ to: "/", search: {}, replace: true });
  }, [startNew, newConversation, navigate]);

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
    await chat.send(message, choice);
  }

  const empty = chat.messages.length === 0 && chat.streaming.length === 0;
  const signedOut = !loading && !user;

  return (
    <AppShell
      sidebarExtra={
        user ? (
          <ConversationList
            conversations={chat.conversations}
            activeId={chat.conversationId}
            loading={chat.loadingConversations}
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
          />
        )}

        <div className={cn("px-5", empty ? "flex flex-1 flex-col justify-center pb-24" : "pb-6")}>
          <div className="mx-auto w-full max-w-3xl">
            {empty ? (
              <h1 className="mb-6 text-center text-[28px] font-semibold tracking-tight text-foreground">
                Ask OCADE
              </h1>
            ) : null}
            <div className="glass rounded-2xl px-4 pb-3 pt-4">
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
                placeholder="Ask anything"
                className="ocade-scroll max-h-60 w-full resize-none bg-transparent px-1 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              />

              <div className="mt-2 flex items-center gap-1">
                <IconButton
                  label="Add an attachment"
                  disabled
                  title="Attachments arrive with Library"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </IconButton>

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

                  <IconButton label="Dictate" disabled title="Dictation is not available yet">
                    <Mic className="h-4 w-4" aria-hidden />
                  </IconButton>

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
                {chat.problem}
              </p>
            ) : signedOut ? (
              <p className="mt-3 text-center text-[13px] text-muted-foreground">
                Sending needs an account. Your message is kept while you sign in.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function IconButton({
  label,
  children,
  disabled,
  title,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={disabled ? title : label}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
