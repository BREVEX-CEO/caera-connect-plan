import { useCallback, useRef, useState, type ReactNode } from "react";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { answerChallenge, listVerifiedFactors } from "@/lib/security/mfa";

/**
 * "CONFIRM IT'S YOU", THE ONE WAY.
 *
 * High-risk actions (exporting the account, deleting it, ending sessions,
 * turning off two-step verification, operator changes) need a proof from the
 * last ten minutes, and the server says so in words. OCADE signs people in
 * with Google or an emailed code — there is no password to ask for — so a
 * fresh proof is either the authenticator code (accounts with two-step on) or
 * a code emailed to the account's address. Either refreshes the session's
 * proof time, and the action is tried once more.
 */

/** The server's refusal for an old proof or an unanswered second factor. */
export function needsFreshProof(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? "");
  return /Confirm (it is you|the code from your authenticator app)/i.test(text);
}

type Step =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "totp"; factorId: string }
  | { kind: "email"; email: string };

export function useConfirmIdentity(): {
  /** Runs `action`; if the server asks for a fresh proof, asks the person and runs it once more. */
  withProof: <T>(action: () => Promise<T>) => Promise<T>;
  dialog: ReactNode;
} {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const settle = useRef<((proved: boolean) => void) | null>(null);

  const finish = (proved: boolean) => {
    settle.current?.(proved);
    settle.current = null;
    setStep({ kind: "idle" });
    setCode("");
    setProblem(null);
  };

  const ask = useCallback(async (): Promise<boolean> => {
    setStep({ kind: "loading" });
    const proved = new Promise<boolean>((resolve) => {
      settle.current = resolve;
    });
    try {
      const factor = (await listVerifiedFactors())[0];
      if (factor) {
        setStep({ kind: "totp", factorId: factor.id });
      } else {
        const supabase = await loadSupabaseClient();
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email;
        if (!email) throw new Error("This account has no email address to send a code to.");
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setStep({ kind: "email", email });
      }
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "OCADE could not ask for a code just now.",
      );
      setStep({ kind: "email", email: "" });
    }
    return proved;
  }, []);

  const withProof = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        if (!needsFreshProof(error)) throw error;
        if (!(await ask())) throw error;
        return action();
      }
    },
    [ask],
  );

  const submit = async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (step.kind === "totp") {
        await answerChallenge(step.factorId, code);
      } else if (step.kind === "email" && step.email) {
        const supabase = await loadSupabaseClient();
        const { error } = await supabase.auth.verifyOtp({
          email: step.email,
          token: code.replace(/\D/g, ""),
          type: "email",
        });
        if (error)
          throw new Error("That code was not accepted. Check the latest email and try again.");
      }
      finish(true);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "That code was not accepted.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const dialog =
    step.kind === "idle" ? null : (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-label="Confirm it's you"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.replace(/\D/g, "").length >= 6 && !busy) void submit();
          }}
          className="w-full max-w-sm rounded-xl border border-border bg-background p-4 text-sm"
        >
          <p className="font-medium text-foreground">Confirm it&apos;s you</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {step.kind === "loading"
              ? "One moment…"
              : step.kind === "totp"
                ? "Enter the code your authenticator app shows now."
                : step.email
                  ? `We sent a code to ${step.email}. Enter it here.`
                  : "OCADE could not send a code."}
          </p>
          {step.kind === "totp" || (step.kind === "email" && step.email) ? (
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-label="Verification code"
              placeholder="123456"
              className="mt-3 h-10 w-full rounded-md border border-border bg-transparent px-3 text-center font-mono tracking-[0.3em] text-foreground outline-none focus-visible:border-ring"
            />
          ) : null}
          {problem ? (
            <p role="alert" className="mt-2 text-[13px] text-destructive">
              {problem}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => finish(false)}
              className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || code.replace(/\D/g, "").length < 6}
              className="h-8 rounded-md bg-foreground px-3 text-sm text-background disabled:opacity-40"
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    );

  return { withProof, dialog };
}
