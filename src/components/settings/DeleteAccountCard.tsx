import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { recordAction } from "@/lib/actions";
import { DELETE_CONFIRMATION, deleteMyAccount } from "@/lib/account.functions";

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

  const matches = phrase.trim().toUpperCase() === DELETE_CONFIRMATION;

  async function run() {
    setBusy(true);
    void recordAction({ actionId: "account.delete" });
    try {
      await deleteAccount({ data: { confirmation: phrase } });
      await supabase.auth.signOut();
      toast.success("Account deleted.", { description: "Your data has been removed." });
      await navigate({ to: "/", replace: true });
    } catch (error) {
      setBusy(false);
      toast.error("Could not delete the account.", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
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
