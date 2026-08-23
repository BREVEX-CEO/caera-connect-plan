import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { FOUNDER_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/founder/haans-antoni")({
  head: () => ({
    meta: [
      { title: "HAANS ANTONI — CEO, Chairman and Founder of CARCC CADANE" },
      {
        name: "description",
        content: "Official profile of Haans Antoni, founder of CARCC CADANE and creator of OCADE.",
      },
    ],
  }),
  component: FounderPage,
});

function FounderPage() {
  return (
    <PublicPage
      eyebrow="Official founder profile"
      title={PUBLIC_IDENTITY.founderAlternateName}
      summary="HAANS ANTONI is CEO, Chairman and Founder of CARCC CADANE and creator of OCADE, based in Bengaluru, Karnataka, India."
      structuredData={FOUNDER_STRUCTURED_DATA}
    >
      <PublicSection title="Work">
        <p>
          Haans Antoni leads the product direction for OCADE, a cross-platform, local-first AI
          workspace being prepared for public launch. This profile records the founder’s role; it
          does not imply an incorporation, trademark registration, funding round or public listing
          that has not occurred.
        </p>
      </PublicSection>
      <PublicSection title="Creation and brand record">
        <p>
          Haans Antoni records that he independently started the CARCC CADANE venture, created the
          CARCC CADANE and OCADE brand concepts, and directs OCADE’s product vision. OCADE is
          pronounced “OH-kayd.” Any later assignment of
          founder-created intellectual property to an incorporated company must be completed in a
          signed written agreement and reflected in the company’s records.
        </p>
      </PublicSection>
      <PublicSection title="Official references">
        <p>
          Read the{` `}
          <Link to="/company" className="text-foreground underline">
            CARCC CADANE profile
          </Link>
          {` `}
          and the{` `}
          <Link to="/products/ocade" className="text-foreground underline">
            OCADE product profile
          </Link>
          . Search engines decide independently how and when this information appears.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
