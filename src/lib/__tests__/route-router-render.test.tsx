import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { RouterProvider, createRouter, createMemoryHistory } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";

/**
 * ROUTE RENDER THROUGH THE REAL ROUTER (P20).
 *
 * `route-execution.test.tsx` renders route components directly, which proves
 * they construct — but 43 of them legitimately need router context (`Link`,
 * `useNavigate`, `useParams`) and cannot be rendered that way at all.
 *
 * This mounts the REAL generated route tree on a memory history and renders at
 * a real URL, which is how the application actually assembles a page. It is
 * strictly stronger evidence than a bare component render: layout routes,
 * nested outlets and params all participate.
 *
 * WHAT IT STILL DOES NOT PROVE: there is no browser, no DOM APIs, no network
 * and no authenticated session. `_authenticated` routes render their
 * unauthenticated state. Effects do not run. This proves a URL assembles into
 * markup without throwing — not that the page works for a signed-in user.
 */

/** Paths that exist in production and should assemble without throwing. */
const PATHS = [
  "/",
  "/auth",
  "/demo",
  "/demo/ocade",
  "/demo/files",
  "/demo/tasks",
  "/demo/settings",
  // The retired products keep a route, so they keep a render check. A
  // placeholder that throws is still a broken page.
  "/ficia",
  "/madee",
  "/cania",
];

async function renderAt(path: string): Promise<string> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
    // A failed preload must not be swallowed into a blank page during a test.
    defaultPreloadStaleTime: 0,
  });
  await router.load();
  return renderToString(<RouterProvider router={router} />);
}

describe("real URLs assemble through the real router", () => {
  it.each(PATHS)("%s renders without throwing", async (path) => {
    let html = "";
    await expect(
      (async () => {
        html = await renderAt(path);
      })(),
      `${path} threw while assembling`,
    ).resolves.not.toThrow();
    expect(html.length, `${path} produced empty markup`).toBeGreaterThan(0);
  });

  it("a URL that does not exist does not render as a normal page", async () => {
    // A 404 that renders like a real page is worse than an error: the user
    // believes they are somewhere they are not.
    const html = await renderAt("/definitely-not-a-real-route-xyz");
    expect(html.length).toBeGreaterThan(0);
    expect(html).toMatch(/not found|404|does not exist/i);
  });
});

describe("the router tree is the one the application ships", () => {
  it("mounts the generated route tree, not a fixture", async () => {
    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      context: { queryClient },
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    const ids = Object.keys(router.routesById);
    // If this collapsed to a handful, the suite would still pass while testing
    // almost nothing.
    expect(ids.length).toBeGreaterThanOrEqual(40);
    expect(ids).toContain("/_authenticated/ocade/");
    expect(ids).toContain("/_authenticated/settings");
  });
});

/**
 * EVERY route in the shipped tree, assembled at a real URL.
 *
 * The URL list is derived from the router itself rather than written by hand,
 * so a route added tomorrow is covered automatically. A hand-maintained list
 * would drift silently towards testing less.
 */
function allRoutePaths(): string[] {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const out = new Set<string>();
  for (const id of Object.keys(router.routesById)) {
    // Layout/pathless segments are not navigable URLs on their own.
    if (id === "__root__") continue;
    let url = id
      .replace(/\/_[A-Za-z0-9]+/g, "") // strip pathless layout segments
      .replace(/\/$/, "");
    if (url === "") url = "/";
    // Substitute concrete values for params so the URL actually matches.
    url = url.replace(/\$[A-Za-z0-9]+/g, "test-id");
    // API routes are request handlers, not renderable pages.
    if (url.startsWith("/api/")) continue;
    out.add(url);
  }
  return [...out].sort();
}

/*
 * Routes that intentionally render nothing because they redirect in
 * `beforeLoad`. Pricing, download and the checkout return page are kept in the
 * tree while OCADE is free for everyone (re-enabling billing is a flag change,
 * not a rebuild) but they must not be reachable, so empty markup is the
 * CORRECT result for them rather than a blank-screen defect.
 */
const INTENTIONAL_REDIRECTS = new Set(["/pricing", "/download", "/checkout/success"]);

const ALL_PATHS = allRoutePaths().filter((p) => !INTENTIONAL_REDIRECTS.has(p));

describe("every shipped route assembles at its real URL", () => {
  it("derives the URL list from the router, not by hand", () => {
    expect(ALL_PATHS.length).toBeGreaterThanOrEqual(34);
    expect(ALL_PATHS).toContain("/");
  });

  it.each(ALL_PATHS)("%s assembles without throwing", async (path) => {
    const html = await renderAt(path);
    // Empty markup is a blank screen in production, which no assertion about
    // "not throwing" would catch on its own.
    expect(html.length, `${path} produced empty markup`).toBeGreaterThan(0);
  });
});

describe("authenticated surfaces do not leak their content without a session", () => {
  /*
   * These assertions started out expecting panel content and were WRONG:
   * `_authenticated` routes render their unauthenticated state here, because
   * this harness supplies no session. That is the more valuable thing to
   * assert. An authenticated surface that rendered its content to an
   * unauthenticated request would be a real access-control defect, and
   * server-rendered markup is exactly where such a leak would appear.
   */
  const AUTHENTICATED = [
    "/ocade/studio",
    "/ocade/models",
    "/settings/mobile",
    "/settings/vault",
    "/admin/launch-gate",
  ];

  it.each(AUTHENTICATED)("%s renders without exposing signed-in content", async (path) => {
    const html = await renderAt(path);
    expect(html.length).toBeGreaterThan(0);
    // Panel bodies that only a signed-in user should see must be absent.
    expect(html).not.toMatch(/rehearsal bench|twin bench|transaction bench/i);
    expect(html).not.toMatch(/On-device engines/i);
  });

  it("never renders a fabricated application-support claim", async () => {
    // BLOCKED means "I could not look", not "it is not there", and FULL
    // support was once hard-coded here. Neither may reach the markup.
    for (const path of ["/", "/demo/ocade", "/ocade/studio"]) {
      const html = await renderAt(path);
      expect(html, `${path} claimed application support`).not.toMatch(
        /coverage:\s*FULL|detected:\s*true/i,
      );
    }
  });
});

describe("public surfaces render their real content", () => {
  it("the demo OCADE surface renders without a session", async () => {
    const html = await renderAt("/demo/ocade");
    expect(html.length).toBeGreaterThan(500);
  });

  it("the landing page renders", async () => {
    const html = await renderAt("/");
    expect(html.length).toBeGreaterThan(500);
  });
});
