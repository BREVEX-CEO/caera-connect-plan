/**
 * Every destination the command palette can reach, and the search over them.
 *
 * Kept beside the palette but apart from it, so the route catalogue can be
 * asserted against the generated route tree without rendering a dialog.
 */
export interface CommandEntry {
  to: string;
  label: string;
  group: "Primary" | "Tools" | "System";
  keywords?: string;
}

/** Every destination below has a route file. */
export const COMMAND_ENTRIES: CommandEntry[] = [
  { to: "/ocade", label: "Chat", group: "Primary", keywords: "conversation ask" },
  { to: "/ocade/projects", label: "Projects", group: "Primary", keywords: "folders workspace" },
  {
    to: "/ocade/cowork",
    label: "Control + Work",
    group: "Primary",
    keywords: "pc computer control agent",
  },
  { to: "/ocade/code", label: "Code", group: "Primary", keywords: "terminal shell repository" },
  {
    to: "/ocade/automations",
    label: "Automations",
    group: "Tools",
    keywords: "schedule recurring",
  },
  {
    to: "/ocade/artifacts",
    label: "Files & artifacts",
    group: "Tools",
    keywords: "outputs exports files",
  },
  { to: "/ocade/tasks", label: "Tasks", group: "Tools", keywords: "runs queue pause stop" },
  {
    to: "/ocade/inbox",
    label: "Inbox",
    group: "Tools",
    keywords: "approvals outcomes notifications",
  },
  {
    to: "/ocade/search",
    label: "Search",
    group: "Tools",
    keywords: "messages projects outputs universal",
  },
  { to: "/ocade/monitors", label: "Monitors", group: "Tools", keywords: "watch alerts sources" },
  {
    to: "/ocade/studio",
    label: "Studio",
    group: "Tools",
    keywords: "creative documents reports apps",
  },
  {
    to: "/ocade/models",
    label: "Models",
    group: "System",
    keywords: "local intelligence engines providers",
  },
  {
    to: "/ocade/devices",
    label: "Devices",
    group: "System",
    keywords: "approved revoke machine phone",
  },
  {
    to: "/ocade/connectors",
    label: "Connectors",
    group: "System",
    keywords: "browser cloud sync integrations",
  },
  {
    to: "/ocade/permissions",
    label: "Permissions",
    group: "System",
    keywords: "approval privacy access",
  },
  { to: "/ocade/activity", label: "Activity", group: "System", keywords: "logs audit history" },
  {
    to: "/ocade/health",
    label: "Health",
    group: "System",
    keywords: "status capability diagnostics",
  },
  {
    to: "/ocade/lab",
    label: "Lab",
    group: "System",
    keywords: "engineering diagnostics research sandbox",
  },
  {
    to: "/organization",
    label: "Organization",
    group: "System",
    keywords: "team members invitations roles groups workspace owner admin",
  },
  { to: "/settings", label: "Settings", group: "System", keywords: "preferences account" },
];

export function filterCommands(entries: CommandEntry[], query: string): CommandEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) =>
    `${entry.label} ${entry.group} ${entry.keywords ?? ""} ${entry.to}`.toLowerCase().includes(q),
  );
}
