// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { watchConsole } from "./support/expected-console";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/lib/theme-provider";

/**
 * PRESS EVERY BUTTON ON THE SIGNED-IN HALF OF THE PRODUCT.
 *
 * WHY THIS FILE EXISTS. An audit of the twenty routes reachable without an
 * account found eight defects that 5,184 passing tests did not: a `<Toaster />`
 * mounted where it never hydrates, so 228 toast call sites were silently
 * dropped; a router with no engine fallback, so the composer was permanently
 * disabled; `Buffer` at module scope, which can only fail in a browser; eight
 * landing cards that did nothing at all on a phone; and a "Sealed" button over
 * a page whose network primitives were every one of them still native.
 *
 * All eight were found by CLICKING, and none of them could have been found by
 * the existing suite, which renders routes to a string and reads the markup.
 * The sixteen routes behind sign-in had never been clicked, and they share most
 * of their code with the ones that turned out to be broken.
 *
 * WHY IT MOUNTS THE ROUTE COMPONENT RATHER THAN THE URL.
 *
 * Going through the real URL drags in the whole `_authenticated` layout: the
 * session guard, device registration, and installation-status observer. Worse,
 * it would need the auth
 * guard satisfied, and standing up a fake session to walk past a security gate
 * is not something a test should teach anyone to do.
 *
 * Each route's `component` is an ordinary React component. Mounting it on a
 * synthetic two-route tree gives it the router context its hooks need, in a
 * real DOM, with no guard, no session and no pretend credentials anywhere.
 *
 * WHAT A PASS PROVES, precisely: the component mounts, and every enabled
 * control can be activated without throwing. It does NOT prove the control did
 * the right thing — there is no backend here to check against. It is the
 * crash-and-dead-button floor, which is the floor the reachable half failed.
 */

/**
 * Routes with no component of their own, and why.
 *
 * Named rather than quietly dropped: an exclusion list nobody can see is how
 * coverage rots. This mirrors `CANNOT_RENDER_STANDALONE` in
 * `route-execution.test.tsx`.
 */
const NO_COMPONENT: Record<string, string> = {
  "_authenticated/home.tsx":
    "/home is a redirect to /ocade and deliberately has no component — it exists so old links and the end of onboarding still land somewhere.",
  "_authenticated/ocade.work.tsx":
    "PLAN.md §4 migrated Cowork to /ocade/cowork; this is the forwarding address, so it redirects in beforeLoad and never renders. A component here would be a frame of the old screen appearing and vanishing.",
  "_authenticated/ocade.system.tsx":
    "PLAN.md §4 migrated the More directory to /ocade/customize; this redirects there in beforeLoad for everybody whose browser or history still holds the old URL.",
  "_authenticated/cania.tsx":
    "CANIA is hidden from OCADE. Its historical deep link redirects before rendering an unavailable product.",
  "_authenticated/ficia.tsx":
    "FICIA is hidden from OCADE. Its historical deep link redirects before rendering an unavailable product.",
  "_authenticated/madee.tsx":
    "MADEE is hidden from OCADE. Its historical deep link redirects before rendering an unavailable product.",
};

/** Routes that require an account, and therefore had no interaction coverage. */
const SIGNED_IN_ROUTES = [
  "_authenticated/ocade.index.tsx",
  "_authenticated/ocade.cowork.tsx",
  "_authenticated/ocade.customize.tsx",
  "_authenticated/ocade.artifacts.tsx",
  "_authenticated/ocade.automations.tsx",
  "_authenticated/ocade.code.tsx",
  "_authenticated/ocade.models.tsx",
  "_authenticated/ocade.monitors.tsx",
  "_authenticated/ocade.projects.tsx",
  "_authenticated/ocade.studio.tsx",
  "_authenticated/onboarding.tsx",
  "_authenticated/access-denied.tsx",
  "_authenticated/admin.launch-gate.tsx",
  "_authenticated/admin.payments-checklist.tsx",
];

const modules = import.meta.glob("../../routes/_authenticated/**/*.tsx", { eager: true }) as Record<
  string,
  { Route?: { options?: { component?: React.ComponentType } } }
>;

