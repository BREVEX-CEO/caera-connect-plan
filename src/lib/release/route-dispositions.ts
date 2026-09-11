/**
 * WHERE EVERY ROUTE IN OCADE BELONGS, AND WHAT PLAN.md §4 SAYS ABOUT IT.
 *
 * §4 ends with one line — "Generate a route-disposition ledger" — after a table
 * of canonical routes and a list of migrations. This is that ledger, and it is
 * source rather than a document because a document about routes goes stale the
 * first time somebody adds one.
 *
 * WHAT MAKES A ROUTE LEDGER LIE, AND WHAT STOPS IT HERE:
 *
 *   A route that exists and is not listed. The generator walks
 *   `src/routes` and refuses to run when a module has no entry — so a new
 *   screen cannot be added without somebody deciding where it belongs.
 *
 *   An entry for a route that does not exist. Also refused, in the same pass,
 *   because a ledger full of removed screens is how a migration looks finished
 *   when it is not.
 *
 *   A migration claimed and not made. `MIGRATE` names the route it moves to,
 *   and the generator requires that target to be a real route. A migration
 *   pointing at nothing is the exact failure this ledger exists to surface.
 *
 * THE DISPOSITIONS, AND WHY THESE FIVE:
 *
 *   CANONICAL   §4's table names this route. It is where the thing lives.
 *   SUPPORTING  A real screen §4 does not name, kept because something needs
 *               it — an auth callback, a public legal page, an API handler.
 *   MIGRATE     §4 says its function moves somewhere else. `movesTo` names
 *               where, and the route redirects there rather than 404ing,
 *               because links people already have must keep working.
 *   ABSORB      Its function belongs inside another screen rather than at a
 *               route of its own. Distinguished from MIGRATE because the work
 *               is different: MIGRATE is a redirect, ABSORB is a rewrite.
 *   RETIRE      Nothing should be here. §5's demo removal is the only source
 *               of these, and there are none left.
 */

export type RouteDisposition = "CANONICAL" | "SUPPORTING" | "MIGRATE" | "ABSORB" | "RETIRE";

export interface RouteEntry {
  /** The route module, relative to `src/routes`, without its extension. */
  module: string;
  /** The URL this module serves. */
  path: string;
  disposition: RouteDisposition;
  /** Why it has this disposition, in one sentence, citing PLAN where it does. */
  reason: string;
  /** Required for MIGRATE and ABSORB: the path its function belongs at. */
  movesTo?: string;
}

/** The canonical routes PLAN.md §4 names, exactly as it names them. */
export const CANONICAL_ROUTES: Readonly<Record<string, string>> = {
  Chat: "/ocade",
  Cowork: "/ocade/cowork",
  Code: "/ocade/code",
  Projects: "/ocade/projects",
  Tasks: "/ocade/tasks",
  Artifacts: "/ocade/artifacts",
  Customize: "/ocade/customize",
  Settings: "/settings",
  Organization: "/organization",
  Administration: "/admin",
};

