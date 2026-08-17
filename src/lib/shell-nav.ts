/** Single source of truth for workspace navigation. */
import {
  MessageSquare,
  Building2,
  Sparkles,
  Globe2,
  Settings,
  Monitor,
  MonitorCog,
  FolderOpen,
  Workflow,
  Package,
  Radar,
  Boxes,
  FileCode2,
  ListChecks,
  Activity,
  Inbox,
  Search,
  Cable,
  ShieldCheck,
  FlaskConical,
  Palette,
  type LucideIcon,
} from "lucide-react";

export type ModuleId = "ocade" | "ficia" | "madee" | "cania" | "devices" | "settings";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  planned?: boolean;
  reason?: string;
  exact?: boolean;
}

export interface ModuleDef {
  id: ModuleId;
  label: string;
  to: string;
  icon: LucideIcon;
  match: string[];
}

export const MODULES: ModuleDef[] = [
  { id: "ocade", label: "OCADE", to: "/ocade", icon: MessageSquare, match: ["/ocade", "/home"] },
  // Reserved future products stay reachable only as honest coming-later pages.
  { id: "ficia", label: "FICIA", to: "/ficia", icon: Building2, match: ["/ficia"] },
  { id: "madee", label: "MADEE", to: "/madee", icon: Sparkles, match: ["/madee"] },
  { id: "cania", label: "CANIA", to: "/cania", icon: Globe2, match: ["/cania"] },
];

export const UTILITY: ModuleDef[] = [
  {
    id: "devices",
    label: "Devices",
    to: "/ocade/devices",
    icon: Monitor,
    match: ["/ocade/devices", "/settings/devices"],
  },
  { id: "settings", label: "Settings", to: "/settings", icon: Settings, match: ["/settings"] },
];

export function activeModule(pathname: string): ModuleId {
  if (pathname.startsWith("/settings/devices")) return "devices";
  if (pathname.startsWith("/settings")) return "settings";
  for (const module of MODULES) {
    if (module.match.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) return module.id;
  }
  return "ocade";
}

/**
 * OCADE navigation is ordered by importance rather than by implementation age:
 * primary work first, then tools, then advanced/system surfaces. The shell stays
 * a single contextual sidebar; we do not stack a second OCADE sidebar inside
 * Chat. Every entry below resolves to a real route.
 */
export const MODULE_CONTEXT: Record<ModuleId, NavItem[]> = {
  ocade: [
    // Primary
    { to: "/ocade", label: "Chat", icon: MessageSquare, exact: true },
    { to: "/ocade/projects", label: "Projects", icon: FolderOpen },
    { to: "/ocade/work", label: "Control + Work", icon: MonitorCog },
    { to: "/ocade/code", label: "Code", icon: FileCode2 },
    // Tools
    { to: "/ocade/automations", label: "Automations", icon: Workflow },
    { to: "/ocade/artifacts", label: "Files", icon: Package },
    { to: "/ocade/tasks", label: "Tasks", icon: ListChecks },
    { to: "/ocade/inbox", label: "Inbox", icon: Inbox },
    { to: "/ocade/search", label: "Search", icon: Search },
    { to: "/ocade/monitors", label: "Monitors", icon: Radar },
    { to: "/ocade/studio", label: "Studio", icon: Palette },
    // Advanced / system
    { to: "/ocade/models", label: "Models", icon: Boxes },
    { to: "/ocade/devices", label: "Devices", icon: Monitor },
    { to: "/ocade/connectors", label: "Connectors", icon: Cable },
    { to: "/ocade/permissions", label: "Permissions", icon: ShieldCheck },
    { to: "/ocade/activity", label: "Activity", icon: Activity },
    { to: "/ocade/health", label: "Health", icon: Activity },
    { to: "/ocade/lab", label: "Lab", icon: FlaskConical },
  ],
  ficia: [],
  madee: [],
  cania: [],
  devices: [
    { to: "/ocade/devices", label: "OCADE Devices", icon: Monitor, exact: true },
    { to: "/settings/devices", label: "Device settings", icon: Settings },
  ],
  settings: [
    { to: "/settings", label: "General", icon: Settings, exact: true },
    { to: "/settings/privacy", label: "Privacy", icon: Settings },
    { to: "/settings/vault", label: "Storage", icon: Settings },
    { to: "/settings/activity", label: "Activity", icon: Settings },
    { to: "/settings/appearance", label: "Appearance", icon: Settings },
  ],
};

export const DEMO_MODULES: ModuleDef[] = [
  { id: "ocade", label: "OCADE", to: "/demo/ocade", icon: MessageSquare, match: ["/demo"] },
];
