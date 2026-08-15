import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { ORGANIZATION_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/company")({
  head: () => ({
    meta: [
      { title: "CAERA CADANE — Company and brand information" },
      {
        name: "description",
        content: "Official pre-launch information about CAERA CADANE, the brand behind OCADE.",
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
      summary="CAERA CADANE is the brand and product venture behind OCADE. It is based in Bengaluru, Karnataka, India, and is preparing for a planned public launch on 28 August 2026."
      structuredData={ORGANIZATION_STRUCTURED_DATA}
    >
      <PublicSection title="Current status">
        <p>
          CAERA CADANE is currently a pre-launch brand operated by Haans Antoni. This page does not
          claim that an Indian company has already been incorporated. Formal entity details, CIN,
          GSTIN and a registered-office address will be published only after they are issued and
          independently verified.
        </p>
      </PublicSection>
      <PublicSection title="Name, meaning and pronunciation">
        <p>
          Haans Antoni created the CAERA CADANE brand name and defines it as “Crown Era / Sovereign
          New Age” and “Command Domain / Capital Dynasty Network.” The official tagline is
          “Command the Next Era.” Pronounce CAERA CADANE as “KAY-rah kuh-DAYN,” simplified as
          “Kay-ra Ka-dane.”
        </p>
        <p>
          These definitions record the founder’s intended brand meaning and creative expression.
          Publication alone does not create exclusive ownership of ordinary words in every context.
          Enforceable exclusivity depends on applicable trademark, passing-off, copyright, contract
          and company-name law, including successful registration where required.
        </p>
      </PublicSection>
      <PublicSection title="Leadership">
        <p>
          Haans Antoni is the founder and publicly uses the roles Founder, Chairman &amp; CEO for
          the CAERA CADANE venture. Read the{` `}
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
