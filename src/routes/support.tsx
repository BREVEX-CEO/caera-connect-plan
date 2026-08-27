import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquarePlus, MessageSquareText, ShieldAlert, Signal } from "lucide-react";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support and contact — OCADE by CARCC CADANE" },
      {
        name: "description",
        content:
          "Current support, legal, privacy, security, investor and partnership contact options for OCADE by CARCC CADANE.",
      },
      { property: "og:title", content: "Support and contact — OCADE" },
      {
        property: "og:description",
        content: "Use OCADE's ticket-based support and administrative review channels.",
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
      eyebrow="Support and contact"
      title="OCADE support"
      summary="OCADE uses a ticket-based support queue and administrative review workspace. Dedicated domain email addresses will be published only after they are activated and verified."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PublicSection title="Common questions">
          <p>Start with setup, local-engine, offline, account, privacy and launch information.</p>
          <Link to="/faq" className={ACTION_LINK}>
            <MessageSquareText className="h-4 w-4" aria-hidden /> Browse the FAQ
          </Link>
        </PublicSection>

        <PublicSection title="Service status">
          <p>
            Check availability, incidents, maintenance and update notices where the status page is
            available.
          </p>
          <Link to="/status" className={ACTION_LINK}>
            <Signal className="h-4 w-4" aria-hidden /> View OCADE status
          </Link>
        </PublicSection>
      </div>

      <PublicSection title="Ticket-based contact">
        <p>
          Signed-in OCADE accounts can create support cases that remain attached to the account and
          appear in the OCADE administrative support queue. Categories include Account, Billing,
          Technical, Privacy, Security, Feedback, Legal, Investor and Partnership.
        </p>
        <p>
          Before authenticated account access opens, this public page is the authoritative contact
          status: no dedicated support, legal, privacy, security or investor email address is
          claimed to be active. Those addresses may be added later after their mailboxes and
          delivery are verified.
        </p>
        <Link to="/settings/support" className={ACTION_LINK}>
          <MessageSquarePlus className="h-4 w-4" aria-hidden /> Open signed-in support
        </Link>
      </PublicSection>

      <PublicSection title="Privacy, legal and security requests">
        <p>
          Use a Privacy, Legal or Security ticket when signed-in ticket intake is available. Privacy
          rights requests may also use the public data-rights route where that route is available.
          Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card
          numbers or payment secrets in a ticket.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/data-rights" className={ACTION_LINK}>
            Data rights
          </Link>
          <Link to="/privacy" className={ACTION_LINK}>
            <ShieldAlert className="h-4 w-4" aria-hidden /> Privacy notice
          </Link>
        </div>
      </PublicSection>

      <PublicSection title="Investor and partnership enquiries">
        <p>
          Prospective investors and strategic partners may use the Investor or Partnership ticket
          category when account intake is available. An enquiry starts a private discussion only; it
          is not an offer of securities, a solicitation to invest or a promise that equity or
          shareholding will be offered.
        </p>
        <Link to="/about" className={ACTION_LINK}>
          About CARCC CADANE
        </Link>
      </PublicSection>
    </PublicPage>
  );
}
