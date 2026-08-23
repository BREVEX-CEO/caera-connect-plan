import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { organizationStructuredData, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/company")({
  head: () => ({
    meta: [
      { title: "CARCC CADANE — Company and brand information" },
      {
        name: "description",
        content: "Official pre-launch information about CARCC CADANE, the brand behind OCADE.",
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
      summary="CARCC CADANE is the brand and product venture behind OCADE. It is based in Bengaluru, Karnataka, India, and is preparing for a planned public launch on 28 August 2026."
      structuredData={organizationStructuredData()}
    >
      <PublicSection title="Current status">
        <p>
          CARCC CADANE is currently a pre-launch brand operated by Haans Antoni. This page does not
          claim that an Indian company has already been incorporated. Formal entity details, CIN,
          GSTIN and a registered-office address will be published only after they are issued and
          independently verified.
        </p>
      </PublicSection>
      <PublicSection title="Identity and launch record">
        <p>
          Haans Antoni created the CARCC CADANE brand and OCADE product identity. The official
          tagline is “Command the Next Era.” The venture records 28 August 2026 as its planned
          founding and public-launch date; until that date, every public surface must describe it
          as planned or pre-launch rather than already founded or launched.
        </p>
        <p>
          Publication does not by itself establish incorporation, trademark registration or
          exclusive ownership. Those claims remain separate and will be published only when
          independently verified.
        </p>
      </PublicSection>
      <PublicSection title="Leadership">
        <p>
          HAANS ANTONI is the founder and publicly uses the roles CEO, Chairman and Founder for
          the CARCC CADANE venture. Read the{` `}
          <Link to="/founder/haans-antoni" className="text-foreground underline">
            official founder profile
          </Link>
          .
        </p>
      </PublicSection>
      <PublicSection title="Products">
        <p>
          OCADE is the active product in development. FICIA, MADEE and CANIA are reserved names for
          possible future products; they are not AI models and no availability claim is made for
          them.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
