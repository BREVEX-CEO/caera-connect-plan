/** Single source of truth for workspace navigation. */
import {
  MessageSquare,
  Settings,
  Monitor,
  MonitorCog,
  FileCode2,
  FolderOpen,
  ListChecks,
  Package,
  SlidersHorizontal,
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
    if (module.match.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/")))
      return module.id;
  }
  return "ocade";
}

/**
 * SEVEN DESTINATIONS, AND WHY IT IS SEVEN.
 *
 * The sidebar held twelve: Chat, Projects, Control + Work, Code, Automations,
 * Files, Tasks, Inbox, Search, Monitors, Studio, System. Every one of them is a
 * real screen, and together they read as a sitemap rather than a place to work
 * — a person opening OCADE for the first time had to decide, before typing
 * anything, which of twelve rooms their question belonged in. That is a
 * decision the product should be making for them.
 *
 * What is left is the set somebody uses in a normal week, in the order they
 * reach for it. Everything removed from the rail is still there, still routed,
 * and reachable three ways: from More, from Cmd/Ctrl+K, and — increasingly —
 * by asking for it in Chat, which now has the tools to do the thing rather than
 * point at the screen that does it.
 *
 * Code, Studio, Monitors, Automations, Files and Inbox are the six that moved.
 * None of them is minor; all six are places a person goes deliberately, having
 * already decided. The rail is for the ones you reach for without deciding.
 */
export const MODULE_CONTEXT: Record<ModuleId, NavItem[]> = {
  ocade: [
    /*
     * THE THREE PRIMARY MODES FIRST, BECAUSE PLAN.md §4 CALLS THEM THAT.
     *
     * Chat, Cowork and Code. Two of the three were not in this list: Cowork was
     * here under its old name and its old path, and Code was not here at all —
     * reachable only from the More directory, which is where things go when
     * somebody has already decided they want them. A primary mode you have to
     * go looking for is not primary, and a person who never opens More never
     * learns that OCADE writes code.
     *
     * Then the secondary views §4 names, in the order somebody reaches for
     * them, and More last. Search is deliberately absent: §4 moves it to a
     * global overlay, which Cmd/Ctrl+K opens from every screen — a rail entry
     * for it would be a second way to do the same thing, one keystroke slower.
     */
    { to: "/ocade", label: "Chat", icon: MessageSquare, exact: true },
    { to: "/ocade/cowork", label: "Cowork", icon: MonitorCog },
    { to: "/ocade/code", label: "Code", icon: FileCode2 },
    { to: "/ocade/projects", label: "Projects", icon: FolderOpen },
    { to: "/ocade/tasks", label: "Tasks", icon: ListChecks },
    { to: "/ocade/artifacts", label: "Artifacts", icon: Package },
    { to: "/ocade/customize", label: "More", icon: SlidersHorizontal },
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
