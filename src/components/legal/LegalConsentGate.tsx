import { useEffect, useMemo, useState, type ReactNode } from "react";
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

export const LEGAL_CONSENT_VERSION = "ocade-prelaunch-2026-08-16";
export const LEGAL_CONSENT_STORAGE_KEY = "caera:legal-consent:v1";

interface ConsentReceipt {
  version: string;
  acceptedAt: string;
  terms: true;
  privacy: true;
}

export function needsLegalConsent(pathname: string): boolean {
  return [
    "/auth",
    "/demo",
    "/home",
    "/ocade",
    "/settings",
    "/ficia",
    "/madee",
    "/cania",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function readLegalConsent(storage?: Pick<Storage, "getItem">): ConsentReceipt | null {
  if (typeof window === "undefined" && !storage) return null;
  try {
    const raw = (storage ?? window.localStorage).getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentReceipt>;
    if (
      parsed.version !== LEGAL_CONSENT_VERSION ||
      parsed.terms !== true ||
      parsed.privacy !== true ||
      typeof parsed.acceptedAt !== "string"
    ) {
      return null;
    }
    return parsed as ConsentReceipt;
  } catch {
    return null;
  }
}

export function LegalConsentGate({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const required = needsLegalConsent(pathname);
  const [accepted, setAccepted] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    setAccepted(readLegalConsent() !== null);
  }, [pathname]);

  const open = required && !accepted;
  const canContinue = terms && privacy;
  const explanation = useMemo(
    () =>
      pathname.startsWith("/demo")
        ? "The demo can use local storage, an on-device model, microphone or device-control permissions only when you choose those features."
        : "OCADE stores essential account, security and preference data needed to provide the workspace.",
    [pathname],
  );

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
    setAccepted(true);
  }

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={() => undefined}>
        <DialogContent
          showClose={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          className="max-w-xl overflow-hidden border-white/15 bg-[oklch(0.09_0.012_255/0.97)] p-0 shadow-[0_28px_100px_rgba(0,0,0,0.72)]"
        >
          <div className="relative p-6 sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,oklch(0.65_0.18_255/0.16),transparent_34%),radial-gradient(circle_at_95%_100%,oklch(0.58_0.2_28/0.11),transparent_30%)]"
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
              <ConsentCheck checked={terms} onChange={setTerms}>
                I have read and accept the{` `}
                <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline">
                  Terms of Service
                </a>
                .
              </ConsentCheck>
              <ConsentCheck checked={privacy} onChange={setPrivacy}>
                I have read and acknowledge the{` `}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">
                  Privacy Notice
                </a>
                , including device permissions and local storage.
              </ConsentCheck>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Camera, microphone, browser control and computer-control permissions are requested
                separately only when you activate them. Payment credentials are entered only on the
                payment provider’s hosted page.
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
