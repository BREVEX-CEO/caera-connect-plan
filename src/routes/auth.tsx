import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { AuthShell } from "@/components/shell/AuthShell";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  next: z.string().optional(),
  message: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const target = safeNext(search.next) ?? "/home";
      throw redirect({ to: target });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — CAERA CADANE" },
      { name: "description", content: "Sign in to your CAERA CADANE workspace." },
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
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(search.message ?? null);

  useEffect(() => {
    setError(null);
  }, [method]);

  async function signInOAuth(provider: "google" | "apple") {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback${
          nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""
        }`,
      });
      if (result.error) {
        setError(result.error.message ?? `Could not sign in with ${provider}.`);
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: nextPath, replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
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
    const { error: err } = await supabase.auth.signInWithOtp({ phone: parsed.data });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    navigate({
      to: "/auth/verify",
      search: { channel: "phone", identifier: parsed.data, next: nextPath },
    });
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
    const { error: err } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback${
          nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""
        }`,
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    navigate({
      to: "/auth/verify",
      search: { channel: "email", identifier: parsed.data, next: nextPath },
    });
  }

  return (
    <AuthShell
      title="Welcome to CAERA CADANE"
      subtitle="One account for OCADE."
      footer={
        <>
          By continuing you agree to our terms and privacy notice. Your workspace defaults to
          Private Sync — you can switch it to Device Only anytime.
        </>
      }
    >
      <div className="flex flex-col gap-5">
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
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
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
            disabled={busy}
            onClick={() => signInOAuth("google")}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleGlyph />}
            Continue with Google
          </button>
        ) : null}

        {method === "apple" ? (
          <button
            disabled={busy}
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
              disabled={busy}
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
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send one-time code
            </button>
          </form>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          New here or returning — the same screen works for both.{" "}
          <Link to="/" className="text-foreground underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
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
