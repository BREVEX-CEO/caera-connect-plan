import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { friendlyOtpError } from "@/lib/auth/otp";
import { AuthShell } from "@/components/shell/AuthShell";
import { readRecoveryEvidence } from "@/lib/auth/recovery-link";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — OCADE" },
      {
        name: "description",
        content: "Set a new password for your OCADE account from your reset link.",
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
  /** Password visibility, which the accessibility checklist asks for wherever
   * a password field exists: somebody typing a long passphrase on a phone has
   * no other way to catch a mistyped character. */
  const [visible, setVisible] = useState(false);

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
     * Somebody who is signed in and wants a new password asks for a reset link
     * from the sign-in page, which goes to the account's own email.
     */
    /*
     * The listener attaches once the client arrives. Loaded on demand rather
     * than imported: this route is statically reachable from the route tree, so
     * a top-level import put the whole auth stack on the entry chunk's graph
     * for a page somebody reaches from an email once.
     */
    let unsubscribe: (() => void) | undefined;
    void loadSupabaseClient().then((supabase) => {
      if (cancelled) return;
      const sub = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" && !cancelled) {
          setLinkValid(true);
          setReady(true);
        }
      });
      unsubscribe = () => sub.data.subscription.unsubscribe();
    });

    void (async () => {
      try {
        await checkTheLink();
      } catch (cause) {
        /*
         * A THROW HERE USED TO MEAN WAITING FOREVER.
         *
         * Nothing after the first `await` set `ready`, so a failed chunk load
         * or a client that would not construct left "Checking your reset
         * link…" on screen for good, on a page somebody reaches once, from an
         * email, when they cannot get in.
         */
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "That link could not be checked.");
        setReady(true);
      }
    })();

    async function checkTheLink() {
      const supabase = await loadSupabaseClient();
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
      /*
       * A fragment saying "recovery" is words in a URL anyone can type. The form opens only on
       * the provider's own PASSWORD_RECOVERY event (listened for above), which it emits after it
       * has verified the token; without one shortly, the link is not a working reset link.
       */
      if (evidence.kind === "recovery_token") {
        window.setTimeout(() => !cancelled && setReady(true), 8000);
        return;
      }
      setReady(true);
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    // Before the first `await`. After one, the handler has already returned
    // and the browser submits the form itself — see the note in
    // `auth.verify.tsx`, where the same ordering destroyed the screen.
    e.preventDefault();
    const supabase = await loadSupabaseClient().catch(() => null);
    if (!supabase) {
      setError("This page could not reach OCADE just now. Check your connection and try again.");
      return;
    }
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
    // A rejected request (not only a returned error) ends the wait too: the button comes back.
    const { error: err } = await supabase.auth
      .updateUser({ password })
      .catch((cause: unknown) => ({ error: cause instanceof Error ? cause : new Error(String(cause)) }))
      .finally(() => setBusy(false));
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
    setTimeout(() => navigate({ to: "/", replace: true }), 1200);
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your OCADE account."
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your reset link…
        </p>
      ) : done ? (
        <p className="text-sm text-foreground" role="status">
          Password updated. Opening Chat…
        </p>
      ) : !linkValid ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-foreground">
            This reset link is no longer valid.
          </p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            {error ??
              "Open this page from the link in your reset email. Reset links expire quickly and can only be used once."}
          </p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Want a new password? Ask for a reset link from the sign-in page: it goes to your
            account&apos;s email, and opening it here lets you choose the new one.
          </p>
          <Link
            to="/auth"
            className="flex h-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="sr-only">New password</span>
            <span className="relative block">
              <input
                id="new-password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password, at least 8 characters"
                className="h-10 w-full rounded-md border border-border bg-transparent pl-3 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? "Hide password" : "Show password"}
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
              >
                {visible ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </span>
          </label>
          <label className="block">
            <span className="sr-only">Confirm new password</span>
            <input
              id="confirm-password"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>
          {error ? (
            <p role="alert" className="text-[13px] text-foreground">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Update password
          </button>
        </form>
      )}
    </AuthShell>
  );
}
