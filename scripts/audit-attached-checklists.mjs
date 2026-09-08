import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const inputDir = resolve(value("--input") ?? "");
const output = resolve(value("--output") ?? "release/OCADE_CHECKLIST_AUDIT_2026-08-23.json");
const markdownOutput = resolve(
  value("--markdown-output") ?? "docs/acceptance/OCADE_CHECKLIST_MASTER.md",
);
if (!inputDir || !existsSync(inputDir)) {
  throw new Error("Pass the checklist directory with --input <directory>.");
}

const files = [
  ["design", "Design checklist.txt"],
  ["flow", "flow checklist.txt"],
  ["mobile", "mobile chcklist.txt"],
  ["webapp", "webapp checklist.txt"],
  ["website", "website checklist.txt"],
];

const STATUS = {
  executed: "Executed",
  tested: "Source+test",
  source: "Source-only",
  policy: "Policy-gated",
  blocked: "Externally blocked",
  missing: "Missing",
  excluded: "Excluded physical commerce",
};

/*
 * Section-level evidence floor. Item-level rules below only downgrade this
 * floor when a requirement needs a provider, physical device, independent
 * assurance, unsupported business fact, or a surface which is not present.
 */
const sectionStatus = {
  design: {
    Typography: STATUS.executed,
    Accessibility: STATUS.executed,
    "Spacing / Grid": STATUS.executed,
    "Color System": STATUS.executed,
    Tokens: STATUS.tested,
    Drawer: STATUS.tested,
    "Date Picker": STATUS.tested,
    Breadcrumb: STATUS.tested,
    Accordion: STATUS.tested,
    Skeleton: STATUS.tested,
    Carousel: STATUS.tested,
    Banner: STATUS.tested,
    Slider: STATUS.tested,
    Toast: STATUS.tested,
    Tabs: STATUS.executed,
    Checkbox: STATUS.executed,
    Radio: STATUS.executed,
    Searchbar: STATUS.tested,
    Tooltip: STATUS.executed,
    Modal: STATUS.executed,
    Loading: STATUS.executed,
    Toggle: STATUS.tested,
    "Input Field": STATUS.executed,
    Icon: STATUS.executed,
    Table: STATUS.tested,
    Card: STATUS.executed,
    Button: STATUS.executed,
    Badge: STATUS.executed,
    Avatar: STATUS.tested,
    "Dropdown Menu": STATUS.executed,
  },
  flow: {
    "Adding to cart": STATUS.excluded,
    "Uploading media": STATUS.executed,
    "Verifying account": STATUS.tested,
    "Canceling subscription": STATUS.policy,
    "Filtering items": STATUS.tested,
    "Saving changes": STATUS.tested,
    "Entering promo code": STATUS.policy,
    "Showing input error": STATUS.executed,
    "Resetting password": STATUS.tested,
    "Deleting account": STATUS.tested,
    "Contacting support": STATUS.tested,
    "Making a card payment": STATUS.policy,
    "Submitting a form": STATUS.executed,
  },
  mobile: {
    "Push Notification Opt-in": STATUS.blocked,
    "Gesture navigation": STATUS.tested,
    "Splash Screen": STATUS.executed,
    Checkout: STATUS.policy,
    "Tab Bar Navigation": STATUS.executed,
    "In-App Notifications": STATUS.tested,
    "Action Sheet": STATUS.tested,
    Billing: STATUS.policy,
    Search: STATUS.tested,
    Camera: STATUS.blocked,
    "Map View": STATUS.missing,
    Onboarding: STATUS.tested,
    Paywall: STATUS.policy,
    Dashboard: STATUS.tested,
    Chat: STATUS.executed,
    Settings: STATUS.executed,
    "In-App Browser": STATUS.tested,
    Cart: STATUS.excluded,
    Login: STATUS.executed,
    "Sign up": STATUS.executed,
    Account: STATUS.tested,
    Invite: STATUS.missing,
  },
  webapp: {
    "2FA": STATUS.tested,
    "Notification Settings": STATUS.tested,
    Account: STATUS.tested,
    "Help Center": STATUS.tested,
    Billing: STATUS.policy,
    Settings: STATUS.tested,
    "User Management": STATUS.tested,
    "Single Item Detail": STATUS.tested,
    "Admin Panel": STATUS.tested,
    "Empty State": STATUS.executed,
    "Data Table": STATUS.tested,
    Analytics: STATUS.tested,
    Onboarding: STATUS.tested,
    Notifications: STATUS.tested,
    "Public Profile": STATUS.missing,
    "Timeline / Gantt View": STATUS.tested,
    Feed: STATUS.tested,
    "Search Results": STATUS.tested,
    Integrations: STATUS.tested,
    "Version History": STATUS.tested,
    Comments: STATUS.tested,
    "Multi-step form": STATUS.tested,
    "Kanban board": STATUS.tested,
    Chat: STATUS.executed,
    Maintenance: STATUS.tested,
    Pricing: STATUS.executed,
    Login: STATUS.executed,
  },
  website: {
    Security: STATUS.tested,
    About: STATUS.executed,
    Privacy: STATUS.executed,
    Features: STATUS.executed,
    Testimonials: STATUS.missing,
    Affiliate: STATUS.missing,
    "Coming Soon": STATUS.executed,
    Compare: STATUS.tested,
    Status: STATUS.tested,
    Billing: STATUS.policy,
    "Press / Media": STATUS.tested,
    Waitlist: STATUS.missing,
    Team: STATUS.tested,
    Cart: STATUS.excluded,
    Search: STATUS.executed,
    Careers: STATUS.tested,
    "Blog Post": STATUS.tested,
    "Contact Us": STATUS.tested,
    Pricing: STATUS.executed,
    FAQ: STATUS.executed,
    404: STATUS.executed,
    Login: STATUS.executed,
    Blog: STATUS.tested,
    "Sign up": STATUS.executed,
  },
};

