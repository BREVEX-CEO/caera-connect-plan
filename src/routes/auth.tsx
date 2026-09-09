import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Phone, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
/*
 * The CONFIGURATION check comes from the cheap module; the CLIENT is loaded on
 * demand. This route is statically reachable, so importing the client here put
 * the whole auth stack on the entry chunk's graph — and the two things this
 * page does with it (read a session in `beforeLoad`, sign in when somebody
 * presses the button) both happen after the page exists.
 */
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { lovable } from "@/integrations/lovable";
import { LegalDialog } from "@/components/legal/LegalDialog";
import { AuthShell } from "@/components/shell/AuthShell";
import { OTP_SENT_NOTICE, friendlyOtpError } from "@/lib/auth/otp";
import {
  describeWait,
  loadThrottle,
  recordFailure,
  recordSuccess,
  saveThrottle,
  secondsUntilAllowed,
  type ThrottledAction,
} from "@/lib/auth/throttle";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safe-next";
import { cn } from "@/lib/utils";
import { describeOAuthError, readOAuthErrorFromUrl } from "@/lib/auth/oauth-errors";
import { authProviderAvailability } from "@/lib/auth/provider-availability";

const searchSchema = z.object({
  next: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  provider: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    if (!getSupabaseBrowserConfiguration().configured) return;
    const supabase = await loadSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const target = safeNext(search.next) ?? DEFAULT_NEXT;
      throw redirect({ to: target });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — CARCC CADANE" },
      { name: "description", content: "Sign in to your CARCC CADANE workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Method = "google" | "apple" | "phone" | "email";

const methods: { id: Method; label: string }[] = [
  ...(authProviderAvailability.google ? [{ id: "google" as const, label: "Google" }] : []),
  ...(authProviderAvailability.apple ? [{ id: "apple" as const, label: "Apple" }] : []),
  ...(authProviderAvailability.phone ? [{ id: "phone" as const, label: "Phone" }] : []),
  { id: "email", label: "Email" },
];

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const nextPath = safeNext(search.next) ?? DEFAULT_NEXT;
  const [method, setMethod] = useState<Method>(methods[0]?.id ?? "email");
  const [busy, setBusy] = useState(false);
  const inboundOAuthError = readOAuthErrorFromUrl(
    { error: search.error, error_description: search.error_description },
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const inboundFriendly = inboundOAuthError
    ? describeOAuthError(
        search.provider ?? "google",
        inboundOAuthError.code,
        inboundOAuthError.description,
      )
    : null;
  const [error, setError] = useState<string | null>(inboundFriendly?.message ?? null);
  const [errorHint, setErrorHint] = useState<string | null>(inboundFriendly?.hint ?? null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(search.message ?? null);
  const authConfigured = getSupabaseBrowserConfiguration().configured;

  useEffect(() => {
    setError(null);
    setErrorHint(null);
  }, [method]);

  async function signInOAuth(provider: "google" | "apple") {
    if (!authProviderAvailability[provider]) {
      setError(`${provider === "google" ? "Google" : "Apple"} sign-in is not available yet.`);
      setErrorHint(
        "Use an enabled sign-in method, or try again after launch configuration is complete.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setErrorHint(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback${
          nextPath !== DEFAULT_NEXT ? `?next=${encodeURIComponent(nextPath)}` : ""
        }`,
      });
      if (result.error) {
        const friendly = describeOAuthError(provider, result.error.message);
        setError(friendly.message);
        setErrorHint(friendly.hint ?? null);
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: nextPath, replace: true });
    } catch (e) {
      const friendly = describeOAuthError(provider, e);
      setError(friendly.message);
      setErrorHint(friendly.hint ?? null);
      setBusy(false);
    }
  }

  async function sendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!authProviderAvailability.phone) {
      setError("Phone sign-in is not available yet.");
      return;
    }
    setBusy(true);
    setError(null);
    const parsed = z
      .string()
      .trim()
      .regex(
        /^\+[1-9]\d{6,14}$/,
        "Enter a phone number in international format, e.g. +14155551234.",
      )
      .safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setBusy(false);
      return;
    }
    // Same rule as email: the person says whether they are joining or
    // returning, and a mistyped digit does not become somebody's new account.
    const sendWait = blockedFor("otp_send", parsed.data);
    if (sendWait > 0) {
      setError(describeWait(sendWait));
      setBusy(false);
      return;
    }
    const creating = signupIntent;
    const supabase = await loadSupabaseClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: parsed.data,
      options: { shouldCreateUser: creating },
    });
    /*
     * Counted whether or not the provider accepted it, for the same reason the
     * reset path counts successes: what is being rate-limited here is the
     * outbound mail, and an attacker learns nothing from which of their sends
     * worked.
     */
    noteAttempt("otp_send", parsed.data, false);
    if (err && !/user|not found|signups? not allowed|otp_disabled/i.test(err.message)) {
      setError(
        [friendlyOtpError(err.message), describeWait(blockedFor("otp_send", parsed.data))]
          .filter(Boolean)
          .join(" "),
      );
      setBusy(false);
      return;
    }
    setNotice("If that number can receive one, a one-time code is on its way.");
    navigate({
      to: "/auth/verify",
      search: {
        channel: "phone",
        identifier: parsed.data,
        next: nextPath,
        intent: creating ? "signup" : "signin",
      },
    });
  }

  /*
   * Consent is NOT collected on this form, and that is deliberate.
   *
   * `LegalConsentGate` in __root.tsx already blocks the whole application
   * until the terms are accepted and the privacy notice acknowledged, so a
   * second set of checkboxes here would ask the same person for the same
   * agreement twice and leave two places that have to be kept in step. The
   * footer links still open the documents in-site so they can be re-read at
   * any point without leaving the form.
   */
  const [legalOpen, setLegalOpen] = useState<null | "terms" | "privacy">(null);
  /*
   * Returning by default. Somebody who has an account and is asked to choose
   * loses nothing by the default being wrong; somebody who does not have one
   * and is quietly given one loses the ability to notice.
   */
  const [signupIntent, setSignupIntent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submitPassword(intent: "signin" | "signup") {
    setBusy(true);
    setError(null);
    setErrorHint(null);
    setNotice(null);
    const parsedEmail = z.string().trim().email("Enter a valid email address.").safeParse(email);
    if (!parsedEmail.success) {
      setError(parsedEmail.error.issues[0].message);
      setBusy(false);
      return;
    }
    if (password.length < 8) {
      setError("Your password needs at least 8 characters.");
      setBusy(false);
      return;
    }
    if (intent === "signup") {
      if (!authProviderAvailability.emailDelivery) {
        setError(
          "New email accounts are temporarily unavailable while production mail is prepared.",
        );
        setErrorHint("No account was created. Existing members can still sign in with a password.");
        setBusy(false);
        return;
      }
      const supabase = await loadSupabaseClient();
      const { data, error: err } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            nextPath !== DEFAULT_NEXT ? `?next=${encodeURIComponent(nextPath)}` : ""
          }`,
        },
      });
      if (err) {
        /*
         * "User already registered" answers the attacker's question, so the
         * wording says what to DO instead of what exists.
         */
        const delay = noteAttempt("signup", parsedEmail.data, false);
        setError(
          [
            /already registered|already exists/i.test(err.message)
              ? "That address cannot be used to create a new account. If it is yours, sign in — or reset the password."
              : friendlyOtpError(err.message),
            describeWait(delay),
          ]
            .filter(Boolean)
            .join(" "),
        );
        setBusy(false);
        return;
      }
      if (!data.session) {
        setNotice(
          "Account created. Check your inbox and open the confirmation link to finish signing in.",
        );
        setBusy(false);
        return;
      }
      navigate({ to: nextPath, replace: true });
      return;
    }
    const waiting = blockedFor("password_signin", parsedEmail.data);
    if (waiting > 0) {
      setError(describeWait(waiting));
      setErrorHint("You can also sign in with a one-time code, or reset your password below.");
      setBusy(false);
      return;
    }
    const supabase = await loadSupabaseClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: parsedEmail.data,
      password,
    });
    if (err) {
      const delay = noteAttempt("password_signin", parsedEmail.data, false);
      /*
       * The provider's text is not shown. It names the service, sometimes names
       * internal endpoints, and its wording distinguishes "no such user" from
       * "wrong password" — which is exactly the difference somebody working
       * through a list of addresses is trying to measure.
       */
      setError(
        [
          err.message.toLowerCase().includes("invalid login")
            ? "That email and password combination did not match an account."
            : friendlyOtpError(err.message),
          describeWait(delay),
        ]
          .filter(Boolean)
          .join(" "),
      );
      setErrorHint("You can also sign in with a one-time code, or reset your password below.");
      setBusy(false);
      return;
    }
    noteAttempt("password_signin", parsedEmail.data, true);
    navigate({ to: nextPath, replace: true });
  }

  /**
   * The wait an attempt has earned, and the record of it.
   *
   * Kept as two small functions rather than a hook so every path on this screen
   * — password sign-in, sign-up, reset, one-time code — goes through the same
   * two lines. Four screens each remembering to back off in their own way is
   * three chances to forget.
   */
  function blockedFor(action: ThrottledAction, identifier: string): number {
    return secondsUntilAllowed(loadThrottle(action, identifier), Date.now());
  }

  function noteAttempt(action: ThrottledAction, identifier: string, ok: boolean): number {
    if (ok) {
      saveThrottle(action, identifier, recordSuccess());
      return 0;
    }
    const next = recordFailure(loadThrottle(action, identifier), Date.now());
    saveThrottle(action, identifier, next);
    return secondsUntilAllowed(next, Date.now());
  }

  async function sendPasswordReset() {
    if (!authProviderAvailability.emailDelivery) {
      setError(
        "Password reset email is temporarily unavailable while production mail is prepared.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setErrorHint(null);
    setNotice(null);
    const parsedEmail = z.string().trim().email("Enter a valid email address.").safeParse(email);
    if (!parsedEmail.success) {
      setError("Enter your email address first, then choose Forgot password.");
      setBusy(false);
      return;
    }
    const waiting = blockedFor("password_reset", parsedEmail.data);
    if (waiting > 0) {
      setBusy(false);
      setError(describeWait(waiting));
      return;
    }
    const supabase = await loadSupabaseClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      const delay = noteAttempt("password_reset", parsedEmail.data, false);
      setError([friendlyOtpError(err.message), describeWait(delay)].filter(Boolean).join(" "));
      return;
    }
    /*
     * A SUCCESSFUL SEND IS RATE-LIMITED TOO, AND THAT IS NOT THE SAME RULE.
     *
     * Everywhere else the backoff counts failures. Here it counts sends,
     * because the thing being abused is the mail itself: a reset endpoint that
     * succeeds every time is a way to fill somebody's inbox using nothing but
     * their address. The notice below is deliberately the same whether or not
     * the address has an account.
     */
    noteAttempt("password_reset", parsedEmail.data, false);
    setNotice(
      "If that address has an account, a password reset link is on its way. The link expires shortly.",
    );
  }

  async function sendEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!authProviderAvailability.emailDelivery) {
      setError(
        "Email one-time codes are temporarily unavailable while production mail is prepared.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const parsed = z.string().trim().email("Enter a valid email address.").safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setBusy(false);
      return;
    }
    /*
     * A ONE-TIME CODE MUST NOT QUIETLY CREATE AN ACCOUNT.
     *
     * This was `shouldCreateUser: true` on a control labelled "Send one-time
     * code", under a heading that says "Sign in". Two people were harmed by
     * that. Somebody returning to OCADE who mistyped one character of their
     * address got a brand-new empty account instead of a failure — signed in,
     * with none of their conversations, and no way to tell what had happened.
     * And somebody genuinely new had an account created for them before they
     * had passed the point where OCADE says what an account is.
     *
     * The person now says which they meant. `signupIntent` is their answer,
     * and it travels to the verify screen so a Resend cannot quietly change it
     * either.
     */
    const creating = signupIntent;
    const supabase = await loadSupabaseClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: creating,
        emailRedirectTo: `${window.location.origin}/auth/callback${
          nextPath !== DEFAULT_NEXT ? `?next=${encodeURIComponent(nextPath)}` : ""
        }`,
      },
    });
    /*
     * A REFUSAL IS NOT REPORTED, AND THAT IS THE POINT.
     *
     * With `shouldCreateUser: false` the provider answers "no such user" for an
     * address that has no account. Showing that turns this form into an oracle:
     * anybody can check whether a given person has an OCADE account by typing
     * it in. So the screen says the same sentence either way and moves on to
     * the code entry, which tells nobody anything. Real errors — a network
     * failure, a rate limit — are still shown, because those are about the
     * request rather than about the account.
     */
    if (err && !/user|not found|signups? not allowed|otp_disabled/i.test(err.message)) {
      setError(friendlyOtpError(err.message));
      setBusy(false);
      return;
    }
    setNotice(OTP_SENT_NOTICE);
    navigate({
      to: "/auth/verify",
      search: {
        channel: "email",
        identifier: parsed.data,
        next: nextPath,
        intent: creating ? "signup" : "signin",
      },
    });
  }

  return (
    <AuthShell
      title="Welcome to CARCC CADANE"
      subtitle="One account for OCADE."
      footer={
        <>
          {/*
            Buttons, not links. A `<Link to="/terms">` navigated away from this
            form and discarded whatever had been typed into it — which is a
            cruel thing to do to somebody who followed the link precisely
            because they were about to agree to it.

            `/terms` and `/privacy` still exist as real pages so the documents
            can be linked from outside OCADE; from inside, they open here.
          */}
          {/*
            THESE ARE 24 CSS PIXELS TALL BECAUSE A THUMB IS NOT A MOUSE.

            They were 30x16 and 73x16 — under the WCAG 2.5.8 floor of 24x24 —
            and the route audit found them at phone width on EVERY signed-out
            route, because this footer is what a phone user sees before they
            are signed in. The links people are most likely to want on a phone,
            the terms and the privacy notice, were the hardest to hit on one.

            `min-h` rather than padding: the type size is unchanged, only the
            hit area grows, so the footer looks the same and is reachable.
          */}
          Read our{` `}
          <button
            type="button"
            onClick={() => setLegalOpen("terms")}
            className="-mx-1 inline-flex min-h-6 items-center rounded px-1 underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            terms
          </button>
          {` `}
          and{` `}
          <button
            type="button"
            onClick={() => setLegalOpen("privacy")}
            className="-mx-1 inline-flex min-h-6 items-center rounded px-1 underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            privacy notice
          </button>
          . Your work is kept in your account, so it is there on every device you sign in on.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!authConfigured ? (
          <div
            role="status"
            className="rounded-md border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] px-3 py-2 text-xs text-[color:var(--state-warning)]"
          >
            Sign-in is temporarily unavailable because this deployment is missing its private
            service configuration. The public information pages remain available, and no data was
            sent to another service.
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            {notice}
          </div>
        ) : null}

        <Link
          to="/blog/$slug"
          params={{ slug: "why-ocade-starts-local" }}
          className="rounded-md border border-border/60 bg-background/35 px-3 py-2.5 text-xs hover:border-primary/35"
        >
          <span className="block font-medium text-foreground">Why OCADE starts local</span>
          <span className="mt-1 block text-muted-foreground">
            Read the product note before deciding whether to sign in or create an account.
          </span>
        </Link>

        {/*
          RETURNING OR JOINING — asked once, plainly, before anything is sent.

          The screen used to say "New here or returning — the same screen works
          for both", which was true of the form and not true of the
          consequences: the one-time code path created an account for any
          address typed into it. Asking costs one tap and removes a whole class
          of "where did my conversations go".
        */}
        <div
          role="radiogroup"
          aria-label="Are you signing in or creating an account?"
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1"
        >
          {/*
            NOT "Sign in" / "Create account", which is what these said first.

            The submit button below says "Sign in" too, so the screen carried
            two different controls with the same words — and the route audit's
            sign-in step, which looks for a button labelled "Sign in", clicked
            this one instead. It set the intent, submitted nothing, and every
            "signed in" route check afterwards silently ran signed OUT.

            A harness can be taught to disambiguate. A person cannot, and they
            are the reason to fix it here: the two controls do different things
            and must not read identically.
          */}
          {[
            { id: false, label: "I have an account", hint: "Sign in to OCADE" },
            { id: true, label: "I am new here", hint: "Create an OCADE account" },
          ].map((option) => (
            <button
              key={String(option.id)}
              type="button"
              role="radio"
              aria-checked={signupIntent === option.id}
              title={option.hint}
              onClick={() => {
                setSignupIntent(option.id);
                setNotice(null);
                setError(null);
                setErrorHint(null);
              }}
              className={cn(
                "inline-flex min-h-[32px] items-center justify-center rounded-md px-2 py-1.5",
                "text-xs font-medium transition-colors",
                signupIntent === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Method tabs */}
        <div
          role="tablist"
          aria-label="Sign-in method"
          className="grid gap-1 rounded-lg bg-muted/40 p-1"
          style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}
        >
          {methods.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={method === m.id}
              onClick={() => {
                setMethod(m.id);
                setNotice(null);
              }}
              className={cn(
                // min-h keeps the hit area at the WCAG 2.5.8 floor of 24px
                // without enlarging the type: these were 21px tall, which is
                // fine with a mouse and a guess with a thumb.
                "inline-flex min-h-[24px] items-center justify-center rounded-md px-2 py-1.5",
                "text-xs font-medium transition-colors",
                method === m.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === "google" ? (
          <button
            disabled={busy || !authConfigured}
            onClick={() => signInOAuth("google")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleGlyph />}
            Continue with Google
          </button>
        ) : null}

        {method === "apple" ? (
          <button
            disabled={busy || !authConfigured}
            onClick={() => signInOAuth("apple")}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppleGlyph />}
            Continue with Apple
          </button>
        ) : null}

        {method === "phone" ? (
          <form onSubmit={sendPhoneOtp} className="flex flex-col gap-3">
            <label htmlFor="phone" className="text-xs font-medium text-muted-foreground">
              Phone number
            </label>
            <div className="flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+14155551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !authConfigured}
              className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send one-time code
            </button>
          </form>
        ) : null}

        {method === "email" ? (
          <form onSubmit={sendEmailOtp} className="flex flex-col gap-3">
            {!authProviderAvailability.emailDelivery ? (
              <div
                role="status"
                className="rounded-md border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] px-3 py-2 text-xs text-[color:var(--state-warning)]"
              >
                Existing members can sign in with a password. New email accounts, one-time codes,
                and password reset will open after production mail delivery is verified.
              </div>
            ) : null}
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <div className="flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password{" "}
              <span className="font-normal">(optional — leave empty for a one-time code)</span>
            </label>
            <div className="flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                /*
                 * The autocomplete token has to match what is about to happen,
                 * or the password manager offers the wrong thing: `new-password`
                 * asks it to GENERATE one, `current-password` asks it to FILL
                 * the saved one. A create-account form advertising
                 * `current-password` is why managers quietly stop offering to
                 * save new logins.
                 */
                autoComplete={signupIntent ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {password.length > 0 ? (
              <button
                type="button"
                onClick={() => submitPassword(signupIntent ? "signup" : "signin")}
                disabled={
                  busy ||
                  !authConfigured ||
                  (signupIntent && !authProviderAvailability.emailDelivery)
                }
                className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {signupIntent ? "Create account" : "Sign in"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !authConfigured || !authProviderAvailability.emailDelivery}
                className="inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {signupIntent ? "Create account with a one-time code" : "Send one-time code"}
              </button>
            )}
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={busy || !authConfigured || !authProviderAvailability.emailDelivery}
              className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-60"
            >
              Forgot password?
            </button>
          </form>
        ) : null}

        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <p className="font-medium">{error}</p>
            {errorHint ? <p className="mt-1 text-destructive/85">{errorHint}</p> : null}
          </div>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          Your choice above decides whether OCADE signs you in or makes a new account.{" "}
          <Link to="/" className="text-foreground underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
      <LegalDialog
        open={legalOpen !== null}
        document={legalOpen ?? "terms"}
        onOpenChange={(next) => {
          if (!next) setLegalOpen(null);
        }}
      />
    </AuthShell>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M21.35 11.1H12v3.2h5.35c-.23 1.38-1.62 4.05-5.35 4.05-3.22 0-5.85-2.66-5.85-5.95S8.78 6.45 12 6.45c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.86 3.98 14.66 3 12 3 6.98 3 3 6.98 3 12s3.98 9 9 9c5.19 0 8.63-3.64 8.63-8.78 0-.59-.06-1.05-.28-1.12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M16.36 12.55c-.03-2.63 2.15-3.9 2.25-3.96-1.23-1.79-3.14-2.03-3.82-2.06-1.63-.16-3.18.96-4.01.96-.84 0-2.11-.94-3.47-.91-1.78.03-3.43 1.03-4.35 2.62-1.85 3.21-.47 7.95 1.33 10.55.88 1.27 1.93 2.7 3.29 2.65 1.32-.05 1.82-.85 3.41-.85 1.59 0 2.05.85 3.45.83 1.43-.03 2.33-1.3 3.2-2.58 1-1.48 1.42-2.92 1.44-3-.03-.01-2.76-1.06-2.79-4.19ZM13.86 4.6c.73-.88 1.22-2.11 1.09-3.33-1.05.04-2.32.7-3.07 1.58-.68.78-1.27 2.03-1.11 3.22 1.17.09 2.36-.59 3.09-1.47Z"
        fill="currentColor"
      />
    </svg>
  );
}
