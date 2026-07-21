/**
 * CAERA CADANE Feature + Action registries.
 *
 * Every visible capability MUST have a Feature entry. Every triggerable
 * action MUST have an Action entry. The UI reads these to decide whether a
 * control is enabled, disabled with a reason, or replaced by a SetupRequired
 * / NativeCompanionRequired / AccessDenied state.
 *
 * This is the enforcement seam for the No-Dead-Button policy.
 */

export type Platform = "web" | "windows" | "macos" | "android" | "ios";

export type FeatureStatus =
  | "active"
  | "beta"
  | "setup_required"
  | "planned"
  | "hidden";

export type Module = "core" | "ocade" | "ficia" | "madee" | "cania" | "admin";

export interface Feature {
  id: string;
  module: Module;
  title: string;
  status: FeatureStatus;
  platforms: Platform[];
  /** Reason shown to users when status is not "active" or "beta". */
  reason?: string;
  /** Feature is a display-only surface with no user-triggerable actions. */
  viewOnly?: boolean;
}

const registry = new Map<string, Feature>();

export function registerFeature(f: Feature) {
  if (f.status !== "active" && f.status !== "beta" && !f.reason) {
    throw new Error(
      `[FeatureRegistry] ${f.id} has status "${f.status}" but no reason. Every non-active feature must explain why.`,
    );
  }
  registry.set(f.id, f);
}

export function getFeature(id: string): Feature | undefined {
  return registry.get(id);
}

export function isFeatureAvailable(id: string): boolean {
  const f = registry.get(id);
  return !!f && (f.status === "active" || f.status === "beta");
}

export function listFeatures(module?: Module): Feature[] {
  const all = Array.from(registry.values());
  return module ? all.filter((f) => f.module === module) : all;
}

// ---------------- Bootstrap Foundation Alpha features ----------------

const features: Feature[] = [
  { id: "auth.sign_in", module: "core", title: "Sign in", status: "active", platforms: ["web"] },
  { id: "auth.sign_out", module: "core", title: "Sign out", status: "active", platforms: ["web"] },
  { id: "onboarding.wizard", module: "core", title: "Onboarding", status: "active", platforms: ["web"] },
  { id: "home.dashboard", module: "core", title: "Home", status: "active", platforms: ["web"], viewOnly: true },
  { id: "settings.activity", module: "core", title: "Activity centre", status: "active", platforms: ["web"] },
  { id: "demo.mode", module: "core", title: "Demo mode", status: "active", platforms: ["web"], viewOnly: true },
  { id: "settings.privacy", module: "core", title: "Privacy settings", status: "active", platforms: ["web"] },
  { id: "settings.devices", module: "core", title: "Devices", status: "active", platforms: ["web"] },
  { id: "settings.appearance", module: "core", title: "Appearance", status: "active", platforms: ["web"] },
  { id: "settings.vault", module: "core", title: "Browser Vault", status: "active", platforms: ["web"] },
  { id: "admin.launch_gate", module: "admin", title: "Launch Gate", status: "active", platforms: ["web"] },
  { id: "admin.country_packs", module: "admin", title: "Country Packs", status: "active", platforms: ["web"] },


  // OCADE — full chat lands in P10
  { id: "ocade.chat", module: "ocade", title: "OCADE chat", status: "active", platforms: ["web"] },
  { id: "ocade.models", module: "ocade", title: "Model connections", status: "active", platforms: ["web"] },
  { id: "ocade.copilot", module: "ocade", title: "Computer Copilot", status: "planned", platforms: ["windows", "macos"], reason: "Requires the Native Companion (Cursor / Tauri build)." },


  // FICIA
  { id: "ficia.company", module: "ficia", title: "Company workspace", status: "active", platforms: ["web"] },
  { id: "ficia.access", module: "ficia", title: "Company access requests", status: "active", platforms: ["web"] },
  { id: "ficia.people", module: "ficia", title: "People, employments & org units", status: "active", platforms: ["web"] },
  { id: "ficia.roles", module: "ficia", title: "Roles, templates & grants", status: "active", platforms: ["web"] },
  { id: "ficia.approvals", module: "ficia", title: "Approvals & segregation of duties", status: "active", platforms: ["web"] },
  { id: "ficia.messenger", module: "ficia", title: "Business messenger", status: "active", platforms: ["web"] },
  { id: "ficia.timesheet", module: "ficia", title: "Timesheets & attendance", status: "active", platforms: ["web"] },
  { id: "ficia.family_planning", module: "ficia", title: "Family, Marriage & Asset Protection", status: "planned", platforms: ["web"], reason: "Ships with the FICIA tax / benefits slice." },

  // MADEE
  { id: "madee.resume", module: "madee", title: "Resume Builder", status: "active", platforms: ["web"] },
  { id: "madee.resume_ai", module: "madee", title: "Resume AI assist", status: "setup_required", platforms: ["web"], reason: "AI assist runs when the Lovable AI Gateway is reachable. Manual editing always works." },

  // CANIA — design + honest empty states now, providers later
  { id: "cania.center", module: "cania", title: "World intelligence center", status: "setup_required", platforms: ["web"], reason: "Provider setup required. Data sources not connected yet." },
  { id: "cania.topics", module: "cania", title: "CANIA saved topics", status: "active", platforms: ["web"] },
  { id: "cania.alerts", module: "cania", title: "CANIA alerts", status: "setup_required", platforms: ["web"], reason: "Alerts fire once provider adapters are connected." },
  { id: "cania.settings", module: "cania", title: "CANIA settings", status: "active", platforms: ["web"] },
  { id: "cania.search", module: "cania", title: "CANIA search", status: "setup_required", platforms: ["web"], reason: "Cross-section search runs once providers are connected." },
];

for (const f of features) registerFeature(f);
