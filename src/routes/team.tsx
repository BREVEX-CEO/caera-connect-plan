import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "CARCC CADANE team" }, { name: "description", content: "The current, factual CARCC CADANE team record behind OCADE." }] }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <PublicPage eyebrow="People" title="The team behind OCADE" summary="CARCC CADANE publishes only people whose roles are verified. It does not use stock portraits, fictional employees or inflated team counts.">
      <PublicSection title="Founder and product leadership"><article className="flex gap-4"><div role="img" aria-label="HAANS ANTONI initials" className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 font-semibold">HA</div><div><h3 className="font-semibold text-foreground">HAANS ANTONI</h3><p>CEO, Chairman and Founder</p><p className="mt-2">Product direction, local intelligence, safety and launch evidence for OCADE.</p><Link to="/founder/haans-antoni" className="mt-2 inline-block text-foreground underline">Official founder profile</Link></div></article></PublicSection>
      <PublicSection title="Areas of work"><div className="grid gap-3 sm:grid-cols-3">{["Product and design", "Local AI and engineering", "Safety and launch readiness"].map((area) => <div key={area} className="rounded-xl border border-border/60 p-3 text-foreground">{area}</div>)}</div><p>These are work areas, not claims of separate departments or unlisted employees.</p></PublicSection>
      <PublicSection title="Working character"><p>OCADE is being built around direct evidence, local-first execution, explicit permissions and honest failure states. Public records separate the product that exists from future-company, funding and hiring plans.</p></PublicSection>
      <PublicSection title="Work with CARCC CADANE"><p>No opening is advertised without verified role terms. The careers page records current workstreams and explains when a role can be published.</p><Link to="/careers" className="text-foreground underline">View careers</Link></PublicSection>
    </PublicPage>
  );
}
