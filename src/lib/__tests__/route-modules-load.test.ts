import { describe, it, expect } from "vitest";

/**
 * Every route module must LOAD — on the server, in Node.
 *
 * This app is server-rendered, so each route module is imported and executed in
 * Node before any browser sees it. A module-scope `window`, `document` or
 * `localStorage` access, or an import that resolves only in a bundle, throws
 * there and takes the whole page down. Nothing in the suite covered this: the
 * render tests import a handful of panels directly, and the dead-control audit
 * reads route files as TEXT without ever executing them.
 *
 * So a route could be broken in a way that typecheck, lint, the unit suite and
 * the build all pass over, and it would first fail for a real user.
 *
 * `import.meta.glob` is resolved by Vite at transform time, so this enumerates
 * the routes that actually exist rather than a list someone must remember to
 * update.
 */

const routeModules = import.meta.glob("/src/routes/**/*.tsx");

describe("every route module loads in a server environment", () => {
  const paths = Object.keys(routeModules).sort();

  it("finds the route tree", () => {
    // A glob that silently matched nothing would make every test below vacuous.
    expect(paths.length).toBeGreaterThan(50);
  });

  it.each(paths)("%s imports without throwing", async (path) => {
    // No try/catch: a rejection here IS the failure, and its stack names the
    // offending module far better than any message this test could invent.
    const loaded = (await routeModules[path]()) as Record<string, unknown>;
    expect(loaded, `${path} produced no module object`).toBeTruthy();
  });
});

describe("every route file declares a route", () => {
  const paths = Object.keys(routeModules).sort();

  it.each(paths)("%s exports a Route", async (path) => {
    const loaded = (await routeModules[path]()) as { Route?: unknown };
    // TanStack file-based routing requires this export. A file under
    // src/routes without it is unreachable — a broken route by definition.
    expect(loaded.Route, `${path} has no exported Route`).toBeDefined();
  });
});