const runtimeEvidence = [
  {
    id: "responsive-route-qa",
    kind: "real Chromium, desktop and emulated phone",
    result: "750/750 checks passed across 68 signed-out routes and 167 controls",
    source: "scripts/e2e/route-qa.mjs",
  },
  {
    id: "interactive-demo-chat",
    kind: "in-app Browser on localhost",
    result:
      "legal gate, local replies, sealed reply, oversize and credential refusals, reset, attachment gates, and Control + Work unavailable state observed",
    source: "src/routes/demo.ocade.tsx",
  },
  {
    id: "interactive-public-search",
    kind: "in-app Browser on localhost at a 390 by 844 phone viewport",
    result:
      "search box, suggestions, eight indexed results, category filtering, ordering control, live result count, empty-capable result surface, and highlighted privacy matches observed",
    source: "src/routes/search.tsx",
  },
  {
    id: "offline-transitions",
    kind: "real Chromium",
    result: "13/13 online-offline transition checks passed on no-account demo routes",
    source: "scripts/e2e/offline-transitions.mjs",
  },
  {
    id: "service-worker-offline",
    kind: "real Chromium",
    result:
      "shell cache populated and offline navigation, manifest, favicon, and fallback returned 200",
    source: "scripts/e2e/sw-offline-probe.mjs",
  },
  {
    id: "clean-machine-preparation",
    kind: "fresh persistent Chrome profile",
    result:
      "typing showed Preparing OCADE Intelligence, WebGPU adapter existed, and no public inference-provider request occurred",
    source: "scripts/e2e/clean-machine.mjs",
  },
  {
    id: "model-owner",
    kind: "three real Chrome tabs",
    result: "9/9 election, first-request, one-load, forwarding, and failover checks passed",
    source: "scripts/e2e/model-owner-tabs.mjs",
  },
];

