import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { SiteFooterLinks } from "@/components/shell/SiteFooter";
import { LandingFirstPaint } from "@/components/landing/LandingFirstPaint";
import { WEBSITE_STRUCTURED_DATA } from "@/lib/public-identity";
import { getSupabaseBrowserConfiguration } from "@/integrations/supabase/configuration";
import {
  hasSeenLanding,
  hasStoredSupabaseSession,
  markLandingSeen,
  rootEntryFor,
} from "@/lib/entry/root-entry";

/* The interactive renderer is optional, customer-requested marketing code. */
const LandingUniverse = lazy(() =>
  import("@/components/landing/LandingUniverse").then((module) => ({
    default: module.LandingUniverse,
  })),
);

export const Route = createFileRoute("/")({
  /**
   * WHICH OF THE THREE ENTRY RULES APPLIES, ANSWERED BEFORE ANYTHING RENDERS.
   *
   * ON THE SERVER the cookie is the only fact available, and it is enough to
   * decide whether the landing page may be sent at all. A returning visitor
   * gets `returning: true` and the component below renders an opening state
   * instead of the marketing page, so the landing page is never painted and
   * then taken away. A crawler carries no cookie and therefore always receives
   * the real landing markup.
   *
   * ON THE CLIENT — which is every navigation to `/` after the first document,
   * such as the 404 page's "Go back home" — both facts are available, so the
   * redirect happens here and the opening state is never needed.
   */
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      /*
       * FAILS TOWARDS THE LANDING PAGE. If the cookie cannot be read — no live
       * request, a prerender pass, a server function that rejects — this route
       * must still render the public landing page rather than throw. A `/`
       * that errors is the worst route in the product to lose.
       */
      try {
        const { landingSeenOnServer } = await import("@/lib/entry/entry.functions");
        return { returning: await landingSeenOnServer() };
      } catch {
        return { returning: false };
      }
    }

    const entry = rootEntryFor({
      seenLanding: hasSeenLanding(document.cookie),
      storedSession: hasStoredSupabaseSession(getSupabaseBrowserConfiguration().url),
    });
    if (entry === "workspace") throw redirect({ to: "/ocade", replace: true });
    if (entry === "sign-in") throw redirect({ to: "/auth", replace: true });
    return { returning: false };
  },
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
          "Private intelligence on your own hardware where supported, with optional authentication, account-hosted workspace data and permissioned network services.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://ocade.in/brand/ocade-carcc-wordmark.png" },
    ],
  }),
  component: RootEntryPage,
});

/**
 * The server said this device has been here before, so the landing page is not
 * what it came for — but only the browser knows whether there is a session.
 *
 * Renders an opening state rather than the landing page, which is what keeps
 * the marketing page from flashing past somebody on their way to work. The
 * decision itself is a synchronous storage read in an effect, so this is on
 * screen for one frame in the ordinary case; it is written as a real state
 * because "one frame" stops being true on a cold cache or a slow phone.
 */
function ReturningVisitor() {
  const navigate = useNavigate();

  useEffect(() => {
    const entry = rootEntryFor({
      seenLanding: true,
      storedSession: hasStoredSupabaseSession(getSupabaseBrowserConfiguration().url),
    });
    void navigate({ to: entry === "workspace" ? "/ocade" : "/auth", replace: true });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground" role="status">
        Opening OCADE…
      </p>
    </main>
  );
}

function RootEntryPage() {
  const { returning } = Route.useRouteContext();
  return returning ? <ReturningVisitor /> : <LandingPage />;
}

/**
 * The public landing experience deliberately stays outside the marketing shell.
 * The Three.js universe is already the highest-value visual element on this
 * route, so legal/about/support pages use a lighter CSS depth system instead of
 * pulling the full 3D engine into every public document.
 */
function LandingPage() {
  const navigate = useNavigate();
  const [interactive, setInteractive] = useState(false);
  const firstPaint = <LandingFirstPaint onExplore={() => setInteractive(true)} />;

  /*
   * A SESSION STILL OVERRIDES THE LANDING PAGE, EVEN WITHOUT THE COOKIE.
   *
   * The server could only see the cookie, so an account signed in on a device
   * that has never opened `/` — a deep link, a cleared cookie jar, a restored
   * profile — was sent marketing it had already bought. The browser knows
   * better, and this is the first moment it can say so. Measured in a browser
   * before it was written: `beforeLoad` does not re-run on the client while
   * hydrating a server-rendered document, so the check has to live here.
   *
   * Otherwise the device has now seen the landing page, so the next visit is a
   * returning one. Marked after paint rather than in `beforeLoad` because a
   * visit that never rendered — a prefetch, an aborted navigation — has shown
   * nobody anything, and marking it seen would retire the landing page for a
   * person who has not read a word of it.
   */
  useEffect(() => {
    if (hasStoredSupabaseSession(getSupabaseBrowserConfiguration().url)) {
      void navigate({ to: "/ocade", replace: true });
      return;
    }
    markLandingSeen();
  }, [navigate]);

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
        {interactive ? (
          <Suspense fallback={firstPaint}>
            <LandingUniverse />
          </Suspense>
        ) : (
          firstPaint
        )}
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
      </footer>
    </div>
  );
}
