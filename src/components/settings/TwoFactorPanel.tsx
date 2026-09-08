import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { QrCode } from "@/components/ui/QrCode";
import {
  currentAssurance,
  discardUnverifiedFactors,
  listFactors,
  removeFactor,
  startEnrollment,
  verifyEnrollment,
  type EnrollmentStarted,
  type SecondFactor,
} from "@/lib/security/mfa";
import { issueRecoveryCodes, readRecoveryCodeStatus } from "@/lib/security/mfa.functions";
import { recordAction } from "@/lib/actions";

/**
 * TWO-STEP SIGN-IN, ON THE SECURITY PAGE.
 *
 * WHAT THIS SCREEN REFUSES TO DO. It never says "protected" from the fact that
 * a setup was started. Enrollment creates a factor immediately and it guards
 * nothing until a code has been entered, so every count here is of VERIFIED
 * factors — an account mid-setup reads as unprotected, because it is.
 *
 * BOTH WAYS IN, ALWAYS. A QR code and the secret in text. A camera is not
 * available to everybody: a desktop authenticator, a locked-down phone, a
 * person who cannot use a camera at all. Offering only the square would make
 * this a feature for people with a working phone camera.
 *
 * THE CODES ARE SHOWN ONCE, AND THE SCREEN SAYS SO BEFORE IT SHOWS THEM.
 * Nothing here can fetch them again, because nothing anywhere can — only a
 * keyed hash is stored. Telling somebody afterwards that they should have
 * written them down is a product failing them at the moment they needed it.
 */