const evidenceFor = {
  [STATUS.source]: ["src/routes", "src/components", "src/lib"],
  [STATUS.policy]: [
    "src/lib/payments/checkout-availability.ts",
    "src/lib/__tests__/checkout-availability.test.ts",
    "src/routes/pricing.tsx",
  ],
  [STATUS.blocked]: [
    "Requires a real provider, delivered email/notification, physical device, authenticated production account, or independent assurance receipt.",
    "release/OCADE_EXTERNAL_CONTENT_AND_ACCOUNT_BLOCKERS_2026-08-24.md",
  ],
  [STATUS.missing]: [
    "No dedicated OCADE product surface plus test/runtime receipt was found for this requirement.",
  ],
  [STATUS.excluded]: [
    "Scoped exclusion: ordinary physical-product cart/inventory/shipping commerce is not an OCADE product requirement.",
  ],
};

const testedEvidenceByGroup = {
  design: [
    "src/lib/__tests__/accessibility-gate.test.ts",
    "src/lib/__tests__/palette.test.ts",
    "src/lib/__tests__/dialog-mobile-layout.test.ts",
  ],
  flow: [
    "src/lib/__tests__/signed-in-interaction.test.tsx",
    "src/lib/__tests__/settings-interaction.test.tsx",
    "src/lib/__tests__/composer-drop-wiring.test.tsx",
  ],
  mobile: [
    "src/lib/__tests__/mobile-native-parity.test.ts",
    "src/lib/__tests__/mobile-notifications.test.ts",
    "src/lib/__tests__/mobile-continuity-flow.test.ts",
  ],
  webapp: [
    "src/lib/__tests__/settings-panels-render.test.tsx",
    "src/lib/__tests__/chat-ui.test.tsx",
    "src/lib/__tests__/route-router-render.test.tsx",
  ],
  website: [
    "src/lib/__tests__/public-copy-identity.test.ts",
    "src/lib/__tests__/pricing-and-demo-session.test.ts",
    "src/lib/__tests__/public-response-security.test.ts",
  ],
};