export const ROUTE_DISPOSITIONS: readonly RouteEntry[] = [
  // ------------------------------------------------------------- primary --
  {
    module: "_authenticated/ocade",
    path: "/ocade-shell",
    disposition: "SUPPORTING",
    reason:
      "The layout every OCADE screen renders into. It owns the chrome so no page can forget it; it is not a destination.",
  },
  {
    module: "_authenticated/ocade.index",
    path: "/ocade",
    disposition: "CANONICAL",
    reason: "§4 names /ocade as Chat, the first of the three primary modes.",
  },
  {
    module: "_authenticated/ocade.cowork",
    path: "/ocade/cowork",
    disposition: "CANONICAL",
    reason: "§4 names /ocade/cowork as Cowork, the second primary mode.",
  },
  {
    module: "_authenticated/ocade.code",
    path: "/ocade/code",
    disposition: "CANONICAL",
    reason: "§4 names /ocade/code as Code, the third primary mode.",
  },
  {
    module: "_authenticated/ocade.work",
    path: "/ocade/work",
    disposition: "MIGRATE",
    movesTo: "/ocade/cowork",
    reason: "§4: 'Migrate /ocade/work to Cowork.' Redirected so existing links keep working.",
  },

  // ----------------------------------------------------------- secondary --
  {
    module: "_authenticated/ocade.projects",
    path: "/ocade/projects",
    disposition: "CANONICAL",
    reason: "§4 secondary view.",
  },
  {
    module: "_authenticated/ocade.tasks",
    path: "/ocade/tasks",
    disposition: "CANONICAL",
    reason: "§4 secondary view, and the home of automations, monitors, inbox and schedules.",
  },
  {
    module: "_authenticated/ocade.artifacts",
    path: "/ocade/artifacts",
    disposition: "CANONICAL",
    reason: "§4 secondary view, and the home of studio, templates and generated outputs.",
  },
  {
    module: "_authenticated/ocade.customize",
    path: "/ocade/customize",
    disposition: "CANONICAL",
    reason: "§4 secondary view: what a person tunes about how OCADE works for them.",
  },
  {
    module: "_authenticated/ocade.search",
    path: "/ocade/search",
    disposition: "SUPPORTING",
    reason:
      "§4: 'Search into a global overlay and contextual search.' The overlay is the primary surface and it exists — Cmd/Ctrl+K in `WorkspaceShell`, which wraps every OCADE screen. This page is its deep-linkable form: a result somebody can send to a colleague or return to. It is deliberately NOT in the rail, because a rail entry would be a second, slower way to do what the keystroke already does.",
  },

  // ------------------------------------- absorbed into Tasks (§4 migrate) --
  {
    module: "_authenticated/ocade.automations",
    path: "/ocade/automations",
    disposition: "MIGRATE",
    movesTo: "/ocade/tasks",
    reason: "§4: 'Automations, monitors, inbox, notifications, and schedules into Tasks.'",
  },
  {
    module: "_authenticated/ocade.monitors",
    path: "/ocade/monitors",
    disposition: "MIGRATE",
    movesTo: "/ocade/tasks",
    reason: "§4: monitors into Tasks.",
  },
  {
    module: "_authenticated/ocade.inbox",
    path: "/ocade/inbox",
    disposition: "MIGRATE",
    movesTo: "/ocade/tasks",
    reason: "§4: inbox into Tasks.",
  },
  {
    module: "_authenticated/ocade.notifications",
    path: "/ocade/notifications",
    disposition: "MIGRATE",
    movesTo: "/ocade/tasks",
    reason: "§4: notifications into Tasks. Preferences remain in Settings, which is a choice.",
  },

  // --------------------------------- absorbed into Artifacts (§4 migrate) --
  {
    module: "_authenticated/ocade.studio",
    path: "/ocade/studio",
    disposition: "MIGRATE",
    movesTo: "/ocade/artifacts",
    reason: "§4: 'Studio, templates, generated outputs, and live outputs into Artifacts.'",
  },
  {
    module: "_authenticated/ocade.templates",
    path: "/ocade/templates",
    disposition: "MIGRATE",
    movesTo: "/ocade/artifacts",
    reason: "§4: templates into Artifacts.",
  },
  {
    module: "_authenticated/ocade.shared",
    path: "/ocade/shared",
    disposition: "MIGRATE",
    movesTo: "/ocade/artifacts",
    reason: "§4: live outputs into Artifacts.",
  },

  // ------------------- absorbed into Settings or Customize (§4 migrate) --
  {
    module: "_authenticated/ocade.models",
    path: "/ocade/models",
    disposition: "MIGRATE",
    movesTo: "/settings/$section",
    reason:
      "§4: 'Models, devices, permissions, connectors, health, system, activity, knowledge, and labs into Settings or Customize.' It moves to Settings › Local engine rather than Settings › Data: that section already rendered this page's two panels, from the same modules, while Data is about exporting and deleting what the account holds. An engine is not account data.",
  },
  {
    module: "_authenticated/ocade.devices",
    path: "/ocade/devices",
    disposition: "MIGRATE",
    movesTo: "/settings/devices",
    reason: "§4: devices into Settings.",
  },
  {
    module: "_authenticated/ocade.permissions",
    path: "/ocade/permissions",
    disposition: "MIGRATE",
    movesTo: "/settings/$section",
    reason: "§4: permissions into Settings.",
  },
  {
    module: "_authenticated/ocade.connectors",
    path: "/ocade/connectors",
    disposition: "MIGRATE",
    movesTo: "/settings/$section",
    reason: "§4: connectors into Settings.",
  },
  {
    module: "_authenticated/ocade.health",
    path: "/ocade/health",
    disposition: "MIGRATE",
    movesTo: "/settings/$section",
    reason: "§4: health into Settings.",
  },
  {
    module: "_authenticated/ocade.system",
    path: "/ocade/system",
    disposition: "MIGRATE",
    movesTo: "/ocade/customize",
    reason: "§4: system into Settings or Customize. It is the 'More' surface, so Customize.",
  },
  {
    module: "_authenticated/ocade.activity",
    path: "/ocade/activity",
    disposition: "MIGRATE",
    movesTo: "/settings/activity",
    reason: "§4: activity into Settings.",
  },
  {
    module: "_authenticated/ocade.knowledge",
    path: "/ocade/knowledge",
    disposition: "MIGRATE",
    movesTo: "/ocade/projects",
    reason:
      "§4: knowledge into Settings or Customize. Project files ARE the knowledge a person adds, so it belongs with Projects rather than beside it.",
  },
  {
    module: "_authenticated/ocade.lab",
    path: "/ocade/lab",
    disposition: "MIGRATE",
    movesTo: "/ocade/customize",
    reason:
      "§4: labs into Settings or Customize. It opens from Customize on request rather than loading with it — twelve panels, several probing runtimes on mount, do not belong in the bundle of a screen somebody opened to change a theme.",
  },

  // ------------------------------------------- administration and access --
  {
    module: "_authenticated/organization",
    path: "/organization",
    disposition: "CANONICAL",
    reason:
      "§4 names /organization as Organization, and §F defines what it holds: members, roles, invitations, groups and the danger zone. It is OCADE's own model rather than FICIA's `tenants`, whose roles describe a business rather than who may act in a workspace.",
  },
  {
    module: "invite",
    path: "/invite",
    disposition: "SUPPORTING",
    reason:
      "Where an invitation link lands. Public on purpose: the recipient often has no account yet, and a route behind the guard would bounce them to a sign-in page that had forgotten why they came.",
  },
  {
    module: "_authenticated/admin.index",
    path: "/admin",
    disposition: "CANONICAL",
    reason:
      "§4 names /admin as Administration. Its four screens existed and its entrance did not, so an administrator had to know the full path of each.",
  },
  {
    module: "_authenticated/admin.users",
    path: "/admin/users",
    disposition: "CANONICAL",
    reason: "§4 names /admin as Administration; this is one of its screens.",
  },
  {
    module: "_authenticated/admin.support",
    path: "/admin/support",
    disposition: "CANONICAL",
    reason: "§4 Administration.",
  },
  {
    module: "_authenticated/admin.help",
    path: "/admin/help",
    disposition: "CANONICAL",
    reason:
      "§L's admin publishing workflow and §G's help-content management, over the one article authority.",
  },
  {
    module: "_authenticated/admin.status",
    path: "/admin/status",
    disposition: "CANONICAL",
    reason:
      "§K's administrator incident controls and §G's status/incidents management, against the one incident authority.",
  },
  {
    module: "_authenticated/admin.operations",
    path: "/admin/operations",
    disposition: "CANONICAL",
    reason:
      "§G's usage overview, commercial-usage windows, audit log and notification delivery status, in one place.",
  },
  {
    module: "_authenticated/admin.billing",
    path: "/admin/billing",
    disposition: "CANONICAL",
    reason:
      "§G's billing and seat overview and payment-event state, plus the audited entitlement grants §H requires. Held until Phase 19 gave the deployment one subscription authority to point it at.",
  },
  {
    module: "_authenticated/admin.launch-gate",
    path: "/admin/launch-gate",
    disposition: "CANONICAL",
    reason: "§4 Administration.",
  },
  {
    module: "_authenticated/admin.payments-checklist",
    path: "/admin/payments-checklist",
    disposition: "CANONICAL",
    reason: "§4 Administration.",
  },
  {
    module: "_authenticated/access-denied",
    path: "/access-denied",
    disposition: "SUPPORTING",
    reason: "Where an unauthorised navigation lands. Not a destination anybody chooses.",
  },
  {
    module: "_authenticated/challenge",
    path: "/challenge",
    disposition: "SUPPORTING",
    reason: "The second-factor challenge §B requires. Reached only mid-authentication.",
  },
  {
    module: "_authenticated/onboarding",
    path: "/onboarding",
    disposition: "MIGRATE",
    movesTo: "/ocade",
    reason:
      "The setup wizard is removed. A new account goes to Chat and configures the rest in Settings; this is the forwarding address for links that predate that.",
  },
  {
    module: "_authenticated/home",
    path: "/home",
    disposition: "MIGRATE",
    movesTo: "/ocade",
    reason:
      "Not in §4's table. The signed-in landing place is Chat, and a second one is a second answer to 'where am I'.",
  },
  {
    module: "_authenticated/route",
    path: "/_authenticated",
    disposition: "SUPPORTING",
    reason: "The authentication gate itself, not a screen.",
  },

  // ------------------------------------------------- other CARCC modules --
  {
    module: "_authenticated/ficia",
    path: "/ficia",
    disposition: "MIGRATE",
    movesTo: "/ocade",
    reason:
      "A hidden future product. Preserve old links without presenting an unavailable product.",
  },
  {
    module: "_authenticated/madee",
    path: "/madee",
    disposition: "MIGRATE",
    movesTo: "/ocade",
    reason:
      "A hidden future product. Preserve old links without presenting an unavailable product.",
  },
  {
    module: "_authenticated/cania",
    path: "/cania",
    disposition: "MIGRATE",
    movesTo: "/ocade",
    reason:
      "A hidden future product. Preserve old links without presenting an unavailable product.",
  },

  // ------------------------------------------------------------ settings --
  {
    module: "_authenticated/settings",
    path: "/settings",
    disposition: "CANONICAL",
    reason: "§4 names /settings. This module is the shell the sections render into.",
  },
  {
    module: "_authenticated/settings.index",
    path: "/settings/",
    disposition: "CANONICAL",
    reason: "The settings list, which §4's /settings resolves to.",
  },
  {
    module: "_authenticated/settings.$section",
    path: "/settings/$section",
    disposition: "CANONICAL",
    reason: "Every settings section that does not need a module of its own.",
  },
  ...(
    [
      ["activity", "What this account did, and from where."],
      ["appearance", "Theme, motion and cursor."],
      ["billing", "Plan and invoices."],
      ["browser", "Managed-browser behaviour."],
      ["devices", "Browsers and devices on this account."],
      ["mobile", "The mobile companion."],
      ["data", "Export or delete what the account holds."],
      ["privacy", "Where work lives, failure reporting, and what this browser keeps."],
      ["security", "Sign-in, second factor and sessions."],
      ["skills", "Skills and packs."],
      ["support", "Support cases."],
      ["tasks", "Task defaults."],
      ["usage", "What this account has used."],
      ["voice", "Dictation and speech."],
    ] as const
  ).map(([slug, reason]): RouteEntry => ({
    module: `_authenticated/settings.${slug}`,
    path: `/settings/${slug}`,
    disposition: "CANONICAL",
    reason: `A settings section under §4's /settings. ${reason}`,
  })),
  {
    module: "_authenticated/settings.vault",
    path: "/settings/vault",
    disposition: "MIGRATE",
    movesTo: "/settings/data",
    reason:
      "The browser vault it configured is gone with PLAN.md Phase 2's single persistent authority. The forwarding address stays: this URL is in shipped settings indexes, bookmarks and help articles.",
  },

  // -------------------------------------------------------------- public --
  {
    module: "__root",
    path: "/",
    disposition: "SUPPORTING",
    reason: "The document shell, not a screen.",
  },
  {
    module: "index",
    path: "/",
    disposition: "SUPPORTING",
    reason: "The public landing page. Outside §4, which describes the signed-in product.",
  },
  {
    module: "share.$token",
    path: "/share/$token",
    disposition: "SUPPORTING",
    /*
     * Not "a public page for people who are not in the product yet", which is
     * what every other entry in the block below is. This is §8's share, and its
     * reader is somebody who was SENT a conversation — they may have no account
     * and may never want one. It is listed separately because the reason
     * matters: it is a product capability that happens to render publicly, not
     * marketing.
     */
    reason:
      "PLAN.md §8's conversation share, read by whoever was given the link. Outside §4's table, which describes the signed-in product, because its reader is not signed in.",
  },
  ...(
    [
      ["about", "/about"],
      ["auth", "/auth"],
      ["auth.callback", "/auth/callback"],
      ["auth.verify", "/auth/verify"],
      ["blog", "/blog"],
      ["blog.$slug", "/blog/$slug"],
      ["blog.index", "/blog/"],
      ["careers", "/careers"],
      ["checkout.success", "/checkout/success"],
      ["company", "/company"],
      ["compare", "/compare"],
      ["data-rights", "/data-rights"],
      ["download", "/download"],
      ["faq", "/faq"],
      ["founder.haans-antoni", "/founder/haans-antoni"],
      ["press", "/press"],
      ["pricing", "/pricing"],
      ["privacy", "/privacy"],
      ["products.ocade", "/products/ocade"],
      ["reset-password", "/reset-password"],
      ["search", "/search"],
      ["security", "/security"],
      ["status", "/status"],
      ["support.$slug", "/support/$slug"],
      ["support.index", "/support/"],
      ["team", "/team"],
      ["terms", "/terms"],
      ["[.]lovable.oauth.consent", "/.lovable/oauth/consent"],
    ] as const
  ).map(([module, path]): RouteEntry => ({
    module,
    path,
    disposition: "SUPPORTING",
    reason:
      "A public or authentication route. §4's table describes the signed-in product; these serve people who are not in it yet.",
  })),

  // ----------------------------------------------------------------- api --
  {
    module: "robots[.]txt",
    path: "/robots.txt",
    disposition: "SUPPORTING",
    reason: "What a crawler is allowed to index. Read by machines, not by people.",
  },
  {
    module: "sitemap[.]xml",
    path: "/sitemap.xml",
    disposition: "SUPPORTING",
    reason: "The public routes a crawler should know about.",
  },
  {
    module: "api/public/status",
    path: "/api/public/status",
    disposition: "SUPPORTING",
    reason: "§K's machine-readable status feed. Read by monitors, not by people.",
  },
  {
    module: "api/public/payments/webhook",
    path: "/api/public/payments/webhook",
    disposition: "SUPPORTING",
    reason: "The provider webhook. Authenticated by signature rather than by session.",
  },
  {
    module: "api/ocade.bridge.$",
    path: "/api/ocade/bridge/$",
    disposition: "SUPPORTING",
    reason: "The companion bridge. Machine-to-machine, on this origin.",
  },
];

