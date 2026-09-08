import { useCallback, useEffect, useState } from "react";
import { AtSign, Loader2, Link2, Link2Off, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import {
  canUnlink,
  linkProvider,
  listIdentities,
  requestEmailChange,
  unlinkProvider,
  type LinkedIdentity,
} from "@/lib/security/identity";
import type { AssuranceDecision } from "@/lib/security/assurance";
import { HIGH_RISK } from "@/lib/security/assurance-middleware";
import { checkAssurance, proveIdentityWithPassword } from "@/lib/security/reauthentication";
import { recordAction } from "@/lib/actions";

/**
 * HOW THIS ACCOUNT CAN BE SIGNED INTO — and how to change that safely.
 *
 * Every control here alters what can BECOME this account, which is why PLAN.md
 * §C groups them with the destructive actions. Adding a provider adds a way in.
 * Removing one can take away the last way in. Changing the email moves where a
 * password reset is delivered, which is the same thing as moving the account.
 *
 * REAUTHENTICATION FIRST, and it is not decoration. A session is what somebody
 * who walked up to an unlocked laptop already has; a password is not. The
 * password field below is the proof, and it is the same check the password
 * change above it makes, for the same reason.
 *
 * THE EMAIL IS NOT CHANGED WHEN THIS SAYS IT ISN'T. Supabase sends a
 * confirmation and the login stays what it was until the link is followed, so
 * this reports the new address as PENDING. Saying "changed" would invite
 * somebody to delete the old mailbox and lose the account.
 */
export function SignInMethodsPanel({ email }: { email: string | null }) {
  const [identities, setIdentities] = useState<LinkedIdentity[] | null>(null);
  /*
   * Whether a password is needed before the next change, decided by the ONE
   * assurance rule rather than by this panel.
   *
   * It used to be `current === "aal2"`, which is the mistake `assurance.ts`
   * exists to prevent: assurance says how STRONGLY somebody authenticated and
   * nothing at all about WHEN. A session that answered a code at nine in the
   * morning was treated here as proof at five in the afternoon, so a passer-by
   * at an unlocked laptop could move the address a password reset is sent to —
   * which is the same thing as taking the account.
   */
  const [proofNeeded, setProofNeeded] = useState<AssuranceDecision | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [proof, setProof] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, decision] = await Promise.all([listIdentities(), checkAssurance(HIGH_RISK)]);
      setIdentities(list);
      setProofNeeded(decision);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not read your sign-in methods.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Prove it is still this person, right now.
   *
   * Supabase has no "reauthenticate with password" call, so the check is a
   * sign-in against the current password: it succeeds only for somebody who
   * knows it, and it refreshes the same session rather than starting a new one,
   * so nothing about the page changes when it passes.
   *
   * A session already at `aal2` has answered a factor challenge and is not
   * asked again — that IS recent proof, and demanding a password on top of a
   * code is friction that buys nothing.
   */
  const reauthenticate = useCallback(async (): Promise<boolean> => {
    /*
     * Asked again at the moment of the change rather than trusting what `load`
     * found. A panel left open for a quarter of an hour has a stale answer, and
     * the stale answer is the permissive one.
     */
    const decision = await checkAssurance(HIGH_RISK);
    setProofNeeded(decision);
    if (decision.allowed) return true;

    if (decision.reason === "factor_required") {
      setProblem(
        "Confirm the code from your authenticator app first — open Settings › Security, or sign in again — then come back to this change.",
      );
      return false;
    }

    const outcome = await proveIdentityWithPassword(email, proof);
    if (outcome.proved) {
      setProof("");
      return true;
    }
    setProblem(
      outcome.reason === "no_email"
        ? "OCADE cannot confirm this account's email address, so it will not change how you sign in from here."
        : "That password did not match. If you have never set one — you sign in with Google, Apple or a one-time code — set a password above first.",
    );
    return false;
  }, [email, proof]);

  async function changeEmail() {
    setBusy("email");
    setProblem(null);
    setNotice(null);
    try {
      if (!(await reauthenticate())) return;
      const result = await requestEmailChange(nextEmail);
      setPending(result.pending);
      setNextEmail("");
      setProof("");
      await recordAction({ actionId: "security.email_change_requested" });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function link(provider: "google" | "apple") {
    setBusy(provider);
    setProblem(null);
    setNotice(null);
    try {
      if (!(await reauthenticate())) return;
      await linkProvider(provider, `${window.location.origin}/settings/security`);
      // A redirect follows; anything after this line runs only if it did not.
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function unlink(identity: LinkedIdentity) {
    setBusy(identity.id);
    setProblem(null);
    setNotice(null);
    try {
      if (!(await reauthenticate())) return;
      await unlinkProvider(identity.id);
      setNotice(`${label(identity.provider)} is no longer a way into this account.`);
      setProof("");
      await recordAction({ actionId: "security.provider_unlinked" });
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const hasPassword = identities?.some((identity) => identity.provider === "email") ?? false;
  const linked = new Set((identities ?? []).map((identity) => identity.provider));

  return (
    <GlassPanel className="mt-4 p-5">
      <div className="flex items-center gap-2">
        <AtSign className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">How you sign in</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Every change here alters what can get into this account, so each one asks you to prove it is
        you first.
      </p>

      {problem ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {problem}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
        >
          {notice}
        </p>
      ) : null}

      {identities === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your sign-in methods…
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/40 text-sm">
          {identities.map((identity) => {
            const removable = canUnlink(identities, identity, hasPassword);
            return (
              <li key={identity.id} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-foreground">{label(identity.provider)}</span>
                  {identity.label ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {identity.label}
                    </span>
                  ) : null}
                </span>
                {removable.allowed ? (
                  <button
                    onClick={() => void unlink(identity)}
                    disabled={busy !== null}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-60"
                  >
                    {busy === identity.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Link2Off className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Remove
                  </button>
                ) : (
                  // Said, not hidden behind a disabled button with no reason.
                  <span className="max-w-[16rem] shrink-0 text-right text-[11px] text-muted-foreground">
                    {removable.reason}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------------------- the proof -- */}
      {proofNeeded?.allowed ? (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          You proved it was you a moment ago, so you will not be asked again just yet.
        </p>
      ) : (
        <label className="mt-4 block max-w-sm">
          <span className="text-xs text-muted-foreground">Your current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            aria-label="Your current password, to confirm it is you"
            className="mt-1 w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary/60"
          />
        </label>
      )}

      {/* ------------------------------------------------------ the email -- */}
      <div className="mt-4 border-t border-border/40 pt-4">
        <h3 className="text-xs font-semibold text-foreground">Change the email you sign in with</h3>
        {pending ? (
          <p role="status" className="mt-2 text-xs text-foreground">
            Check <span className="font-medium">{pending}</span> and follow the link. Until you do,
            you still sign in with {email ?? "your current address"} — do not close that mailbox.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            {/*
              A PREFERRED WIDTH, NOT A FIXED ONE.

              `w-64` was 256px whatever the column could spare, and in the
              settings form at tablet width the column spared 244 — so the field
              hung 34px past the edge and took the whole document sideways with
              it. `basis-64` asks for the same 256, `min-w-0` lets it give them
              back when they are not there, and the input fills whatever the
              label ends up with.
            */}
            <label className="grid min-w-0 flex-1 basis-64 gap-1.5">
              <span className="text-xs text-muted-foreground">New address</span>
              <input
                type="email"
                autoComplete="email"
                value={nextEmail}
                onChange={(event) => setNextEmail(event.target.value)}
                aria-label="The new email address"
                className="w-full min-w-0 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary/60"
              />
            </label>
            <button
              onClick={() => void changeEmail()}
              disabled={busy !== null || !nextEmail || (!proofNeeded?.allowed && !proof)}
              className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              {busy === "email" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              Send a confirmation
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------- more ways in -- */}
      <div className="mt-4 border-t border-border/40 pt-4">
        <h3 className="text-xs font-semibold text-foreground">Add another way in</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          A second method is what gets you back in if you lose the first.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["google", "apple"] as const).map((provider) => (
            <button
              key={provider}
              onClick={() => void link(provider)}
              disabled={busy !== null || linked.has(provider) || (!proofNeeded?.allowed && !proof)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              {busy === provider ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Link2 className="h-3.5 w-3.5" aria-hidden />
              )}
              {linked.has(provider) ? `${label(provider)} linked` : `Link ${label(provider)}`}
            </button>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

/** Provider names as people know them, never the raw slug. */
function label(provider: string): string {
  if (provider === "email") return "Email and password";
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
