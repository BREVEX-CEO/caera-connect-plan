import { createFileRoute } from "@tanstack/react-router";
import { SiteFooterLinks } from "@/components/shell/SiteFooter";
import { LocalIntelligenceControl } from "@/components/ocade/setup/LocalIntelligenceControl";
import { LandingUniverse } from "@/components/landing/LandingUniverse";
import { WEBSITE_STRUCTURED_DATA } from "@/lib/public-identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OCADE by CARCC CADANE — Local-first AI workspace" },
      {
        name: "description",
        content:
          "OCADE is a local-first AI workspace by CARCC CADANE for private chat, research, work and permissioned computer control. Formal founding and public launch: 28 August 2026.",
      },
      { property: "og:title", content: "OCADE by CARCC CADANE — Command the Next Era." },
      {
        property: "og:description",
        content:
          "Private intelligence on your own hardware where supported, with optional authentication, Private Sync and permissioned network services.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://ocade.in/brand/ocade-carcc-wordmark.png" },
    ],
  }),
  component: LandingPage,
});

/**
 * The public landing experience deliberately stays outside the marketing shell.
 * The Three.js universe is already the highest-value visual element on this
 * route, so legal/about/support pages use a lighter CSS depth system instead of
 * pulling the full 3D engine into every public document.
 */
function LandingPage() {
  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(WEBSITE_STRUCTURED_DATA).replace(/</g, "\\u003c"),
        }}
      />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <LandingUniverse />
      </main>
      <footer className="relative z-10 border-t border-border/40 bg-background/55 py-8 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-[11.5px] text-muted-foreground/70 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="font-medium text-foreground/90">CARCC CADANE</p>
            <p className="mt-1">OCADE — Command the Next Era.</p>
            <p className="mt-1">© {new Date().getFullYear()} CARCC CADANE</p>
          </div>
          <SiteFooterLinks
            extra={[
              { to: "/about", label: "About" },
              { to: "/company", label: "Company" },
              { to: "/support", label: "Contact" },
              { to: "/privacy", label: "Privacy" },
              { to: "/terms", label: "Terms" },
              { to: "/auth", label: "Sign in" },
            ]}
          />
        </div>
        {/*
          THE UNINSTALL CONTROL, ON THE PUBLIC PAGE.

          OCADE starts preparing its intelligence as soon as a visitor arrives,
          which is what makes the product fast -- and it means a visitor who has
          not signed in has something of theirs on their device. The control to
          remove it therefore has to be reachable WITHOUT an account, on the
          page where the storing started. Quiet, near the bottom, and findable:
          a removal control that only exists behind a sign-in is not a removal
          control for the people most likely to want one.
        */}
        <div className="mx-auto mt-6 max-w-6xl px-4 text-center sm:text-left">
          <LocalIntelligenceControl variant="compact" />
        </div>
      </footer>
    </div>
  );
}
