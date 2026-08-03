/**
 * Single source of truth for OCADE workspace navigation (Plan §37).
 *
 * One shell, module-aware. Contextual items are derived from the active module
 * so the sidebar changes with context instead of stacking a second sidebar
 * inside the page. Items that are not yet real are marked `planned` and render
 * disabled with a reason — never a dead button.
 */
import {
  Home,
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  Settings,
  Monitor,
  FolderOpen,
  FileOutput,
  CalendarClock,
  Workflow,
  Package,
  Radar,
  Boxes,
  ListChecks,
  FileCode2,
  BriefcaseBusiness,
  type LucideIcon,
} from "lucide-react";

export type ModuleId = "home" | "ocade" | "ficia" | "madee" | "cania" | "devices" | "settings";

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

export const MODULES: ModuleDef[] = [
  { id: "home", label: "Home", to: "/home", icon: Home, match: ["/home"] },
  { id: "ocade", label: "OCADE", to: "/ocade", icon: MessageSquare, match: ["/ocade"] },
  {
    id: "ficia",
    label: "FICIA",
    to: "/ficia",
    icon: Building2,
    match: ["/ficia", "/people", "/roles", "/messenger", "/time"],
  },
  { id: "madee", label: "MADEE", to: "/madee", icon: Sparkles, match: ["/madee"] },
  {
    id: "cania",
    label: "CANIA",
    to: "/cania",
    icon: Globe2,
    match: ["/cania", "/world", "/business", "/markets"],
  },
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
  return "home";
}

/**
 * Contextual navigation per module. OCADE's conversation list is injected by
 * the OCADE route itself (it owns that state); these are the static entries.
 */
export const MODULE_CONTEXT: Record<ModuleId, NavItem[]> = {
  home: [],
  /*
   * One entry per destination.
   *
   * "Outputs" and "Scheduled" used to sit here as separate items pointing at
   * /ocade/projects and /ocade/automations — the same URLs as the entries
   * beside them. Clicking "Outputs" landed on the projects list, not on
   * outputs, which is a dead control wearing a different label. Outputs live
   * inside a selected project and scheduled runs inside Automations, so they
   * are reached there rather than advertised as places of their own.
   */
  ocade: [
    { to: "/ocade", label: "Chat", icon: MessageSquare, exact: true },
    { to: "/ocade/work", label: "Work", icon: BriefcaseBusiness },
    { to: "/ocade/code", label: "Code", icon: FileCode2 },
    { to: "/ocade/projects", label: "Projects", icon: FolderOpen },
    { to: "/ocade/artifacts", label: "Artifacts", icon: Package },
    { to: "/ocade/monitors", label: "Monitors", icon: Radar },
    { to: "/ocade/automations", label: "Automations", icon: Workflow },
    { to: "/ocade/studio", label: "Studio", icon: Boxes },
  ],
  ficia: [
    { to: "/ficia", label: "Companies", icon: Building2, exact: true },
    { to: "/people", label: "People", icon: ListChecks },
    { to: "/roles", label: "Roles", icon: ListChecks },
    { to: "/messenger", label: "Messenger", icon: MessageSquare },
    { to: "/time", label: "Timesheets", icon: CalendarClock },
  ],
  madee: [
    { to: "/madee", label: "Resumes", icon: Sparkles, exact: true },
    { to: "/madee/new", label: "New resume", icon: FileOutput },
  ],
  cania: [{ to: "/cania", label: "Overview", icon: Globe2, exact: true }],
  devices: [{ to: "/settings/devices", label: "Devices", icon: Monitor, exact: true }],
  settings: [
    { to: "/settings", label: "General", icon: Settings, exact: true },
    { to: "/settings/privacy", label: "Privacy", icon: Settings },
    { to: "/settings/vault", label: "Storage", icon: Settings },
    { to: "/settings/activity", label: "Activity", icon: Settings },
    { to: "/settings/appearance", label: "Appearance", icon: Settings },
  ],
};

/** Demo-mode navigation (no real account). */
export const DEMO_MODULES: ModuleDef[] = [
  { id: "home", label: "Home", to: "/demo", icon: Home, match: ["/demo"] },
  { id: "ocade", label: "OCADE", to: "/demo/ocade", icon: MessageSquare, match: ["/demo/ocade"] },
  { id: "ficia", label: "FICIA", to: "/demo/ficia", icon: Building2, match: ["/demo/ficia"] },
  { id: "madee", label: "MADEE", to: "/demo/madee", icon: Sparkles, match: ["/demo/madee"] },
  { id: "cania", label: "CANIA", to: "/demo/cania", icon: Globe2, match: ["/demo/cania"] },
];
