/**
 * Skill Pack registry and built-in packs.
 *
 * The framework here is universal; the COVERAGE is not, and this module refuses
 * to blur the two. `coverageReport()` names every category OCADE has no pack
 * for, so the product can say "OCADE cannot drive your CAD software yet"
 * instead of implying it can and failing at the first click.
 *
 * A capability is only marked `tested: true` when it is exercised by a real
 * automated test in this repository. The built-in packs below therefore cover
 * exactly the three surfaces OCADE has genuine, tested adapters for — the
 * managed browser host, the companion's file/window commands, and its clipboard
 * and selection commands. Everything else is honestly absent.
 */
import {
  CONTROL_PREFERENCE,
  SKILL_CATEGORIES,
  type SkillCategory,
  type SkillPack,
  type SkillCapability,
} from "./skill-pack";
import { GIT_PACK } from "./packs/git-pack";
import { LOCAL_FILES_PACK } from "./packs/local-files-pack";
import { DATA_PACK } from "./packs/data-pack";
import { INTEGRITY_PACK } from "./packs/integrity-pack";
import { ARCHIVE_PACK } from "./packs/archive-pack";
import { GEO_PACK } from "./packs/geo-pack";
import { MONEY_PACK } from "./packs/money-pack";
import { CALENDAR_PACK } from "./packs/calendar-pack";
import { MEDIA_PACK } from "./packs/media-pack";
import { VIDEO_PACK } from "./packs/video-pack";
import { RECORDS_PACK } from "./packs/records-pack";
import { CLINICAL_PACK } from "./packs/clinical-pack";
import { CAPTIONS_PACK } from "./packs/captions-pack";
import { STREAMING_PACK } from "./packs/streaming-pack";

/* ------------------------------------------------------- built-in packs -- */

/**
 * Web pages, driven through the OCADE-managed Playwright/CDP host.
 *
 * Every capability here is exercised by managed-browser and browser-policy
 * tests, including the refusals.
 */
const WEB_PAGE_PACK: SkillPack = {
  appId: "ocade.web",
  displayName: "Web pages",
  category: "browsers_transfer",
  // Pinned to the managed browser-host protocol, not a browser version.
  testedVersions: ["1."],
  requiresLicensedInstall: false,
  capabilities: [
    {
      id: "tabs.list",
      label: "List open tabs",
      methods: ["adapter"],
      mutating: false,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "page.read",
      label: "Read a page you've allowed",
      // DOM first; the accessibility tree is the fallback for canvas-heavy apps.
      methods: ["dom", "accessibility"],
      mutating: false,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "page.screenshot",
      label: "Capture a page, with credential fields masked",
      methods: ["adapter"],
      mutating: false,
      verifyBy: "api",
      tested: true,
    },
  ],
};

/**
 * Email drafting and authenticated web work.
 *
 * The controlled connector and browser fixtures exercise preview binding,
 * recipient/attachment verification, connector-first routing, protected-field
 * refusal and independent send receipts. No live OAuth provider is bundled.
 */
const EMAIL_WEB_WORK_PACK: SkillPack = {
  appId: "ocade.email-web-work",
  displayName: "Email and authenticated web work",
  category: "chat_projects",
  testedVersions: ["1."],
  requiresLicensedInstall: false,
  coverageNote:
    "The workflow contract is tested with controlled connector and paired-browser hosts. A live mail account still requires an approved OAuth/API connector or a user-authenticated permitted site.",
  capabilities: [
    {
      id: "email.preview",
      label: "Validate recipients, attachments and preview a draft",
      methods: ["official_api", "dom"],
      mutating: false,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "email.send",
      label: "Send a confirmed preview and verify the provider receipt",
      methods: ["official_api", "dom"],
      mutating: true,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "web.edit",
      label: "Edit an authenticated permitted site",
      methods: ["dom", "accessibility"],
      mutating: true,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "web.transfer",
      label: "Upload or download an approved file",
      methods: ["dom"],
      mutating: true,
      verifyBy: "api",
      tested: true,
    },
  ],
};