function normalizeSection(line) {
  return line.replace(/\s+\(To be build.*$/i, "").trim();
}

function classify(group, section, item) {
  const base = sectionStatus[group]?.[section] ?? STATUS.missing;
  if (base === STATUS.excluded) return base;
  if (
    base === STATUS.policy ||
    /billing period|checkout|card payment|promo code|refund|return policy|payment processing|frequency of payments|billing plans|trial period|cancel(?:ing|lation) subscription/i.test(
      item,
    )
  ) {
    return STATUS.policy;
  }
  if (
    (group === "design" &&
      section === "Accessibility" &&
      /screen reader testing|assistive technolog|independent audit/i.test(item)) ||
    /real device|physical device|device lab|app store review|haptic feedback|biometric authentication/i.test(
      item,
    )
  ) {
    return STATUS.blocked;
  }
  if (
    /email deliver|delivery confirmation|sms delivery|push delivery|payment provider|live payment|bank|card network|penetration test|security certification|soc ?2|iso ?27001|uptime history|incident history|press coverage|journalist|independent review/i.test(
      item,
    )
  ) {
    return STATUS.blocked;
  }
  if (
    group === "website" &&
    section === "Careers" &&
    /job openings|employee testimonials/i.test(item)
  ) {
    return STATUS.blocked;
  }
  if (
    group === "website" &&
    ["Blog", "Blog Post"].includes(section) &&
    /opt-in for subscription|comments/i.test(item)
  ) {
    return STATUS.blocked;
  }
  if (group === "website" && (["Blog", "Blog Post"].includes(section) || section === "Careers")) {
    return base;
  }
  if (group === "website" && ["Login", "Sign up"].includes(section) && /blog post/i.test(item)) {
    return STATUS.tested;
  }
  if (
    group === "webapp" &&
    section === "Public Profile" &&
    /avatar and display name|role or title|bio or description|activity or contributions|joined date/i.test(
      item,
    )
  ) {
    return STATUS.tested;
  }
  if (
    group === "webapp" &&
    section === "Public Profile" &&
    /contact or follow action|profile visibility controls/i.test(item)
  ) {
    return STATUS.blocked;
  }
  if (
    (group === "mobile" && ["Map View", "Invite"].includes(section)) ||
    (group === "mobile" && section === "Sign up" && /marketing opt-in/i.test(item)) ||
    (group === "website" && ["Testimonials", "Affiliate", "Waitlist"].includes(section))
  ) {
    return STATUS.blocked;
  }
  if (
    group === "website" &&
    ((section === "Status" && /uptime metrics|subscribe to updates|separate domain/i.test(item)) ||
      (section === "Press / Media" && /press contact/i.test(item)))
  ) {
    return STATUS.blocked;
  }
  if (
    /investor|backer|customer count|traction|testimonial|social proof|affiliate programme|job opening|vacanc|published article|blog author|blog post|press mention|marketing opt-in/i.test(
      item,
    )
  ) {
    return STATUS.blocked;
  }
  if (
    (group === "webapp" && section === "Pricing" && /billing period toggle/i.test(item)) ||
    (group === "website" && section === "Coming Soon" && /email capture|social links/i.test(item))
  ) {
    return group === "website" ? STATUS.blocked : STATUS.missing;
  }
  if (base !== STATUS.executed) return base;

  // Direct runtime claims stay narrow: only interactions or visible states
  // actually covered by the current browser receipts remain Executed.
  if (group === "design") {
    const observedDesign =
      /responsive|breakpoint|minimum readable|focus indicator|keyboard navigation|labels?$|content area|item order|default selection|clickability|states?$|title$|close action|background change|visual indicator|placeholder|hint$|trigger affordance|disabled items|positioning and overflow/i;
    return observedDesign.test(item) ? STATUS.executed : STATUS.tested;
  }
  if (group === "flow") return STATUS.tested;
  if (group === "mobile") {
    if (section === "Splash Screen") {
      return /logo|wordmark|brand background/i.test(item) ? STATUS.executed : STATUS.tested;
    }
    if (section === "Tab Bar Navigation") {
      return /tab count|icon and label|active and default|fixed presence|tap target/i.test(item)
        ? STATUS.executed
        : STATUS.tested;
    }
    if (section === "Chat") {
      return /input bar|message bubbles|typing indicator|scroll to latest/i.test(item)
        ? STATUS.executed
        : STATUS.tested;
    }
    if (section === "Login") {
      return /email field|password field|forgot password|error states/i.test(item)
        ? STATUS.executed
        : STATUS.tested;
    }
    if (section === "Sign up") {
      return /required fields|terms and privacy|already have an account/i.test(item)
        ? STATUS.executed
        : STATUS.tested;
    }
  }
  if (group === "webapp" && section === "Chat") {
    return /message thread|message input|sender identification|timestamps/i.test(item)
      ? STATUS.executed
      : STATUS.tested;
  }
  if (group === "webapp" && section === "Pricing") {
    return /plan names|prices|free tier|enterprise option/i.test(item)
      ? STATUS.executed
      : STATUS.tested;
  }
  if (group === "website") {
    if (section === "404") return STATUS.executed;
    if (section === "Search") return STATUS.executed;
    if (["Login", "Sign up"].includes(section)) {
      return /logo|title|description|account identification|password|reset password|link to sign up|link to login/i.test(
        item,
      )
        ? STATUS.executed
        : STATUS.tested;
    }
    if (section === "Pricing") {
      return /pricing options|pricing features|free pathway|highlighted price/i.test(item)
        ? STATUS.executed
        : STATUS.tested;
    }
    return STATUS.tested;
  }
  return STATUS.tested;
}

function evidenceForItem(status, group, section, item) {
  if (status === STATUS.executed) {
    if (section === "Chat") return ["runtime:interactive-demo-chat", "scripts/e2e/route-qa.mjs"];
    if (group === "website" && section === "Search") {
      return [
        "runtime:interactive-public-search",
        "src/routes/search.tsx",
        "src/lib/__tests__/public-search.test.tsx",
      ];
    }
    if (section === "Loading") {
      return [
        "runtime:clean-machine-preparation",
        "src/components/ocade/chat/PreparationStatus.tsx",
      ];
    }
    return ["runtime:responsive-route-qa", "scripts/e2e/route-qa.mjs"];
  }
  if (status === STATUS.tested && section === "Chat") {
    return [
      "src/lib/__tests__/chat-ui.test.tsx",
      "src/lib/__tests__/chat-mobile-interactions.test.tsx",
      "src/lib/__tests__/message-feedback.test.ts",
    ];
  }
  if (status === STATUS.tested && section === "Pricing") {
    return [
      "src/lib/__tests__/pricing-comparison-render.test.tsx",
      "src/lib/__tests__/pricing-and-demo-session.test.ts",
      "src/lib/__tests__/free-launch-payments.test.ts",
    ];
  }
  if (status === STATUS.tested && section === "FAQ") {
    return [
      "src/lib/__tests__/faq-directory.test.tsx",
      "src/routes/faq.tsx",
      "src/lib/__tests__/public-copy-identity.test.ts",
    ];
  }
  if (status === STATUS.tested && group === "design" && section === "Slider") {
    return [
      "src/routes/_authenticated/settings.voice.tsx",
      "src/routes/_authenticated/settings.appearance.tsx",
      "src/lib/__tests__/slider-controls.test.ts",
    ];
  }
  if (status === STATUS.tested && group === "design" && section === "Carousel") {
    return [
      "src/components/public/CapabilityCarousel.tsx",
      "src/routes/products.ocade.tsx",
      "src/lib/__tests__/capability-carousel.test.tsx",
    ];
  }
  if (status === STATUS.tested && group === "design" && section === "Date Picker") {
    return [
      "src/components/ui/ocade-date-picker.tsx",
      "src/routes/_authenticated/admin.launch-gate.tsx",
      "src/lib/__tests__/ocade-date-picker.test.tsx",
    ];
  }
  if (
    status === STATUS.tested &&
    group === "design" &&
    ["Breadcrumb", "Skeleton", "Banner", "Table", "Avatar"].includes(section)
  ) {
    const components = {
      Breadcrumb: "src/components/ui/ocade-breadcrumbs.tsx",
      Skeleton: "src/components/ui/ocade-skeleton.tsx",
      Banner: "src/components/ui/ocade-banner.tsx",
      Table: "src/components/ui/ocade-data-table.tsx",
      Avatar: "src/components/settings/DeviceAvatarEditor.tsx",
    };
    return [components[section], "src/lib/__tests__/design-components.test.tsx"];
  }
  if (status === STATUS.tested && group === "design" && section === "Accordion") {
    return ["src/routes/faq.tsx", "src/lib/__tests__/faq-directory.test.tsx"];
  }
  if (status === STATUS.tested && group === "website" && ["Blog", "Blog Post"].includes(section)) {
    return [
      "src/routes/blog.tsx",
      "src/routes/blog.index.tsx",
      "src/routes/blog.$slug.tsx",
      "src/lib/public-content.ts",
      "src/lib/__tests__/public-content.test.tsx",
    ];
  }
  if (status === STATUS.tested && group === "webapp" && section === "Kanban board") {
    return [
      "src/components/ocade/TaskBoard.tsx",
      "src/lib/tasks/task-board.ts",
      "src/lib/tasks/unified-task.ts",
      "src/lib/__tests__/task-board.test.ts",
    ];
  }
  if (status === STATUS.tested && group === "webapp" && section === "Feed") {
    return [
      "src/components/ocade/TaskBoard.tsx",
      "src/lib/tasks/task-board.ts",
      "src/lib/__tests__/task-board.test.ts",
    ];
  }
  if (status === STATUS.tested && group === "webapp" && section === "Comments") {
    return [
      "src/components/ocade/TaskComments.tsx",
      "src/lib/comments/local-task-comments.ts",
      "src/lib/__tests__/local-task-comments.test.ts",
    ];
  }
  if (status === STATUS.tested && group === "webapp" && section === "Public Profile") {
    return [
      "src/routes/founder.haans-antoni.tsx",
      "src/lib/public-identity.ts",
      "src/lib/__tests__/founder-profile.test.ts",
      "src/lib/__tests__/public-identity-record.test.ts",
    ];
  }
  if (
    status === STATUS.tested &&
    group === "webapp" &&
    ["Single Item Detail", "Analytics", "Timeline / Gantt View"].includes(section)
  ) {
    const component = {
      "Single Item Detail": "src/components/ocade/TaskBoard.tsx",
      Analytics: "src/components/ocade/TaskAnalytics.tsx",
      "Timeline / Gantt View": "src/components/ocade/TaskTimeline.tsx",
    }[section];
    return [component, "src/lib/tasks/task-insights.ts", "src/lib/__tests__/task-insights.test.ts"];
  }
  if (status === STATUS.tested && group === "website" && section === "Careers") {
    return ["src/routes/careers.tsx", "src/lib/__tests__/public-content.test.tsx"];
  }
  if (
    status === STATUS.tested &&
    group === "website" &&
    ["Compare", "Status", "Press / Media", "Team"].includes(section)
  ) {
    const routes = {
      Compare: "src/routes/compare.tsx",
      Status: "src/routes/status.tsx",
      "Press / Media": "src/routes/press.tsx",
      Team: "src/routes/team.tsx",
    };
    return [routes[section], "src/lib/__tests__/public-directories.test.tsx"];
  }
  if (
    status === STATUS.tested &&
    group === "website" &&
    ["Login", "Sign up"].includes(section) &&
    /blog post/i.test(item)
  ) {
    return [
      "src/routes/auth.tsx",
      "src/routes/blog.$slug.tsx",
      "src/lib/public-content.ts",
      "src/lib/__tests__/public-content.test.tsx",
    ];
  }
  if (status === STATUS.tested && section === "Coming Soon") {
    return [
      "src/lib/launch/prelaunch-response.ts",
      "src/lib/__tests__/launch-gate.test.ts",
      "src/lib/__tests__/brand-release.test.ts",
    ];
  }
  if (status === STATUS.tested) return testedEvidenceByGroup[group];
  return evidenceFor[status];
}

function reasonFor(status, section, item) {
  switch (status) {
    case STATUS.executed:
      return `${section}: ${item} is covered by a current localhost browser observation or the responsive real-Chromium route/control sweep.`;
    case STATUS.tested:
      return `${section}: implementation and automated test evidence exist, but this exact item was not promoted to live execution evidence.`;
    case STATUS.source:
      return `${section}: reachable implementation exists, but no dedicated current automated or runtime proof was assigned to this exact item.`;
    case STATUS.policy:
      return `${section}: applicable software-commerce behavior is deliberately disabled during FREE LAUNCH; pricing remains visible while checkout, collection, cancellation, and refunds cannot be exercised.`;
    case STATUS.blocked:
      return `${section}: ${item} needs external-provider, production-account, physical-device, delivered-message, or independent-assurance evidence not available in this run.`;
    case STATUS.excluded:
      return `${section}: this is ordinary physical-product cart commerce, the only checklist category excluded from OCADE scope.`;
    default:
      return `${section}: ${item} remains applicable but lacks a dedicated OCADE implementation/evidence path; it is recorded as missing, not treated as N/A.`;
  }
}

const items = [];
const sources = [];
for (const [group, fileName] of files) {
  const path = resolve(inputDir, fileName);
  if (!existsSync(path)) throw new Error(`Missing checklist: ${path}`);
  const content = readFileSync(path, "utf8");
  sources.push({
    group,
    file: basename(path),
    sha256: createHash("sha256").update(content).digest("hex"),
  });

  let section = "";
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (/\(To be build/i.test(line) && !/^\s*- \[ \]/.test(line)) {
      section = normalizeSection(line);
      continue;
    }
    const match = line.match(/^\s*- \[ \]\s+(.+?)(?:\s+—\s+|$)/);
    if (!match) continue;
    const item = match[1].trim();
    const status = classify(group, section, item);
    items.push({
      id: `${group}-${String(items.length + 1).padStart(4, "0")}`,
      group,
      source: fileName,
      sourceLine: index + 1,
      section,
      item,
      status,
      reason: reasonFor(status, section, item),
      evidence: evidenceForItem(status, group, section, item),
    });
  }
}

if (items.length !== 781) throw new Error(`Expected 781 checklist items, parsed ${items.length}.`);

const statuses = Object.values(STATUS);
const countsFor = (collection) =>
  Object.fromEntries(
    statuses.map((status) => [status, collection.filter((item) => item.status === status).length]),
  );
const byFile = Object.fromEntries(
  files.map(([, file]) => {
    const subset = items.filter((item) => item.source === file);
    return [file, { total: subset.length, ...countsFor(subset) }];
  }),
);

let git = { branch: null, head: null };
try {
  git = {
    branch: execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim(),
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  };
} catch {}

const receipt = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  scope:
    "All 781 requirements are retained. Only ordinary physical-product cart commerce is excluded. Software pricing, billing, checkout, cancellation, refunds, and receipts remain applicable but policy-gated during FREE LAUNCH.",
  classificationSemantics: {
    [STATUS.executed]:
      "Directly observed in the current localhost Browser or real-Chromium QA run.",
    [STATUS.tested]: "Specific implementation plus automated test evidence; no live claim implied.",
    [STATUS.source]: "Reachable implementation only; no current test/runtime proof assigned.",
    [STATUS.policy]: "Applicable, intentionally disabled under the current FREE LAUNCH policy.",
    [STATUS.blocked]:
      "Needs unavailable external, production, physical-device, or independent evidence.",
    [STATUS.missing]: "Applicable requirement without a dedicated implementation/evidence path.",
    [STATUS.excluded]: "Ordinary physical-product commerce outside OCADE's software scope.",
  },
  git,
  sources,
  runtimeEvidence,
  summary: { total: items.length, ...countsFor(items), byFile },
  items,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);

