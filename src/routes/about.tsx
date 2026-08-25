import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { organizationStructuredData } from "@/lib/public-identity";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CARCC CADANE and OCADE" },
      {
        name: "description",
        content: "About CARCC CADANE, OCADE, leadership, launch information and investor or strategic-partnership enquiries.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicPage
      eyebrow="About CARCC CADANE"
      title="Building OCADE"
      summary="CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE, a local-first AI workspace."
      structuredData={organizationStructuredData()}
    >
      <PublicSection title="CARCC CADANE">
        <p>
          CARCC CADANE develops technology products and systems under a single enterprise and brand
          identity. OCADE is its active AI product. The official CARCC CADANE tagline is “Command the
          Next Era.”
        </p>
      </PublicSection>

      <PublicSection title="OCADE">
        <p>
          OCADE is a cross-platform AI workspace designed for chat, research, work and permissioned
          computer-control tasks. Supported AI generation is designed around local inference on the
          user's device, while optional authentication, Private Sync, current-information retrieval
          and other user-requested online services are handled separately.
        </p>
      </PublicSection>

      <PublicSection title="Leadership">
        <p>
          HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Read the{` `}
          <Link to="/founder/haans-antoni" className="text-foreground underline">
            official founder profile
          </Link>
          .
        </p>
      </PublicSection>

      <PublicSection title="Founding and public launch">
        <p>
          CARCC CADANE records 28 August 2026 as its scheduled founding date and the scheduled public
          launch of OCADE. Public identity, privacy, legal and verification pages may be available
          before that opening while the authenticated product remains protected by the launch gate.
        </p>
      </PublicSection>

      <PublicSection title="Investors, strategic partners and future ownership discussions">
        <p>
          CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners
          who want to discuss product strategy, commercial collaboration, future investment or a
          possible future ownership or equity transaction. No outside investor or shareholder is
          publicly announced on this page today.
        </p>
        <p>
          Nothing on this website is an offer to sell securities, an investment prospectus, a
          solicitation to invest, a promise of allocation, valuation or return, or a guarantee that
          equity or shareholding will be offered. Any future investment or ownership arrangement
          would require separate diligence, documentation, approvals and legal compliance.
        </p>
        <p>
          Until dedicated investor email infrastructure is activated and verified, prospective
          investors and strategic partners should use the OCADE ticket system when signed-in account
          intake is available and choose the Investor or Partnership category. Existing verified
          stakeholders, if any are admitted in the future, may be provided a separate verified
          governance channel outside the public website.
        </p>
      </PublicSection>

      <PublicSection title="Contact and support">
        <p>
          OCADE uses a ticket-based support and administrative review system. Dedicated support,
          privacy, legal and investor email addresses will be published only after they are activated
          and verified. Visit the <Link to="/support" className="text-foreground underline">Support page</Link> for the current contact status.
        </p>
      </PublicSection>

      <PublicSection title="Legal and privacy">
        <p>
          Read the <Link to="/terms" className="text-foreground underline">Terms of service</Link> and{` `}
          <Link to="/privacy" className="text-foreground underline">Privacy notice</Link> before using OCADE services.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
