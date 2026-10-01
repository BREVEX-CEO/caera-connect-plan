import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/shell/AuthShell";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { enterConsole } from "@/lib/admin/console.functions";
import { onSite } from "@/lib/admin/console-host";

/**
 * THE CONSOLE'S WAY IN. The site sent a one-time sign-in in the fragment; the
 * console's server turns it into this origin's own session (see
 * `console.functions.ts`), and the fragment is gone from the address bar and
 * the history before anything else happens.
 */
export const Route = createFileRoute("/auth/console")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Opening the console — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: EnterConsolePage,
});

function EnterConsolePage() {
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
    window.history.replaceState(null, "", "/auth/console");
    void (async () => {
      try {
        if (!token) throw new Error("Open the console from your account menu in OCADE.");
        const tokens = await enterConsole({ data: { token } });
        const supabase = await loadSupabaseClient();
        // A console session this browser already held is ended, not left behind.
        const { data } = await supabase.auth.getSession();
        if (data.session) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        const { error } = await supabase.auth.setSession(tokens);
        if (error) throw error;
        window.location.replace("/admin");
      } catch (cause) {
        setProblem(cause instanceof Error ? cause.message : "The console could not open.");
      }
    })();
  }, []);

  return (
    <AuthShell title="Opening the console">
      {problem ? (
        <div role="alert" className="space-y-3 text-sm text-foreground">
          <p>{problem === "Not found" ? "The console could not open." : problem}</p>
          <a
            href={
              typeof window === "undefined"
                ? "/"
                : onSite(new URL("/admin", window.location.href)).toString()
            }
            className="underline underline-offset-2"
          >
            Back to OCADE
          </a>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing you in…
        </p>
      )}
    </AuthShell>
  );
}
