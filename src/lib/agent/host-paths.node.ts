/**
 * Where the native hosts live, decided on the server and nowhere else.
 *
 * A path is a capability. If a caller could name the interpreter, the "bounded
 * Python sidecar" would be "run this executable", and every guard above it
 * would be decoration. So these are resolved from the project root, checked for
 * existence, and reported as MISSING rather than substituted when absent.
 *
 * Reporting missing honestly matters more than it looks: a developer machine
 * without the venv and a user machine where the installer failed produce the
 * same symptom, and "the computer-control host is not installed" sends both to
 * the right place. Silently degrading to "no tools available" sends neither.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AdapterConfig } from "./adapters.node";

export type AdapterConfigResult =
  { ok: true; config: AdapterConfig } | { ok: false; reason: string; missing: string[] };

/**
 * Find the project root by marker rather than by counting `..`.
 *
 * The server bundle does not sit where the source did. Counting directory
 * levels worked from source and resolved every sidecar next to the bundle once
 * built — which is exactly how the first live agent run failed, with all three
 * tasks reporting "the computer-control host could not start".
 */
export function projectRoot(startFrom = process.cwd()): string | null {
  let dir = process.env.OCADE_ROOT ?? startFrom;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, "native", "browser-host", "index.mjs"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function pythonExecutableFor(root: string): string {
  return process.platform === "win32"
    ? resolve(root, "native/python-host/.venv/Scripts/python.exe")
    : resolve(root, "native/python-host/.venv/bin/python");
}

export async function resolveAdapterConfig(): Promise<AdapterConfigResult> {
  const root = projectRoot();
  if (!root) {
    return {
      ok: false,
      reason: "OCADE could not locate its own installation directory on this machine.",
      missing: ["installation root"],
    };
  }

  const pythonExecutable = pythonExecutableFor(root);
  const pythonHostDir = resolve(root, "native/python-host");
  const browserHostEntry = resolve(root, "native/browser-host/index.mjs");
  /*
   * The Mark-L control engine's headless door.
   *
   * Resolved like the other sidecars — from the project root, checked for
   * existence, reported missing rather than substituted. It runs on the same
   * OCADE-owned interpreter as the other Python host, so there is still exactly
   * one interpreter path in this file and no way for a caller to name another.
   */
  const engineBridgeEntry = resolve(root, "native/ocade_control_engine/ocade_bridge.py");

  const missing: string[] = [];
  if (!existsSync(pythonExecutable)) missing.push("the computer-control host (Python environment)");
  if (!existsSync(join(pythonHostDir, "ocade_host", "__main__.py"))) {
    missing.push("the computer-control host (program files)");
  }
  if (!existsSync(browserHostEntry)) missing.push("the managed-browser host");
  if (!existsSync(engineBridgeEntry)) missing.push("the control engine");

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `OCADE cannot control this computer yet because ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not installed.`,
      missing,
    };
  }

  return {
    ok: true,
    config: { pythonExecutable, pythonHostDir, browserHostEntry, engineBridgeEntry },
  };
}
