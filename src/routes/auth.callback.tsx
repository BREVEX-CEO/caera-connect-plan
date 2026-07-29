import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/shell/AuthShell";

const searchSchema = z.object({
  next: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Signing you in — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { next, error: providerError, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(
    providerError ? (error_description ?? providerError) : null,
  );

  useEffect(() => {
    if (error) return;
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

    let cancelled = false;

    const check = async () => {
      const { data, error: err } = await supabase.auth.getSession();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      if (data.session) {
        navigate({ to: target, replace: true });
        return;
      }
      // Wait for onAuthStateChange to fire from the OAuth handler.
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) navigate({ to: target, replace: true });
    });

    const timeout = window.setTimeout(() => {
      if (!cancelled) setError("Sign-in is taking longer than expected. Please try again.");
    }, 12000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [error, navigate, next]);

  return (
    <AuthShell
      title="Signing you in"
      subtitle="Completing your sign-in — this should only take a moment."
    >
      {error ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Back to sign-in
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Verifying your session…
        </div>
      )}
    </AuthShell>
  );
}
