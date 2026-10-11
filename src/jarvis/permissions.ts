/**
 * What JARVIS may do, decided from the account's stored decisions.
 *
 * Pure, so the same rule runs in the server functions that enforce it and in
 * the drawer that displays it. A device-level decision overrides the account
 * default for that device. A capability with no decision takes its default,
 * and capabilities this mission has not built default to off.
 */
import {
  capabilityFor,
  commandClass,
  hostOf,
  type Capability,
  type DeviceAction,
} from "./protocol";

export interface PermissionRow {
  capability: string;
  allowed: boolean;
  device_id: string | null;
}

const DEFAULTS: Record<Capability, boolean> = {
  master: true,
  browser: true,
  microphone: true,
  memory: false,
  autonomous: false,
  browser_real: false,
  files: false,
  screen: false,
  camera: false,
  apps: false,
  messaging: false,
  devices: true,
  computer_control: false,
  terminal: false,
};

export function isAllowed(
  rows: readonly PermissionRow[],
  capability: Capability,
  deviceId?: string | null,
): boolean {
  const pick = (device: string | null) =>
    rows.find((row) => row.capability === capability && (row.device_id ?? null) === device);
  const decided = (deviceId ? pick(deviceId) : undefined) ?? pick(null);
  return decided ? decided.allowed : DEFAULTS[capability];
}

