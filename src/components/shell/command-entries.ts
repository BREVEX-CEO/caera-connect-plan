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
    to: "/ocade/artifacts",
    label: "Files & artifacts",
    group: "Tools",
    keywords: "outputs exports files studio templates prompts shared sharing creative",
  },
  {
    to: "/ocade/tasks",
    /*
     * ONE ENTRY FOR ALL OF IT.
     *
     * Automations, Monitors and Inbox each had a line here, and each was a
     * slower way to reach part of what this one reaches. `PLAN.md` §4 folded
     * them into Tasks; the keywords keep the words people actually type, so
     * searching "inbox" or "monitor" still lands somewhere useful.
     */
    label: "Tasks",
    group: "Tools",
    keywords:
      "runs queue pause stop automations schedule recurring monitors watch alerts inbox approvals outcomes notifications",
  },
  {
    to: "/ocade/search",
    label: "Search",
    group: "Tools",
    keywords: "messages projects outputs universal",
  },
  /*
   * SETTINGS, NOT SEVEN SETTINGS SCREENS.
   *
   * Models, Devices, Connectors, Permissions, Activity, Health and Lab each had
   * a line here. §4 folded all seven into Settings and Customize, so the
   * palette names the destinations that exist and keeps the words people type
   * to find them.
   */
  {
    to: "/settings",
    label: "Settings",
    group: "System",
    keywords:
      "preferences account models local engine offline intelligence devices connectors permissions activity audit health diagnostics privacy security billing",
  },
  {
    to: "/ocade/customize",
    label: "Customize",
    group: "System",
    keywords: "appearance theme voice skills how ocade talks lab engineering diagnostics",
  },
  {
    to: "/organization",
    label: "Organization",
    group: "System",
    keywords: "team members invitations roles groups workspace owner admin",
  },
];

export function filterCommands(entries: CommandEntry[], query: string): CommandEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) =>
    `${entry.label} ${entry.group} ${entry.keywords ?? ""} ${entry.to}`.toLowerCase().includes(q),
  );
}
