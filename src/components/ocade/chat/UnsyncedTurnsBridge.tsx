import { useEffect, useSyncExternalStore } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { appendOcadeMessage } from "@/lib/ocade.functions";
import {
  describeUnsynced,
  flushUnsyncedTurns,
  subscribeUnsynced,
  unsyncedCount,
  type UnsyncedTurn,
} from "@/lib/chat/unsynced-turns";

/**
 * THE ONLY THING STANDING BETWEEN A HELD TURN AND SILENCE.
 *
 * `PLAN.md` Phase 2 allows a turn produced on the device to wait in the open
 * tab when the account cannot be reached, and requires three things of that
 * arrangement: the person is told, closing the tab warns first, and the turn
 * reaches the account exactly once when the connection returns. This does all
 * three, and it is mounted in the authenticated layout rather than in Chat so
 * it keeps doing them after somebody navigates to Settings.
 *
 * WHY `beforeunload` AND NOT A NICER DIALOG. Nothing else can stop a tab
 * closing. The browser's own wording is unavoidable and deliberately vague,
 * which is exactly why the count is also on screen: the confirmation is the
 * last chance, not the explanation.
 *
 * THE FLUSH IS TRIED ON RECONNECT AND ON MOUNT, never on a timer. A poll would
 * spend a phone's battery re-learning something the `online` event already
 * says, and the retry that matters — the one after a failed attempt — comes
 * with the next event rather than from this component guessing.
 */
export function UnsyncedTurnsBridge() {
  const count = useSyncExternalStore(subscribeUnsynced, unsyncedCount, () => 0);

  useEffect(() => {
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Assigned as well as prevented: older browsers require the property and
      // ignore an empty string, and the two together are what actually prompts.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);

  useEffect(() => {
    let cancelled = false;

    const upload = async (turn: UnsyncedTurn) => {
      await appendOcadeMessage({
        data: {
          conversationId: turn.conversationId,
          role: turn.role,
          content: turn.content,
          modelId: turn.modelId,
          providerId: turn.providerId,
          clientKey: turn.clientKey,
          attachments: turn.attachments,
        },
      });
    };

    const drain = async () => {
      if (unsyncedCount() === 0) return;
      const result = await flushUnsyncedTurns(upload);
      if (cancelled || result.uploaded === 0) return;
      toast.success(
        result.uploaded === 1
          ? "The message that was waiting is now saved to your account."
          : `${result.uploaded} messages that were waiting are now saved to your account.`,
      );
    };

    void drain();
    window.addEventListener("online", drain);
    return () => {
      cancelled = true;
      window.removeEventListener("online", drain);
    };
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-xs rounded-lg border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] px-3 py-2 text-[12px] shadow-lg backdrop-blur"
      role="status"
      data-testid="unsynced-turns"
      data-count={count}
    >
      <span className="flex items-start gap-2">
        {typeof navigator !== "undefined" && navigator.onLine ? (
          <Loader2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[color:var(--state-warning)]"
            aria-hidden
          />
        ) : (
          <CloudOff
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--state-warning)]"
            aria-hidden
          />
        )}
        <span className="text-foreground">{describeUnsynced(count)}</span>
      </span>
    </div>
  );
}
