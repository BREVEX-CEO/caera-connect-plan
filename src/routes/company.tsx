import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { organizationStructuredData, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/company")({
  head: () => ({
    meta: [
      { title: "CARCC CADANE — Company and brand information" },
      {
        name: "description",
        content:
          "Official information about CARCC CADANE, the technology enterprise and brand behind OCADE, including leadership, launch and investor-enquiry information.",
      },
    ],
  }),
  component: CompanyPage,
});

function CompanyPage() {
  return (
    <PublicPage
      eyebrow="Official CARCC CADANE information"
      title={PUBLIC_IDENTITY.brand}
      summary="CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. It records 28 August 2026 as its formal founding date and OCADE's public-launch date."
      structuredData={organizationStructuredData()}
    >
      <PublicSection title="What CARCC CADANE is">
        <p>
          CARCC CADANE is the technology enterprise, product venture and brand identity behind
          OCADE. It develops software, AI systems and related technology under the CARCC CADANE
          name. The official tagline is “Command the Next Era.”
        </p>
        <p>
          Public references use the CARCC CADANE enterprise and brand identity. A specific corporate
          form, securities status, trademark status, funding claim or other registration claim is
          published only when it is separately established and appropriate to disclose.
        </p>
      </PublicSection>

      <PublicSection title="Formal founding and OCADE launch">
        <p>
          CARCC CADANE records <strong className="text-foreground">28 August 2026</strong> as its
          formal founding date and the public-launch date for OCADE. Legal, privacy, support,
          identity and verification pages can be public earlier so users and external services can
          review them.
        </p>
        <p>
          Authenticated product access remains controlled by the production launch gate until both
          the launch date and final readiness approval are satisfied. This prevents an unfinished
          build from opening merely because the date has arrived.
        </p>
      </PublicSection>

      <PublicSection title="Leadership">
        <p>
          HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Read the{" "}
          <Link to="/founder/haans-antoni" className="text-foreground underline">
            official founder profile
          </Link>
          .
        </p>
      </PublicSection>

      <PublicSection title="OCADE">
        <p>
          OCADE is CARCC CADANE's active local-first AI workspace. Supported AI generation is
          designed around on-device inference, with optional authentication, account-hosted work,
          current-information retrieval, support, payments and other user-authorized online services
          separated from the local AI path.
        </p>
        <p>
          Read the{" "}
          <Link to="/products/ocade" className="text-foreground underline">
            OCADE product page
          </Link>{" "}
          for the current product boundary.
        </p>
      </PublicSection>

      <PublicSection title="Investors, strategic partners and future ownership discussions">
        <p>
          CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners
          who want to discuss product strategy, commercial collaboration, future investment or a
          possible future ownership or equity transaction.
        </p>
        <p>
          No outside shareholder or investor is publicly announced on this page today. Nothing on
          this website is an offer to sell securities, an investment prospectus, a solicitation to
          invest, a promise of allocation, valuation, dividend, return or a guarantee that equity or
          shareholding will be offered.
        </p>
        <p>
          Use the{" "}
          <Link to="/about" className="text-foreground underline">
            About page
          </Link>{" "}
          and{" "}
          <Link to="/support" className="text-foreground underline">
            Support page
          </Link>{" "}
          for the current investor-enquiry process.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
