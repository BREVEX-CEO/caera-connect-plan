import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { organizationStructuredData, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/company")({
  head: () => ({
    meta: [
      { title: "CARCC CADANE — Company and brand information" },
      {
        name: "description",
        content: "Official information about CARCC CADANE, the technology enterprise and brand behind OCADE.",
      },
    ],
  }),
  component: CompanyPage,
});

function CompanyPage() {
  return (
    <PublicPage
      eyebrow="Official information"
      title={PUBLIC_IDENTITY.brand}
      summary="CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE. The scheduled founding and public-launch date is 28 August 2026."
      structuredData={organizationStructuredData()}
    >
      <PublicSection title="What CARCC CADANE is">
        <p>
          CARCC CADANE is the technology enterprise and product venture behind OCADE. It develops
          software, AI systems and related products under the CARCC CADANE identity. The official
          tagline is “Command the Next Era.”
        </p>
        <p>
          Public references use the CARCC CADANE enterprise and brand identity. Legal-form,
          securities, trademark, funding or registration claims are published only when they are
          separately established and appropriate to disclose.
        </p>
      </PublicSection>

      <PublicSection title="Founding and launch record">
        <p>
          CARCC CADANE records 28 August 2026 as its scheduled founding date and the scheduled public
          launch of OCADE. Before that opening, public information pages may be available for
          identity, legal, privacy and verification purposes while the authenticated product remains
          launch-gated.
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

      <PublicSection title="OCADE">
        <p>
          OCADE is the active local-first AI workspace in development. Its supported AI generation
          is designed around on-device inference, with optional authentication, Private Sync,
          current-information retrieval and other permissioned online services clearly separated
          from the local AI path.
        </p>
        <p>
          Read the <Link to="/products/ocade" className="text-foreground underline">OCADE product page</Link> for the current product boundary.
        </p>
      </PublicSection>

      <PublicSection title="Investors and strategic partners">
        <p>
          CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners
          who want to discuss the business, product strategy or a possible future investment or
          ownership transaction. No outside shareholder or investor is publicly announced on this
          page today, and nothing on this website is an offer to sell securities or a solicitation
          to invest.
        </p>
        <p>
          Use the <Link to="/about" className="text-foreground underline">About page</Link> for the current investor-enquiry process.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
