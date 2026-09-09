import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { recordAction } from "@/lib/actions";
import {
  DELETE_CONFIRMATION,
  deleteMyAccount,
  type AccountDeletionReceipt,
} from "@/lib/account.functions";
import { deleteLocalData } from "@/lib/device/local-data";
import { organizationsBlockingAccountDeletion } from "@/lib/organizations/authority";

/**
 * Delete account.
 *
 * Two confirmations, as the destructive-action rule requires: opening the
 * panel, then typing the exact phrase. The list above the field states what
 * goes, so nobody discovers the scope afterwards.
 */
export function DeleteAccountCard() {
  const navigate = useNavigate();
  const deleteAccount = useServerFn(deleteMyAccount);
  const [armed, setArmed] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<AccountDeletionReceipt | null>(null);

  const matches = phrase.trim().toUpperCase() === DELETE_CONFIRMATION;

  /*
   * ASKED BEFORE THE BUTTON, NOT AFTER THE ATTEMPT — PLAN.md §O.
   *
   * The server refuses to delete the last owner of an organization, and it
   * refuses before it destroys anything. But being told at the end of a typed
   * confirmation that this was never going to work is a bad way to find out,
   * and the thing they need to do — hand the workspace over, or close it — has
   * to happen somewhere else. So the warning is here, with the way there.
   *
   * A failure to ask does NOT hide the button. The server is the protection;
   * this is the courtesy, and a courtesy that disabled account deletion because
   * a query failed would be the wrong trade.
   */
  const blocking = useQuery({
    queryKey: ["organizations", "blocking-account-deletion"],
    queryFn: organizationsBlockingAccountDeletion,
  });
  const blockers = blocking.data?.ok ? blocking.data.value : [];

  async function run() {
    setBusy(true);
    void recordAction({ actionId: "account.delete" });
    try {
      const outcome = await deleteAccount({ data: { confirmation: phrase } });
      await (await loadSupabaseClient()).auth.signOut();

      /*
       * THE LOCAL HALF, THROUGH THE ONE AUTHORITY THAT KNOWS THE BOUNDARY.
       *
       * The server has removed the account's rows; this machine still holds its
       * own copies. `deleteLocalData` removes account data and this device's
       * registration and CANNOT touch a model-owned key, so Offline
       * Intelligence survives — which is what PLAN.md §A and §O both require,
       * and what the receipt says out loud.
       */
      deleteLocalData(["all_account_data", "device_lease"]);

      /*
       * THE RECEIPT IS SHOWN, NOT TOASTED AWAY.
       *
       * A toast that disappears in four seconds is not a receipt. This is the
       * last moment the person has any relationship with the account, and the
       * reference is the only thing they can quote afterwards — there is no
       * account left to look it up from.
       */
      setReceipt(outcome.receipt);
      setBusy(false);
    } catch (error) {
      setBusy(false);
      toast.error("Could not delete the account.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  if (receipt) {
    return (
      <GlassPanel className="flex flex-col gap-4 border-destructive/30 p-5">
        <header className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Account deleted</h3>
        </header>
        <p className="text-[13px] leading-6 text-muted-foreground">
          Keep this reference. It is the only way to ask about this deletion, because there is no
          longer an account to look it up from — and it identifies the deletion, not you.
        </p>
        <dl className="grid gap-1 text-[13px]">
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono text-foreground">{receipt.reference}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Completed</dt>
            <dd>
              <time dateTime={receipt.completedAt}>
                {new Date(receipt.completedAt).toLocaleString()}
              </time>
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Other sessions ended</dt>
            <dd>{receipt.sessionsRevoked}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-muted-foreground">Removed</dt>
            <dd>{receipt.removed.join(", ")}</dd>
          </div>
        </dl>
        {/*
         * Stated because people ask, and because the answer is the point of a
         * boundary this product spends real effort maintaining: deleting the
         * account does not delete the model on this machine.
         */}
        <p className="text-[13px] leading-6 text-muted-foreground">
          Offline Intelligence on this device was <strong>not</strong> removed. Deleting it is a
          separate choice, and nothing here started a download.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void navigate({ to: "/", replace: true })}
        >
          Close
        </Button>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="flex flex-col gap-4 border-destructive/30 p-5">
      <header className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Delete account</h3>
      </header>

      <p className="text-[13px] leading-6 text-muted-foreground">
        This permanently removes your profile, chat history and messages, support cases and account
        records, then deletes your sign-in itself. It cannot be undone and there is no recovery
        window.
      </p>

      {blockers.length > 0 ? (
        <div
          className="rounded-md border border-[color:var(--state-warning-line)] bg-[color:var(--state-warning-wash)] p-3 text-[13px] leading-6 text-[color:var(--state-warning)]"
          role="status"
        >
          <p>
            You are the only owner of{" "}
            <strong>{blockers.map((organization) => organization.name).join(", ")}</strong>.
            Deleting your account would leave {blockers.length === 1 ? "it" : "them"} with nobody
            who can administer {blockers.length === 1 ? "it" : "them"}, so this will be refused
            until you hand {blockers.length === 1 ? "it" : "them"} over
            {blockers.some((organization) => organization.solo)
              ? " — or close the ones you are alone in"
              : ""}
            .
          </p>
          <Link to="/organization" className="mt-2 inline-block font-medium underline">
            Open Organization
          </Link>
        </div>
      ) : null}

      {armed ? (
        <div className="flex flex-col gap-3">
          <label className="text-[12px] text-muted-foreground" htmlFor="delete-confirm">
            Type <span className="font-mono text-foreground">{DELETE_CONFIRMATION}</span> to
            confirm.
          </label>
          <Input
            id="delete-confirm"
            value={phrase}
            autoComplete="off"
            disabled={busy}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder={DELETE_CONFIRMATION}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!matches || busy}
              onClick={() => void run()}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setArmed(false);
                setPhrase("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button size="sm" variant="outline" onClick={() => setArmed(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete account
          </Button>
        </div>
      )}
    </GlassPanel>
  );
}
