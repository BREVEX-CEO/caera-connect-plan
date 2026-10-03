import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { AuthShell } from "@/components/shell/AuthShell";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safe-next";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  describeResend,
  friendlyOtpError,
  secondsUntilResend,
} from "@/lib/auth/otp";
import {
  describeWait,
  loadThrottle,
  recordFailure,
  recordSuccess,
  saveThrottle,
  secondsUntilAllowed,
} from "@/lib/auth/throttle";

const searchSchema = z.object({
  identifier: z.string().email(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/verify")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Enter your code — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { identifier, next } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  /*
   * A code was just sent by the screen that navigated here, so the cooldown
   * starts immediately rather than offering a resend the provider would
   * refuse a second later.
   */
  const [lastSentAt, setLastSentAt] = useState<number | null>(() => Date.now());
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);
  /*
   * WRONG CODES NOW COST TIME.
   *
   * This used to be `useRef(0)`: a counter that, from the fifth failure on,
   * showed a longer sentence and then let the sixth attempt through at once.
   * The message claimed OCADE had stopped; nothing had, and a script
   * working through six-digit codes was slowed only by string rendering. The
   * backoff is real now — free for the first two failures, because that is what
   * a typo costs, and doubling to five minutes after that.
   */
  const [throttle, setThrottle] = useState(() => loadThrottle("otp_verify", identifier));
  const [wait, setWait] = useState(0);

  useEffect(() => {
    const tick = () => setWait(secondsUntilAllowed(throttle, Date.now()));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [throttle]);

  useEffect(() => {
    const tick = () => setCooldown(secondsUntilResend(lastSentAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastSentAt]);

  /*
   * THROUGH `safeNext`, NOT A SECOND HAND-ROLLED CHECK.
   *
   * What stood here — starts with "/", does not start with "//" — is the exact
   * pattern match `safe-next.ts` exists to replace, and it accepts strings the
   * shared resolver rejects. Two answers to "may OCADE navigate here?" is one
   * more than a redirect target should ever have.
   */
  const target = safeNext(next) ?? DEFAULT_NEXT;

  async function verify(e: React.FormEvent) {
    /*
     * BEFORE THE FIRST `await`, AND THAT IS THE WHOLE BUG.
     *
     * This used to load the Supabase client first and call `preventDefault`
     * after it. An `await` yields to the event loop, the handler returns, and
     * the browser treats the submit as unhandled — so it did the default thing
     * and navigated to the form's action, which is this page with an empty
     * query string. `identifier` lives in that query string, so
     * the reloaded route failed `validateSearch` and the error boundary
     * replaced the screen with "Something stopped working".
     *
     * Entering a code — right or wrong — therefore destroyed the screen it was
     * entered on, and the only way back was to start again. Nothing caught it
     * because the screen was unreachable at all: `auth.tsx` was a parent route
     * with no `<Outlet/>`, so `/auth/verify` rendered the sign-in form.
     */
    e.preventDefault();
    const supabase = await loadSupabaseClient();
    const remaining = secondsUntilAllowed(throttle, Date.now());
    if (remaining > 0) {
      setError(describeWait(remaining));
      return;
    }
    setBusy(true);
    setError(null);
    const parsed = z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the six-digit code we sent you.")
      .safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.auth.verifyOtp({
      email: identifier,
      token: parsed.data,
      type: "email",
    });
    if (err) {
      const next = recordFailure(throttle, Date.now());
      setThrottle(next);
      saveThrottle("otp_verify", identifier, next);
      /*
       * The provider's text is never shown: it names the service, sometimes
       * names internal endpoints, and answers "does this account exist?" for
       * anyone working through a list of addresses.
       *
       * The wait is appended rather than replacing the reason — a person who
       * mistyped needs to know both that the code was wrong and when they may
       * try again.
       */
      const delay = secondsUntilAllowed(next, Date.now());
      setError([friendlyOtpError(err.message), describeWait(delay)].filter(Boolean).join(" "));
      setBusy(false);
      return;
    }
    const cleared = recordSuccess();
    setThrottle(cleared);
    saveThrottle("otp_verify", identifier, cleared);
    navigate({ to: target, replace: true });
  }

  async function resend() {
    // Guard BEFORE the await. Loading the client first left a window in which
    // two fast clicks both passed the cooldown check and sent two codes.
    if (cooldown > 0 || resending) return;
    setResending(true);
    const supabase = await loadSupabaseClient();
    setError(null);
    setResent(false);
    /*
     * The clock starts on the ATTEMPT, not on the success. A failed send that
     * left the button live is how somebody hammers a provider into rate
     * limiting them, and the failure they then see is the lockout rather than
     * the original problem.
     */
    setLastSentAt(Date.now());
    /*
     * The same call the previous screen made, with the same defaults.
     *
     * There used to be an `intent` in the URL deciding `shouldCreateUser`,
     * because the product had a separate Sign in and Create account screen and
     * a resend from the wrong one silently made an empty account for a mistyped
     * address. There is one way in now — a code to an email address — and the
     * provider decides whether that identity already exists, so there is no
     * intent to carry and no way for the two calls to disagree.
     */
    const { error: err } = await supabase.auth.signInWithOtp({ email: identifier });
    setResending(false);
    if (err) setError(friendlyOtpError(err.message));
    else setResent(true);
  }

  return (
    <AuthShell
      title="Enter your code"
      subtitle={`We sent a one-time code to ${identifier}.`}
      footer={
        <>
          Wrong address?{" "}
          <Link to="/auth" className="text-foreground underline-offset-4 hover:underline">
            Go back
          </Link>
        </>
      }
    >
      <form onSubmit={verify} className="flex flex-col gap-4">
        <label htmlFor="code" className="sr-only">
          Six-digit code
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-12 rounded-md border border-border bg-transparent text-center font-mono text-xl tracking-[0.4em] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring"
          placeholder="000000"
        />
        <button
          type="submit"
          disabled={busy || wait > 0}
          className="flex h-10 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {/*
            The countdown is ON the button, not only in the error. A control
            that has silently stopped working is a bug as far as the person
            pressing it is concerned; one that says when it will work again is
            an instruction.
          */}
          {wait > 0 ? `Wait ${wait}s` : "Verify and continue"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          /*
           * The countdown is the label, not a decoration beside it. A disabled
           * button with the reason somewhere else is a button that, to a screen
           * reader, simply stopped working.
           */
          className="flex min-h-6 items-center justify-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {describeResend(cooldown)}
        </button>
        <p aria-live="polite" className="sr-only">
          {resent ? "A new code has been sent." : ""}
        </p>
        {resent ? (
          <p className="text-[13px] text-muted-foreground">
            A new code is on its way. The previous one no longer works.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] text-foreground">
            {error}
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}
