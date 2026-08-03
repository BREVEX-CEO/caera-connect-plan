import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/shell/AuthShell";

const searchSchema = z.object({
  channel: z.enum(["phone", "email"]),
  identifier: z.string().min(1),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/verify")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Enter your code — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { channel, identifier, next } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

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
      setError(err.message);
      setBusy(false);
      return;
    }
    navigate({ to: target, replace: true });
  }

  async function resend() {
    setError(null);
    setResent(false);
    const { error: err } =
      channel === "phone"
        ? await supabase.auth.signInWithOtp({ phone: identifier })
        : await supabase.auth.signInWithOtp({ email: identifier });
    if (err) setError(err.message);
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
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {resent ? "Code resent." : "Didn't get it? Resend."}
        </button>
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
