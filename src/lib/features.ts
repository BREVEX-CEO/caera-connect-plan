/**
 * CARCC CADANE Feature + Action registries.
 *
 * Every visible capability MUST have a Feature entry. Every triggerable
 * action MUST have an Action entry. The UI reads these to decide whether a
 * control is enabled, disabled with a reason, or replaced by a SetupRequired
 * / NativeCompanionRequired / AccessDenied state.
 *
 * This is the enforcement seam for the No-Dead-Button policy.
 */

export type Platform = "web" | "windows" | "macos" | "android" | "ios";

export type FeatureStatus = "active" | "beta" | "setup_required" | "planned" | "hidden";

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
  {
    id: "onboarding.wizard",
    module: "core",
    title: "Onboarding",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "home.dashboard",
    module: "core",
    title: "Home",
    status: "active",
    platforms: ["web"],
    viewOnly: true,
  },
  {
    id: "settings.activity",
    module: "core",
    title: "Activity centre",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "demo.mode",
    module: "core",
    title: "Demo mode",
    status: "active",
    platforms: ["web"],
    viewOnly: true,
  },
  {
    id: "settings.privacy",
    module: "core",
    title: "Privacy settings",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "settings.devices",
    module: "core",
    title: "Devices",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "settings.appearance",
    module: "core",
    title: "Appearance",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "settings.security",
    module: "core",
    title: "Security",
    status: "active",
    platforms: ["web"],
  },
  /*
   * RETIRED, NOT DELETED. `PLAN.md` Phase 2 removed the encrypted browser
   * store this configured, and `/settings/vault` now forwards to
   * `/settings/data`. The entry stays `hidden` so `isFeatureAvailable` is
   * false everywhere — no screen can enable a control for it — while the
   * vault actions below keep a human title for the audit rows people already
   * have in their activity log.
   */
  {
    id: "settings.vault",
    module: "core",
    title: "Browser Vault",
    status: "hidden",
    reason: "The encrypted browser store was removed; an account holds the account's work.",
    platforms: ["web"],
  },
  {
    id: "admin.launch_gate",
    module: "admin",
    title: "Launch Gate",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "admin.country_packs",
    module: "admin",
    title: "Country Packs",
    status: "active",
    platforms: ["web"],
  },

  // OCADE — full chat lands in P10
  { id: "ocade.chat", module: "ocade", title: "OCADE chat", status: "active", platforms: ["web"] },
  {
    id: "ocade.models",
    module: "ocade",
    title: "Model connections",
    status: "active",
    platforms: ["web"],
  },
  {
    id: "ocade.copilot",
    module: "ocade",
    title: "Computer Copilot",
    status: "planned",
    platforms: ["windows", "macos"],
    reason: "Requires the Native Companion (Cursor / Tauri build).",
  },

  /*
   * FICIA, MADEE and CANIA are placeholders in this release.
   *
   * One entry each, marked `planned` with the reason the user actually sees on
   * the page. This registry is what the No-Dead-Button policy checks against,
   * so leaving the old rows at "active" would assert that a company workspace,
   * a resume builder and a market feed are live after their code has been
   * removed — the registry would be the last place still claiming they work.
   */
  {
    id: "ficia.placeholder",
    module: "ficia",
    title: "FICIA",
    status: "planned",
    platforms: ["web"],
    reason: "Coming later — not an AI model.",
    viewOnly: true,
  },
  {
    id: "madee.placeholder",
    module: "madee",
    title: "MADEE",
    status: "planned",
    platforms: ["web"],
    reason: "Coming later — not an AI model.",
    viewOnly: true,
  },
  {
    id: "cania.placeholder",
    module: "cania",
    title: "CANIA",
    status: "planned",
    platforms: ["web"],
    reason: "Coming later — not an AI model.",
    viewOnly: true,
  },
];

for (const f of features) registerFeature(f);
