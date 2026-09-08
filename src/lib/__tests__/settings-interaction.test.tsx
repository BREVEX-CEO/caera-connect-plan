// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
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
 * PRESS EVERY BUTTON ON THE SETTINGS SURFACE.
 *
 * THE GAP THIS CLOSES. `signed-in-interaction.test.tsx` is the only suite in
 * the project that clicks anything, and it covers fifteen routes — none of
 * them Settings. Settings is not a minor corner: it is thirty-odd sections
 * holding the controls for privacy mode, the local engine, cloud permission,
 * memory, connectors, devices, updates and accessibility. Every one of those
 * panels had exactly the coverage the fifteen audited routes had before they
 * were clicked and turned out to contain eight defects, including a permanently
 * disabled composer and eight cards that did nothing on a phone.
 *
 * Panels are mounted DIRECTLY rather than through `/settings/$section`, for
 * the same reason the signed-in audit mounts route components: the real URL
 * drags in the `_authenticated` layout, its session guard and hardware probes,
 * and standing up a fake session to walk past a security gate is not something
 * a test should teach anyone to do. Each panel is an ordinary component; the
 * synthetic route tree gives it the router context its hooks need.
 *
 * WHAT A PASS PROVES, precisely: the panel mounts signed-out — which is the
 * state the product promises is readable — and every enabled control can be
 * activated without throwing. It does NOT prove the control did the right
 * thing; there is no backend here to check against. It is the crash-and-dead-
 * button floor, and it is the floor Settings has never been held to.
 */

/**
 * Every panel the catch-all route can render, plus the standalone ones.
 *
 * Derived from a glob rather than hand-listed so a new panel is covered the
 * day it lands. Non-panel helpers in the same folder are excluded BY NAME
 * below, because an exclusion list nobody can see is how coverage rots.
 */
const NOT_A_PANEL: Record<string, string> = {
  SettingsGate:
    "Exports the read-only banner and the access hook used by the panels, not a panel itself — it renders nothing on its own.",
  SettingsShell:
    "The navigation chrome around the panels. Exercised by the route tests; mounting it here would audit the sidebar thirty times over.",
  PlanComparison:
    "A pure presentational table, mounted by the /pricing route and by settings/usage; both render it and are audited by their own route tests. Its purchase gate has a test of its own.",
  OfflineSection:
    "A two-line composition of OfflineStoragePanel and EngineImportPanel, both audited here individually.",
  PaymentTestModeBanner:
    "A conditional warning strip, not a panel: with the free launch mode active no checkout is configured, so it correctly renders nothing at all.",
  UpiSetupBanner:
    "A conditional payout-readiness strip, not a panel: it renders nothing until a payout readiness summary exists, which needs live billing configuration.",
  PerformanceFallbackNotice:
    "A conditional notice, not a panel: it renders nothing unless the performance fallback is active, which no headless test environment triggers.",
};

const modules = import.meta.glob("../../components/settings/*.tsx", { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

/** Panel name → component, for every module that exports one. */
const PANELS: [string, React.ComponentType][] = Object.entries(modules)
  .map(([path, mod]): [string, unknown] => {
    const name = path
      .split("/")
      .pop()!
      .replace(/\.tsx$/, "");
    return [name, mod[name]];
  })
  .filter(([name, exported]) => !(name in NOT_A_PANEL) && typeof exported === "function")
  .map(([name, exported]): [string, React.ComponentType] => [name, exported as React.ComponentType])
  .sort((a, b) => a[0].localeCompare(b[0]));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/**
 * Rejections this harness causes, rather than the product.
 *
 * A server function called from a panel reaches for the TanStack Start request
 * context, which only exists inside the server runtime; a Supabase query has no
 * network here. Listed by pattern, and anything NOT matching fails the run —
 * swallowing every rejection would turn this audit into the sort of test that
 * passes regardless, which is precisely what it exists to replace.
 */
const HARNESS_REJECTIONS = [
  /No Start context found in AsyncLocalStorage/i,
  /fetch failed/i,
  /Failed to fetch/i,
  /NetworkError/i,
];
const unexpectedRejections: string[] = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  /*
   * Browser APIs jsdom does not implement, stubbed as ABSENT-BUT-SANE rather
   * than as working features: a panel that needs WebGPU or OPFS should take
   * its "not available" branch here — a real branch worth exercising — rather
   * than be handed a fake that lets it walk into code that cannot work.
   */
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
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:audit";
    URL.revokeObjectURL = () => {};
  }
  if (!window.HTMLAnchorElement.prototype.click) {
    window.HTMLAnchorElement.prototype.click = () => {};
  }

  /*
   * `window.prompt` is the confirmation mechanism for the typed-phrase controls
   * in Memory and Devices, and jsdom throws "Not implemented" for it. Returning
   * null is the REFUSAL path — the user cancelled — so this audit never
   * confirms a destructive action it could not have meant to confirm.
   */
  window.prompt = () => null;
  window.confirm = () => false;
  window.alert = () => {};

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

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  unexpectedRejections.length = 0;
});

