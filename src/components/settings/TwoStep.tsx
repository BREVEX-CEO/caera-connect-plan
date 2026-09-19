import { useEffect, useState } from "react";
import {
  discardUnverifiedFactors,
  listVerifiedFactors,
  removeFactor,
  startEnrollment,
  verifyEnrollment,
  type EnrollmentStarted,
  type SecondFactor,
} from "@/lib/security/mfa";
import { Action, Row } from "./rows";

/**
 * THE SECOND FACTOR HAD EVERY PART EXCEPT A WAY TO CREATE ONE.
 *
 * `lib/security/mfa.ts` could enroll, verify, list and remove; the signed-in
 * layout redirected an enrolled account to a challenge; the database refused a
 * privileged operation without `aal2`. Nothing called `startEnrollment`. So the
 * factor could never come into existence, and the consequence was not
 * theoretical: the operational task `PLAN.md` names — giving an account Pro or
 * Max by hand — was unreachable through the product, because
 * `ocade_grant_entitlement` requires a second factor and no operator could
 * obtain one.
 *
 * It is here rather than in a hidden admin corner because it is not an admin
 * feature. Anybody may protect their account, and an enrollment flow only
 * operators can reach is a second authority over who may hold a factor.
 *
 * NO QR DEPENDENCY. The secret is shown for typing in, and the `otpauth://` URI
 * is a link an authenticator app on the same device opens directly. A rendering
 * library for a square of pixels is 40 KiB to save some typing once.
 */
export function TwoStep() {
  const [factors, setFactors] = useState<SecondFactor[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<EnrollmentStarted | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listVerifiedFactors()
      .then((verified) => {
        if (!cancelled) setFactors(verified);
      })
      .catch((error: unknown) => {
        // An unreadable list is not "no second factor": saying Off here would
        // tell somebody their account is unprotected when it may not be.
        if (!cancelled) setProblem(messageOf(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const on = (factors?.length ?? 0) > 0;

  async function begin() {
    setBusy(true);
    setProblem(null);
    try {
      // Every abandoned attempt leaves an unverified factor behind, and Supabase
      // counts them against the account's limit.
      await discardUnverifiedFactors();
      setEnrolling(await startEnrollment("Authenticator app"));
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!enrolling) return;
    setBusy(true);
    setProblem(null);
    try {
      await verifyEnrollment(enrolling.factorId, code);
      setEnrolling(null);
      setCode("");
      setFactors(await listVerifiedFactors());
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(factor: SecondFactor) {
    setBusy(true);
    setProblem(null);
    try {
      await removeFactor(factor.id);
      setFactors(await listVerifiedFactors());
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Row
        label="Two-step verification"
        description={
          factors === null
            ? "Checking this account…"
            : on
              ? "On. OCADE asks for a code from your authenticator app, and privileged changes require it."
              : "Off. Add an authenticator app so a stolen password alone cannot reach this account."
        }
      >
        {factors === null ? null : on ? (
          <Action label="Turn off" busy={busy} destructive onClick={() => turnOff(factors[0]!)} />
        ) : enrolling ? null : (
          <Action label={busy ? "Starting…" : "Set up"} busy={busy} onClick={begin} />
        )}
      </Row>

      {enrolling ? (
        <div className="border-b border-border/50 py-4 last:border-b-0">
          <p className="text-sm text-foreground">Add this account to your authenticator app</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Open the link on this device, or type the key in by hand. Then enter the six digits your
            app shows.
          </p>
          <a
            href={enrolling.uri}
            className="mt-2 inline-block text-[13px] text-foreground underline underline-offset-2"
          >
            Open in your authenticator app
          </a>
          <p className="mt-2 break-all font-mono text-[13px] text-muted-foreground">
            {enrolling.secret}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Six-digit code from your authenticator app"
              placeholder="123456"
              className="h-8 w-28 rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            />
            <Action
              label={busy ? "Confirming…" : "Confirm"}
              busy={busy || code.replace(/\s/g, "").length < 6}
              onClick={finish}
            />
            <button
              type="button"
              onClick={() => {
                setEnrolling(null);
                setCode("");
                // The factor this screen created protects nothing and would
                // otherwise sit on the account for ever.
                void discardUnverifiedFactors();
              }}
              className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {problem ? (
        <p className="pt-3 text-[13px] text-foreground" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "That did not work. Try again.";
}
