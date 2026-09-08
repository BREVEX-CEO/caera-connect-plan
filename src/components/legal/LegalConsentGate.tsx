import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { LegalDialog } from "./LegalDialog";

const ConsentAccountBridge = lazy(() => import("./ConsentAccountBridge"));
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type ConsentReceipt,
  LEGAL_CONSENT_STORAGE_KEY,
  LEGAL_CONSENT_VERSION,
  needsLegalConsent,
  usesAccountConsentReceipt,
  coversCurrentDocuments,
  latestServerReceipt,
  readLegalConsent,
  recordServerConsent,
} from "@/lib/legal/consent-receipts";

export function LegalConsentGate({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const required = needsLegalConsent(pathname);
  const [accepted, setAccepted] = useState(false);
  const [legalOpen, setLegalOpen] = useState<null | "terms" | "privacy">(null);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  const [userId, setUserId] = useState("");
  const usesAccountReceipt = usesAccountConsentReceipt(pathname);

  useEffect(() => {
    const local = readLegalConsent();
    if (local) {
      setAccepted(true);
      return;
    }
    /*
     * THE ACCOUNT REMEMBERS, SO THE PERSON IS NOT ASKED TWICE.
     *
     * Acceptance lived only in `localStorage`, so somebody who had already
     * agreed was asked again on their phone, again after clearing site data,
     * and again in a private window. A gate that reappears is a gate people
     * learn to click through, which is the opposite of informed consent.
     *
     * The local receipt is still checked first and answers instantly; the
     * server is consulted only when this device has none. An unreachable
     * server leaves the gate up, which is the right way round: OCADE asks
     * again rather than assuming an agreement it cannot see.
     */
    if (!userId) {
      setAccepted(false);
      return;
    }
    let live = true;
    void latestServerReceipt(userId).then((receipt) => {
      if (!live) return;
      setAccepted(coversCurrentDocuments(receipt));
    });
    return () => {
      live = false;
    };
  }, [pathname, userId]);

  const open = required && !accepted;
  const canContinue = terms && privacy;
  const explanation =
    "OCADE stores essential account, security and preference data needed to provide the workspace.";

  function accept() {
    if (!canContinue) return;
    const receipt: ConsentReceipt = {
      version: LEGAL_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
      terms: true,
      privacy: true,
    };
    try {
      window.localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(receipt));
    } catch {
      // Continue for this tab, but say plainly that the receipt will not persist.
      setStorageWarning(true);
    }
    /*
     * Recorded against the account as well, when there is one, so OCADE can
     * answer "which version did they accept, and when?" — a question the
     * person's own localStorage cannot answer to anybody else, and which they
     * can erase.
     *
     * Fire-and-forget on purpose. A database that is unreachable must not stop
     * somebody agreeing to the terms and getting on with their work; the local
     * receipt already carries this device, and the worst case is being asked
     * again on the next one.
     */
    if (userId) void recordServerConsent(userId, "gate");
    setAccepted(true);
  }

  return (
    <>
      {/*
        Loaded only where an account receipt applies. It renders nothing, so the
        `null` fallback is the finished state rather than a placeholder — and
        keeping it out of this module keeps the Supabase client out of the entry
        bundle every public page parses. See `ConsentAccountBridge.tsx`.
      */}
      {usesAccountReceipt ? (
        <Suspense fallback={null}>
          <ConsentAccountBridge onUserId={setUserId} />
        </Suspense>
      ) : null}
      {children}
      <Dialog open={open} onOpenChange={() => undefined}>
        <DialogContent
          showClose={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto border-white/15 bg-[oklch(0.09_0_0/0.97)] p-0 shadow-[0_28px_100px_rgba(0, 0, 0,0.72)]"
        >
          <div className="relative p-6 sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,oklch(0.65_0_0/0.16),transparent_34%),radial-gradient(circle_at_95%_100%,oklch(0.58_0_0/0.11),transparent_30%)]"
            />
            <DialogHeader className="relative text-left">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <DialogTitle>Before you use OCADE</DialogTitle>
              <DialogDescription className="leading-relaxed">
                Please read and accept the prelaunch Terms and acknowledge the Privacy Notice.
                {` ${explanation}`}
              </DialogDescription>
            </DialogHeader>

            <div className="relative mt-5 grid gap-3">
              {/*
                THESE OPENED A NEW BROWSER TAB, AND THAT WAS THE DEFECT.
                `href="/terms" target="_blank"` threw the reader out of OCADE
                to read OCADE's own terms — and this gate is modal, so they
                came back to a dialog they had to find their place in again.
                Buttons opening an in-site dialog keep the reader here and
                keep the ticks they had already made.
              */}
              <ConsentCheck checked={terms} onChange={setTerms}>
                I have read and accept the{` `}
                <button
                  type="button"
                  onClick={() => setLegalOpen("terms")}
                  className="text-primary underline"
                >
                  Terms of Service
                </button>
                .
              </ConsentCheck>
              <ConsentCheck checked={privacy} onChange={setPrivacy}>
                I have read and acknowledge the{` `}
                <button
                  type="button"
                  onClick={() => setLegalOpen("privacy")}
                  className="text-primary underline"
                >
                  Privacy Notice
                </button>
                , including device permissions and local storage.
              </ConsentCheck>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Camera, microphone, browser control and computer-control permissions are requested
                separately only when you activate them. Purchases and payment collection are
                disabled during FREE LAUNCH.
              </p>
              {storageWarning ? (
                <p role="status" className="text-[11px] text-[color:var(--state-warning)]">
                  This browser could not save the receipt. You may be asked again after reloading.
                </p>
              ) : null}
            </div>

            <DialogFooter className="relative mt-6 sm:justify-between sm:space-x-3">
              <a
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-full px-4 text-xs text-muted-foreground hover:text-foreground"
              >
                Leave OCADE
              </a>
              <Button
                type="button"
                disabled={!canContinue}
                onClick={accept}
                className="h-10 rounded-full px-6"
              >
                Accept and continue
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <LegalDialog
        open={legalOpen !== null}
        document={legalOpen ?? "terms"}
        onOpenChange={(next) => {
          if (!next) setLegalOpen(null);
        }}
      />
    </>
  );
}

function ConsentCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-black/20 p-3 text-[12.5px] leading-relaxed text-foreground/90">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[color:var(--primary)]"
      />
      <span>{children}</span>
    </label>
  );
}
