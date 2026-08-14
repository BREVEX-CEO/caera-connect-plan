/**
 * Is live screen perception actually available, or only installed?
 *
 * SALVAGED FROM A DELETED SIMULATOR. This was the top of
 * `src/lib/control/perception.ts`, a 994-line fused-perception module that
 * accepted observations from a host that did not exist. That module went with
 * the rest of `src/lib/control/`. Real perception on this machine is
 * `screen_observe` in the Python engine, which reads the UI Automation tree
 * directly.
 *
 * This function is kept because it answers a question the settings screen
 * genuinely has to answer, and it never simulated anything: given what the
 * companion reports, WHICH pieces are missing? Naming them individually is the
 * point — "perception unavailable" sends a user hunting, while "accessibility
 * permission, vision provider" tells them what to fix.
 */

export type PerceptionSource = "accessibility" | "ocr" | "icon" | "vision";

export interface PerceptionRuntimeReadiness {
  /**
   * The code path exists. Always true, and deliberately not the same question
   * as `liveReady` — conflating the two is what let a build with no permissions
   * report perception as working.
   */
  sourceReady: true;
  liveReady: boolean;
  missing: string[];
}

/**
 * Project live perception readiness from authenticated companion evidence.
 * Source availability is not runtime availability: callers must explicitly
 * report every external perception provider they have actually connected.
 */
export function perceptionRuntimeReadiness(input: {
  companionAvailable: boolean;
  permissions?: Array<{ id: string; state: string }>;
  providers?: Partial<Record<PerceptionSource, boolean>>;
}): PerceptionRuntimeReadiness {
  const missing: string[] = [];
  if (!input.companionAvailable) {
    missing.push("Signed Native Companion");
  }
  const granted = new Set(
    (input.permissions ?? [])
      .filter((permission) => permission.state === "granted" || permission.state === "not_required")
      .map((permission) => permission.id),
  );
  if (!granted.has("accessibility")) {
    missing.push("accessibility permission");
  }
  if (!granted.has("screen_capture")) {
    missing.push("screen-capture permission");
  }
  for (const source of ["ocr", "icon", "vision"] as const) {
    if (!input.providers?.[source]) missing.push(`${source} provider`);
  }
  return {
    sourceReady: true,
    liveReady: missing.length === 0,
    missing,
  };
}