function componentFor(name: string): React.ComponentType | undefined {
  const key = Object.keys(modules).find((k) => k.endsWith(`/routes/${name}`));
  return key ? modules[key].Route?.options?.component : undefined;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/**
 * Rejections this harness causes, rather than the product.
 *
 * A server function called from a component reaches for the TanStack Start
 * request context, which only exists inside the server runtime. Mounting a
 * component on its own therefore rejects — in the real app the same call is
 * fine. Listed by pattern, and anything NOT matching fails the run: swallowing
 * every rejection would turn this audit into the sort of test that passes
 * regardless, which is precisely what it was written to replace.
 */
const HARNESS_REJECTIONS = [/No Start context found in AsyncLocalStorage/i];
const unexpectedRejections: string[] = [];

let consoleWatch: ReturnType<typeof watchConsole>;

beforeAll(() => {
  /*
   * Every console error is classified rather than printed. A run whose output
   * is full of expected noise is a run in which a NEW error goes unread.
   */
  consoleWatch = watchConsole();

  /*
   * React only applies `act()` semantics when this is set. Without it, effects
   * are not flushed the way the assertions assume — the audit would report a
   * clean route because it never saw the route finish rendering.
   */
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  /*
   * Browser APIs jsdom does not implement. Each is stubbed as ABSENT-BUT-SANE
   * rather than as a working feature: a route that needs WebGPU should take its
   * "not available" branch here — a real branch worth exercising — rather than
   * be handed a fake that lets it walk into code that cannot work.
   */
  /*
   * CANVAS: ABSENT, AND HONESTLY SO.
   *
   * jsdom has no canvas implementation and shouts about it on every call —
   * a hundred and fifty lines of output in this file alone, which is exactly
   * how a real error goes unread.
   *
   * `null` is not a workaround: it is what a REAL browser returns when the
   * requested context type is unsupported, and every component that draws must
   * already handle it. Stubbing a fake 2D context instead would hand these
   * routes a canvas that silently records nothing, letting them walk into
   * drawing code that cannot work — the opposite of what this audit is for.
   */
  const canvas = window.HTMLCanvasElement.prototype as unknown as {
    getContext: () => null;
  };
  canvas.getContext = () => null;

  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  for (const [name, impl] of [
    [
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    ],
    [
      "IntersectionObserver",
      class {
        root = null;
        rootMargin = "";
        thresholds = [];
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    ],
  ] as const) {
    if (!(name in window)) {
      (window as unknown as Record<string, unknown>)[name] = impl;
    }
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  // Typed-confirmation controls use the native prompt in a real browser. A
  // cancelled prompt is the honest jsdom branch and avoids jsdom's noisy
  // "not implemented" pseudo-call, which otherwise returns undefined.
  window.prompt = () => null;

  /*
   * jsdom implements neither of these, and an export button that calls
   * `URL.createObjectURL` would throw for a reason that has nothing to do with
   * the product. Stubbed as working, unlike the capability probes above,
   * because there is no "download unavailable" branch for a route to take —
   * the alternative is not testing export controls at all.
   */
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:audit";
    URL.revokeObjectURL = () => {};
  }
  if (!window.HTMLAnchorElement.prototype.click) {
    window.HTMLAnchorElement.prototype.click = () => {};
  }
  process.on("unhandledRejection", (reason) => {
    const text = reason instanceof Error ? reason.message : String(reason);
    if (!HARNESS_REJECTIONS.some((p) => p.test(text))) unexpectedRejections.push(text);
  });

  if (!window.crypto?.randomUUID) {
    Object.defineProperty(window.crypto ?? {}, "randomUUID", {
      value: () => "00000000-0000-4000-8000-000000000000",
      configurable: true,
    });
  }
});

afterAll(() => {
  consoleWatch.restore();
});

describe("the console during this audit", () => {
  it("carries nothing this harness cannot account for", () => {
    /*
     * The point of collecting them: an unexplained console error during a
     * click-through is a defect that has not been noticed yet. Expected ones
     * are named above with the reason they are correct; everything else fails
     * here rather than scrolling past in the output.
     */
    expect(consoleWatch.unexpected.slice(0, 5)).toEqual([]);
  });
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

async function mount(Component: React.ComponentType) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const leaf = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    // The router types `component` as its own function-component alias; every
    // route in this project supplies exactly that, and the cast is only needed
    // because the glob above widens it to `ComponentType`.
    component: Component as Parameters<typeof createRoute>[0]["component"],
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  /*
   * SETTLE ACROSS A DYNAMIC IMPORT, NOT JUST ONE TICK.
   *
   * `useSession` loads the Supabase client on demand — a top-level import put
   * 203 KiB of auth stack on the landing page's first paint — so "am I signed
   * in?" now resolves an import before it can answer, and the first render is
   * legitimately a loading state. One macrotask was enough when the answer was
   * synchronous; it is not enough to resolve a module.
   *
   * Several short turns rather than one long wait: the loop finishes as soon as
   * the work does, and a page that never settles still fails rather than
   * hanging the run.
   */
  for (let turn = 0; turn < 6; turn += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe("every signed-in route exposes a component to audit", () => {
  it.each(SIGNED_IN_ROUTES)("%s has one", (name) => {
    expect(typeof componentFor(name), `${name} exposes no component`).toBe("function");
  });

  it("keeps the component-less list short, specific and justified", () => {
    expect(Object.keys(NO_COMPONENT)).toHaveLength(6);
    for (const [name, reason] of Object.entries(NO_COMPONENT)) {
      expect(componentFor(name), `${name} is excluded but now HAS a component`).toBeUndefined();
      expect(reason.length, `${name} is excluded without a reason`).toBeGreaterThan(40);
    }
  });
});

/**
 * Fill text inputs before pressing anything.
 *
 * A form's primary control is usually disabled until its required field has a
 * value — onboarding's "Continue" is, correctly, and step one has no other
 * enabled button. Auditing without typing means auditing a screen with nothing
 * to press and calling it covered.
 */
async function fillTextInputs() {
  const setValue = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  const inputs = [
    ...container!.querySelectorAll<HTMLInputElement>(
      "input:not([disabled]):not([type=checkbox]):not([type=radio]):not([type=file])",
    ),
  ];
  for (const input of inputs) {
    if (input.value) continue;
    await act(async () => {
      // React tracks the previous value on the node; setting `.value` directly
      // makes its change detection skip the update. The prototype setter is how
      // the event gets through.
      setValue.call(input, input.type === "email" ? "audit@example.test" : "Audit Tester");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  return inputs.length;
}

describe("the signed-in half mounts in a real DOM", () => {
  it.each(SIGNED_IN_ROUTES)(
    "%s mounts without throwing",
    async (name) => {
      const Component = componentFor(name)!;
      await expect(mount(Component)).resolves.toBeUndefined();
      expect(container!.innerHTML.length, `${name} rendered nothing`).toBeGreaterThan(0);
    },
    30_000,
  );
});

describe("every enabled control on a signed-in route can be pressed", () => {
  it.each(SIGNED_IN_ROUTES)(
    "%s survives pressing everything",
    async (name) => {
      await mount(componentFor(name)!);
      await fillTextInputs();

      // Destructive and outbound controls are named, not pressed. This is a
      // crash audit, not a licence to delete or send anything.
      const skip = /delete|remove|erase|wipe|sign out|log out|pay|subscribe|checkout|purchase/i;

      const failures: string[] = [];
      const seen = new Set<Element>();
      // Re-query every round: React replaces nodes on state change, so a list
      // captured once goes stale after the first click that does anything, and
      // every later click lands on a detached node. That flaw made an earlier
      // pass of this audit report eleven working controls as dead.
      for (let round = 0; round < 80; round += 1) {
        const next = [
          ...container!.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [role='button'], [role='tab'], [role='switch'], a[href]",
          ),
        ].find((el) => !seen.has(el));
        if (!next) break;
        seen.add(next);
        const label = (next.getAttribute("aria-label") || next.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 45);
        if (skip.test(label)) continue;

        /*
         * A link IS a control — /ocade/studio is built entirely from them, and
         * auditing only <button> reported that whole route as having nothing to
         * press at all.
         *
         * A link is verified by its HREF rather than by clicking it. Clicking
         * one navigates the memory router away from the route under audit, the
         * component unmounts, and every control after it goes unexamined: an
         * earlier revision of this block clicked links and cut /ocade/studio
         * from eleven controls to one. What makes a link right or wrong is
         * where it points, and that is checked here.
         */
        if (next instanceof HTMLAnchorElement) {
          const href = next.getAttribute("href") ?? "";
          /*
           * A fragment is a real destination. "Skip to content" points at
           * `#main-content`, which is the accessibility affordance that lets a
           * keyboard user past the navigation — an earlier version of this rule
           * counted it as a link that goes nowhere and failed six routes for
           * having one.
           */
          const goesSomewhere =
            href.startsWith("/") ||
            /^(https?:|mailto:|tel:)/i.test(href) ||
            (href.startsWith("#") && href.length > 1);
          if (!goesSomewhere) {
            failures.push(
              `${label || "(unlabelled link)"}: href goes nowhere (${JSON.stringify(href)})`,
            );
          }
          continue;
        }
        try {
          await act(async () => {
            next.click();
            await new Promise((r) => setTimeout(r, 0));
          });
        } catch (error) {
          failures.push(`${label || "(unlabelled)"}: ${(error as Error).message}`);
        }
      }

      if (process.env.OCADE_AUDIT_VERBOSE) {
        console.log(`AUDIT ${name}: pressed ${seen.size}, failures ${failures.length}`);
      }
      expect(failures, `${name} threw while pressing controls`).toEqual([]);
      expect(seen.size, `${name} exposed no controls to press`).toBeGreaterThan(0);
      expect(
        unexpectedRejections,
        `${name} left a rejection this harness does not account for`,
      ).toEqual([]);
    },
    45_000,
  );
});
