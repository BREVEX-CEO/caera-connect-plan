import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { answerChallenge, listVerifiedFactors, type SecondFactor } from "@/lib/security/mfa";
import { redeemRecoveryCode } from "@/lib/security/mfa.functions";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * THE SECOND FACTOR, ASKED FOR AT SIGN-IN.
 *
 * An enrolled account whose session is `aal1` has proved one factor and not the
 * other. Without this screen the factor is an ornament: it exists, it appears
 * in Settings, and a stolen password still reaches every screen in the product.
 *
 * WHY THE RECOVERY PATH IS ON THIS SCREEN AND NOT BEHIND A SUPPORT EMAIL. This
 * is exactly where somebody stands when they have lost their phone. Sending
 * them away to find a different route — one that would itself need them to
 * sign in, which is what they cannot finish — is the loop that makes people
 * abandon accounts. The way out is offered at the moment it is needed.
 *
 * WHAT A RECOVERY CODE DOES HERE, precisely: it removes the lost factor and
 * revokes every session, including this one. It is not a way past the
 * challenge — using one signs you out and you sign in again with your
 * password, then set up a new app. That is the whole point: if a code let you
 * straight in, a stolen sheet of paper would be a password.
 */
export const Route = createFileRoute("/_authenticated/challenge")({
  head: () => ({
    meta: [{ title: "Confirm it is you — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  component: ChallengePage,
});

function ChallengePage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  const [factors, setFactors] = useState<SecondFactor[] | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usingRecovery, setUsingRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recovered, setRecovered] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const verified = await listVerifiedFactors();
        setFactors(verified);
        setFactorId(verified[0]?.id ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read this account.");
      }
    })();
  }, []);

  /*
   * Where to go once the challenge passes.
   *
   * `safeNext` is the same guard the sign-in screen uses, and it is not
   * optional: `next` comes from the URL, so without it this screen would
   * forward somebody to any address an attacker put in a link — a redirect
   * that looks like it came from inside OCADE.
   */
  const destination = safeNext(next ?? null) ?? "/ocade";

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
    const supabase = await loadSupabaseClient();
    setBusy(true);
    setError(null);
    try {
      const outcome = await redeemRecoveryCode({ data: { code: recoveryCode } });
      if (!outcome.ok) {
        setError(outcome.message);
        setBusy(false);
        return;
      }
      /*
       * The server has already revoked every session. Clearing the local copy
       * stops the app briefly believing in a session the server has destroyed,
       * which otherwise renders one confusing frame of a signed-in shell.
       */
      await supabase.auth.signOut().catch(() => undefined);
      setRecovered(
        "Your authenticator app has been removed and every session signed out. Sign in with your password, then set up a new app.",
      );
      setBusy(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }, [recoveryCode]);

  if (recovered) {
    return (
      <Shell title="Authenticator app removed">
        <p role="status" className="text-sm text-foreground">
          {recovered}
        </p>
        <button
          onClick={() => navigate({ to: "/auth", replace: true })}
          className="mt-4 inline-flex items-center rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25"
        >
          Go to sign in
        </button>
      </Shell>
    );
  }

  return (
    <Shell title="Confirm it is you">
      {factors === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading this account…
        </p>
      ) : usingRecovery ? (
        <>
          <p className="text-sm text-muted-foreground">
            Enter one of the recovery codes you saved. It removes the authenticator app from this
            account and signs you out everywhere — it does not sign you in.
          </p>
          <label className="mt-4 block">
            <span className="text-xs text-muted-foreground">Recovery code</span>
            <input
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              autoComplete="off"
              placeholder="A1B2C-3D4E5"
              aria-label="Recovery code"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-sm tracking-wide text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary/60"
            />
          </label>
          {error ? <Problem text={error} /> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => void recover()}
              disabled={busy || recoveryCode.trim().length < 8}
              className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Use this code
            </button>
            <button
              onClick={() => {
                setUsingRecovery(false);
                setError(null);
              }}
              disabled={busy}
              className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Back
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Open your authenticator app and enter the six-digit code it is showing.
          </p>

          {factors.length > 1 ? (
            <label className="mt-4 block">
              <span className="text-xs text-muted-foreground">Which app?</span>
              <select
                value={factorId ?? ""}
                onChange={(event) => setFactorId(event.target.value)}
                aria-label="Which authenticator app"
                className="mt-1 w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              >
                {factors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs text-muted-foreground">Six-digit code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={8}
              aria-label="Six-digit code from your authenticator app"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-sm tracking-widest text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary/60"
            />
          </label>

          {error ? <Problem text={error} /> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => void confirm()}
              disabled={busy || !factorId || code.replace(/\s/g, "").length < 6}
              className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Confirm
            </button>
            <button
              onClick={() => {
                setUsingRecovery(true);
                setError(null);
              }}
              disabled={busy}
              className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              I have lost my phone
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70svh] w-full max-w-md items-center px-4">
      <GlassPanel className="w-full p-6">
        <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> {title}
        </h1>
        <div className="mt-3">{children}</div>
      </GlassPanel>
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      {text}
    </p>
  );
}
