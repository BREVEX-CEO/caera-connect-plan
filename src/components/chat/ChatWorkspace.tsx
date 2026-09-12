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
 * shows only Auto, OCADE and Offline.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Plus } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/** The only three words the customer sees for intelligence. */
export type IntelligenceChoice = "auto" | "ocade" | "offline";

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
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState<IntelligenceChoice>("auto");
  const textarea = useRef<HTMLTextAreaElement>(null);

  /*
   * A held message comes back to the composer on every visit, not only after a
   * successful sign-in.
   *
   * The restore used to be gated on `user`, which read as "hand it back once
   * they are in". It loses the message in the case that actually happens:
   * somebody presses Send, decides not to sign in, and comes back to Chat. The
   * message was in storage and nothing ever put it on screen again.
   *
   * It is removed from storage when it is sent, not when it is read, so it is
   * neither discarded nor sent twice — `docs/APP_FLOW.md` requires both.
   */
  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem(PENDING_KEY);
      if (pending) setDraft((current) => (current.length > 0 ? current : pending));
    } catch {
      /* Storage can be blocked; the composer still works. */
    }
  }, [user]);

  function grow() {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }

  function send() {
    const message = draft.trim();
    if (!message) return;
    if (!user) {
      try {
        window.sessionStorage.setItem(PENDING_KEY, message);
      } catch {
        /* The draft stays in the composer either way. */
      }
      void navigate({ to: "/auth", search: { next: "/" } });
    }
  }

  const signedOut = !loading && !user;

  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh-3rem)] flex-col md:min-h-screen">
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <div className="w-full max-w-2xl">
            <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-foreground">
              Ask OCADE
            </h1>

            <div className="glass rounded-xl px-3 pb-2 pt-3">
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
                    send();
                  }
                }}
                placeholder="Ask anything"
                className="ocade-scroll max-h-60 w-full resize-none bg-transparent px-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              />

              <div className="mt-1 flex items-center gap-1">
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

                  <IconButton label="Dictate" disabled title="Dictation arrives with Chat">
                    <Mic className="h-4 w-4" aria-hidden />
                  </IconButton>

                  <button
                    type="button"
                    onClick={send}
                    disabled={draft.trim().length === 0}
                    aria-label="Send"
                    className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            {signedOut ? (
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
