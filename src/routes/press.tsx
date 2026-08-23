import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";

export const Route = createFileRoute("/press")({
  head: () => ({ meta: [{ title: "CARCC CADANE press kit" }, { name: "description", content: "Official pre-launch OCADE facts and downloadable CARCC CADANE brand assets." }] }),
  component: PressPage,
});

function PressPage() {
  return (
    <PublicPage eyebrow="Press and media" title="CARCC CADANE press kit" summary="Source-bound company and product facts for OCADE coverage. No press coverage, award, customer, funding or incorporation claim is implied.">
      <PublicSection title="Company overview"><p>CARCC CADANE is the independent pre-launch venture behind OCADE, created and led by Haans Antoni in Bengaluru, Karnataka, India. OCADE is a local-first AI workspace being prepared for a planned public launch on 28 August 2026.</p></PublicSection>
      <PublicSection title="Brand assets"><div className="grid gap-4 sm:grid-cols-2"><a href="/brand/ocade-carcc-wordmark.png" download className="rounded-xl border border-border/70 p-4 text-foreground"><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE wordmark" width={2172} height={724} className="aspect-[3/1] w-full object-contain" /><span className="mt-2 block text-xs">Download wordmark PNG</span></a><a href="/brand/ocade-carcc-mark.png" download className="rounded-xl border border-border/70 p-4 text-foreground"><img src="/brand/ocade-carcc-mark.png" alt="OCADE mark" width={1296} height={1296} className="mx-auto aspect-square w-28 object-contain" /><span className="mt-2 block text-xs">Download mark PNG</span></a></div><p>Keep the black background, metallic silver, violet and gold treatment intact. Do not recolour, crop through the mark or imply endorsement.</p></PublicSection>
      <PublicSection title="Key statistics"><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wide">Product</dt><dd className="text-foreground">1 active product: OCADE</dd></div><div><dt className="text-xs uppercase tracking-wide">Planned founding and launch</dt><dd className="text-foreground">28 August 2026</dd></div><div><dt className="text-xs uppercase tracking-wide">Headquarters record</dt><dd className="text-foreground">Bengaluru, Karnataka, India</dd></div><div><dt className="text-xs uppercase tracking-wide">Verified funding or customers</dt><dd className="text-foreground">None claimed</dd></div></dl></PublicSection>
      <PublicSection title="Recent press releases"><p>No press release has been published. This empty state is intentional; product journal posts are not relabelled as press releases.</p><Link to="/blog" className="text-foreground underline">Read the OCADE journal</Link></PublicSection>
      <PublicSection title="Press contact"><p>A dedicated press mailbox has not been verified, so no address is published. Use the official company and founder profiles for sourceable facts until a press contact is confirmed.</p></PublicSection>
    </PublicPage>
  );
}
