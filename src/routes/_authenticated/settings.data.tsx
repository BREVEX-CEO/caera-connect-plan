import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/PageHeader";
import { AccountDataPanel } from "@/components/settings/AccountDataPanel";

export const Route = createFileRoute("/_authenticated/settings/data")({
  head: () => ({
    meta: [{ title: "Your data — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountDataPage,
});

/**
 * ACCESS AND ERASURE, ON THEIR OWN SCREEN.
 *
 * This address was `/settings/vault`, and the page behind it was about a
 * browser vault: a passphrase, a recovery kit, and the unlock state of an
 * encrypted store on this one machine. `PLAN.md` Phase 2 removed that store,
 * so the address now holds the thing a person actually comes here for — a copy
 * of what OCADE holds, and the ability to delete it.
 *
 * SEPARATE FROM PRIVACY, deliberately. Privacy is about where work is allowed
 * to go and what this browser may keep; this is about exercising a right over
 * what has already been kept. Somebody reading the first should not stumble
 * into a delete control they did not come for.
 */
function AccountDataPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account · Data"
        title="Your data"
        description="Export everything OCADE holds for your account, or delete it by kind."
        actions={
          <Link
            to="/settings"
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Settings
          </Link>
        }
      />
      <AccountDataPanel />
    </>
  );
}
