/**
 * APPS & WEBSITES (plan 14E.6, 14E.8, REPO-19): one searchable directory of what JARVIS can use,
 * built only from what is real: the apps each paired computer reports and whether each is
 * allowed there, the websites allowed on it, the tool servers (MCP) approved on it, and the
 * person's own skills. Third-party accounts are listed so people can find them, each with the
 * truthful state that OCADE has not finished registering with that provider: no Connect button
 * is offered until a registered, reviewed integration exists (14E.6.2-3).
 */
export type EntryKind = "app" | "website" | "tools" | "skill" | "account";
export type EntryState = "allowed" | "needs_permission" | "approved" | "yours" | "not_available";

export interface DirectoryEntry {
  kind: EntryKind;
  key: string;
  name: string;
  detail: string;
  state: EntryState;
  device?: string;
}

/** Providers people look for; none is connectable until OCADE registers with it. */
export const ACCOUNT_SERVICES: readonly { name: string; synonyms: string }[] = [
  { name: "GitHub", synonyms: "git code repository" },
  { name: "Google Drive", synonyms: "docs sheets files gdrive" },
  { name: "Gmail", synonyms: "email mail google" },
  { name: "Google Calendar", synonyms: "calendar events meetings" },
  { name: "Microsoft 365", synonyms: "outlook onedrive excel word office" },
  { name: "Slack", synonyms: "chat messages team" },
  { name: "Notion", synonyms: "notes wiki docs" },
  { name: "Dropbox", synonyms: "files storage" },
  { name: "Canva", synonyms: "design graphics" },
  { name: "Figma", synonyms: "design prototype" },
];

interface DeviceInput {
  id: string;
  name: string;
  installed_apps: unknown;
  capabilities: unknown;
}

export function directory(
  devices: readonly DeviceInput[],
  grants: ReadonlyMap<string, readonly string[]>,
  skills: readonly { name: string; title: string }[],
): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  for (const device of devices) {
    const allowed = new Set(grants.get(device.id) ?? []);
    const apps = Array.isArray(device.installed_apps) ? device.installed_apps : [];
    const seen = new Set<string>();
    for (const app of apps as { name?: unknown; exe?: unknown }[]) {
      if (typeof app?.name !== "string" || typeof app.exe !== "string" || seen.has(app.exe))
        continue;
      seen.add(app.exe);
      entries.push({
        kind: "app",
        key: `${device.id}:app:${app.exe}`,
        name: app.name,
        detail: app.exe,
        state: allowed.has(`app:${app.exe}`) ? "allowed" : "needs_permission",
        device: device.name,
      });
    }
    for (const grant of allowed) {
      if (!grant.startsWith("site:")) continue;
      entries.push({
        kind: "website",
        key: `${device.id}:${grant}`,
        name: grant.slice(5),
        detail: "Website",
        state: "allowed",
        device: device.name,
      });
    }
    const mcp = (device.capabilities as { mcp?: unknown } | null)?.mcp;
    for (const server of Array.isArray(mcp) ? (mcp as Record<string, unknown>[]) : []) {
      if (typeof server.id !== "string") continue;
      const tools = Array.isArray(server.tools) ? server.tools.length : 0;
      entries.push({
        kind: "tools",
        key: `${device.id}:mcp:${server.id}`,
        name: server.id,
        detail: `${typeof server.publisher === "string" ? server.publisher : "Tool server"} · ${tools} tool${tools === 1 ? "" : "s"}`,
        state: allowed.has(`mcp:${server.id}`) ? "allowed" : "approved",
        device: device.name,
      });
    }
  }
  for (const skill of skills) {
    entries.push({
      kind: "skill",
      key: `skill:${skill.name}`,
      name: `/${skill.name}`,
      detail: skill.title,
      state: "yours",
    });
  }
  for (const service of ACCOUNT_SERVICES) {
    entries.push({
      kind: "account",
      key: `account:${service.name}`,
      name: service.name,
      detail: service.synonyms,
      state: "not_available",
    });
  }
  return entries;
}

/** Type-to-search over names, details and devices; every word must match somewhere. */
export function search(entries: readonly DirectoryEntry[], query: string): DirectoryEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...entries];
  return entries.filter((entry) => {
    const text = `${entry.name} ${entry.detail} ${entry.device ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
