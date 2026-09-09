import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { TelemetryPanel } from "@/components/settings/TelemetryPanel";
import { LocalDataPanel } from "@/components/settings/LocalDataPanel";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  head: () => ({
    meta: [{ title: "Privacy — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: PrivacyPage,
});

/**
 * WHAT THIS SCREEN STOPPED ASKING.
 *
 * It offered a storage mode per kind of data — Browser Only, PC Vault or
 * Private Sync, for chats, files, images, recordings, Copilot history and
 * learning replays. Eighteen switches, and behind them three different places
 * a conversation could be, with no rule for which one was authoritative when
 * they disagreed.
 *
 * `PLAN.md` Phase 2 answered it once, for everybody: an account holds the
 * account's work, protected by row-level security, on every device the person
 * signs in on. So the question is gone rather than defaulted, and this screen
 * now says plainly where things are instead of asking somebody to decide.
 *
 * What genuinely remains a choice is still here: whether OCADE may report a
 * failure, and what this particular browser is allowed to keep.
 */
function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account · Privacy"
        title="Privacy"
        description="Where your work lives, what leaves this device, and what OCADE may report."
        actions={
          <Link
            to="/settings"
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Settings
          </Link>
        }
      />

      <GlassPanel className="mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p>
            <strong className="text-foreground">
              Your conversations, projects, files and saved outputs live in your account.
            </strong>{" "}
            Every row is protected by row-level security, so only your session can read it, and it
            follows you to every device you sign in on. Exporting or deleting it is on{" "}
            <Link to="/settings/data" className="underline">
              Your data
            </Link>
            .
          </p>
          <p>
            <strong className="text-foreground">
              An incognito conversation is written nowhere.
            </strong>{" "}
            It lives in the tab and ends with it.
          </p>
          <p>
            <strong className="text-foreground">Offline Intelligence stays on this device.</strong>{" "}
            The model files never leave it, and answering with them sends nothing.
          </p>
          <p>
            <strong className="text-foreground">
              A turn written while your account is unreachable
            </strong>{" "}
            waits in the open tab, is marked as unsaved, and warns you before you close it.
          </p>
        </div>
      </GlassPanel>

      {/* Opt-in failure reporting. Consent lives with the other privacy choices. */}
      <div className="mt-4">
        <TelemetryPanel />
      </div>

      {/*
        The device half, clearly separated from the account half: they are
        different requests. Clearing a shared laptop is not exercising a data
        right, and a person doing one should not accidentally do the other.
      */}
      <LocalDataPanel />
    </>
  );
}
