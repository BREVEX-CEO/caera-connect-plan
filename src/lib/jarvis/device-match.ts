/**
 * REPO-43: a task never moves between computers on its own. When the person names an app with @
 * that the chosen computer does not have but another of their computers does, the page says so
 * and offers that computer; switching stays the person's choice.
 */
export interface DeviceApps {
  id: string;
  name: string;
  installed_apps: unknown;
}

function has(device: DeviceApps, app: string): boolean {
  const apps = Array.isArray(device.installed_apps) ? device.installed_apps : [];
  return apps.some(
    (entry: { exe?: unknown }) => typeof entry?.exe === "string" && entry.exe.toLowerCase() === app,
  );
}

/** The first @-named app missing on the chosen computer, with the other computers that have it. */
export function appOnAnotherComputer(
  draft: string,
  chosen: DeviceApps | null,
  devices: readonly DeviceApps[],
): { app: string; computers: { id: string; name: string }[] } | null {
  if (!chosen) return null;
  for (const [, raw] of draft.matchAll(/(?:^|\s)@([^\s@]{1,80})/g)) {
    const app = raw!.replace(/[.,;:!?)]+$/, "").toLowerCase();
    if (!app || has(chosen, app)) continue;
    const computers = devices
      .filter((device) => device.id !== chosen.id && has(device, app))
      .map(({ id, name }) => ({ id, name }));
    if (computers.length) return { app, computers };
  }
  return null;
}
