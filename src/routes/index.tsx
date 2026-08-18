import { createFileRoute, Link } from "@tanstack/react-router";
import { CosmicInteractionLayer } from "@/components/landing/CosmicInteractionLayer";
import { LandingModelWarmup } from "@/components/landing/LandingModelWarmup";
import { LandingUniverse } from "@/components/landing/LandingUniverse";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OCADE by CAERA CADANE — AI that runs on your device" },
      {
        name: "description",
        content:
          "OCADE is a local-only AI workspace. Its browser and desktop AI engines run on your own device; prompts are never routed to Gemini, GPT, OpenAI or another cloud model.",
      },
      { property: "og:title", content: "OCADE by CAERA CADANE — Local-only AI" },
      {
        property: "og:description",
        content:
          "A private AI workspace whose inference runs on your device, with browser-local model caching for fast return visits.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#02050a]">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <LandingModelWarmup />
      <CosmicInteractionLayer />
      <main id="main-content" tabIndex={-1} className="relative focus:outline-none">
        <LandingUniverse />
        <section className="relative z-10 border-y border-white/[0.07] bg-black/45 px-4 py-24 backdrop-blur-xl sm:py-32">
          <div className="mx-auto max-w-5xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-cyan-300/75">
              OCADE Instant Local
            </p>
            <div className="mt-5 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <h2 className="max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
                  Open once. Come back to an AI that is already closer to ready.
                </h2>
                <p className="mt-6 max-w-2xl text-pretty text-[15px] leading-7 text-white/58 sm:text-base">
                  On supported browsers, OCADE begins preparing the smallest safe local engine shortly
                  after the page opens. Completed model data is kept in browser application storage,
                  interrupted preparation resumes later, and the temporary inference worker is released
                  after warming so a marketing visit does not leave a model sitting in memory.
                </p>
              </div>
              <div className="grid gap-3 text-sm text-white/72">
                <InstantLocalFact title="No cloud model fallback">
                  If a local engine is unavailable, OCADE says so instead of forwarding the prompt.
                </InstantLocalFact>
                <InstantLocalFact title="One browser engine across tabs">
                  Web Locks coordinate same-origin tabs so multiple pages do not intentionally load separate full model engines.
                </InstantLocalFact>
                <InstantLocalFact title="Commercial deployment path">
                  The same local-first architecture can support managed enterprise installs, self-hosted model distribution and paid support without selling user prompts.
                </InstantLocalFact>
              </div>
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/demo/ocade" className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-[13px] font-medium text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:hover:translate-y-0">
                Try OCADE locally
              </Link>
              <Link to="/company" className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 text-[13px] font-medium text-white/85 backdrop-blur transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                Enterprise & company
              </Link>
            </div>
            <p className="mt-7 max-w-3xl text-[11px] leading-5 text-white/38">
              First delivery still requires a working connection. A browser may terminate page or service-worker work after every tab is closed, so OCADE stores partial progress and resumes it on the next visit rather than claiming an impossible guaranteed background download. Save-Data is always respected.
            </p>
          </div>
        </section>
      </main>
      <footer className="relative z-10 border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 text-[11.5px] text-muted-foreground/70 sm:flex-row">
          <p>© {new Date().getFullYear()} CAERA CADANE</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/company" className="transition-colors hover:text-foreground">Company</Link>
            <Link to="/faq" className="transition-colors hover:text-foreground">FAQ</Link>
            <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link to="/settings/support" className="transition-colors hover:text-foreground">Support</Link>
            <Link to="/auth" className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InstantLocalFact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
      <p className="font-medium text-white/92">{title}</p>
      <p className="mt-1.5 text-[12px] leading-5 text-white/48">{children}</p>
    </div>
  );
}
