import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquare, ShieldCheck, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

/**
 * Three-step welcome, shown once per account after the first sign-in.
 *
 * It is a tour, not a gate: nothing is stored on the server and skipping loses
 * nothing. The seen flag is per account AND per device so a shared browser does
 * not swallow the next person's welcome.
 */
const STEPS = [
  {
    icon: MessageSquare,
    title: "Ask OCADE anything",
    body: "OCADE is your assistant for text, documents and images. Start typing in the composer — conversations are saved so you can return to them later.",
  },
  {
    icon: ShieldCheck,
    title: "You choose where data lives",
    body: "Each kind of data is either Browser Only, encrypted on this device, or Private Sync, stored against your account. Change it any time in Settings → Privacy.",
  },
  {
    icon: Laptop,
    title: "Continue on any device",
    body: "Sign in on your phone or another computer and synced work follows you. Up to two desktops and two phones can be active at once.",
  },
] as const;

function storageKey(userId: string) {
  return `caera.welcome-tour.v1.${userId}`;
}

export function WelcomeTour() {
  const { user, loading } = useSession();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    try {
      if (window.localStorage.getItem(storageKey(user.id)) === "seen") return;
    } catch {
      // Storage can be blocked. Showing the tour once per session is a better
      // failure than crashing the shell around it.
    }
    setOpen(true);
  }, [loading, user]);

  function close() {
    if (user) {
      try {
        window.localStorage.setItem(storageKey(user.id), "seen");
      } catch {
        /* nothing to persist to; the tour simply reappears next time */
      }
    }
    setOpen(false);
  }

  if (!open) return null;

  const current = STEPS[step]!;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border/70 bg-background/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-white/[0.04]">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <h2 id="welcome-tour-title" className="mt-4 text-lg font-semibold tracking-tight">
          {current.title}
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{current.body}</p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((s, index) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all ${
                  index === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              {last ? "Close" : "Skip"}
            </Button>
            {last ? (
              <Button size="sm" asChild onClick={close}>
                <Link to="/ocade">Start with OCADE</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((value) => value + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
        <p className="sr-only">{`Step ${step + 1} of ${STEPS.length}`}</p>
      </div>
    </div>
  );
}
