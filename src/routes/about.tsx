import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Cpu, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { organizationStructuredData } from "@/lib/public-identity";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CARCC CADANE and OCADE" },
      {
        name: "description",
        content:
          "Official information about CARCC CADANE, OCADE, leadership, the 28 August 2026 founding and launch, and investor or strategic-partnership enquiries.",
      },
      { property: "og:title", content: "About CARCC CADANE and OCADE" },
      {
        property: "og:description",
        content:
          "CARCC CADANE is the technology enterprise and venture behind OCADE — Command the Next Era.",
      },
    ],
  }),
  component: AboutPage,
});

const PILL =
  "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

function AboutPage() {
  return (
    <PublicPage
      eyebrow="Official CARCC CADANE information"
      title="Building the next era of private AI"
      summary="CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE — a local-first AI workspace designed around private intelligence, user control and permissioned action."
      structuredData={organizationStructuredData()}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={PILL}>
          <Orbit className="h-3.5 w-3.5" aria-hidden /> OCADE
        </div>
        <div className={PILL}>
          <Cpu className="h-3.5 w-3.5" aria-hidden /> Local-first AI
        </div>
        <div className={PILL}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Permissioned control
        </div>
        <div className={PILL}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Command the Next Era.
        </div>
      </div>

      <PublicSection title="CARCC CADANE">
        <p>
          CARCC CADANE is the technology enterprise, business brand and venture behind OCADE. It is
          being built as a long-term product and technology identity rather than as a temporary app
          label. OCADE is the active AI product within that identity.
        </p>
        <p>
          The official CARCC CADANE tagline is{" "}
          <strong className="text-foreground">“Command the Next Era.”</strong>
          Public materials use the CARCC CADANE brand name consistently and do not publish an
          unverified corporate form or registration category.
        </p>
      </PublicSection>

      <PublicSection title="OCADE">
        <p>
          OCADE is a cross-platform AI workspace for chat, research, work, creation and permissioned
          computer-control tasks. Supported AI generation is designed around local inference on the
          user's own hardware where supported.
        </p>
        <p>
          Optional authentication, Private Sync, current-information retrieval, support, payments
          and user-requested network services are separated from normal local AI generation. Feature
          availability varies by device, hardware, platform and release readiness.
        </p>
        <Link
          to="/products/ocade"
          className="inline-flex items-center gap-1 text-foreground underline"
        >
          View the OCADE product page <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </PublicSection>

      <PublicSection title="Leadership">
        <p>
          HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Product
          direction, brand strategy and the OCADE technology vision are led under that role.
        </p>
        <Link to="/founder/haans-antoni" className="text-foreground underline">
          Read the official founder profile
        </Link>
      </PublicSection>

      <PublicSection title="Formal founding and public launch — 28 August 2026">
        <p>
          CARCC CADANE records <strong className="text-foreground">28 August 2026</strong> as its
          formal founding date and the scheduled public launch date for OCADE. Legal, privacy,
          identity, support and verification pages can be available earlier so users and external
          services can review them before the authenticated product opens.
        </p>
        <p>
          Product release remains controlled by the OCADE launch gate. The date alone does not open
          an unfinished build: the production readiness flag must also be approved after final
          coding, verification and release checks.
        </p>
      </PublicSection>

      <PublicSection title="Investors, strategic partners and future ownership discussions">
        <p>
          CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners
          who want to discuss product strategy, commercial collaboration, future investment or a
          possible future ownership or equity transaction.
        </p>
        <p>
          No outside investor or shareholder is publicly announced by this page today. Nothing on
          this website is an offer to sell securities, an investment prospectus, a solicitation to
          invest, a promise of allocation, valuation, dividend, return, future listing or a
          guarantee that equity or shareholding will be offered.
        </p>
        <p>
          Any future investment, ownership or shareholder arrangement requires a separate private
          discussion, diligence, valuation, legal documentation, approvals and compliance with the
          laws that apply to that transaction.
        </p>
        <p>
          Until dedicated investor email infrastructure is activated and verified, prospective
          investors and strategic partners should use the OCADE ticket system when account intake is
          available and choose the <strong className="text-foreground">Investor</strong> or{" "}
          <strong className="text-foreground">Partnership</strong> category.
        </p>
      </PublicSection>

      <PublicSection title="Support, legal, privacy and security contact">
        <p>
          OCADE uses a ticket-based support and administrative review system. Dedicated support,
          privacy, legal, security and investor domain email addresses will be published only after
          the mailboxes are activated and verified.
        </p>
        <p>
          Visit the{" "}
          <Link to="/support" className="text-foreground underline">
            Support page
          </Link>{" "}
          for the current contact status. Do not send passwords, one-time codes, PINs, recovery
          codes, private keys or payment secrets through support.
        </p>
      </PublicSection>

      <PublicSection title="Legal and privacy">
        <p>
          The{" "}
          <Link to="/terms" className="text-foreground underline">
            Terms of service
          </Link>{" "}
          explain AI limitations, computer-control risk, payments, refunds, liability, acceptable
          use, investor enquiries and disputes. The{" "}
          <Link to="/privacy" className="text-foreground underline">
            Privacy notice
          </Link>{" "}
          explains Google Sign-In, local processing, Private Sync and user-requested network
          services.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
