import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooterLinks } from "@/components/shell/SiteFooter";
import { LandingUniverse } from "@/components/landing/LandingUniverse";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAERA CADANE — Private AI workspace for people and companies" },
      {
        name: "description",
        content:
          "OCADE: a private, local-first AI assistant. It reads your documents on your own device and runs on your own hardware where it can.",
      },
      { property: "og:title", content: "CAERA CADANE — Private AI workspace" },
      {
        property: "og:description",
        content:
          "A private AI assistant that runs on your device first and asks before it uses the cloud.",
      },
    ],
  }),
  component: LandingPage,
});

/**
 * The landing page.
 *
 * NOT INSIDE `MarketingShell`, and that is the point rather than an oversight.
 * The shell contributes a sticky header carrying the identity and the sign-in
 * actions — exactly the furniture this page exists without. The identity here
 * is a single element that travels from the centre of the opening into the
 * corner, and a second copy of it in a header would make that journey look like
 * a duplicate rather than a move.
 *
 * WHAT IS DELIBERATELY GONE. The four module cards (OCADE plus three names
 * reserved for products that are not being built) and the four "pillar" cards
 * below them. Sixteen paragraphs of reassurance in eight rectangles, read by
 * nobody, in front of the one thing on this page worth looking at. FICIA, MADEE
 * and CANIA appear nowhere public: a card for something that does not exist is
 * a promise, and three of them made the product look like a suite rather than
 * an assistant.
 *
 * The skip link stays. It is the one piece of shell chrome that is not
 * decoration.
 */
function LandingPage() {
  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <LandingUniverse />
      </main>
      <footer className="relative z-10 border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 text-[11.5px] text-muted-foreground/70 sm:flex-row">
          <p>© {new Date().getFullYear()} CAERA CADANE</p>
          <SiteFooterLinks
            extra={[
              { to: "/company", label: "Company" },
              { to: "/auth", label: "Sign in" },
            ]}
          />
        </div>
      </footer>
    </div>
  );
}
