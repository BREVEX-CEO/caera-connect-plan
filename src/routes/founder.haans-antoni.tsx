import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { FOUNDER_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/founder/haans-antoni")({
  head: () => ({
    meta: [
      { title: "HAANS ANTONI — Founder, CEO and Chairman of CARCC CADANE" },
      {
        name: "description",
        content:
          "Official profile of HAANS ANTONI, Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
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
      summary="HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE."
      structuredData={FOUNDER_STRUCTURED_DATA}
    >
      <div className="flex items-center gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div
          role="img"
          aria-label="HAANS ANTONI initials"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 text-lg font-semibold shadow-[0_12px_35px_rgba(0,0,0,0.25)]"
        >
          HA
        </div>
        <div>
          <p className="font-semibold">HAANS ANTONI</p>
          <p className="text-sm text-muted-foreground">Founder, CEO and Chairman</p>
          <p className="mt-1 text-xs text-muted-foreground">Founding record · 28 August 2026</p>
        </div>
      </div>

      <PublicSection title="Role">
        <p>
          Haans Antoni leads CARCC CADANE and directs the product vision for OCADE, the local-first
          AI workspace whose formal public-launch date is recorded as 28 August 2026. Product access
          remains controlled by the production launch gate until final readiness approval is given.
        </p>
      </PublicSection>

      <PublicSection title="Contribution record">
        <ul className="list-disc space-y-2 pl-5">
          <li>Created and directs OCADE's local-first product vision.</li>
          <li>Established the CARCC CADANE and OCADE brand concepts.</li>
          <li>Leads product, safety, launch and evidence requirements.</li>
        </ul>
      </PublicSection>

      <PublicSection title="Public profile scope">
        <p>
          This profile contains only the founder identity and work record intentionally published by
          CARCC CADANE. It does not expose private OCADE account activity, personal contact details,
          private communications or user-profile data, and it does not imply an unannounced funding
          round, public listing, shareholder structure or securities offering.
        </p>
      </PublicSection>

      <PublicSection title="Creation and brand record">
        <p>
          Haans Antoni created the CARCC CADANE and OCADE brand concepts and directs OCADE's product
          vision. OCADE is pronounced “OH-kayd.” Brand, intellectual-property, registration and
          ownership claims remain subject to the rights, licences and legal records that actually
          apply to each asset.
        </p>
      </PublicSection>

      <PublicSection title="Official references">
        <p>
          Read the{" "}
          <Link to="/company" className="text-foreground underline">
            CARCC CADANE profile
          </Link>
          , the{" "}
          <Link to="/about" className="text-foreground underline">
            About page
          </Link>{" "}
          and the{" "}
          <Link to="/products/ocade" className="text-foreground underline">
            OCADE product profile
          </Link>
          . Search engines decide independently how and when this information appears.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
