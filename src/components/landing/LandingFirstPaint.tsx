import { Link } from "@tanstack/react-router";

/**
 * The server-rendered, immediately usable landing surface.
 *
 * The interactive universe is deliberately not a first-load dependency. It is
 * an optional marketing enhancement, while this is the complete public path to
 * read what OCADE is, choose an account path, or opt into that enhancement.
 * Keeping the two separate means a first-time visitor can tap a real action
 * before a decorative renderer has parsed or touched the main thread.
 */
export function LandingFirstPaint({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.18_0_0/0.38),transparent_58%)]"
      />
      <section className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-center px-4 py-16 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
          OCADE by CARCC CADANE
        </p>
        <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl">
          An AI workspace for Chat, Cowork and Code.
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Work with OCADE online when authorized, or use Offline Intelligence on supported hardware
          after sign-in. Every computer action remains permissioned and observable.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/auth"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-7 text-[13.5px] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Get started
          </Link>
          <Link
            to="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border/70 bg-background/40 px-7 text-[13.5px] font-medium text-foreground backdrop-blur transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See the plans
          </Link>
          <button
            type="button"
            onClick={onExplore}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Explore the interactive view
          </button>
        </div>
        <div className="mt-16 grid max-w-3xl gap-5 text-sm text-muted-foreground sm:grid-cols-3">
          <p>
            <strong className="block text-foreground">Private by design</strong>
            Local Intelligence is prepared only after authenticated sign-in.
          </p>
          <p>
            <strong className="block text-foreground">Controlled action</strong>
            Cowork shows the intended target and requires approval when policy requires it.
          </p>
          <p>
            <strong className="block text-foreground">Continuous work</strong>
            Projects keep conversations, code, tasks and artifacts connected.
          </p>
        </div>
      </section>
    </div>
  );
}
