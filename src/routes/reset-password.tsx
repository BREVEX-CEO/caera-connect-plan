import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyOtpError } from "@/lib/auth/otp";
import { AuthShell } from "@/components/shell/AuthShell";
import { opensResetForm, readRecoveryEvidence } from "@/lib/auth/recovery-link";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — CARCC CADANE" },
      {
        name: "description",
        content: "Set a new password for your CARCC CADANE account from your reset link.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /*
     * A SESSION IS NOT A RESET LINK.
     *
     * This used to accept `SIGNED_IN` and, failing that, the mere existence of
     * a session — so anyone at a browser where the owner was still signed in
     * could open this URL and replace the password without knowing the old
     * one, locking the owner out of their own account. Changing a password is
     * the one operation that must prove identity by some means OTHER than the
     * session it is about to invalidate.
     *
     * `PASSWORD_RECOVERY` is kept because it IS that proof: Supabase emits it
     * only for a session established from a recovery token. Everything else
     * has to arrive in the URL and survive `readRecoveryEvidence`.
     *
     * Somebody who is signed in and wants a new password is not stuck — they
     * are sent to Settings › Security, where the current password is required.
     */
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setLinkValid(true);
        setReady(true);
      }
    });

    void (async () => {
      const evidence = readRecoveryEvidence(window.location.href);

      if (evidence.kind === "error") {
        if (!cancelled) {
          setError(evidence.message);
          setReady(true);
        }
        return;
      }

      if (evidence.kind === "recovery_code") {
        /*
         * A code is a claim, not the proof. The form opens only if the
         * exchange actually produces a session — a spent, forged or expired
         * code fails here and the page says so.
         */
        const { error: exchangeError } = await supabase.auth
          .exchangeCodeForSession(evidence.code)
          .catch((e: unknown) => ({ error: e as Error }));
        if (cancelled) return;
        setLinkValid(!exchangeError);
        setReady(true);
        return;
      }

      if (cancelled) return;
      setLinkValid(opensResetForm(evidence));
      setReady(true);
    })();

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Your new password needs at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Both passwords must match.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      /*
       * The provider's own words used to land here verbatim, naming the
       * service and occasionally an internal endpoint. This is a person
       * halfway through recovering their account; what they need is a sentence
       * about what to do next.
       */
      setError(
        /same.*password|should be different/i.test(err.message)
          ? "That is the password you already had. Choose a different one."
          : /expired|invalid|token/i.test(err.message)
            ? "This reset link has expired. Ask for a new one from the sign-in page."
            : friendlyOtpError(err.message),
      );
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/home", replace: true }), 1200);
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your CARCC CADANE account."
      footer={
        <>
          Changed your mind?{" "}
          <Link to="/auth" className="underline underline-offset-2">
            Back to sign in
          </Link>
          .
        </>
      }
    >
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
        </div>
      ) : done ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          Password updated. Taking you to your workspace…
        </div>
      ) : !linkValid ? (
        <div className="flex flex-col gap-3">
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <p className="font-medium">This reset link is no longer valid.</p>
            <p className="mt-1 text-destructive/85">
              {error ??
                "Open this page from the link in your reset email. Reset links expire quickly and can only be used once."}
            </p>
            <p className="mt-1 text-destructive/85">
              Already signed in and just want a new password? Change it in Settings › Security,
              where OCADE asks for your current one first.
            </p>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">
            New password
          </label>
          <div className="flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70">
            <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">
            Confirm new password
          </label>
          <div className="flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70">
            <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none"
            />
          </div>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update password
          </button>
        </form>
      )}
    </AuthShell>
  );
}
