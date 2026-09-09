import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/runtime-error-reporting";
import { ThemeProvider } from "@/lib/theme-provider";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { SiteFooterLinks } from "@/components/shell/SiteFooter";
import { DepthScene } from "@/components/motion/DepthScene";
import { useInstallationBootstrap } from "@/lib/brain/use-installation";
import { LegalConsentGate } from "@/components/legal/LegalConsentGate";
// Side-effect import: registers Foundation Alpha features on module load.
import "@/lib/features";

function NotFoundComponent() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16">
      {/* Restrained ambient depth — one soft light source, no page-wide gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border/70 bg-background/70 p-8 text-center shadow-[0_28px_90px_rgba(0, 0, 0,0.35)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          CARCC CADANE
        </p>
        <h1 className="mt-4 text-6xl font-semibold tracking-tight text-foreground">404</h1>
        <h2 className="mt-3 text-lg font-semibold text-foreground">
          This page isn&apos;t part of the workspace
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The link may be out of date, or the page may have moved. Nothing has been lost — your
          account and work are exactly where you left them.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go back home
          </Link>
          <Link
            to="/ocade"
            className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Open OCADE
          </Link>
        </div>
        <SiteFooterLinks className="mt-6 justify-center text-xs text-muted-foreground" />
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center" role="alert">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CARCC CADANE — Private AI workspace" },
      {
        name: "description",
        content:
          "CARCC CADANE is a privacy-first cross-platform AI work platform. OCADE is a local-first AI assistant that reads your documents on your own device.",
      },
      { name: "author", content: "Haans Antoni" },
      // Matches --background in the default (black) theme, so the browser
      // chrome and the app do not meet at a visible seam on mobile.
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "CARCC CADANE — Private AI workspace" },
      {
        property: "og:description",
        content:
          "Private AI assistant, commerce and studio for solo builders, small businesses and enterprise.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "CARCC CADANE" },
      { property: "og:image", content: "/brand/ocade-carcc-wordmark.png" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      /*
        Emitted only when the URL actually resolved.

        Vite rewrites `?url` to a hashed asset path in dev and in the build, but
        under vitest there is no asset pipeline and the import resolves to "".
        React then warns twice per render — once that a `precedence` stylesheet
        needs a non-empty href, once that an empty string was passed to href —
        and its advice is exactly this: do not render the element at all.

        The guard is not test-only cosmetics. A `<link rel="stylesheet" href="">`
        resolves to the CURRENT PAGE, so any environment where the import fails
        to resolve makes the browser re-request the document and parse the HTML
        as CSS. Omitting the tag degrades to unstyled; emitting an empty one
        costs a wasted round trip on every navigation.
      */
      ...(appCss ? [{ rel: "stylesheet", href: appCss }] : []),
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      // Makes OCADE installable as its own window (HWE-35). Without it the
      // offline shell registered below has an application to open but no
      // application to BE — a tab that gets closed rather than an app that
      // stays.
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/*
 * THE FIRST PAINT IS A THEME DECISION, AND REACT IS TOO LATE TO MAKE IT.
 *
 * `ThemeProvider` puts `light`/`real` on <html> in an effect, so until React
 * hydrates the document has no theme class at all. That leaves two seams. The
 * browser paints its own canvas — white — before the stylesheet parses, and a
 * reader on the light theme then gets white, black, light, in that order. On a
 * black product the white frame is the one people notice; it reads as the page
 * having failed and reloaded.
 *
 * This is the standard fix and it has to be exactly this shape: synchronous,
 * inline, in <head>, before anything renders. A module cannot do it — modules
 * are deferred by definition. The inline background is what covers the gap
 * before the stylesheet lands; the class is what stops the second flip.
 *
 * It reads the same key and the same shape as `readLocal()` in
 * theme-provider.tsx, and if anything at all goes wrong it does nothing and
 * leaves the default black in place. Storage can be blocked, the value can be
 * garbage, and neither is worth a blank page.
 */
/*
 * Theme AND language, both applied before first paint.
 *
 * The language matters for the same reason the theme does, and for a different
 * audience: a screen reader picks its pronunciation from the document's `lang`
 * attribute, so a page announced in the wrong language is unintelligible rather
 * than merely accented. Correcting it after hydration would mean the first
 * thing read aloud is read wrong.
 *
 * The stored choice wins over the browser's, because somebody who picked a
 * language has said something deliberate. An unrecognised stored value is
 * ignored rather than trusted: this runs before any of the application's own
 * validation exists, and the list is inlined here for the same reason the theme
 * names are — a module import would defeat the point of running first.
 * `supported-locales.ts` remains the authority, and
 * `locale-boot-matches-authority.test.ts` asserts the two lists agree.
 */
const THEME_BOOT = `(function(){try{
var d=document.documentElement;var t="dark";
try{var r=localStorage.getItem("caera:appearance:v1");
if(r){var p=JSON.parse(r);if(p&&(p.theme==="light"||p.theme==="real"))t=p.theme;}}catch(e){}
d.classList.add("theme-"+t);if(t!=="dark")d.classList.add(t);
var bg=t==="light"?"#f1f1f1":"#0a0a0a";
d.style.background=bg;d.style.colorScheme=t==="light"?"light":"dark";
try{var L=["en-US","en-GB","en-IN","hi-IN","de-DE","fr-FR","es-ES","ja-JP"];
var l=localStorage.getItem("ocade.locale.v1");
if(l&&L.indexOf(l)!==-1){d.lang=l;}
else{var n=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language])||[];
for(var i=0;i<n.length;i++){if(L.indexOf(n[i])!==-1){d.lang=n[i];break;}}}}catch(e){}
}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    /*
     * The inline background on <html> is the floor under everything above: if
     * the script is blocked by a strict CSP and the stylesheet is still in
     * flight, the canvas is still not white.
     *
     * `suppressHydrationWarning` is not cosmetic here, and it is not optional.
     * The boot script's whole job is to change this element before React sees
     * it, so the server HTML and the live DOM disagree on <html> BY DESIGN.
     * React 19 treats a mismatch on the root element as a failed hydration and
     * throws the server markup away to re-render the entire tree on the
     * client. That is how this was found: offline, where a full client render
     * has to redo everything from cache, the document sat blank for ten
     * seconds and the service-worker probe read an empty title and an empty
     * body. Online it merely cost a full re-render nobody had measured.
     *
     * The suppression is one level deep — it covers this element's own
     * attributes, not its children — so a genuine mismatch inside the app
     * still fails loudly.
     */
    <html lang="en" style={{ background: "#0a0a0a" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  /*
   * Whether anybody is signed in, used for one thing only: deciding whether
   * Offline Intelligence may begin preparing itself.
   *
   * It is filled in by the subscription below rather than by `useSession`,
   * and that is a bundle decision with a measurable price. A static import of
   * the Supabase client puts 200 KiB of auth, PostgREST, realtime and storage
   * into the ENTRY graph, which every visitor to a public marketing page then
   * parses before first paint — on the landing route that parse is a large
   * part of the Total Blocking Time PLAN.md §26 caps at 200 ms.
   *
   * Starting false is the safe direction: preparation waits for a session it
   * can see rather than starting on an assumption.
   */
  const [signedIn, setSignedIn] = useState(false);
  const [backgroundRuntimeReady, setBackgroundRuntimeReady] = useState(
    () => !isPublicFirstPaintPath(pathname),
  );

  /*
   * A public page must be usable before background account/session, service
   * worker and device-maintenance work begins. Start as soon as the visitor
   * asks to interact, or after the initial reading window. Product routes are
   * ready immediately, so an authenticated redirect never delays preparation.
   */
  useEffect(() => {
    if (backgroundRuntimeReady) return;
    const start = () => window.setTimeout(() => setBackgroundRuntimeReady(true), 0);
    const timer = window.setTimeout(start, 4_000);
    window.addEventListener("pointerdown", start, { once: true, passive: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [backgroundRuntimeReady]);

  /**
   * Async failures never reach a React boundary — an unhandled rejection in a
   * fetch or an event handler would otherwise vanish with no diagnostic at all.
   * These capture them without changing what the user sees.
   */
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      reportRuntimeError(reason instanceof Error ? reason : new Error(String(reason)), {
        boundary: "unhandled_rejection",
      });
    };
    const onError = (e: ErrorEvent) => {
      reportRuntimeError(e.error instanceof Error ? e.error : new Error(e.message), {
        boundary: "window_error",
      });
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {backgroundRuntimeReady ? (
          <BrowserRuntimeBootstrap
            pathname={pathname}
            queryClient={queryClient}
            router={router}
            onSignedInChange={setSignedIn}
            signedIn={signedIn}
          />
        ) : null}
        {/*
          THE TOASTER. Without it, `toast()` is a no-op.

          `sonner` was a dependency, `toast` was imported in 24 files, and there
          were 225 call sites — and no `<Toaster />` was mounted anywhere in the
          application, so not one of those messages could ever appear. Every
          refusal, every failure reason, every confirmation was written,
          dispatched, and dropped.

          The failure mode is the worst kind: silent. A blocked send looked like
          a dead button. "Your 28-minute demo has ended" never arrived. A vault
          that would not unlock gave no reason. Every call site looked correct,
          because it was — the sink was missing.

          Found by pressing send on a message containing a credential, seeing the
          send correctly refused, and seeing nothing on screen to say why.

          IT MUST LIVE HERE, NOT IN `RootShell`. `shellComponent` renders the
          HTML document on the SERVER; the client hydrates the route tree only,
          so a sibling of `{children}` in the shell never mounts in the browser.
          Sonner renders null during SSR — so mounted there it produced no server
          markup AND no client markup, and looked exactly like a missing import.
          `RootComponent` is the hydrated root, so this covers every route,
          signed in or out.

          Outside the ErrorBoundary on purpose: when the boundary is showing its
          fallback, explaining what failed is when a toast matters most.
        */}
        <Toaster
          position="bottom-right"
          closeButton
          // Follows the app's own theme tokens rather than sonner's defaults,
          // which are light-mode only and unreadable on this surface.
          toastOptions={{
            classNames: {
              toast: "bg-background text-foreground border border-border/70 shadow-lg",
              description: "text-muted-foreground",
              actionButton: "bg-primary text-primary-foreground",
            },
          }}
        />
        {/*
          Last-resort boundary. TanStack's errorComponent covers route render
          errors; this also catches anything thrown by providers or by a child
          that renders outside the route tree, so a single fault cannot leave
          the user staring at a blank page.
        */}
        {/*
          THE CAMERA FOR THE WHOLE APPLICATION.

          Mounted here, at the hydrated root, so every route renders inside one
          scene and one pointer listener rather than each shell standing up its
          own. It renders no element of its own (`display: contents`), so no
          layout below it changes.

          INSIDE the ErrorBoundary's sibling position and OUTSIDE the boundary
          itself, for the same reason the Toaster is: if a route throws, the
          fallback should still be drawn in the same space as everything else.
        */}
        <DepthScene>
          <ErrorBoundary
            label="CARCC CADANE"
            fallback={(retry, message) => (
              <main className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="max-w-md text-center" role="alert">
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Something stopped working
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <button
                      onClick={retry}
                      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Try again
                    </button>
                    <a
                      href="/"
                      className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Go home
                    </a>
                  </div>
                </div>
              </main>
            )}
          >
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <LegalConsentGate pathname={pathname}>
              <Outlet />
            </LegalConsentGate>
          </ErrorBoundary>
        </DepthScene>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function isPublicFirstPaintPath(pathname: string) {
  return (
    !pathname.startsWith("/ocade") &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/admin")
  );
}

/** Non-visual device/session work, deliberately absent from public first paint. */
function BrowserRuntimeBootstrap({
  pathname,
  queryClient,
  router,
  onSignedInChange,
  signedIn,
}: {
  pathname: string;
  queryClient: QueryClient;
  router: ReturnType<typeof useRouter>;
  onSignedInChange: (signedIn: boolean) => void;
  signedIn: boolean;
}) {
  useInstallationBootstrap({ enabled: signedIn });

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/integrations/supabase/client").then(
      ({ getSupabaseBrowserConfiguration, supabase }) => {
        if (cancelled || !getSupabaseBrowserConfiguration().configured) return;
        void supabase.auth.getSession().then(({ data }) => {
          if (!cancelled) onSignedInChange(Boolean(data.session));
        });
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          onSignedInChange(Boolean(session));
          if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
          if (event === "SIGNED_OUT") {
            /*
             * WHAT SIGNING OUT CLEARS IS WHAT THIS TAB WAS HOLDING — never the
             * account's own records.
             *
             * It used to call `clearDevices()` and `clearApprovals()`. Both
             * were safe while those lived in this browser and became
             * destructive the moment they lived in the account: signing out
             * would have unpaired every phone the person owns and thrown away
             * every approval waiting for them. Paired devices, the revocations
             * among them, and outstanding approvals all stay exactly where they
             * are.
             *
             * What must not stay is anything this tab was holding on the
             * previous person's behalf, because the next person to sign in on
             * this machine would inherit it.
             */
            void Promise.all([
              import("@/lib/offline-queue").then((module) => module.forgetAllQueues()),
              import("@/lib/chat/unsynced-turns").then((module) => module.forgetAllUnsyncedTurns()),
              /*
               * The site policy is the account's, and this tab was holding a
               * copy of it to answer permission checks without a round trip.
               * Forgetting it makes the next account start from refusal rather
               * than inheriting what the last one allowed.
               */
              import("@/lib/native/browser-bridge").then((module) =>
                module.forgetBrowserSitePolicy(),
              ),
              import("@/lib/native/tauri-companion").then((module) =>
                module.closeActiveCompanionSession(),
              ),
            ]).catch(() => {
              /* Best effort for modules that may never have loaded in this tab. */
            });
          }
          router.invalidate();
          if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      },
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [onSignedInChange, queryClient, router]);

  useEffect(() => {
    void import("@/lib/local/web-supervisor").then(({ registerOfflineShellFromBrowser }) =>
      registerOfflineShellFromBrowser().then((registration) => {
        if (!registration.ok) return;
        void import("@/lib/offline/prime-runtime").then((module) =>
          module.primeOfflineRuntimeFromBrowser(),
        );
        void import("@/lib/offline/prime-navigation").then((module) =>
          module.primeOfflineNavigationFromBrowser(router),
        );
      }),
    );
  }, [router]);

  useEffect(() => {
    void import("@/lib/security/isolation-upgrade").then((module) =>
      module.upgradeIsolationInBrowser(),
    );
  }, [pathname]);

  useEffect(() => {
    let cleanup = () => {};
    void import("@/lib/security/shell-hardening").then(({ hardenDesktopShell }) => {
      cleanup = hardenDesktopShell();
    });
    return () => cleanup();
  }, []);

  return null;
}
