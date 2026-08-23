import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Phone, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowserConfiguration, supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LegalDialog } from "@/components/legal/LegalDialog";
import { AuthShell } from "@/components/shell/AuthShell";
import { OTP_SENT_NOTICE, friendlyOtpError } from "@/lib/auth/otp";
import { cn } from "@/lib/utils";
import { describeOAuthError, readOAuthErrorFromUrl } from "@/lib/auth/oauth-errors";

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
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const target = safeNext(search.next) ?? "/home";
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

function safeNext(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (typeof window !== "undefined") {
    try {
      const u = new URL(value, window.location.origin);
      if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
    } catch {
      /* fall through */
    }
  }
  return null;
}

type Method = "google" | "apple" | "phone" | "email";

const methods: { id: Method; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
];

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const nextPath = safeNext(search.next) ?? "/home";
  const [method, setMethod] = useState<Method>("google");
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
    setBusy(true);
    setError(null);
    setErrorHint(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback${
          nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""
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
    const creating = signupIntent;
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: parsed.data,
      options: { shouldCreateUser: creating },
    });
    if (err && !/user|not found|signups? not allowed|otp_disabled/i.test(err.message)) {
      setError(friendlyOtpError(err.message));
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
      const { data, error: err } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""
          }`,
        },
      });
      if (err) {
        /*
         * "User already registered" answers the attacker's question, so the
         * wording says what to DO instead of what exists.
         */
        setError(
          /already registered|already exists/i.test(err.message)
            ? "That address cannot be used to create a new account. If it is yours, sign in — or reset the password."
            : err.message,
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
    const { error: err } = await supabase.auth.signInWithPassword({
      email: parsedEmail.data,
      password,
    });
    if (err) {
      setError(
        err.message.toLowerCase().includes("invalid login")
          ? "That email and password combination did not match an account."
          : err.message,
      );
      setErrorHint("You can also sign in with a one-time code, or reset your password below.");
      setBusy(false);
      return;
    }
    navigate({ to: nextPath, replace: true });
  }

  async function sendPasswordReset() {
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
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNotice(
      "If that address has an account, a password reset link is on its way. The link expires shortly.",
    );
  }

  async function sendEmailOtp(e: React.FormEvent) {
    e.preventDefault();
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
    const { error: err } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: creating,
        emailRedirectTo: `${window.location.origin}/auth/callback${
          nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""
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
          . Your workspace defaults to Private Sync — you can switch it to Device Only anytime.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!authConfigured ? (
          <div
            role="status"
            className="rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]"
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
          to="/demo"
          className="flex items-center justify-between rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)] hover:bg-[color:var(--state-warning)]/20"
        >
          <span>Just looking? Try the demo — no sign-in, sample data only.</span>
          <span className="font-semibold uppercase tracking-wider">Demo →</span>
        </Link>

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
          {[
            { id: false, label: "Sign in", hint: "I already have an OCADE account" },
            { id: true, label: "Create account", hint: "I am new to OCADE" },
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
          className="grid grid-cols-4 gap-1 rounded-lg bg-muted/40 p-1"
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
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 focus-within:ring-2 focus-within:ring-ring">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+14155551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !authConfigured}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send one-time code
            </button>
          </form>
        ) : null}

        {method === "email" ? (
          <form onSubmit={sendEmailOtp} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 focus-within:ring-2 focus-within:ring-ring">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password{" "}
              <span className="font-normal">(optional — leave empty for a one-time code)</span>
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 focus-within:ring-2 focus-within:ring-ring">
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
                disabled={busy || !authConfigured}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {signupIntent ? "Create account" : "Sign in"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !authConfigured}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {signupIntent ? "Create account with a one-time code" : "Send one-time code"}
              </button>
            )}
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={busy || !authConfigured}
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
