import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/shell/AuthShell";
import { answerChallenge, listVerifiedFactors, type SecondFactor } from "@/lib/security/mfa";
import { DEFAULT_NEXT, safeNext } from "@/lib/auth/safe-next";
import { redeemRecoveryCode } from "@/lib/security/recovery.functions";

/**
 * THE SECOND FACTOR, ASKED FOR AT SIGN-IN.
 *
 * An enrolled account whose session is `aal1` has proved one factor and not the
 * other. Without this screen the factor is an ornament: it exists, it appears
 * in Settings, and a stolen credential still reaches every screen.
 *
 * IT LIVES UNDER `/auth`, NOT INSIDE THE PRODUCT. It used to be
 * `/_authenticated/challenge`, which put the screen that completes signing in
 * behind the gate that requires signing in to be complete. Nothing broke —
 * `aal1` is a session — but the layering was upside down, and the workspace
 * shell rendered around a screen that is part of the way in.
 *
 * WHY THE RECOVERY PATH IS HERE AND NOT BEHIND A SUPPORT ADDRESS. This is
 * exactly where somebody stands when they have lost their phone. Sending them
 * somewhere that itself needs a completed sign-in is the loop that makes people
 * abandon accounts.
 *
 * WHAT A RECOVERY CODE DOES, PRECISELY: it removes the lost factor and revokes
 * every session, including this one. It is not a way past the challenge — using
 * one signs you out, and you sign in again and enrol a new app. If a code let
 * you straight in, a stolen sheet of paper would be a password.
 */
export const Route = createFileRoute("/auth/challenge")({
  ssr: false,
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({
    meta: [{ title: "Confirm it is you — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: ChallengePage,
});

function ChallengePage() {
  const { next } = Route.useSearch();

  const [factors, setFactors] = useState<SecondFactor[] | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingRecovery, setUsingRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recovered, setRecovered] = useState(false);

  /*
   * A FAILED READ MUST END THE WAITING.
   *
   * The failure set an error the spinner branch never rendered, so the screen
   * span forever and said nothing — on the one screen somebody reaches while
   * they are trying to get into their account.
   */
  const load = useCallback(async () => {
    setError(null);
    try {
      const verified = await listVerifiedFactors();
      setFactors(verified);
      setFactorId(verified[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this account.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * `safeNext` is the same guard every other auth screen uses, and it is not
   * optional here: `next` comes from the URL, so without it this screen would
   * forward somebody to any address an attacker put in a link — a redirect that
   * looks like it came from inside OCADE.
   */
  const destination = safeNext(next ?? null) ?? DEFAULT_NEXT;

  const confirm = useCallback(async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      await answerChallenge(factorId, code);
      /*
       * A full document load rather than a client navigation. The access token
       * has been replaced with one carrying `aal2`, and the route guard reads
       * assurance in `beforeLoad`; a soft navigation can reuse the resolved
       * context and bounce straight back here.
       */
      window.location.assign(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }, [factorId, code, destination]);

  const recover = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await redeemRecoveryCode({ data: { code: recoveryCode } });
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      // The server ended every session. Clearing this browser's copy stops it
      // briefly believing in one the server has already destroyed.
      const { loadSupabaseClient } = await import("@/integrations/supabase/on-demand");
      await (await loadSupabaseClient()).auth.signOut({ scope: "local" }).catch(() => undefined);
      setRecovered(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }, [recoveryCode]);

  if (recovered) {
    return (
      <AuthShell title="Two-step verification is off">
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          Your authenticator app was removed and every session signed out. Sign in again, then turn
          two-step verification on with your new phone.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/auth")}
          className="mt-5 flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Go to sign in
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Confirm it is you"
      subtitle={
        usingRecovery
          ? "Enter one of the recovery codes you saved. It turns two-step verification off and signs you out everywhere; it does not sign you in."
          : "Open your authenticator app and enter the six-digit code it is showing."
      }
      footer={
        <button
          type="button"
          onClick={() =>
            // Leaving the challenge must end this half-signed-in session first,
            // or "a different account" lands back in the same one.
            void import("@/integrations/supabase/on-demand")
              .then(({ loadSupabaseClient }) => loadSupabaseClient())
              .then((supabase) => supabase.auth.signOut({ scope: "local" }))
              .finally(() => window.location.assign("/auth"))
          }
          className="transition-colors hover:text-foreground"
        >
          Use a different account
        </button>
      }
    >
      {factors === null && error ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm text-foreground underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : factors === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading this account…
        </p>
      ) : usingRecovery ? (
        <div className="space-y-3">
          <label className="block">
            <span className="sr-only">Recovery code</span>
            <input
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="A1B2C-3D4E5-F6G7H-J8K9M"
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 font-mono text-sm tracking-wide text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>
          {error ? (
            <p role="alert" className="text-[13px] text-foreground">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void recover()}
            disabled={busy || recoveryCode.trim().length < 20}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Use this code
          </button>
          <button
            type="button"
            onClick={() => {
              setUsingRecovery(false);
              setError(null);
            }}
            disabled={busy}
            className="flex h-9 w-full items-center justify-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {factors.length > 1 ? (
            <label className="block">
              <span className="sr-only">Which authenticator app</span>
              <select
                value={factorId ?? ""}
                onChange={(event) => setFactorId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
              >
                {factors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="sr-only">Six-digit code from your authenticator app</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              className="h-12 w-full rounded-md border border-border bg-transparent text-center font-mono text-xl tracking-[0.4em] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>

          {error ? (
            <p role="alert" className="text-[13px] text-foreground">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !factorId || code.length < 6}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Confirm
          </button>
          <button
            type="button"
            onClick={() => {
              setUsingRecovery(true);
              setError(null);
            }}
            disabled={busy}
            className="flex h-9 w-full items-center justify-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            I lost my authenticator
          </button>
        </div>
      )}
    </AuthShell>
  );
}
