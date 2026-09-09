import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

/**
 * Mount one component inside a real router.
 *
 * WHY IT IS NEEDED AT ALL. Anything that renders a `<Link>` reads router
 * context on its first render, and without a provider React throws
 * "Cannot read properties of null (reading 'isServer')" — which says nothing
 * about the component under test. Stubbing `Link` instead would be worse: the
 * destination would stop being checked, and a link to a route that no longer
 * exists is exactly the dead control the audit gates look for.
 *
 * DELIBERATELY SMALL. This is for component tests: one route, one memory
 * history entry, no query client and no theme. It is async only because the
 * router must resolve its first match before it renders anything. A test that needs those has
 * outgrown this helper and should build what it needs where the reader can see
 * it — `settings-interaction.test.tsx` is the example.
 */
export async function renderWithRouter(element: ReactElement): Promise<RenderResult> {
  /*
   * jsdom has no `scrollTo`, and the router calls it when it settles a match.
   * Left alone it prints "Not implemented: Window's scrollTo()" to stderr on
   * every mount, which is exactly the kind of expected noise that hides a real
   * message. A no-op is honest here: scrolling is not what these tests measure,
   * and the same stub is used by the interaction audits.
   */
  window.scrollTo = () => {};

  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const leaf = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => element,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  /*
   * LOADED BEFORE IT IS RENDERED. `RouterProvider` renders nothing at all
   * until the router has resolved its first match, so without this the test
   * body sees an empty container and every query fails with a message about
   * the element rather than about the router.
   */
  await router.load();
  return render(<RouterProvider router={router as never} />);
}