export function TwoFactorPanel() {
  const [factors, setFactors] = useState<SecondFactor[] | null>(null);
  const [assurance, setAssurance] = useState<"aal1" | "aal2" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enrolling, setEnrolling] = useState<EnrollmentStarted | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [issued, setIssued] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [all, level] = await Promise.all([listFactors(), currentAssurance()]);
      setFactors(all);
      setAssurance(level.current);
      setLoadError(null);
    } catch (error) {
      /*
       * Named, never rendered as "no factors". Showing an empty list on a read
       * failure tells somebody their account is unprotected when it may not be
       * — and invites them to enroll a second one they do not need.
       */
      setLoadError(error instanceof Error ? error.message : "Could not read this account.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recovery = useQuery({
    queryKey: ["security", "recovery-codes"],
    queryFn: () => readRecoveryCodeStatus(),
  });

  const verified = (factors ?? []).filter((factor) => factor.verified);
  const protectedAccount = verified.length > 0;

  async function begin() {
    setBusy(true);
    setMessage(null);
    try {
      /*
       * Sweep abandoned enrollments FIRST. Every QR screen somebody closed
       * leaves a factor behind, they count against Supabase's per-account
       * limit, and the failure they eventually cause — "you cannot enroll" —
       * says nothing about the cause.
       */
      await discardUnverifiedFactors();
      const started = await startEnrollment(name || "Authenticator app");
      setEnrolling(started);
      setCode("");
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!enrolling) return;
    setBusy(true);
    setMessage(null);
    try {
      await verifyEnrollment(enrolling.factorId, code);
      setEnrolling(null);
      setName("");
      setCode("");
      setMessage({ kind: "success", text: "Two-step sign-in is on for this account." });
      await recordAction({ actionId: "security.mfa_enrolled" });
      await refresh();
      await recovery.refetch();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setEnrolling(null);
    setCode("");
    // The half-finished factor goes with the screen that created it.
    await discardUnverifiedFactors();
    await refresh();
  }

  async function remove(factor: SecondFactor) {
    setBusy(true);
    setMessage(null);
    try {
      await removeFactor(factor.id);
      await recordAction({ actionId: "security.mfa_removed" });
      await refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function generateCodes() {
    setBusy(true);
    setMessage(null);
    setCopied(false);
    try {
      const result = await issueRecoveryCodes();
      if (!result.ok) {
        setMessage({ kind: "error", text: result.reason });
        return;
      }
      setIssued(result.codes);
      await recovery.refetch();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="mt-4 p-5">
      <div className="flex items-center gap-2">
        {protectedAccount ? (
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
        ) : (
          <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        <h2 className="text-sm font-semibold text-foreground">Two-step sign-in</h2>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        A code from an app on your phone, as well as your password. It is the single most effective
        thing you can do to stop somebody else signing in as you, even if they learn your password.
      </p>

      {loadError ? (
        <Message kind="error" text={loadError} onRetry={() => void refresh()} />
      ) : factors === null ? (
        <Loading label="Reading this account…" />
      ) : (
        <>
          <p className="mt-3 text-sm text-foreground">
            {protectedAccount
              ? `On — ${verified.length} authenticator app${verified.length === 1 ? "" : "s"}.`
              : "Off. This account is protected by its password alone."}
            {protectedAccount && assurance === "aal1" ? (
              <span className="ml-2 text-xs text-muted-foreground">
                This session has not confirmed a code yet.
              </span>
            ) : null}
          </p>

          {verified.length > 0 ? (
            <ul className="mt-3 divide-y divide-border/40 text-sm">
              {verified.map((factor) => (
                <li key={factor.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{factor.name}</span>
                    {factor.createdAt ? (
                      <span className="text-xs text-muted-foreground">
                        Added {new Date(factor.createdAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </span>
                  <button
                    onClick={() => void remove(factor)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {/* ------------------------------------------------------- enrollment -- */}
      {enrolling ? (
        <div className="mt-4 rounded-md border border-border/60 bg-background/40 p-4">
          <h3 className="text-sm font-medium text-foreground">Scan this with your app</h3>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
            <QrCode
              value={enrolling.uri}
              className="shrink-0"
              title="Set-up code for your authenticator app"
            />
            <div className="min-w-0 flex-1">
              {/*
                THE SECOND WAY IN. Not a fallback for when the square fails —
                an equal route, for a desktop authenticator, a phone without a
                usable camera, or a person who cannot use one.
              */}
              <p className="text-xs text-muted-foreground">
                No camera? Type this into your app instead:
              </p>
              <code className="mt-1 block break-all rounded bg-muted/40 px-2 py-1.5 font-mono text-xs text-foreground">
                {enrolling.secret}
              </code>

              <label className="mt-4 block">
                <span className="text-xs text-muted-foreground">
                  Then enter the six-digit code it shows
                </span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  aria-label="Six-digit code from your authenticator app"
                  className="mt-1 w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 font-mono text-sm tracking-widest text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary/60"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void confirm()}
                  disabled={busy || code.replace(/\s/g, "").length < 6}
                  className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Turn on two-step sign-in
                </button>
                <button
                  onClick={() => void cancel()}
                  disabled={busy}
                  className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Name this device</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="iPhone"
              aria-label="A name for this authenticator app"
              className="w-48 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-primary/60"
            />
          </label>
          <button
            onClick={() => void begin()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            {protectedAccount ? "Add another app" : "Set up two-step sign-in"}
          </button>
        </div>
      )}

      {message ? <Message kind={message.kind} text={message.text} /> : null}

      {/* --------------------------------------------------- recovery codes -- */}
      <div className="mt-6 border-t border-border/40 pt-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Recovery codes</h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          If you lose your phone, a recovery code removes the authenticator app from this account so
          you can set up a new one. It does not sign you in on its own, and using one signs you out
          everywhere.
        </p>

        {recovery.isPending ? (
          <Loading label="Reading your codes…" />
        ) : recovery.data && !recovery.data.available ? (
          // Truthfully unavailable rather than a button that cannot work.
          <p className="mt-3 text-xs text-muted-foreground">{recovery.data.unavailableReason}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-foreground">
              {recovery.data?.unavailableReason
                ? recovery.data.unavailableReason
                : (recovery.data?.total ?? 0) === 0
                  ? "None yet."
                  : `${recovery.data?.remaining} of ${recovery.data?.total} unused.`}
            </p>
            <button
              onClick={() => void generateCodes()}
              disabled={busy || !protectedAccount}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {(recovery.data?.total ?? 0) === 0
                ? "Create recovery codes"
                : "Replace with new codes"}
            </button>
            {!protectedAccount ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Set up two-step sign-in first — recovery codes exist to get you past a lost app.
              </p>
            ) : null}
          </>
        )}

        {issued ? (
          <div
            role="status"
            className="mt-4 rounded-md border border-[color:var(--state-warning-line-strong)] bg-[color:var(--state-warning-surface)] p-3"
          >
            <p className="text-xs font-medium text-foreground">
              Save these now. This is the only time they are shown, and replacing them is the only
              way to see a readable set again.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs text-foreground sm:grid-cols-3">
              {issued.map((issuedCode) => (
                <li key={issuedCode} className="rounded bg-background/60 px-2 py-1">
                  {issuedCode}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(issued.join("\n")).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy all"}
              </button>
              <button
                onClick={() => setIssued(null)}
                className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent"
              >
                I have saved them
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

function Message({
  kind,
  text,
  onRetry,
}: {
  kind: "error" | "success";
  text: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          : "mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
      }
    >
      <span>{text}</span>
      {onRetry ? (
        <button onClick={onRetry} className="underline underline-offset-2">
          Retry
        </button>
      ) : null}
    </div>
  );
}
