/**
 * Environment facts the ported logic asks for, answered for a browser-first
 * runtime instead of a Node process.
 *
 * `platform` exists because the donor picked different glyphs and different
 * shell semantics per OS. In OCADE the browser answers from the user agent and
 * the local companion overrides it with the real host platform once connected.
 */

export type HostPlatform = "darwin" | "win32" | "linux" | "unknown";

function detectPlatform(): HostPlatform {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const hint = `${nav?.userAgent ?? ""}`.toLowerCase();
  if (/mac|iphone|ipad|ipod/.test(hint)) return "darwin";
  if (/win/.test(hint)) return "win32";
  if (/linux|android|cros/.test(hint)) return "linux";
  return "unknown";
}

let override: HostPlatform | null = null;

/** The local companion reports the real host platform once it connects. */
export function setHostPlatform(next: HostPlatform | null): void {
  override = next;
}

export const env = {
  get platform(): HostPlatform {
    return override ?? detectPlatform();
  },
};

/**
 * Truthiness for a configuration flag. The donor read `process.env`; OCADE has
 * no process, so flags arrive from the host as explicit values.
 */
export function isEnvTruthy(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  const normalised = value.trim().toLowerCase();
  return normalised === "1" || normalised === "true" || normalised === "yes" || normalised === "on";
}