/**
 * Checkpointed creative execution contract, with Blender as the reference.
 *
 * Deterministic host fixtures prove route ordering, sandbox acknowledgements,
 * project rollback and byte-level render/glTF validation. No installed
 * creative application has run here, so the pack remains deliberately
 * unversioned and carries its runtime boundary in the coverage report.
 */
const CREATIVE_CONTROL_PACK: SkillPack = {
  appId: "ocade.creative.control",
  displayName: "Creative application control",
  category: "graphics_media",
  testedVersions: [],
  requiresLicensedInstall: true,
  coverageNote:
    "The checkpoint, Blender route, sandbox, scene-inspection, render and export contracts are fixture-tested. OCADE cannot claim to drive an installed Blender or other creative application until its signed adapter and a real project pass live validation.",
  capabilities: [
    {
      id: "creative.checkpoint",
      label: "Create and independently verify a versioned project checkpoint",
      methods: ["adapter", "file"],
      mutating: false,
      verifyBy: "file",
      tested: true,
    },
    {
      id: "creative.script",
      label: "Run an approved bounded creative script",
      methods: ["official_api", "adapter", "cli"],
      mutating: true,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "creative.render",
      label: "Render and inspect exact output media bytes",
      methods: ["official_api", "adapter", "cli"],
      mutating: true,
      verifyBy: "file",
      tested: true,
    },
    {
      id: "creative.export",
      label: "Export and validate a conforming glTF deliverable",
      methods: ["official_api", "adapter", "file", "cli"],
      mutating: true,
      verifyBy: "file",
      tested: true,
    },
  ],
};

/**
 * Generic duplicate-first CAD/CAE execution and export contract. Controlled
 * fixtures test its invariants, but no licensed engineering product or real
 * solver has run, so the pack is unversioned and explicitly limited.
 */
const ENGINEERING_CONTROL_PACK: SkillPack = {
  appId: "ocade.engineering.control",
  displayName: "CAD and engineering application control",
  category: "engineering_cad",
  testedVersions: [],
  requiresLicensedInstall: true,
  coverageNote:
    "Duplicate-project routing, engineering-assumption guards, rebuild checks, exchange-file inspection and solver-result boundaries are fixture-tested. OCADE cannot claim to drive a licensed CAD/CAE product or validate an engineering result until a real installed application, model and solver output pass independent checks.",
  capabilities: [
    {
      id: "engineering.duplicate",
      label: "Create and verify a duplicate engineering project",
      methods: ["official_api", "adapter", "file", "cli"],
      mutating: false,
      verifyBy: "file",
      tested: true,
    },
    {
      id: "engineering.model",
      label: "Edit units, dimensions and constraints under exact approval",
      methods: ["official_api", "adapter", "file", "cli"],
      mutating: true,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "engineering.export",
      label: "Export and independently reopen STEP, STL, DXF or DWG",
      methods: ["official_api", "adapter", "file", "cli"],
      mutating: true,
      verifyBy: "file",
      tested: true,
    },
    {
      id: "engineering.solver",
      label: "Run a licensed solver and parse result evidence",
      methods: ["official_api", "adapter", "file", "cli"],
      mutating: true,
      verifyBy: "file",
      tested: true,
    },
  ],
};

/**
 * Files, folders and windows, driven through the signed companion.
 *
 * The COMMANDS are tested end-to-end against a MAC-verifying fake host
 * (`copilot-session-flow.test.ts`). What is not proven here is the companion
 * binary itself, which has never been linked in this environment — so the pack
 * is not version-pinned and resolves as `probed` until a signed build runs.
 */
