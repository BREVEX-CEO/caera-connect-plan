import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";

export const Route = createFileRoute("/_authenticated/cowork")({
  head: () => ({ meta: [{ title: "Cowork — OCADE" }] }),
  component: CoworkPage,
});

/**
 * Cowork is honest about not being here yet.
 *
 * `PLAN2.md` owns it: the OCADE JARVIS runtime becomes the single Cowork
 * implementation, with Jarvis as its voice-first mode. Shipping a Cowork
 * screen with controls that cannot do anything would be the one thing
 * `docs/RULES.md` #9 forbids, so the destination exists, says what it is, and
 * offers nothing it cannot do.
 */
function CoworkPage() {
  return (
    <AppShell>
      <div className="flex h-full min-h-[calc(100vh-3rem)] items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-secondary">
            <Sparkles className="h-4.5 w-4.5 text-muted-foreground" aria-hidden />
          </span>
          <h1 className="mt-4 text-base font-semibold text-foreground">Cowork is not ready yet</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Cowork will let OCADE carry out work for you, with Jarvis as its hands-free mode. It is
            not available in this release, and nothing here pretends otherwise.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
