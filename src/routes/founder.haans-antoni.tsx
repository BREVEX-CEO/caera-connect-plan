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
      <div className="flex items-center gap-4 rounded-2xl border border-white/7 bg-white/[0.018] p-5">
        <div
          role="img"
          aria-label="HAANS ANTONI initials"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 text-lg font-semibold"
        >
          HA
        </div>
        <div>
          <p className="font-semibold">HAANS ANTONI</p>
          <p className="text-sm text-muted-foreground">CEO, Chairman and Founder</p>
          <p className="mt-1 text-xs text-muted-foreground">Bengaluru, Karnataka, India</p>
          <p className="mt-1 text-xs text-muted-foreground">Founder record · 28 August 2026</p>
        </div>
      </div>
      <PublicSection title="Work">
        <p>
          Haans Antoni leads the product direction for OCADE, a cross-platform, local-first AI
          workspace being prepared for public launch. This profile records the founder’s role; it
          does not imply an incorporation, trademark registration, funding round or public listing
          that has not occurred.
        </p>
      </PublicSection>
      <PublicSection title="Contribution record">
        <ul className="list-disc space-y-2 pl-5">
          <li>Created and directs OCADE’s local-first product vision.</li>
          <li>Established the CARCC CADANE and OCADE brand concepts.</li>
          <li>Leads the pre-launch product, safety and evidence requirements.</li>
        </ul>
      </PublicSection>
      <PublicSection title="Public profile scope">
        <p>
          This is the official public founder profile. It contains only the founder identity and
          work record CARCC CADANE has chosen to publish; it does not expose an OCADE user profile,
          private account activity, contact address or follower count. Per-user profile visibility
          controls and contact or follow actions remain unavailable until the correct production
          identity project and communication channel are verified.
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
