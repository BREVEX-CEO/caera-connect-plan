import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/shell/AuthShell";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — CAERA CADANE" },
      {
        name: "description",
        content: "Set a new password for your CAERA CADANE account from your reset link.",
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
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (!cancelled) {
          setLinkValid(true);
          setReady(true);
        }
      }
    });
    void (async () => {
      const hash = window.location.hash ?? "";
      const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
      }
      if (params.get("error_description")) {
        if (!cancelled) {
          setError(params.get("error_description"));
          setReady(true);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setLinkValid(Boolean(data.session));
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
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/home", replace: true }), 1200);
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a new password for your CAERA CADANE account."
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
              {error ?? "Reset links expire quickly and can only be used once."}
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
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 focus-within:ring-2 focus-within:ring-ring">
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
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 px-3 focus-within:ring-2 focus-within:ring-ring">
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
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update password
          </button>
        </form>
      )}
    </AuthShell>
  );
}