async function mount(Component: React.ComponentType) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const leaf = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
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

describe("the settings surface offers panels to audit", () => {
  it("finds them, and enough of them to be meaningful", () => {
    // A glob that silently matched nothing would make every check below vacuous.
    expect(PANELS.length).toBeGreaterThan(15);
  });

  it("keeps the non-panel exclusions specific and justified", () => {
    for (const [name, reason] of Object.entries(NOT_A_PANEL)) {
      expect(
        Object.keys(modules).some((p) => p.endsWith(`/${name}.tsx`)),
        `${name} is excluded but no such module exists — the list is stale`,
      ).toBe(true);
      expect(reason.length, `${name} is excluded without a real reason`).toBeGreaterThan(40);
    }
  });
});

describe("every settings panel mounts in a real DOM", () => {
  it.each(PANELS)(
    "%s mounts without throwing",
    async (name, Component) => {
      await expect(mount(Component)).resolves.toBeUndefined();
      expect(container!.innerHTML.length, `${name} rendered nothing`).toBeGreaterThan(0);
    },
    30_000,
  );
});

describe("every enabled control in settings can be pressed", () => {
  it.each(PANELS)(
    "%s survives pressing everything",
    async (name, Component) => {
      await mount(Component);

      /*
       * Destructive and outbound controls are NAMED, not pressed. This is a
       * crash audit, not a licence to erase someone's memory, revoke their
       * paired devices or start a subscription. The typed-phrase confirmations
       * would refuse anyway — `window.prompt` returns null above — but relying
       * on that would make the audit's safety depend on a stub.
       */
      const skip =
        /delete|remove|erase|wipe|clear|revoke|forget|sign out|log out|pay|subscribe|checkout|purchase|upgrade|cancel plan/i;

      const failures: string[] = [];
      const seen = new Set<Element>();
      // Re-query every round: React replaces nodes on state change, so a list
      // captured once goes stale after the first click that does anything.
      for (let round = 0; round < 80; round += 1) {
        const next = [
          ...container!.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [role='button'], [role='tab'], [role='switch'], [role='radio']",
          ),
        ].find((el) => !seen.has(el));
        if (!next) break;
        seen.add(next);
        const label = (next.getAttribute("aria-label") || next.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 45);
        if (skip.test(label)) continue;
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
      expect(
        unexpectedRejections,
        `${name} left a rejection this harness does not account for`,
      ).toEqual([]);

      /*
       * A PANEL THAT OFFERS NOTHING MUST SAY WHY.
       *
       * Eight panels press zero controls here, and every one of them turned out
       * to be legitimate: Cloud Permission's buttons live inside its
       * `grants.length > 0` branch and this browser has no grants; Telemetry's
       * are disabled until there is something to send; About and Licences is
       * informational. Signed out and empty is a real state, not a bug.
       *
       * But "zero controls" is also exactly what a panel looks like when its
       * controls have silently stopped rendering, and without this the audit
       * would pass identically in both cases — vacuously, on the panel that
       * broke. The product's own no-dead-control policy already says the answer:
       * a control that cannot act must explain itself. So a panel with nothing
       * to press has to be SAYING something instead, and enough of it to be an
       * explanation rather than a heading.
       */
      if (seen.size === 0) {
        const explanation = (container!.textContent ?? "").replace(/\s+/g, " ").trim();
        expect(
          explanation.length,
          `${name} offers no control and no explanation — it renders as a dead panel`,
        ).toBeGreaterThan(80);
      }
    },
    45_000,
  );
});

describe("the audit as a whole is not inert", () => {
  it("presses a meaningful number of controls across the settings surface", async () => {
    /*
     * The per-panel checks all tolerate zero controls, for the good reasons
     * above. Nothing in them would notice if EVERY panel started rendering its
     * empty state — a broken settings gate, say — and the suite would report
     * a clean audit of nothing at all. This is the floor under that.
     */
    let total = 0;
    for (const [, Component] of PANELS) {
      await mount(Component);
      total += container!.querySelectorAll("button:not([disabled]), [role='switch']").length;
      if (root) {
        const r = root;
        act(() => r.unmount());
      }
      container?.remove();
      root = null;
      container = null;
    }
    expect(total, "settings rendered almost no enabled controls at all").toBeGreaterThan(25);
  }, 60_000);
});

/**
 * Console output this audit legitimately causes, classified rather than muted.
 *
 * The shared list in `support/expected-console.ts` says why each message is
 * correct behaviour. Anything NOT on it still reaches the console and fails the
 * assertion below, so a new error cannot hide inside expected noise.
 */
const consoleWatch = watchConsole();
afterAll(() => consoleWatch.restore());

describe("the console during this audit", () => {
  it("carries nothing this harness cannot account for", () => {
    expect(consoleWatch.unexpected.slice(0, 5)).toEqual([]);
  });
});
