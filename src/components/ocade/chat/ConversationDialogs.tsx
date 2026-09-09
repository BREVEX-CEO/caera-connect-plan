import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SHARE_REFUSAL_MESSAGE,
  currentShareToken,
  describeSnapshot,
  readSharedConversation,
  revokeConversationShare,
  shareConversation,
  shareLinkFor,
} from "@/lib/chat/conversation-sharing";
import type { Conversation } from "./conversation-model";

/**
 * The four short, focused decisions a person makes about one conversation:
 * rename it, share it, delete it, or delete all of them.
 *
 * Together in one module because they are the same kind of thing — a modal
 * that asks one question and closes — and separating four small dialogs into
 * four files would spread one idea across a directory. Extracted from the Chat
 * route by `PLAN.md` Phase 1; behaviour is unchanged.
 */
export function RenameDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: Conversation | null;
  onClose: () => void;
  onSubmit: (title: string) => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(target?.title ?? "");
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
        </DialogHeader>
        {/* No placeholder either — this field had no accessible name at all. */}
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={200}
          aria-label="Conversation name"
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * CLEARING EVERYTHING, WITH THE BLAST RADIUS STATED — PLAN.md §8.
 *
 * A typed confirmation, like the single delete and like the organization danger
 * zone, because the failure mode of a mis-click here is a person's entire chat
 * history and there is no undo.
 *
 * IT SAYS WHAT IT DOES *NOT* TOUCH. Somebody clearing their conversations has
 * no way to know from the words "delete all" whether their downloaded model,
 * their memory or their projects go with it — and the honest answer is that
 * they do not, each having its own control. Leaving that unsaid makes people
 * either avoid the button or press it and lose something they did not intend
 * to; saying it costs three lines.
 *
 * The count is stated so the confirmation is about a real quantity rather than
 * an abstraction, and so that pressing it on an empty history is obviously a
 * no-op before it is pressed.
 */
/**
 * SHARE A CONVERSATION — PLAN.md §8.
 *
 * OPENING THIS PUBLISHES NOTHING. It reads whether a live link already exists
 * and shows it. Taking a snapshot is the button, and the button says what it
 * will copy before it copies it — a dialog that shared a conversation as a side
 * effect of somebody checking whether it was shared would be the worst possible
 * reading of the word.
 *
 * The two refusals a person can act on are stated with their remedy: a
 * conversation stored only on the device has nothing on the server to share,
 * and an incognito one was never written down at all. Both are refused HERE
 * before any request, because both are knowable from what is already on screen
 * and a round trip to be told so is a worse experience than a sentence.
 */
export function ShareDialog({
  conversation,
  currentMessageCount,
  onClose,
}: {
  conversation: Conversation | null;
  currentMessageCount: number | null;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{ count: number; at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const id = conversation?.id ?? null;
  const shareable = Boolean(conversation) && !conversation!.incognito;

  useEffect(() => {
    setToken(null);
    setSnapshot(null);
    if (!id || !shareable) return;
    let cancelled = false;
    setLoading(true);
    void currentShareToken(id)
      .then(async (existing) => {
        if (cancelled) return;
        setToken(existing);
        if (!existing) return;
        // What the LINK currently shows, read back through the same public
        // reader a visitor uses — so the dialog cannot describe a snapshot the
        // link does not actually serve.
        const shared = await readSharedConversation(existing);
        if (!cancelled && shared) {
          setSnapshot({ count: shared.messageCount, at: shared.snapshotAt });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, shareable]);

  async function publish() {
    if (!id) return;
    setBusy(true);
    try {
      const outcome = await shareConversation({ conversationId: id });
      if (!outcome.ok) {
        toast.error(SHARE_REFUSAL_MESSAGE[outcome.refusal]);
        return;
      }
      setToken(outcome.value);
      const shared = await readSharedConversation(outcome.value);
      if (shared) setSnapshot({ count: shared.messageCount, at: shared.snapshotAt });
      toast.success("Link ready. Anyone with it can read this copy.");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!id) return;
    setBusy(true);
    try {
      const outcome = await revokeConversationShare(id);
      if (!outcome.ok) {
        toast.error(SHARE_REFUSAL_MESSAGE[outcome.refusal]);
        return;
      }
      setToken(null);
      setSnapshot(null);
      toast.success(
        outcome.value > 0
          ? "The link no longer opens anything."
          : "This conversation was not shared.",
      );
    } finally {
      setBusy(false);
    }
  }

  const link =
    token && typeof window !== "undefined" ? shareLinkFor(window.location.origin, token) : null;

  return (
    <Dialog open={Boolean(conversation)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share “{conversation?.title ?? ""}”</DialogTitle>
        </DialogHeader>

        {conversation?.incognito ? (
          <p className="text-sm text-muted-foreground">
            An incognito conversation cannot be shared. Nothing from it is written down, so there is
            nothing to copy into a link.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {snapshot
                ? describeSnapshot({
                    messageCount: snapshot.count,
                    snapshotAt: snapshot.at,
                    currentMessageCount: currentMessageCount ?? snapshot.count,
                  })
                : "Sharing copies this conversation as it is now. The copy does not update afterwards, and attachments are not included."}
            </p>

            {loading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Checking whether this is already shared…
              </p>
            ) : null}

            {link ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={link}
                  aria-label="Share link"
                  className="font-mono text-xs"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link);
                    toast.success("Link copied.");
                  }}
                >
                  Copy
                </Button>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              The link is unlisted and is not indexed by search engines. Anyone who has it can read
              the copy until you stop sharing.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {shareable ? (
            <>
              {token ? (
                <Button variant="destructive" onClick={() => void stop()} disabled={busy}>
                  Stop sharing
                </Button>
              ) : null}
              <Button onClick={() => void publish()} disabled={busy || loading}>
                {busy ? "Working…" : token ? "Update the copy" : "Create a link"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAllDialog({
  open,
  busy,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    setPhrase("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {count === 1 ? "your one conversation" : `all ${count} conversations`}?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            This removes every conversation and every message from this device and from your
            account, on every machine you sign in on. It cannot be undone.
          </p>
          <p className="text-xs text-muted-foreground">
            It does <span className="font-medium text-foreground">not</span> remove Offline
            Intelligence, what OCADE remembers about you, or your projects. Each of those has its
            own control in Settings.
          </p>
          <p className="text-xs">
            Type <span className="font-mono font-semibold">delete everything</span> to confirm.
          </p>
          <Input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder="delete everything"
            aria-label="Type delete everything to confirm"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || count === 0 || phrase !== "delete everything"}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete everything"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Conversation | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    setPhrase("");
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{target?.title}”?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            This permanently removes the conversation and all its messages. This cannot be undone.
          </p>
          <p className="text-xs">
            Type <span className="font-mono font-semibold">delete</span> to confirm.
          </p>
          <Input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="delete"
            aria-label="Type delete to confirm"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={phrase !== "delete"} onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