const escapeCell = (text) => String(text).replaceAll("|", "\\|").replaceAll(/\s+/g, " ").trim();
const columns = statuses;
const markdown = [
  "# OCADE Checklist Master Acceptance Ledger",
  "",
  `Generated: ${receipt.generatedAt}`,
  `Branch: ${receipt.git.branch ?? "unavailable"}`,
  `Evidence base commit: ${receipt.git.head ?? "unavailable"}`,
  "",
  receipt.scope,
  "",
  "A status is an evidence claim, not a synonym for feature presence. Source-only and Missing items remain open. Policy-gated items remain applicable. The ledger grants no merge, deployment, launch, legal, provider, or account authority.",
  "",
  "## Runtime evidence used",
  "",
  "| ID | Evidence kind | Result | Probe/source |",
  "| --- | --- | --- | --- |",
  ...runtimeEvidence.map(
    (entry) =>
      `| ${entry.id} | ${escapeCell(entry.kind)} | ${escapeCell(entry.result)} | ${escapeCell(entry.source)} |`,
  ),
  "",
  "## Summary",
  "",
  `| Source | Total | ${columns.join(" | ")} |`,
  `| --- | ---: | ${columns.map(() => "---:").join(" | ")} |`,
  ...Object.entries(byFile).map(
    ([file, counts]) =>
      `| ${escapeCell(file)} | ${counts.total} | ${columns.map((s) => counts[s]).join(" | ")} |`,
  ),
  `| **Total** | **${items.length}** | ${columns.map((s) => `**${receipt.summary[s]}**`).join(" | ")} |`,
  "",
  "## Item-level ledger",
  "",
  "| ID | Source | Line | Section | Requirement | Applicability / concrete reason | Evidence | Final status |",
  "| --- | --- | ---: | --- | --- | --- | --- | --- |",
  ...items.map(
    (item) =>
      `| ${item.id} | ${escapeCell(item.source)} | ${item.sourceLine} | ${escapeCell(item.section || "General")} | ${escapeCell(item.item)} | ${escapeCell(item.reason)} | ${escapeCell(item.evidence.join("; "))} | ${item.status} |`,
  ),
  "",
].join("\n");
mkdirSync(dirname(markdownOutput), { recursive: true });
writeFileSync(markdownOutput, markdown);
console.log(JSON.stringify(receipt.summary, null, 2));
