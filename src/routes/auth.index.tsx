import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
/*
 * The CONFIGURATION check comes from the cheap module; the CLIENT is loaded on
 * demand. This route is statically reachable, so importing the client here puts
 * the whole auth stack on the entry chunk's graph — and the two things this
 * page does with it (read a session in `beforeLoad`, sign in when somebody
 * presses a button) both happen after the page exists.
 */
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { AuthShell } from "@/components/shell/AuthShell";
import { OTP_SENT_NOTICE, friendlyOtpError } from "@/lib/auth/otp";
import {
  describeWait,
  loadThrottle,
  recordFailure,
  recordSuccess,
  saveThrottle,
  secondsUntilAllowed,
} from "@/lib/auth/throttle";
import { DEFAULT_NEXT, rememberNext, safeNext } from "@/lib/auth/safe-next";
import { describeOAuthError, readOAuthErrorFromUrl } from "@/lib/auth/oauth-errors";
import {
  fetchAuthProviderAvailability,
  type AuthProviderAvailability,
} from "@/lib/auth/provider-availability";

const searchSchema = z.object({
  next: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  provider: z.string().optional(),
});

export const Route = createFileRoute("/auth/")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    if (!getSupabaseBrowserConfiguration().configured) return;
    const supabase = await loadSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: safeNext(search.next) ?? DEFAULT_NEXT });
  },
  /*
   * Asked of the project before the screen renders, so the buttons are the
   * ones that work rather than the ones a build flag believed in. It resolves
   * rather than rejects, so a project that cannot be reached still gets a
   * usable sign-in screen.
   *
   * RUN ON THE SERVER TOO, DELIBERATELY. A first attempt skipped the call
   * during SSR and returned `ASSUME_AVAILABLE` there. The server's loader
   * result is the one that ships — the client does not re-run it on hydration
   * — so the screen showed every method regardless of what the project said,
   * which is the defect this replaced wearing different clothes.
   */
  loader: (): Promise<AuthProviderAvailability> =>
    fetchAuthProviderAvailability(getSupabaseBrowserConfiguration()),
  head: () => ({
    meta: [
      { title: "Sign in — OCADE" },
      { name: "description", content: "Sign in to OCADE." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

/**
 * THE WAY IN, AND THERE ARE TWO OF THEM.
 *
 * Continue with Google, or a six-digit code to an email address. It was three:
 * a code to a phone number was the third, and the owner removed it. Sending SMS
 * needs an external provider account OCADE does not have, so the phone tab
 * could only ever refuse — and an authentication method that cannot
 * authenticate is worse than one that is absent, because it is the one somebody
 * picks when the others give them trouble.
 *
 * A PASSWORD IS THE THIRD WAY, ONE PRESS AWAY. It is optional and set from a
 * reset link (/reset-password), so it sits behind "Use a password instead"
 * rather than competing with the code, which needs nothing remembered.
 *
 * WHAT A FAILURE IS ALLOWED TO SAY. Never the provider's own text, which names
 * the provider and is written for whoever operates it. Never whether an account
 * exists: "no user found" and "wrong code" become the same sentence, because
 * the difference between them is exactly what somebody probing a list of
 * addresses is trying to learn.
 */
function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const availability = Route.useLoaderData();
  // GoTrue's email provider flag covers OTP and password sign-in.
  const emailEnabled = availability.emailDelivery;
  const nextPath = safeNext(search.next) ?? DEFAULT_NEXT;
  const configured = getSupabaseBrowserConfiguration().configured;

  const inbound = readOAuthErrorFromUrl(
    { error: search.error, error_description: search.error_description },
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const inboundFriendly = inbound
    ? describeOAuthError("google", inbound.code, inbound.description)
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(inboundFriendly?.message ?? null);
  const [hint, setHint] = useState<string | null>(inboundFriendly?.hint ?? null);
  const [notice, setNotice] = useState<string | null>(search.message ?? null);

  /*
   * ALREADY SIGNED IN, ON A PAGE THE SERVER DREW. `beforeLoad` forwards a
   * signed-in person on a navigation inside the app, but a page loaded fresh is
   * rendered on the server — which has no session — and the browser does not
   * run `beforeLoad` again when it takes over. So somebody who opened /auth
   * with a session (a bookmark, or on the way back from the console) was shown
   * the sign-in form, and signing in again made a second session.
   */
  useEffect(() => {
    if (!configured) return;
    let current = true;
    void loadSupabaseClient()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data }) => {
        if (current && data.session) void navigate({ to: nextPath, replace: true });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [configured, navigate, nextPath]);

  async function continueWithGoogle() {
    if (!availability.google) {
      setError("Google sign-in is not available yet.");
      setHint(emailEnabled ? "Use a code sent to your email address instead." : null);
      return;
    }
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      /*
       * Supabase is the only identity authority — `docs/DECISIONS.md` #25. The
       * provider handshake used to go through a third-party auth wrapper, which
       * meant a second thing in the product that knew how to create a session.
       */
      const supabase = await loadSupabaseClient();
      /*
       * THE DESTINATION RIDES IN THE TAB, NOT IN THE URL. Supabase returns only to a
       * callback on its allow list, matched exactly; `?next=` made it no match, so the
       * person was sent to the Site URL with an unused code and was not signed in.
       */
      rememberNext(nextPath);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) {
        const friendly = describeOAuthError("google", oauthError.message);
        setError(friendly.message);
        setHint(friendly.hint ?? null);
        setBusy(false);
      }
      // On success the browser is navigating to Google; leaving `busy` set is
      // what stops a second press starting a second handshake.
    } catch (thrown) {
      const friendly = describeOAuthError("google", thrown);
      setError(friendly.message);
      setHint(friendly.hint ?? null);
      setBusy(false);
    }
  }

  async function sendEmailCode(event: React.FormEvent) {
    // Before the first `await`. After one the handler has already returned and
    // the browser submits the form itself — see the note in `auth.verify.tsx`.
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Enter your email address.");
      return;
    }
    if (!emailEnabled) {
      setError("Email codes are not available yet.");
      setHint(availability.google ? "Continue with Google instead." : null);
      return;
    }
    const state = loadThrottle("otp_send", address);
    const wait = secondsUntilAllowed(state, Date.now());
    if (wait > 0) {
      setError(describeWait(wait));
      return;
    }

    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const supabase = await loadSupabaseClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({ email: address });
      if (sendError) {
        saveThrottle("otp_send", address, recordFailure(state, Date.now()));
        setError(friendlyOtpError(sendError.message));
        setBusy(false);
        return;
      }
      saveThrottle("otp_send", address, recordSuccess());
      setNotice(OTP_SENT_NOTICE);
      void navigate({
        to: "/auth/verify",
        search: { identifier: address, next: nextPath },
      });
    } catch {
      setError("OCADE could not send a code just now. Try again in a moment.");
      setBusy(false);
    }
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!emailEnabled) return;
    const address = email.trim().toLowerCase();
    if (!address || !password) {
      setError("Enter your email address and password.");
      return;
    }
    const state = loadThrottle("password_signin", address);
    const wait = secondsUntilAllowed(state, Date.now());
    if (wait > 0) {
      setError(describeWait(wait));
      return;
    }
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const supabase = await loadSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: address,
        password,
      });
      if (signInError) {
        saveThrottle("password_signin", address, recordFailure(state, Date.now()));
        // One sentence whether the account exists or not.
        setError("That email and password did not match.");
        setHint("Forgot it? Choose “Use an email code instead” below.");
        setBusy(false);
        return;
      }
      saveThrottle("password_signin", address, recordSuccess());
      void navigate({ to: nextPath });
    } catch {
      setError("OCADE could not sign you in just now. Try again in a moment.");
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <AuthShell
        title="Sign in"
        subtitle="This deployment has no account service configured yet, so signing in is not possible here."
      >
        <Link
          to="/"
          className="flex h-10 items-center justify-center rounded-md border border-border text-sm text-foreground transition-colors hover:bg-accent"
        >
          Back to Chat
        </Link>
      </AuthShell>
    );
  }

  // The same field in both sign-in forms.
  const emailField = (
    <label className="block space-y-1">
      <span className="text-sm font-medium">Email address</span>
      <input
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-11 w-full rounded-md border border-border bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
      />
    </label>
  );

  return (
    <AuthShell
      title="Sign in to OCADE"
      subtitle={
        emailEnabled
          ? availability.google
            ? "Continue with Google, or sign in with your email."
            : "Sign in with your email address."
          : availability.google
            ? "Use your Google account to sign in."
            : "Sign-in is currently unavailable."
      }
      footer={
        <>
          By continuing you accept the <Link to="/terms">Terms &amp; Conditions</Link> and the{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </>
      }
    >
      {availability.google ? (
        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Continue with Google
        </button>
      ) : null}
      {availability.google && emailEnabled ? (
        <div className="my-5 flex items-center gap-3 text-[0.8125rem] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}

      {emailEnabled ? (
        <form onSubmit={usePassword ? signInWithPassword : sendEmailCode} className="space-y-3">
          {emailField}
          {usePassword ? (
            <div className="space-y-1">
              <label htmlFor="sign-in-password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="sign-in-password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-border bg-transparent pl-3 pr-12 text-base text-foreground outline-none focus-visible:border-ring"
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={visible ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  {visible ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
          ) : null}
          <SubmitButton busy={busy}>{usePassword ? "Sign in" : "Send code"}</SubmitButton>
        </form>
      ) : null}

      {emailEnabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setUsePassword((current) => !current);
            setVisible(false);
            setError(null);
            setHint(null);
          }}
          className="mt-2 min-h-11 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
        >
          {usePassword ? "Use an email code instead" : "Use a password instead"}
        </button>
      ) : null}
      {!emailEnabled && !availability.google ? (
        <Link
          to="/help"
          className="flex min-h-11 items-center justify-center rounded-md border border-border text-sm hover:bg-accent"
        >
          Get help
        </Link>
      ) : null}

      {error ? (
        <p className="mt-4 text-[0.8125rem] text-foreground" role="alert">
          {error}
          {hint ? <span className="mt-1 block text-muted-foreground">{hint}</span> : null}
        </p>
      ) : notice ? (
        <p className="mt-4 text-[0.8125rem] text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
    </AuthShell>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
