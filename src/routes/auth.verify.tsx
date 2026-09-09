import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  channel: z.enum(["phone", "email"]),
  identifier: z.string().min(1),
  next: z.string().optional(),
  /*
   * WHY THE INTENT TRAVELS WITH THE USER.
   *
   * `resend()` called `signInWithOtp` with no options, which defaults to
   * creating an account. Somebody who pressed "Sign in", mistyped a character
   * and then pressed Resend would have a brand-new empty account made for the
   * address they did not mean to type — and would then be signed into it,
   * wondering where their conversations went. The intent the person actually
   * expressed on the previous screen has to survive the navigation.
   */
  intent: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth/verify")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Enter your code — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { channel, identifier, next, intent } = Route.useSearch();
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
    const supabase = await loadSupabaseClient();
    e.preventDefault();
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
      .regex(/^\d{4,8}$/, "Enter the numeric code we sent you.")
      .safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setBusy(false);
      return;
    }
    const { error: err } =
      channel === "phone"
        ? await supabase.auth.verifyOtp({ phone: identifier, token: parsed.data, type: "sms" })
        : await supabase.auth.verifyOtp({ email: identifier, token: parsed.data, type: "email" });
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
    const supabase = await loadSupabaseClient();
    if (cooldown > 0 || resending) return;
    setError(null);
    setResent(false);
    setResending(true);
    /*
     * The clock starts on the ATTEMPT, not on the success. A failed send that
     * left the button live is how somebody hammers a provider into rate
     * limiting them, and the failure they then see is the lockout rather than
     * the original problem.
     */
    setLastSentAt(Date.now());
    const options = { shouldCreateUser: intent === "signup" };
    const { error: err } =
      channel === "phone"
        ? await supabase.auth.signInWithOtp({ phone: identifier, options })
        : await supabase.auth.signInWithOtp({ email: identifier, options });
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
          Wrong {channel === "phone" ? "number" : "address"}?{" "}
          <Link to="/auth" className="text-foreground underline-offset-4 hover:underline">
            Go back
          </Link>
        </>
      }
    >
      <form onSubmit={verify} className="flex flex-col gap-4">
        <label htmlFor="code" className="text-xs font-medium text-muted-foreground">
          One-time code
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="border-b border-border/70 bg-transparent px-1 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors focus:border-foreground/70"
          placeholder="••••••"
          maxLength={8}
        />
        <button
          type="submit"
          disabled={busy || wait > 0}
          className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
          className="inline-flex min-h-[24px] items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {describeResend(cooldown)}
        </button>
        <p aria-live="polite" className="sr-only">
          {resent ? "A new code has been sent." : ""}
        </p>
        {resent ? (
          <p className="text-xs text-muted-foreground">
            A new code is on its way. The previous one no longer works.
          </p>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </div>
        ) : null}
        {intent === "signin" ? (
          <p className="text-xs text-muted-foreground">
            No code arriving? If you have not created an OCADE account yet,{" "}
            <Link to="/auth" className="text-foreground underline underline-offset-4">
              create one
            </Link>{" "}
            — signing in only works for an address that already has one.
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}
