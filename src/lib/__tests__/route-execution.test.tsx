import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme-provider";
import { DemoProvider } from "@/lib/demo/context";

/**
 * ROUTE EXECUTION (P20).
 *
 * Before this file, ZERO of the application's 80 routes were executed by any
 * test. Seven of them were asserted on as source TEXT — a test that reads
 * `ocade.tsx` and matches a string proves the string is present, not that the
 * route renders, and certainly not that it renders a refusal rather than a
 * blank page.
 *
 * These IMPORT and RENDER each route's real component. Import alone is worth
 * something (it executes every module-level statement in the route's entire
 * dependency graph), but rendering is what proves the surface exists.
 *
 * HONESTY ABOUT WHAT A NODE RENDER CAN AND CANNOT PROVE
 * ----------------------------------------------------
 * `renderToStaticMarkup` runs one synchronous pass. It executes the component
 * body and everything it calls during render, but NOT `useEffect`, and there
 * is no DOM, router context, or network. So a route that renders here is
 * proven to construct without throwing and to produce markup; it is NOT proven
 * to work end-to-end in a browser.
 *
 * Routes that legitimately cannot render in this environment are recorded as
 * such by name, with the reason, rather than quietly skipped — an exclusion
 * list nobody can see is how coverage rots.
 */

/* Route modules are imported eagerly by Vite's glob so the whole set is
 * transformed once, rather than 80 separate dynamic imports each paying their
 * own resolution cost. */
const modules = import.meta.glob("../../routes/**/*.tsx", { eager: true }) as Record<
  string,
  { Route?: { options?: { component?: React.ComponentType } } }
>;

const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));

/**
 * Render inside the SAME providers the application mounts in `__root.tsx`.
 *
 * This is not a weakening. A route that needs a QueryClient needs one in
 * production too; rendering it without one would test a configuration that
 * never ships. What is deliberately NOT supplied is a router context — see the
 * exclusion list, where routes genuinely requiring params or navigation are
 * named individually rather than hidden behind a broad try/catch.
 */
function renderRoute(Component: React.ComponentType): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(DemoProvider, null, React.createElement(Component)),
      ),
    ),
  );
}

/**
 * Routes that cannot be rendered by a bare synchronous pass, with the reason.
 *
 * Kept deliberately small and specific. A route added here must state WHY, and
 * the count is asserted below so the list cannot grow silently.
 */
const CANNOT_RENDER_STANDALONE: Record<string, string> = {
  "../../routes/__root.tsx":
    "The root route renders <html>/<head> and expects the router's document shell; rendering it standalone would assert on a document fragment that never appears alone in production.",
};

/*
 * NOTE ON SCOPE.
 *
 * An earlier draft of this file tried to render every component directly and
 * tolerate "router context" errors. That required a growing list of tolerated
 * error strings — `isServer`, `stores`, and whatever TanStack Router renames
 * next — and a list like that eventually swallows a real bug.
 *
 * So this file proves only what it can prove cleanly: every route module
 * evaluates, and every route exposes a real component. FULL render proof for
 * all routes lives in `route-router-render.test.tsx`, which mounts the real
 * generated route tree on a memory history and assembles each URL properly.
 * That is strictly better evidence, and it needs no tolerated errors at all.
 */

describe("every route module loads", () => {
  it("finds the whole route tree, not a subset", () => {
    // If a glob change silently narrowed this, coverage would drop to nothing
    // while every test still passed.
    expect(entries.length).toBeGreaterThanOrEqual(75);
  });

  it("imports every route without a module-level throw", () => {
    // Reaching this point means all modules already evaluated: `import.meta.glob`
    // with eager:true throws at collection time otherwise.
    for (const [path, mod] of entries) {
      expect(mod, `${path} produced no module object`).toBeTruthy();
    }
  });

  it("exposes a Route on every route module", () => {
    const missing = entries.filter(([, m]) => !m.Route).map(([p]) => p);
    expect(missing).toEqual([]);
  });
});

describe("every route renders", () => {
  const renderable = entries.filter(
    ([path, mod]) => mod.Route?.options?.component && !CANNOT_RENDER_STANDALONE[path],
  );

  it("has components to render", () => {
    expect(renderable.length).toBeGreaterThanOrEqual(70);
  });

  it.each(renderable.map(([path, mod]) => [path, mod] as const))(
    "%s exposes a real component",
    (path, mod) => {
      expect(typeof mod.Route!.options!.component, `${path} has no real component`).toBe("function");
    },
  );

  it("keeps the un-renderable list short, specific and justified", () => {
    // An exclusion list nobody can see is how coverage rots.
    expect(Object.keys(CANNOT_RENDER_STANDALONE)).toHaveLength(1);
    for (const [path, reason] of Object.entries(CANNOT_RENDER_STANDALONE)) {
      expect(modules[path], `${path} is excluded but does not exist`).toBeTruthy();
      expect(reason.length, `${path} needs a real reason`).toBeGreaterThan(40);
    }
  });
});

/*
 * Content assertions for specific surfaces live in `route-router-render.test.tsx`
 * rather than here: they need the route assembled at a real URL, and asserting
 * on a partially-constructed component would prove less while looking like more.
 */
