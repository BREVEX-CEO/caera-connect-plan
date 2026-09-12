import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportRuntimeError } from "@/lib/runtime-error-reporting";
import { AppearanceProvider } from "@/lib/appearance";
import { SettingsPanelProvider } from "@/components/settings/settings-panel";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { useInstallationBootstrap } from "@/lib/brain/use-installation";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OCADE" },
      {
        name: "description",
        content:
          "OCADE is a small AI workspace: chat, a library of your files and outputs, and work OCADE can carry out for you.",
      },
      { name: "author", content: "Haans Antoni" },
      // Matches --background in the default theme, so the browser chrome and
      // the app do not meet at a visible seam on mobile.
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "OCADE" },
      {
        property: "og:description",
        content: "A small AI workspace. Chat, Library and Cowork, and nothing you did not ask for.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "OCADE" },
      { property: "og:image", content: "/brand/ocade-carcc-wordmark.png" },
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
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
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
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportRuntimeError(reason instanceof Error ? reason : new Error(String(reason)), {
        boundary: "unhandled_rejection",
      });
    };
    const onError = (event: ErrorEvent) => {
      reportRuntimeError(event.error instanceof Error ? event.error : new Error(event.message), {
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
function BrowserBootstrap() {
  const router = useRouter();
  useInstallationBootstrap();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/integrations/supabase/client").then(
      ({ getSupabaseBrowserConfiguration, supabase }) => {
        if (cancelled || !getSupabaseBrowserConfiguration().configured) return;
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (cancelled) return;
          if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
          if (event === "SIGNED_OUT") {
            /*
             * What signing out clears is what this TAB was holding, never the
             * account's own records: the next person to sign in on this machine
             * must not inherit an unsent turn from the last one.
             */
            void import("@/lib/chat/unsynced-turns")
              .then((module) => module.forgetAllUnsyncedTurns())
              .catch(() => {});
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
