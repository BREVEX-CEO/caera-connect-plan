/**
 * What JARVIS may do, decided from the account's stored decisions.
 *
 * Pure, so the same rule runs in the server functions that enforce it and in
 * the drawer that displays it. A device-level decision overrides the account
 * default for that device. A capability with no decision takes its default,
 * and capabilities this mission has not built default to off.
 */
import { hostOf, type Capability } from "./protocol";

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
    /^\[(::1?|f[cd]|fe[89ab])/i.test(host)
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

export type Refusal = { capability: Capability | "site"; message: string };

/** Why an action on this device may not run, or null when it may. */
export function refuseAction(
  rows: readonly PermissionRow[],
  input: { deviceId: string; mode: "isolated" | "real"; url?: string },
): Refusal | null {
  if (!isAllowed(rows, "master"))
    return { capability: "master", message: "OCADE JARVIS is turned off." };
  if (!isAllowed(rows, "browser", input.deviceId))
    return { capability: "browser", message: "Browser control is turned off for this device." };
  if (input.mode === "real" && !isAllowed(rows, "browser_real", input.deviceId))
    return { capability: "browser_real", message: "Using your own browser is not allowed." };
  if (input.url !== undefined && !siteAllowed(rows, input.url)) {
    const host = hostOf(input.url) ?? "";
    return {
      capability: "site",
      message:
        siteDecision(rows, host) === null && isPrivateHost(host)
          ? `${host} is on a private network. Allow it in Allowed Apps first.`
          : "That site is turned off in Allowed Apps.",
    };
  }
  return null;
}
