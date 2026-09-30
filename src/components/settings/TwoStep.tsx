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
import { Action, Confirm, Row } from "./rows";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { checkAssurance } from "@/lib/security/reauthentication";
import { HIGH_RISK_REQUIREMENT } from "@/lib/security/assurance";
import { issueRecoveryCodes, readRecoveryCodes } from "@/lib/security/recovery.functions";

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
  const [rejected, setRejected] = useState(0);
  const [offAsked, setOffAsked] = useState(false);
  const { withProof, dialog } = useConfirmIdentity();
  const [copied, setCopied] = useState(false);
  // The sheet, held only while it is on screen: it cannot be shown again.
  const [sheet, setSheet] = useState<string[] | null>(null);
  const [codesLeft, setCodesLeft] = useState<number | null>(null);
  const [sheetCopied, setSheetCopied] = useState(false);

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

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    void readRecoveryCodes().then(
      (status) => !cancelled && setCodesLeft(status.remaining),
      // Unknown is said as unknown, never as "none left".
      () => !cancelled && setCodesLeft(null),
    );
    return () => {
      cancelled = true;
    };
  }, [on, sheet]);

  /** A new sheet replaces the old one, so it asks for a fresh proof like any high-risk change. */
  async function makeCodes() {
    setBusy(true);
    setProblem(null);
    try {
      const { codes } = await withProof(() => issueRecoveryCodes());
      setSheetCopied(false);
      setSheet(codes);
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    setBusy(true);
    setProblem(null);
    try {
      // Every abandoned attempt leaves an unverified factor behind, and Supabase
      // counts them against the account's limit.
      await discardUnverifiedFactors();
      setEnrolling(await startEnrollment("Authenticator app"));
      setCode("");
      setRejected(0);
      setCopied(false);
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
      setRejected(0);
      setFactors(await listVerifiedFactors());
      // Two-step without a way back is a locked account the day the phone is
      // lost, so the codes are made and shown in the same step.
      await makeCodes();
    } catch (error) {
      setProblem(messageOf(error));
      setCode("");
      setRejected((count) => count + 1);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(factor: SecondFactor) {
    setBusy(true);
    setProblem(null);
    try {
      await withProof(async () => {
        // Removing protection is itself high risk: a fresh proof, not just this session's old one.
        const decision = await checkAssurance(HIGH_RISK_REQUIREMENT);
        if (!decision.allowed) throw new Error(decision.message);
        await removeFactor(factor.id);
      });
      setOffAsked(false);
      setFactors(await listVerifiedFactors());
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {dialog}
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
          offAsked ? (
            <Confirm
              label={busy ? "Turning off…" : "Turn off two-step"}
              busy={busy}
              onConfirm={() => turnOff(factors[0]!)}
              onCancel={() => setOffAsked(false)}
            />
          ) : (
            <Action label="Turn off" destructive onClick={() => setOffAsked(true)} />
          )
        ) : enrolling ? null : (
          <Action label={busy ? "Starting…" : "Set up"} busy={busy} onClick={begin} />
        )}
      </Row>

      {enrolling ? (
        <div className="border-b border-border/50 py-4 last:border-b-0">
          <p className="text-sm text-foreground">Add OCADE to your authenticator app</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Scan the code with your app, or enter the key by hand. If your app already has an OCADE
            entry from an earlier try, delete it first — each setup makes a new key.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {enrolling.qr ? (
              <img
                src={enrolling.qr}
                alt="QR code for your authenticator app"
                width={148}
                height={148}
                className="h-[148px] w-[148px] rounded-md bg-white p-1.5"
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              <p
                className="break-all font-mono text-[13px] tracking-wide text-foreground"
                aria-label="Setup key"
              >
                {enrolling.secret.match(/.{1,4}/g)?.join(" ")}
              </p>
              <div className="flex flex-wrap gap-3 text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(enrolling.secret).then(
                      () => setCopied(true),
                      () => setCopied(false),
                    );
                  }}
                  className="text-foreground underline underline-offset-2"
                >
                  {copied ? "Key copied" : "Copy key"}
                </button>
                <a href={enrolling.uri} className="text-foreground underline underline-offset-2">
                  Open in app on this device
                </a>
              </div>
            </div>
          </div>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && code.length === 6) void finish();
            }}
          >
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Six-digit code from your authenticator app"
              placeholder="123456"
              className="h-8 w-28 rounded-md border border-border bg-transparent px-2.5 text-sm tracking-widest text-foreground outline-none focus-visible:border-ring"
            />
            <Action
              label={busy ? "Confirming…" : "Confirm"}
              busy={busy || code.length < 6}
              onClick={finish}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEnrolling(null);
                setCode("");
                setProblem(null);
                // The factor this screen created protects nothing and would
                // otherwise sit on the account for ever.
                void discardUnverifiedFactors();
              }}
              className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </form>
          {rejected >= 2 ? (
            <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
              Still not accepted? Your app may hold a key from an earlier try, or its clock may be
              off.{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => void begin()}
                className="text-foreground underline underline-offset-2"
              >
                Start again with a new key
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {on && !sheet ? (
        <Row
          label="Recovery codes"
          description={
            codesLeft === null
              ? "One-time codes that turn two-step verification off if you lose your phone."
              : codesLeft === 0
                ? "None left. Make new codes now: without them a lost phone locks this account."
                : `${codesLeft} left. Each works once, and turns two-step verification off if you lose your phone.`
          }
        >
          <Action
            label={busy ? "Making…" : "Make new codes"}
            busy={busy}
            onClick={() => void makeCodes()}
          />
        </Row>
      ) : null}

      {sheet ? (
        <div
          className="border-b border-border/50 py-4 last:border-b-0"
          role="region"
          aria-label="Your recovery codes"
        >
          <p className="text-sm text-foreground">Save these recovery codes now</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            They are shown once. If you lose your phone, one of them turns two-step verification off
            so you can sign in and set it up again. Keep them somewhere other than your phone. Codes
            made earlier no longer work.
          </p>
          <ul className="mt-3 grid gap-1 font-mono text-[13px] tracking-wide text-foreground sm:grid-cols-2">
            {sheet.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(sheet.join("\n")).then(
                  () => setSheetCopied(true),
                  () => setSheetCopied(false),
                );
              }}
              className="text-foreground underline underline-offset-2"
            >
              {sheetCopied ? "Codes copied" : "Copy codes"}
            </button>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                `OCADE recovery codes\n\n${sheet.join("\n")}\n`,
              )}`}
              download="ocade-recovery-codes.txt"
              className="text-foreground underline underline-offset-2"
            >
              Download
            </a>
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="text-foreground underline underline-offset-2"
            >
              I saved them
            </button>
          </div>
        </div>
      ) : null}

      {problem ? (
        <p className="pt-3 text-[13px] text-foreground" role="alert">
          {problem}
          {/aal2|assurance|Confirm the code/i.test(problem) ? (
            <>
              {" "}
              <a
                href={`/auth/challenge?next=${encodeURIComponent(window.location.pathname)}`}
                className="underline underline-offset-2"
              >
                Enter your code
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "That did not work. Try again.";
}
