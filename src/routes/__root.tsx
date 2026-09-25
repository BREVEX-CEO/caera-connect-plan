import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppearanceProvider } from "@/lib/appearance";
import { SettingsPanelProvider } from "@/components/settings/settings-panel";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { useInstallationBootstrap } from "@/lib/brain/use-installation";
import { useSession } from "@/lib/session";
import { needsFullNavigation } from "@/lib/security/isolation";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  /*
   * CROSSING THE ISOLATION BOUNDARY NEEDS A NEW DOCUMENT.
   *
   * Cross-origin isolation is decided when a document is CREATED, from the
   * headers on that response, so a client-side transition cannot change it.
   * Chat is isolated because inference needs `SharedArrayBuffer`; `/auth` must
   * not be, because COOP `same-origin` severs `window.opener` and that is where
   * the sign-in SDK's popup branch would run.
   *
   * Without this, routing from Chat to sign-in kept the isolated document and
   * quietly put the one page that must never be isolated on the isolated side —
   * `needsFullNavigation` has existed for this the whole time and nothing
   * consulted it. Both directions matter: the back button is the other one.
   *
   * The document's own URL is the question, not the router's idea of it, and
   * the answer is false for every ordinary navigation — which is all of them
   * except into and out of sign-in.
   */
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    if (!needsFullNavigation(window.location.pathname, location.pathname)) return;
    throw redirect({ href: location.href, reloadDocument: true });
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OCADE" },
      {
        name: "description",
        content:
          "OCADE by CARCC is an AI chat product: ask Online or Offline, and keep your files in Library.",
      },
      { name: "author", content: "Haans Antoni" },
      // Matches --background in the default theme, so the browser chrome and
      // the app do not meet at a visible seam on mobile.
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "OCADE" },
      {
        property: "og:description",
        content: "OCADE by CARCC. Chat Online or Offline, with your files in Library.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "OCADE" },
      { property: "og:image", content: "https://ocade.in/brand/ocade-og.png" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      /*
       * Emitted only when the URL actually resolved. Vite rewrites `?url` to a
       * hashed asset path in dev and in the build, but under vitest there is no
       * asset pipeline and the import resolves to "". A
       * `<link rel="stylesheet" href="">` resolves to the CURRENT PAGE, so the
       * browser re-requests the document and parses HTML as CSS.
       */
      ...(appCss ? [{ rel: "stylesheet", href: appCss }] : []),
      /*
       * The two faces on screen before anything else. A font is requested by
       * the STYLESHEET, so without this the browser cannot know it needs one
       * until the CSS has downloaded, parsed and laid the text out once — and
       * the swap then reflows every line it touches.
       */
      {
        rel: "preload",
        href: "/fonts/inter-latin.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      /*
       * NO WEB APP MANIFEST, AND NO APPLE TOUCH ICON. OCADE IS A WEBSITE.
       *
       * Those two links were the whole of the product's install promotion, and
       * neither is passive: a manifest with `display: standalone` is precisely
       * what makes Chrome offer "Install app" in the address bar and in its
       * menu, and `apple-touch-icon` is what dresses an "Add to Home Screen"
       * shortcut up as an application on iOS. OCADE is reached at ocade.in in a
       * browser; nobody is asked to install anything.
       *
       * The service worker stays and is untouched. It is what makes the shell
       * open without a connection, and it needs no manifest to do that —
       * offline caching and installability are separate browser features that
       * happen to be described in the same tutorials.
       *
       * The manifest was also broken: its `start_url` was `/ocade`, a route
       * that answers 404, so anybody who did install it got an error page.
       */
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
 * `AppearanceProvider` puts the classes on <html> in an effect, so until React
 * hydrates the document has no theme at all and the browser paints its own
 * white canvas. On a near-black product that white frame reads as the page
 * having failed and reloaded.
 *
 * Synchronous, inline, in <head>, before anything renders — a module cannot do
 * it, because modules are deferred by definition. It reads the same key and
 * the same shape as `readLocal()` in `src/lib/appearance.tsx`, and if anything
 * goes wrong it does nothing and leaves the default dark in place.
 */
const THEME_BOOT = `(function(){try{
var d=document.documentElement;var light=false;var hc=false;var rm=false;
try{var raw=localStorage.getItem("ocade:appearance:v1");
if(raw){var p=JSON.parse(raw);light=p&&p.theme==="light";hc=!!(p&&p.highContrast);rm=!!(p&&p.reducedMotion);}}catch(e){}
if(light)d.classList.add("light");
if(hc)d.classList.add("high-contrast");
if(rm)d.classList.add("reduce-motion");
d.style.background=light?"#f1f1f1":"#0a0a0a";
d.style.colorScheme=light?"light":"dark";
}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` is not cosmetic and not optional: the boot
     * script's whole job is to change this element before React sees it, so the
     * server HTML and the live DOM disagree on <html> BY DESIGN. React 19 treats
     * a mismatch on the root element as a failed hydration and throws the server
     * markup away. The suppression is one level deep, so a genuine mismatch
     * inside the app still fails loudly.
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

  /**
   * Async failures never reach a React boundary — an unhandled rejection in a
   * fetch or an event handler would otherwise vanish with no diagnostic at all.
   */

  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <SettingsPanelProvider>
          <BrowserBootstrap />
          {/*
            THE TOASTER. Without it mounted here, `toast()` is a no-op — and it
            must be here rather than in `RootShell`, because `shellComponent`
            renders the document on the SERVER and the client hydrates the route
            tree only. Outside the ErrorBoundary on purpose: when the boundary is
            showing its fallback, explaining what failed is when a toast matters
            most.
          */}
          <Toaster
            position="bottom-right"
            closeButton
            toastOptions={{
              classNames: {
                toast: "bg-background text-foreground border border-border/70",
                description: "text-muted-foreground",
                actionButton: "bg-primary text-primary-foreground",
              },
            }}
          />
          <ErrorBoundary
            label="OCADE"
            fallback={(retry, message) => (
              <main className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="max-w-md text-center" role="alert">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    Something stopped working
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                  <button
                    onClick={retry}
                    className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Try again
                  </button>
                </div>
              </main>
            )}
          >
            <Outlet />
          </ErrorBoundary>
        </SettingsPanelProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}

/**
 * Work that must happen once per browser and nowhere on screen.
 *
 * Offline Intelligence preparation starts on the first supported visit whether
 * or not anybody is signed in — `docs/PRD.md` and `docs/TRD.md` both say so —
 * and nothing it needs is imported statically, so the transfer can never share
 * a task with hydration.
 */
function refreshOfflineAllowance() {
  void import("@/lib/commercial/offline-allowance")
    .then((module) => module.syncOfflineAllowance())
    .catch(() => {});
}

function BrowserBootstrap() {
  const router = useRouter();
  /*
   * PREPARING OFFLINE INTELLIGENCE NEEDS AN ACCOUNT, SO IT WAITS FOR ONE.
   *
   * This started on every visit, signed in or not. The release lookup is
   * authenticated — it mints a delivery link for a person — so a signed-out
   * bootstrap could only fail, and it failed into a stage nothing retries:
   * a fresh tab that signed in with an emailed code stayed permanently broken
   * because the sign-in was a client-side navigation and nothing started the
   * install again.
   *
   * `enabled` flips when the account arrives, which re-runs the effect. That
   * covers the emailed-code path, the redirect back from Google, and a session
   * restored from storage, without a second trigger for each.
   */
  const { user } = useSession();
  useInstallationBootstrap({ enabled: Boolean(user) });

  /*
   * REGISTER THE SERVICE WORKER, WHICH NOTHING WAS DOING.
   *
   * `public/sw.js` has been in the tree the whole time — network-first
   * navigation, an offline page, and the `backgroundfetch*` handlers the model
   * transfer resumes through — and no code ever called `register`. So the
   * application could not open without a network on the very product whose
   * point is that it can, and a download interrupted by a closed tab had no
   * worker to carry on in.
   *
   * AFTER LOAD, DELIBERATELY. Registration competes with hydration and with the
   * first paint, and the worker controls the NEXT navigation regardless, so
   * there is nothing to gain by doing it sooner.
   */
  /*
   * KEEP A SIGNED OFFLINE ALLOWANCE ON THE DEVICE WHILE THERE IS A NETWORK.
   *
   * Deferred, unawaited, and silent about every failure: it is background work
   * on behalf of a session that has not started yet. `syncOfflineAllowance`
   * reports anything spent offline before asking for more, and asks only when
   * the device is running low.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(refreshOfflineAllowance, 2000);
    window.addEventListener("online", refreshOfflineAllowance);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", refreshOfflineAllowance);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* A browser that refuses it still gets the whole product, online. */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    /*
     * WHO IS SIGNED IN, so an event that does not change the answer does not
     * re-match every route.
     *
     * Supabase emits `SIGNED_OUT` for its own housekeeping as well as for a
     * person signing out — a failed `verifyOtp` emits one while nobody was
     * signed in to begin with. Invalidating on that dragged the router through
     * a re-match of the screen the person was standing on, and on
     * `/auth/verify` — whose search carries the channel and the address the
     * code went to — the re-match came back without them and threw. Entering a
     * wrong code replaced the screen with "Something stopped working", so the
     * only recovery from a typo was to start again.
     *
     * An event that leaves the same account signed in, or nobody signed in,
     * now changes nothing.
     */
    let signedIn: string | null = null;
    void import("@/integrations/supabase/client").then(
      ({ getSupabaseBrowserConfiguration, supabase }) => {
        if (cancelled || !getSupabaseBrowserConfiguration().configured) return;
        void supabase.auth.getSession().then(({ data }) => {
          if (!cancelled) signedIn = data.session?.user.id ?? null;
        });
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
          const nowSignedIn = session?.user.id ?? null;
          if (nowSignedIn === signedIn && event !== "USER_UPDATED") return;
          const previous = signedIn;
          signedIn = nowSignedIn;
          if (event === "SIGNED_IN") setTimeout(refreshOfflineAllowance, 0);
          if (event === "SIGNED_OUT") {
            /*
             * What signing out clears is what this TAB was holding, never the
             * account's own records: the next person to sign in on this machine
             * must not inherit an unsent turn from the last one.
             */
            if (previous) {
              void import("@/lib/chat/unsynced-turns")
                .then((module) => module.forgetAllUnsyncedTurns(previous))
                .catch(() => {});
            }
          }
          router.invalidate();
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      },
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  useEffect(() => {
    void import("@/lib/security/isolation-upgrade").then((module) =>
      module.upgradeIsolationInBrowser(),
    );
  }, []);

  return null;
}

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page is not part of OCADE. Your chats and files are where you left them.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open Chat
        </Link>
      </div>
    </main>
  );
}

function ErrorComponent({ reset }: { reset: () => void }) {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center" role="alert">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try again, or go back to Chat.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Open Chat
          </a>
        </div>
      </div>
    </main>
  );
}