const DESKTOP_FILES_PACK: SkillPack = {
  appId: "ocade.desktop.files",
  displayName: "Files, folders and windows",
  category: "os_utilities",
  testedVersions: [],
  requiresLicensedInstall: false,
  capabilities: [
    {
      id: "window.list",
      label: "List open windows",
      methods: ["adapter"],
      mutating: false,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "window.arrange",
      label: "Move or resize a window",
      methods: ["adapter"],
      mutating: true,
      verifyBy: "ui",
      tested: true,
    },
    {
      id: "app.open",
      label: "Open an application you've allowed",
      methods: ["adapter"],
      mutating: true,
      verifyBy: "ui",
      tested: true,
    },
    {
      id: "file.open",
      label: "Open a file or folder you've allowed",
      methods: ["file", "adapter"],
      mutating: true,
      verifyBy: "file",
      tested: true,
    },
  ],
};

/** Text and clipboard, driven through the signed companion. */
const DESKTOP_TEXT_PACK: SkillPack = {
  appId: "ocade.desktop.text",
  displayName: "Text and clipboard",
  category: "office_docs",
  testedVersions: [],
  requiresLicensedInstall: false,
  capabilities: [
    {
      id: "selection.read",
      label: "Read what you've selected",
      methods: ["accessibility", "adapter"],
      mutating: false,
      verifyBy: "api",
      tested: true,
    },
    {
      id: "selection.replace",
      label: "Replace what you've selected",
      methods: ["accessibility", "adapter"],
      mutating: true,
      verifyBy: "ui",
      tested: true,
    },
    {
      id: "clipboard.write",
      label: "Put text on the clipboard",
      methods: ["adapter"],
      mutating: true,
      verifyBy: "api",
      tested: true,
    },
  ],
};

export const BUILT_IN_PACKS: SkillPack[] = [
  WEB_PAGE_PACK,
  EMAIL_WEB_WORK_PACK,
  CREATIVE_CONTROL_PACK,
  ENGINEERING_CONTROL_PACK,
  DESKTOP_FILES_PACK,
  DESKTOP_TEXT_PACK,
  // Genuinely executed: `git-pack.test.ts` runs the real binary against a
  // throwaway repository and verifies every result through git itself.
  GIT_PACK,
  // Genuinely executed: `local-files-pack.test.ts` performs real filesystem
  // operations in a throwaway directory, including the symlink-escape case.
  LOCAL_FILES_PACK,
  // Genuinely executed: `data-pack.test.ts` parses real CSV/JSON files from disk
  // and checks every statistic against a hand calculation.
  DATA_PACK,
  // Genuinely executed: `integrity-pack.test.ts` hashes real files with real
  // crypto and compares against independently computed digests.
  INTEGRITY_PACK,
  // Genuinely executed: `archive-pack.test.ts` runs real tar, and builds an
  // actual traversal archive to prove the escape guard holds.
  ARCHIVE_PACK,
  // Genuinely executed: `video-pack.test.ts` generates a real clip with a real
  // encoder, trims, crops and captions it, and DECODES the export frame by
  // frame — because ffmpeg exits 0 on files nothing can play.
  VIDEO_PACK,

  /*
   * FILE-FORMAT PACKS.
   *
   * These extend coverage into categories whose vendor applications are not
   * installed here — and could not be tested if they were claimed. Each works
   * on the category's open interchange format instead, and each carries a
   * `coverageNote` naming the applications it CANNOT drive, so a supported row
   * in the coverage table never reads as "OCADE operates your CAD software".
   */
  // `geo-pack.test.ts` checks geodesic area against an independently derived
  // closed form, so the arithmetic is verified rather than merely consistent.
  GEO_PACK,
  // `money-pack.test.ts` proves exactness on the cases float arithmetic fails.
  MONEY_PACK,
  // `calendar-pack.test.ts` parses real folded, escaped iCalendar text.
  CALENDAR_PACK,
  // `media-pack.test.ts` reads genuine PNG and GIF files byte by byte.
  MEDIA_PACK,
  // `records-pack.test.ts` runs the checks against CSV parsed by the data pack.
  RECORDS_PACK,
  // `clinical-pack.test.ts` assembles real DICOM byte structures, and proves
  // the pack never emits the contents of an identifying field.
  CLINICAL_PACK,
  // `captions-pack.test.ts` parses real WebVTT and SubRip text.
  CAPTIONS_PACK,
  // `streaming-pack.test.ts` parses real HLS playlists.
  STREAMING_PACK,
];

