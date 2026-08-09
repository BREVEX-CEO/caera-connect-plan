/**
 * Single source of truth for OCADE workspace navigation (Plan §37).
 *
 * One shell, module-aware. Contextual items are derived from the active module
 * so the sidebar changes with context instead of stacking a second sidebar
 * inside the page. Items that are not yet real are marked `planned` and render
 * disabled with a reason — never a dead button.
 */
import {
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  Settings,
  Monitor,
  FolderOpen,
  Workflow,
  Package,
  Radar,
  Boxes,
  FileCode2,
  type LucideIcon,
} from "lucide-react";

export type ModuleId = "ocade" | "ficia" | "madee" | "cania" | "devices" | "settings";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Disabled with a reason when the capability isn't real yet. */
  planned?: boolean;
  reason?: string;
  exact?: boolean;
}

export interface ModuleDef {
  id: ModuleId;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Matched against the pathname to resolve the active module. */
  match: string[];
}

/**
 * The module rail: OCADE, three reserved names, and nothing else.
 *
 * "Home" was removed with the products it existed to introduce. A landing
 * screen offering a choice between four workspaces is navigation; offering a
 * choice between one workspace and three pages that say "not yet" is a step
 * between the user and the product. `/home` still redirects, so no link breaks.
 */
export const MODULES: ModuleDef[] = [
  { id: "ocade", label: "OCADE", to: "/ocade", icon: MessageSquare, match: ["/ocade", "/home"] },
  /*
   * FICIA, MADEE and CANIA are placeholders in this release.
   *
   * They keep a rail entry and a route so existing links resolve and the names
   * stay reserved, and each lands on one honest page. Their sub-pages are gone,
   * so their `match` lists collapse to their own prefix — the old entries
   * claimed /people, /time, /markets and friends, and matching a path that no
   * longer exists would light the rail for a route that 404s.
   */
  { id: "ficia", label: "FICIA", to: "/ficia", icon: Building2, match: ["/ficia"] },
  { id: "madee", label: "MADEE", to: "/madee", icon: Sparkles, match: ["/madee"] },
  { id: "cania", label: "CANIA", to: "/cania", icon: Globe2, match: ["/cania"] },
];

export const UTILITY: ModuleDef[] = [
  {
    id: "devices",
    label: "Devices",
    to: "/settings/devices",
    icon: Monitor,
    match: ["/settings/devices"],
  },
  { id: "settings", label: "Settings", to: "/settings", icon: Settings, match: ["/settings"] },
];

/** Resolve the active module from a pathname. */
export function activeModule(pathname: string): ModuleId {
  if (pathname.startsWith("/settings/devices")) return "devices";
  if (pathname.startsWith("/settings")) return "settings";
  for (const m of MODULES) {
    if (m.match.some((p) => pathname === p || pathname.startsWith(p + "/"))) return m.id;
  }
  // Nothing matched. OCADE is the product, so OCADE is the fallback.
  return "ocade";
}

/**
 * Contextual navigation per module. OCADE's conversation list is injected by
 * the OCADE route itself (it owns that state); these are the static entries.
 */
export const MODULE_CONTEXT: Record<ModuleId, NavItem[]> = {
  /*
   * OCADE's own tools, inside OCADE. None of these is a separate product and
   * none is reachable from the module rail — they are the places a conversation
   * sends you: the projects a chat belongs to, the artifacts it produced, the
   * engines it runs on.
   *
   * Every entry points at a route that exists. Trimming this list without
   * deleting the routes would orphan them, which is worse than a longer
   * sidebar: an unreachable page is a page nobody maintains.
   */
  ocade: [
    { to: "/ocade", label: "Chat", icon: MessageSquare, exact: true },
    { to: "/ocade/projects", label: "Projects", icon: FolderOpen },
    { to: "/ocade/artifacts", label: "Artifacts", icon: Package },
    { to: "/ocade/code", label: "Code", icon: FileCode2 },
    { to: "/ocade/automations", label: "Automations", icon: Workflow },
    { to: "/ocade/monitors", label: "Monitors", icon: Radar },
    { to: "/ocade/models", label: "Local intelligence", icon: Boxes },
    { to: "/ocade/studio", label: "Studio", icon: Boxes },
  ],
  /*
   * No contextual entries for the placeholder products. A sidebar listing
   * "People", "Timesheets" and "New resume" beside a page that says the product
   * is not here yet is five dead buttons and one honest sentence contradicting
   * each other.
   */
  ficia: [],
  madee: [],
  cania: [],
  devices: [{ to: "/settings/devices", label: "Devices", icon: Monitor, exact: true }],
  settings: [
    { to: "/settings", label: "General", icon: Settings, exact: true },
    { to: "/settings/privacy", label: "Privacy", icon: Settings },
    { to: "/settings/vault", label: "Storage", icon: Settings },
    { to: "/settings/activity", label: "Activity", icon: Settings },
    { to: "/settings/appearance", label: "Appearance", icon: Settings },
  ],
};

/**
 * Demo-mode navigation (no real account).
 *
 * One entry, because the demo is one thing: OCADE, running on the visitor's own
 * device for 28 minutes. There was a "Home" entry pointing at a tile grid of
 * Files and Tasks; those were separate top-level products in a product that has
 * exactly one, and `/demo` now goes straight to the chat.
 */
export const DEMO_MODULES: ModuleDef[] = [
  { id: "ocade", label: "OCADE", to: "/demo/ocade", icon: MessageSquare, match: ["/demo"] },
];
