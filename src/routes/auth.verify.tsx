import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/shell/AuthShell";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  describeResend,
  friendlyOtpError,
  secondsUntilResend,
} from "@/lib/auth/otp";

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
  const attempts = useRef(0);

  useEffect(() => {
    const tick = () => setCooldown(secondsUntilResend(lastSentAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lastSentAt]);

  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  async function verify(e: React.FormEvent) {
    e.preventDefault();
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
      attempts.current += 1;
      /*
       * The provider's text is never shown: it names the service, sometimes
       * names internal endpoints, and answers "does this account exist?" for
       * anyone working through a list of addresses.
       */
      setError(
        attempts.current >= 5
          ? "That code did not match. After several attempts OCADE stops guessing — ask for a new code, or go back and check the address."
          : friendlyOtpError(err.message),
      );
      setBusy(false);
      return;
    }
    navigate({ to: target, replace: true });
  }

  async function resend() {
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
          className="rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-center text-lg tracking-[0.4em] text-foreground outline-none focus:ring-2 focus:ring-ring"
          placeholder="••••••"
          maxLength={8}
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Verify and continue
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