/* ----------------------------------------------------------- registry ---- */

function clonePack(pack: SkillPack): SkillPack {
  return {
    ...pack,
    testedVersions: [...pack.testedVersions],
    capabilities: pack.capabilities.map((capability) => ({
      ...capability,
      methods: [...capability.methods],
    })),
  };
}

function assertPackText(value: unknown, field: string, maxLength = 200): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Invalid skill pack ${field}.`);
  }
}

const SAFE_PACK_ID = /^[a-z0-9][a-z0-9._-]*$/i;

/** Reject malformed or ambiguous metadata before it can become a coverage claim. */
export function assertValidSkillPack(pack: SkillPack): void {
  assertPackText(pack.appId, "appId");
  if (!SAFE_PACK_ID.test(pack.appId)) {
    throw new Error("Invalid skill pack appId.");
  }
  assertPackText(pack.displayName, "displayName");
  if (!SKILL_CATEGORIES.includes(pack.category)) {
    throw new Error(`Invalid skill pack category for ${pack.appId}.`);
  }
  if (typeof pack.requiresLicensedInstall !== "boolean") {
    throw new Error(`Invalid skill pack licensing flag for ${pack.appId}.`);
  }
  if (pack.coverageNote !== undefined) {
    assertPackText(pack.coverageNote, "coverageNote", 1_000);
  }
  if (!Array.isArray(pack.testedVersions)) {
    throw new Error(`Invalid tested versions for ${pack.appId}.`);
  }
  const versions = new Set<string>();
  for (const version of pack.testedVersions) {
    assertPackText(version, "tested version");
    if (versions.has(version)) {
      throw new Error(`Duplicate tested version ${version} in ${pack.appId}.`);
    }
    versions.add(version);
  }
  if (!Array.isArray(pack.capabilities) || pack.capabilities.length === 0) {
    throw new Error(`Skill pack ${pack.appId} must declare at least one capability.`);
  }
  const capabilityIds = new Set<string>();
  for (const capability of pack.capabilities) {
    assertPackText(capability.id, "capability id");
    if (!SAFE_PACK_ID.test(capability.id)) {
      throw new Error(`Invalid capability id in ${pack.appId}.`);
    }
    assertPackText(capability.label, "capability label");
    if (capabilityIds.has(capability.id)) {
      throw new Error(`Duplicate capability ${capability.id} in ${pack.appId}.`);
    }
    capabilityIds.add(capability.id);
    if (!Array.isArray(capability.methods) || capability.methods.length === 0) {
      throw new Error(`Capability ${capability.id} must declare a control method.`);
    }
    const methods = new Set<string>();
    for (const method of capability.methods) {
      if (!CONTROL_PREFERENCE.includes(method)) {
        throw new Error(`Invalid control method in ${pack.appId}:${capability.id}.`);
      }
      if (methods.has(method)) {
        throw new Error(`Duplicate control method in ${pack.appId}:${capability.id}.`);
      }
      methods.add(method);
    }
    if (!["file", "ui", "log", "api", "none"].includes(capability.verifyBy)) {
      throw new Error(`Invalid verification method in ${pack.appId}:${capability.id}.`);
    }
    if (typeof capability.mutating !== "boolean" || typeof capability.tested !== "boolean") {
      throw new Error(`Invalid safety metadata in ${pack.appId}:${capability.id}.`);
    }
    if (capability.tested && capability.verifyBy === "none") {
      throw new Error(`Tested capability ${pack.appId}:${capability.id} must be verifiable.`);
    }
  }
}

export class PackRegistry {
  private packs: SkillPack[];

  constructor(initial: SkillPack[] = BUILT_IN_PACKS) {
    initial.forEach(assertValidSkillPack);
    this.packs = initial.map(clonePack);
  }

  list(): SkillPack[] {
    return this.packs.map(clonePack);
  }

  get(appId: string): SkillPack | null {
    const pack = this.packs.find((p) => p.appId === appId);
    return pack ? clonePack(pack) : null;
  }

  byCategory(category: SkillCategory): SkillPack[] {
    return this.packs.filter((p) => p.category === category).map(clonePack);
  }

  /**
   * Add a pack. Replaces one with the same id rather than shadowing it, so a
   * lookup can never depend on registration order.
   */
  register(pack: SkillPack): void {
    assertValidSkillPack(pack);
    this.packs = [...this.packs.filter((p) => p.appId !== pack.appId), clonePack(pack)];
  }

  /**
   * Take a pack out, for real.
   *
   * WHY REGISTRATION WITHOUT REMOVAL IS NOT ENOUGH. `skill-trust` exists
   * because a community skill drives somebody's computer, and its second rule
   * is that revocation beats a valid signature — a correctly signed skill that
   * has been withdrawn is refused. That refusal happened at ADMISSION and
   * nowhere else: a skill already registered stayed in this list, kept being
   * returned by `list()` and `get()`, and kept being planned against, because
   * nothing here could take it out again. Signing without removal is the
   * weaker half of the same problem the trust module was written to solve.
   *
   * Returns whether anything was actually removed, so a caller can tell
   * "withdrawn" from "was never here" instead of assuming.
   */
  unregister(appId: string): boolean {
    const before = this.packs.length;
    this.packs = this.packs.filter((pack) => pack.appId !== appId);
    return this.packs.length !== before;
  }

  /** Capabilities across all packs that are backed by a real test. */
  testedCapabilities(): { appId: string; capability: SkillCapability }[] {
    return this.packs.flatMap((p) =>
      p.capabilities
        .filter((c) => c.tested)
        .map((c) => ({
          appId: p.appId,
          capability: { ...c, methods: [...c.methods] },
        })),
    );
  }
}

/* ---------------------------------------------------------- coverage ----- */

export interface CategoryCoverage {
  category: SkillCategory;
  label: string;
  packs: number;
  testedCapabilities: number;
  /** True only when at least one pack has at least one tested capability. */
  supported: boolean;
  /**
   * True when EVERY pack in this category works on files rather than driving
   * the category's applications. Reported separately because "OCADE can read a
   * GeoJSON file" and "OCADE can operate your CAD software" are different
   * claims, and only one of them is true.
   */
  formatOnly: boolean;
  /** The limits each pack states about itself, for display verbatim. */
  limits: string[];
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  os_utilities: "System, files and utilities",
  erp_crm_hcm_scm: "Business systems (ERP, CRM, HR, supply chain)",
  office_docs: "Documents, spreadsheets and slides",
  graphics_media: "Graphics, video, audio and 3D",
  dev_tools: "Code, version control, databases and CI/CD",
  engineering_cad: "CAD, simulation, GIS and industrial control",
  chat_projects: "Chat and project tools",
  security_networking: "Security, networking and identity",
  data_bi_ai: "Data, analytics and AI tools",
  browsers_transfer: "Browsers and file transfer",
  finance_commerce: "Accounting, tax, commerce and payments",
  healthcare_imaging: "Healthcare and medical imaging",
  education: "Education tools",
  games_streaming: "Games and streaming",
};

/**
 * Honest coverage across every promised category.
 *
 * Categories with no pack are reported as unsupported rather than omitted —
 * an omission reads as "fine", and the user needs to know before they rely on
 * OCADE for that kind of work.
 */
export function coverageReport(registry: PackRegistry): CategoryCoverage[] {
  return SKILL_CATEGORIES.map((category) => {
    const packs = registry.byCategory(category);
    const testedCapabilities = packs.reduce(
      (n, p) => n + p.capabilities.filter((c) => c.tested).length,
      0,
    );
    const withTests = packs.filter((p) => p.capabilities.some((c) => c.tested));
    return {
      category,
      label: CATEGORY_LABELS[category],
      packs: packs.length,
      testedCapabilities,
      supported: testedCapabilities > 0,
      formatOnly: withTests.length > 0 && withTests.every((p) => p.coverageNote !== undefined),
      limits: packs.map((p) => p.coverageNote).filter((n): n is string => n !== undefined),
    };
  });
}

/**
 * One-line summary for the UI.
 *
 * Never rounds an unsupported category up, and never lets file-format coverage
 * pass as application control — the two are counted separately in the same
 * sentence, because a single "10 of 14" would be read as the stronger claim.
 */
export function describeCoverage(report: CategoryCoverage[]): string {
  const supported = report.filter((r) => r.supported);
  const formatOnly = supported.filter((r) => r.formatOnly).length;
  const full = supported.length - formatOnly;

  const base = `OCADE drives the applications in ${full} of ${report.length} software categories, and works on the file formats of ${formatOnly} more`;
  return formatOnly === 0
    ? `OCADE has tested skill packs for ${full} of ${report.length} software categories. For anything else it will say so and offer to inspect the app first.`
    : `${base} — reading and checking files without operating the software itself. For anything else it will say so and offer to inspect the app first.`;
}

/**
 * What OCADE can honestly say about an app it has no pack for.
 * Never proposes acting blind.
 */
export function describeUnsupported(appName: string): string {
  return `OCADE doesn't have a tested skill pack for ${appName}. With your approval it can inspect the app once — its version, menus and accessibility tree — and save what it learns, so later tasks are fast. It won't act on guesswork before that.`;
}

/**
 * Answer "what do you know about this program?" honestly.
 *
 * A pack whose name merely resembles what the user typed is NOT a claim to
 * drive that program: a file-format pack answers with its own limits attached,
 * so searching for a CAD package never comes back looking like a yes.
 */
export function describeAppLookup(registry: PackRegistry, appName: string): string {
  const needle = appName.trim().toLowerCase();
  if (!needle) return "";

  const pack = registry.list().find((p) => p.displayName.toLowerCase().includes(needle));
  if (!pack) return describeUnsupported(appName);

  if (pack.coverageNote) {
    return `OCADE has a tested pack for ${pack.displayName.toLowerCase()}, which covers files rather than the applications themselves. ${pack.coverageNote}`;
  }
  return `OCADE has a tested skill pack for ${pack.displayName.toLowerCase()}, and can operate it directly.`;
}

/**
 * Unload every pack a revocation covers.
 *
 * The list is the publisher's or the reviewer's answer about which skills must
 * stop being used; this is the part that makes the answer take effect on a
 * machine that already has them. A version-specific revocation only removes
 * the pack when the installed version matches, because a revocation for 1.2 is
 * not a statement about 1.3.
 *
 * Returns what was removed, so the surface can say so rather than going quiet.
 */
export function applyRevocations(
  registry: PackRegistry,
  revocations: readonly { skillId: string; version?: string; reason: string }[],
  installedVersion: (appId: string) => string | undefined = () => undefined,
): { appId: string; reason: string }[] {
  const removed: { appId: string; reason: string }[] = [];
  for (const entry of revocations) {
    if (!registry.get(entry.skillId)) continue;
    if (entry.version !== undefined && installedVersion(entry.skillId) !== entry.version) continue;
    if (registry.unregister(entry.skillId)) {
      removed.push({ appId: entry.skillId, reason: entry.reason });
    }
  }
  return removed;
}
