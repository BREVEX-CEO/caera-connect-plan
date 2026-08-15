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
import { hardenDesktopShell } from "@/lib/security/shell-hardening";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getSupabaseBrowserConfiguration, supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/lib/theme-provider";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { DepthScene } from "@/components/motion/DepthScene";
import { invalidateModeCache } from "@/lib/storage/resolver";
import { clearDevices } from "@/lib/mobile/device-store";
import { clearApprovals } from "@/lib/mobile/approval-store";
import { registerOfflineShellFromBrowser } from "@/lib/local/web-supervisor";
import { primeOfflineRuntimeFromBrowser } from "@/lib/offline/prime-runtime";
import { closeActiveCompanionSession } from "@/lib/native/tauri-companion";
// Side-effect import: registers Foundation Alpha features on module load.
import "@/lib/features";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
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
      { title: "CAERA CADANE — Private AI workspace" },
      {
        name: "description",
        content:
          "CAERA CADANE is a privacy-first cross-platform AI work platform. OCADE is a local-first AI assistant that reads your documents on your own device.",
      },
      { name: "author", content: "Haans Antoni" },
      // Matches --background in the default (black) theme, so the browser
      // chrome and the app do not meet at a visible seam on mobile.
      { name: "theme-color", content: "#0a0a09" },
      { property: "og:title", content: "CAERA CADANE — Private AI workspace" },
      {
        property: "og:description",
        content:
          "Private AI assistant, commerce and studio for solo builders, small businesses and enterprise.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "CAERA CADANE" },
      { property: "og:image", content: "/brand/ocade-wordmark.png" },
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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
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

  useEffect(() => {
    if (!getSupabaseBrowserConfiguration().configured) {
      // Keep public and legal pages available during a deployment binding
      // incident. Authentication remains unavailable and therefore fails
      // closed; no alternate project or insecure fallback is selected.
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

      // Privacy modes are cached in a module-level map for the life of the tab.
      // Clearing it on sign-out means the next account starts from its own
      // stored settings rather than inheriting whatever was resolved before.
      if (event === "SIGNED_OUT") {
        invalidateModeCache();
        // Paired phones belong to the account that paired them. The store is
        // device-local and not account-scoped, so leaving them would show the
        // next person to sign in on this browser the previous account's trusted
        // devices — and let them act through them.
        clearDevices();
        clearApprovals();
        // A signed native session is account-scoped. Invalidate the in-memory
        // signer immediately and let worker subscribers stop before this
        // browser can be used by another account.
        void closeActiveCompanionSession().catch(() => {
          // Local invalidation already happened before host IPC. A transport
          // failure must not resurrect or retain the closed signer.
        });
      }

      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  /**
   * Install the offline shell (HWE-35).
   *
   * Fire-and-forget on purpose: a browser that refuses a service worker —
   * private browsing, an insecure origin, a locked-down enterprise profile — is
   * an ordinary state, not an error, and `registerOfflineShell` never throws.
   * The outcome is not surfaced here because nothing about THIS render changes;
   * `supervisionCapability` is what screens read when they need to say what
   * works offline.
   */
  useEffect(() => {
    void registerOfflineShellFromBrowser().then((registration) => {
      if (registration.ok) void primeOfflineRuntimeFromBrowser();
    });
  }, []);

  /*
   * Desktop shell polish: no context menu, no devtools shortcuts, no stray
   * reload. A no-op on the web, where breaking right-click would cost people
   * copy, open-in-new-tab and screen-reader actions to inconvenience somebody
   * who can read the served source anyway.
   */
  useEffect(() => hardenDesktopShell(), []);

  /**
   * Async failures never reach a React boundary — an unhandled rejection in a
   * fetch or an event handler would otherwise vanish with no diagnostic at all.
   * These capture them without changing what the user sees.
   */
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      reportLovableError(reason instanceof Error ? reason : new Error(String(reason)), {
        boundary: "unhandled_rejection",
      });
    };
    const onError = (e: ErrorEvent) => {
      reportLovableError(e.error instanceof Error ? e.error : new Error(e.message), {
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
        {/*
          THE TOASTER. Without it, `toast()` is a no-op.

          `sonner` was a dependency, `toast` was imported in 24 files, and there
          were 225 call sites — and no `<Toaster />` was mounted anywhere in the
          application, so not one of those messages could ever appear. Every
          refusal, every failure reason, every confirmation was written,
          dispatched, and dropped.

          The failure mode is the worst kind: silent. A blocked send looked like
          a dead button. "Your 8-minute demo has ended" never arrived. A vault
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
            label="CAERA CADANE"
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
            <Outlet />
          </ErrorBoundary>
        </DepthScene>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
