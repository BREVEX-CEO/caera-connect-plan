import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
  type ThrottledAction,
} from "@/lib/auth/throttle";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safe-next";
import { describeOAuthError, readOAuthErrorFromUrl } from "@/lib/auth/oauth-errors";
import { authProviderAvailability } from "@/lib/auth/provider-availability";
import {
  CALLING_COUNTRIES,
  DEFAULT_CALLING_COUNTRY,
  describePhoneProblem,
  flagFor,
  toE164,
} from "@/lib/auth/phone-numbers";
import { cn } from "@/lib/utils";

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
    if (data.session) throw redirect({ to: safeNext(search.next) ?? DEFAULT_NEXT });
  },
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
 * THE WAY IN, AND THERE ARE THREE OF THEM.
 *
 * Continue with Google, a six-digit code to an email address, a six-digit code
 * to a phone number. `docs/APP_FLOW.md` names exactly those, and the screen
 * that this replaced offered Apple and Microsoft buttons for providers nobody
 * had configured, a password field beside the code field, and 821 lines of
 * branching between them.
 *
 * THE PASSWORD IS NOT HERE, AND THAT IS THE DECISION RATHER THAN AN OMISSION.
 * A password is optional and managed under Account; `/reset-password` remains
 * for the people who set one. Putting it on the first screen makes the common
 * case — a code, arriving in seconds, with nothing to remember — look like the
 * fallback.
 *
 * WHAT A FAILURE IS ALLOWED TO SAY. Never the provider's own text, which names
 * the provider and is written for whoever operates it. Never whether an account
 * exists: "no user found" and "wrong code" become the same sentence, because
 * the difference between them is exactly what somebody probing a list of
 * addresses is trying to learn.
 */
type Channel = "email" | "phone";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const nextPath = safeNext(search.next) ?? DEFAULT_NEXT;
  const configured = getSupabaseBrowserConfiguration().configured;

  const inbound = readOAuthErrorFromUrl(
    { error: search.error, error_description: search.error_description },
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const inboundFriendly = inbound
    ? describeOAuthError("google", inbound.code, inbound.description)
    : null;

  const [channel, setChannel] = useState<Channel>(
    authProviderAvailability.emailDelivery ? "email" : "phone",
  );
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(DEFAULT_CALLING_COUNTRY);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(inboundFriendly?.message ?? null);
  const [hint, setHint] = useState<string | null>(inboundFriendly?.hint ?? null);
  const [notice, setNotice] = useState<string | null>(search.message ?? null);

  useEffect(() => {
    setError(null);
    setHint(null);
  }, [channel]);

  /** One place to refuse a request that is arriving too fast. */
  function blockedBy(action: ThrottledAction, identifier: string): string | null {
    const state = loadThrottle(action, identifier);
    const wait = secondsUntilAllowed(state, Date.now());
    return wait > 0 ? describeWait(wait) : null;
  }

  async function continueWithGoogle() {
    if (!authProviderAvailability.google) {
      setError("Google sign-in is not available yet.");
      setHint("Use a code sent to your email address or phone number instead.");
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
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${
            nextPath !== DEFAULT_NEXT ? `?next=${encodeURIComponent(nextPath)}` : ""
          }`,
        },
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
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) {
      setError("Enter your email address.");
      return;
    }
    if (!authProviderAvailability.emailDelivery) {
      setError("Email codes are not available yet.");
      setHint("Continue with Google instead.");
      return;
    }
    const blocked = blockedBy("otp_send", address);
    if (blocked) {
      setError(blocked);
      return;
    }

    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const supabase = await loadSupabaseClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({ email: address });
      if (sendError) {
        saveThrottle(
          "otp_send",
          address,
          recordFailure(loadThrottle("otp_send", address), Date.now()),
        );
        setError(friendlyOtpError(sendError.message));
        setBusy(false);
        return;
      }
      saveThrottle("otp_send", address, recordSuccess());
      setNotice(OTP_SENT_NOTICE);
      void navigate({
        to: "/auth/verify",
        search: { channel: "email", identifier: address, next: nextPath },
      });
    } catch {
      setError("OCADE could not send a code just now. Try again in a moment.");
      setBusy(false);
    }
  }

  async function sendPhoneCode(event: React.FormEvent) {
    event.preventDefault();
    if (!authProviderAvailability.phone) {
      setError("Phone codes are not available yet.");
      setHint("Continue with Google, or use your email address instead.");
      return;
    }
    const normalised = toE164(phone, country);
    if (!normalised.ok) {
      setError(describePhoneProblem(normalised.reason));
      return;
    }
    const blocked = blockedBy("otp_send", normalised.e164);
    if (blocked) {
      setError(blocked);
      return;
    }

    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const supabase = await loadSupabaseClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({ phone: normalised.e164 });
      if (sendError) {
        saveThrottle(
          "otp_send",
          normalised.e164,
          recordFailure(loadThrottle("otp_send", normalised.e164), Date.now()),
        );
        setError(friendlyOtpError(sendError.message));
        setBusy(false);
        return;
      }
      saveThrottle("otp_send", normalised.e164, recordSuccess());
      setNotice(OTP_SENT_NOTICE);
      void navigate({
        to: "/auth/verify",
        search: { channel: "phone", identifier: normalised.e164, next: nextPath },
      });
    } catch {
      setError("OCADE could not send a code just now. Try again in a moment.");
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

  return (
    <AuthShell
      title="Sign in to OCADE"
      subtitle="Continue with Google, or have a six-digit code sent to you."
      footer={
        <>
          By continuing you accept the <Link to="/terms">Terms &amp; Conditions</Link> and the{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </>
      }
    >
      {authProviderAvailability.google ? (
        <>
          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Continue with Google
          </button>
          <div className="my-5 flex items-center gap-3 text-[13px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <div className="mb-4 flex rounded-md border border-border p-0.5" role="tablist">
        {(["email", "phone"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={channel === id}
            onClick={() => setChannel(id)}
            className={cn(
              "h-8 flex-1 rounded text-sm capitalize transition-colors",
              channel === id ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
          >
            {id}
          </button>
        ))}
      </div>

      {channel === "email" ? (
        <form onSubmit={sendEmailCode} className="space-y-3">
          <label className="block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>
          <SubmitButton busy={busy}>Send code</SubmitButton>
        </form>
      ) : (
        <form onSubmit={sendPhoneCode} className="space-y-3">
          <div className="flex gap-2">
            <label className="shrink-0">
              <span className="sr-only">Country calling code</span>
              <select
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring"
              >
                {CALLING_COUNTRIES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {flagFor(entry.code)} {entry.code} +{entry.dial}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Phone number</span>
              <input
                type="tel"
                autoComplete="tel-national"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            </label>
          </div>
          <SubmitButton busy={busy}>Send code</SubmitButton>
        </form>
      )}

      {error ? (
        <p className="mt-4 text-[13px] text-foreground" role="alert">
          {error}
          {hint ? <span className="mt-1 block text-muted-foreground">{hint}</span> : null}
        </p>
      ) : notice ? (
        <p className="mt-4 text-[13px] text-muted-foreground" role="status">
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
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
