import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { FOUNDER_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/founder/haans-antoni")({
  head: () => ({
    meta: [
      { title: "Haans Antoni — Founder, Chairman & CEO of CAERA CADANE" },
      {
        name: "description",
        content: "Official profile of Haans Antoni, founder of CAERA CADANE and creator of OCADE.",
      },
    ],
  }),
  component: FounderPage,
});

function FounderPage() {
  return (
    <PublicPage
      eyebrow="Official founder profile"
      title={PUBLIC_IDENTITY.founder}
      summary="Haans Antoni is the founder of CAERA CADANE and creator of OCADE. He publicly serves as Founder, Chairman & CEO of the venture from Bengaluru, Karnataka, India."
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
      <PublicSection title="Official references">
        <p>
          Read the{` `}
          <Link to="/company" className="text-foreground underline">
            CAERA CADANE profile
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
