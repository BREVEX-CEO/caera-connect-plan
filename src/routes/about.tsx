import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/shell/PublicPage";
import { FOUNDER_STRUCTURED_DATA, PUBLIC_IDENTITY } from "@/lib/public-identity";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the founder — OCADE" },
      {
        name: "description",
        content: "HAANS ANTONI is Founder, CEO and Chairman of CARCC and the creator of OCADE.",
      },
      { property: "og:title", content: "About the founder — OCADE" },
      {
        property: "og:description",
        content: "The founder of CARCC and creator of OCADE.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(FOUNDER_STRUCTURED_DATA),
      },
    ],
  }),
  component: AboutPage,
});

/**
 * About is the FOUNDER page.
 *
 * It used to be a marketing overview with a pill row, a company profile, a
 * product profile and a separate `/founder/haans-antoni` page carrying the
 * person. Four pages said one thing between them. `PLAN.md` keeps `/about` as
 * About the Founder, so the founder record is here and the company appears
 * only as the context the record needs.
 */
function AboutPage() {
  return (
    <PublicPage
      title="About the founder"
      intro={`${PUBLIC_IDENTITY.founderAlternateName} is ${PUBLIC_IDENTITY.founderRoles} of ${PUBLIC_IDENTITY.brand} and the creator of ${PUBLIC_IDENTITY.product}.`}
    >
      <div className="glass flex items-center gap-4 rounded-lg p-4">
        <span
          role="img"
          aria-label={`${PUBLIC_IDENTITY.founderAlternateName} initials`}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-secondary text-base font-semibold text-secondary-foreground"
        >
          HA
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {PUBLIC_IDENTITY.founderAlternateName}
          </p>
          <p className="text-[13px] text-muted-foreground">{PUBLIC_IDENTITY.founderRoles}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {PUBLIC_IDENTITY.brand} · {PUBLIC_IDENTITY.plannedLaunchDate}
          </p>
        </div>
      </div>

      <Section title="Role">
        <p>
          Haans Antoni leads {PUBLIC_IDENTITY.brand} and directs the product vision for OCADE. The
          formal founding and public launch record is {PUBLIC_IDENTITY.plannedLaunchDate}.
        </p>
      </Section>

      <Section title="Contribution record">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Created and directs OCADE&apos;s product vision.</li>
          <li>Established the {PUBLIC_IDENTITY.brand} and OCADE brand concepts.</li>
          <li>Leads product, safety and launch requirements.</li>
        </ul>
      </Section>

      <Section title="The company">
        <p>
          {PUBLIC_IDENTITY.brand} is the independent technology enterprise behind OCADE. Its tagline
          is <strong className="text-foreground">“{PUBLIC_IDENTITY.tagline}”</strong>. OCADE is
          pronounced “{PUBLIC_IDENTITY.productPronunciation}”.
        </p>
      </Section>

      <Section title="Scope of this page">
        <p>
          This page publishes the founder identity and work record only. It does not expose account
          activity, personal contact details or private communications, and it does not imply a
          funding round, public listing, shareholder structure or securities offering.
        </p>
      </Section>
    </PublicPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}