export function findRouteEntry(module: string): RouteEntry | null {
  return ROUTE_DISPOSITIONS.find((entry) => entry.module === module) ?? null;
}

/**
 * Every problem with the ledger, as a list rather than a throw.
 *
 * `modulesOnDisk` is what the repository actually has; the ledger is what
 * somebody decided. The two disagreeing in EITHER direction is a finding.
 */
export function validateRouteLedger(modulesOnDisk: readonly string[]): string[] {
  const problems: string[] = [];
  const listed = new Set<string>();
  const paths = new Set(ROUTE_DISPOSITIONS.map((entry) => entry.path));

  for (const entry of ROUTE_DISPOSITIONS) {
    if (listed.has(entry.module)) problems.push(`${entry.module}: listed twice`);
    listed.add(entry.module);

    if (entry.reason.trim().length < 12) {
      problems.push(`${entry.module}: reason must say why, in words`);
    }
    if ((entry.disposition === "MIGRATE" || entry.disposition === "ABSORB") && !entry.movesTo) {
      problems.push(`${entry.module}: ${entry.disposition} without a destination`);
    }
    if (entry.movesTo && !paths.has(entry.movesTo)) {
      problems.push(`${entry.module}: moves to ${entry.movesTo}, which is not a route`);
    }
    if (entry.movesTo && entry.disposition !== "MIGRATE" && entry.disposition !== "ABSORB") {
      problems.push(`${entry.module}: ${entry.disposition} should not name a destination`);
    }
  }

  for (const module of modulesOnDisk) {
    if (!listed.has(module)) problems.push(`${module}: on disk with no entry in the ledger`);
  }
  for (const entry of ROUTE_DISPOSITIONS) {
    if (!modulesOnDisk.includes(entry.module)) {
      problems.push(`${entry.module}: in the ledger with no module on disk`);
    }
  }

  return problems;
}

/**
 * The canonical routes §4's table names that nothing serves.
 *
 * SEPARATE FROM `validateRouteLedger` ON PURPOSE. That function answers "is the
 * ledger consistent with the repository", which must always be yes. This one
 * answers "is the product complete against §4", which is allowed to be no while
 * the work is tracked — and the two have different audiences: the first is a
 * defect in the ledger, the second is a defect in the product.
 *
 * This is the check that found `/ocade/cowork`, `/ocade/customize`, `/admin`
 * and `/organization` missing, while the navigation offered none of the first
 * three and two of them were primary modes.
 */
export function unservedCanonicalRoutes(): string[] {
  return Object.entries(CANONICAL_ROUTES)
    .filter(
      ([, path]) =>
        !ROUTE_DISPOSITIONS.some((entry) => entry.path === path || entry.path === `${path}/`),
    )
    .map(([area, path]) => `${area}: §4 names ${path} and nothing serves it`);
}
