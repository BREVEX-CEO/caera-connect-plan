import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageSquareText, ShieldAlert, Signal } from "lucide-react";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — OCADE by CARCC CADANE" },
      {
        name: "description",
        content:
          "Public help and contact routes for OCADE, including account support, service status, privacy, and security reporting.",
      },
      { property: "og:title", content: "Support — OCADE" },
      {
        property: "og:description",
        content: "Get public OCADE help or continue to the signed-in support workspace.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SupportPage,
});

const ACTION_LINK =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SupportPage() {
  return (
    <PublicPage
      eyebrow="Public help centre"
      title="OCADE support"
      summary="Read common answers, check the service, or contact CARCC CADANE without signing in. Account-specific tickets remain inside the private signed-in workspace."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PublicSection title="Common questions">
          <p>Start with setup, local-engine, offline, account, privacy, and FREE LAUNCH answers.</p>
          <Link to="/faq" className={ACTION_LINK}>
            <MessageSquareText className="h-4 w-4" aria-hidden /> Browse the FAQ
          </Link>
        </PublicSection>

        <PublicSection title="Service status">
          <p>Check current prelaunch availability, incidents, maintenance, and update notices.</p>
          <Link to="/status" className={ACTION_LINK}>
            <Signal className="h-4 w-4" aria-hidden /> View OCADE status
          </Link>
        </PublicSection>
      </div>

      <PublicSection title="Contact support">
        <p>
          Email support for installation, browser-extension, demo, or account-access help. Do not
          send passwords, one-time codes, PINs, private keys, recovery codes, or payment secrets.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="mailto:support@ocade.in" className={ACTION_LINK}>
            <Mail className="h-4 w-4" aria-hidden /> support@ocade.in
          </a>
          <Link to="/settings/support" className={ACTION_LINK}>
            Open signed-in support
          </Link>
        </div>
        <p className="text-xs">
          The email link opens your mail application. Delivery is confirmed only by your mail
          provider; the link itself does not claim that a message was received.
        </p>
      </PublicSection>

      <PublicSection title="Privacy and security">
        <p>
          Privacy requests use the public data-rights route. Security reports can be sent to the
          dedicated security mailbox without including exploit secrets in a public page.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/data-rights" className={ACTION_LINK}>
            Data rights
          </Link>
          <a href="mailto:security@ocade.in" className={ACTION_LINK}>
            <ShieldAlert className="h-4 w-4" aria-hidden /> security@ocade.in
          </a>
        </div>
      </PublicSection>
    </PublicPage>
  );
}