/** Loopback, private-network and link-local hosts: a device's own neighbourhood. */
export function isPrivateHost(host: string): boolean {
  return (
    /(^|\.)(localhost|local|internal|lan|home)$/.test(host) ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    // IPv4 carried in IPv6 (mapped, or NAT64) is judged by the device's own resolver too.
    /^\[(::1?|f[cd]|fe[89ab]|::ffff:|64:ff9b::)/i.test(host)
  );
}

/** The person's explicit decision for this address or a parent domain, if any. */
function siteDecision(rows: readonly PermissionRow[], host: string): boolean | null {
  const labels = host.split(".");
  // A name matches itself and its parent domains; an address or a bare name only itself.
  const scopes =
    /^[\d.]+$/.test(host) || labels.length === 1
      ? [host]
      : labels.slice(0, -1).map((_, at) => labels.slice(at).join("."));
  for (const scope of scopes) {
    const row = rows.find((r) => r.capability === `site:${scope}` && r.device_id === null);
    if (row) return row.allowed;
  }
  return null;
}

/**
 * A public site is usable unless the person turned it (or a parent domain)
 * off. A private-network address is usable only after the person allowed it,
 * so a page cannot steer JARVIS into the device's own network.
 */
export function siteAllowed(rows: readonly PermissionRow[], url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return siteDecision(rows, host) ?? !isPrivateHost(host);
}

export type Refusal = { capability: Capability | "site" | "app"; message: string };

/**
 * Allowed Apps: Always (true), Never (false) or Ask (no decision). A rule set
 * for this computer wins over the account-wide one for the same app.
 */
export function appDecision(
  rows: readonly PermissionRow[],
  name: string,
  deviceId: string | null = null,
): boolean | null {
  const key = `app:${name.toLowerCase()}`;
  const row =
    (deviceId ? rows.find((r) => r.capability === key && r.device_id === deviceId) : undefined) ??
    rows.find((r) => r.capability === key && r.device_id === null);
  return row ? row.allowed : null;
}

const LABELS: Partial<Record<Capability, string>> = {
  browser: "Browser control",
  browser_real: "Using your own browser",
  screen: "Seeing the screen",
  computer_control: "Mouse and keyboard control",
  apps: "Opening apps",
  files: "Files",
  terminal: "Running commands",
};

/**
 * Why an action on this device may not run, or null when it may. `offered` is
 * what the device itself reported it can do: a permission never turns on a
 * capability the device does not have.
 */
export function refuseAction(
  rows: readonly PermissionRow[],
  input: {
    deviceId: string;
    mode: "isolated" | "real";
    action: DeviceAction;
    offered?: Record<string, boolean>;
  },
): Refusal | null {
  if (!isAllowed(rows, "master"))
    return { capability: "master", message: "OCADE JARVIS is turned off." };
  const needed = capabilityFor(input.action);
  const label = LABELS[needed] ?? "That";
  if (!isAllowed(rows, needed, input.deviceId))
    return { capability: needed, message: `${label} is turned off for this device.` };
  // Moving a file through a page needs the browser as well as the work folder.
  if (
    (input.action.action === "upload" || input.action.action === "download") &&
    !isAllowed(rows, "browser", input.deviceId)
  )
    return { capability: "browser", message: "Browser control is turned off for this device." };
  if (needed !== "browser" && input.offered && input.offered[needed] !== true)
    return { capability: needed, message: `${label} is not available on this device.` };
  if (
    needed === "browser" &&
    input.mode === "real" &&
    !isAllowed(rows, "browser_real", input.deviceId)
  )
    return { capability: "browser_real", message: "Using your own browser is not allowed." };
  const url =
    input.action.action === "open" || input.action.action === "new_tab"
      ? input.action.url
      : undefined;
  if (url !== undefined && !siteAllowed(rows, url)) {
    const host = hostOf(url) ?? "";
    return {
      capability: "site",
      message:
        siteDecision(rows, host) === null && isPrivateHost(host)
          ? `${host} is on a private network. Allow it in Devices, under Apps and websites, first.`
          : "That site is turned off in Devices, under Apps and websites.",
    };
  }
  if (
    input.action.action === "open_app" &&
    appDecision(rows, input.action.name, input.deviceId) === false
  )
    return {
      capability: "app",
      message: `${input.action.name} is set to Never in Devices, under Apps and websites.`,
    };
  return null;
}

/** Whether the person must confirm this action before the device runs it. */
export function needsConfirmation(
  rows: readonly PermissionRow[],
  action: DeviceAction,
  deviceId: string | null = null,
): boolean {
  switch (action.action) {
    case "open_app":
      return appDecision(rows, action.name, deviceId) !== true;
    // An upload is a work-folder file leaving for a website: the page cannot be trusted to ask.
    // The work folder is the boundary: reaching past it, in or out, is the person's to allow.
    case "file_delete":
    case "system":
    case "upload":
    case "file_import":
    case "file_export":
      return true;
    case "window":
      // Closing a window can lose unsaved work.
      return action.state === "close";
    case "run":
      // The task's own builds, tests and git reads run unasked (owner policy,
      // 2026-10-02); everything else is shown whole and asked. queue() asks for
      // a routine one too once the task has read a web page.
      return !["inert", "routine"].includes(commandClass(action.command));
    default:
      return false;
  }
}

export interface OnlineDevice {
  id: string;
  name: string;
  kind: string;
  capabilities: unknown;
}

/**
 * WHICH COMPUTER DOES THE WORK. The computer's own work needs its Device
 * Agent. Browser work goes to the one computer allowed to use the person's own
 * browser, else one with the isolated browser. With several possible and none
 * chosen, the person chooses: work never goes to a computer they did not mean.
 */
export function chooseTaskDevice<T extends OnlineDevice>(
  online: readonly T[],
  rows: readonly PermissionRow[],
  where: "browser" | "computer",
  deviceId?: string,
  context: { here?: string; on?: "here" | "computer" } = {},
): { ok: true; device: T; real: boolean } | { ok: false; message: string } {
  const offers = (d: T, capability: string) =>
    (d.capabilities as Record<string, boolean> | null)?.[capability] === true;
  /*
   * WHERE THE PERSON IS, UNLESS THEY NAMED A COMPUTER (owner addendum 2026-10-02).
   * Asked from their phone in the OCADE app, "open Chrome" is the phone's Chrome;
   * "on my PC" (or work only a computer can do) goes to the paired computer.
   */
  // A phone works on its apps and screen; a web task still needs a browser JARVIS drives.
  const phone =
    !deviceId && context.on !== "computer" && where === "computer"
      ? online.find((d) => d.id === context.here && d.kind === "android")
      : undefined;
  if (phone) return { ok: true, device: phone, real: false };
  const pool =
    !deviceId && context.on === "computer" ? online.filter((d) => d.kind === "agent") : online;
  if (pool.length === 0 && online.length > 0) {
    return { ok: false, message: "Your computer is not online. Open OCADE on it, or turn it on." };
  }
  const chosen = deviceId ? pool.filter((d) => d.id === deviceId) : pool;
  if (deviceId && chosen.length === 0) {
    return {
      ok: false,
      message: "That computer is not online. Open OCADE on it or choose another in Devices.",
    };
  }
  // Computers first: a phone works on a task only when the person chose it.
  const workers = chosen.filter((d) => d.kind === "agent" || d.kind === "android");
  const computers = workers.filter((d) => d.kind === "agent");
  const agents = deviceId || computers.length === 0 ? workers : computers;
  const ownBrowsers = chosen.filter(
    (d) => offers(d, "browser_real") && isAllowed(rows, "browser_real", d.id),
  );
  if (!deviceId && agents.length > 1 && (where === "computer" || ownBrowsers.length !== 1)) {
    return {
      ok: false,
      message: `More than one computer is online (${agents
        .map((d) => d.name)
        .join(", ")}). Choose one in Devices, then ask again.`,
    };
  }
  const own = ownBrowsers[0];
  const device =
    where === "computer"
      ? agents[0]
      : (own ?? agents.find((d) => offers(d, "browser_isolated")) ?? agents[0]);
  if (!device) {
    return {
      ok: false,
      message:
        where === "computer"
          ? "No computer with the OCADE Device Agent is online. Connect one in Devices."
          : "No JARVIS device is online. Connect one in Devices to run browser tasks.",
    };
  }
  return { ok: true, device, real: device === own };
}
