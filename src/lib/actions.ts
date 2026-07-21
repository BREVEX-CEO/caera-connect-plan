/**
 * ActionRegistry — every triggerable app action must have an entry.
 *
 * Pairs with the FeatureRegistry (src/lib/features.ts). Splits every action
 * into one of two log destinations:
 *  - "compliance" → immutable, hash-chained compliance_audit_log
 *  - "operational" → short-retention activity_log
 *
 * Plan §15: never overload the legal audit log with harmless preference toggles.
 */

import { supabase } from "@/integrations/supabase/client";

export type LogTarget = "compliance" | "operational";

export type ComplianceCategory =
  | "finance"
  | "payment"
  | "filing"
  | "signature"
  | "approval"
  | "role_change"
  | "sensitive_export"
  | "deletion"
  | "other";

export interface Action {
  id: string;
  featureId: string;
  title: string;
  log: LogTarget;
  /** Required when log === "compliance". */
  category?: ComplianceCategory;
  /** Human-readable description of what the action changes. */
  description?: string;
}

const registry = new Map<string, Action>();

export function registerAction(a: Action) {
  if (a.log === "compliance" && !a.category) {
    throw new Error(
      `[ActionRegistry] ${a.id} logs to compliance but has no category.`,
    );
  }
  registry.set(a.id, a);
}

export function getAction(id: string): Action | undefined {
  return registry.get(id);
}

export function listActions(): Action[] {
  return Array.from(registry.values());
}

// --------------- Bootstrap Foundation Alpha actions ---------------

const actions: Action[] = [
  { id: "auth.sign_in", featureId: "auth.sign_in", title: "Sign in", log: "operational" },
  { id: "auth.sign_out", featureId: "auth.sign_out", title: "Sign out", log: "operational" },
  {
    id: "onboarding.complete",
    featureId: "onboarding.wizard",
    title: "Complete onboarding",
    log: "operational",
  },
  {
    id: "settings.theme.change",
    featureId: "settings.privacy",
    title: "Change theme",
    log: "operational",
  },
  {
    id: "settings.privacy.change",
    featureId: "settings.privacy",
    title: "Change privacy mode",
    log: "operational",
    description: "Per-data-class privacy toggle. Not a regulated change.",
  },
  {
    id: "devices.register",
    featureId: "settings.devices",
    title: "Register device",
    log: "operational",
  },
  {
    id: "devices.revoke",
    featureId: "settings.devices",
    title: "Revoke device",
    log: "compliance",
    category: "role_change",
    description: "Revoking a device removes an approved access surface for the account.",
  },
];

for (const a of actions) registerAction(a);

// --------------- Writers ---------------

interface RecordArgs {
  actionId: string;
  metadata?: Record<string, unknown>;
  tenantId?: string | null;
}

/**
 * Record an action. Automatically routes to the correct log based on the
 * ActionRegistry entry. Fails silently in the UI layer — logging must never
 * break the primary flow — but reports errors to the console.
 */
export async function recordAction({ actionId, metadata, tenantId }: RecordArgs): Promise<void> {
  const a = registry.get(actionId);
  if (!a) {
    console.warn(`[ActionRegistry] unknown action id: ${actionId}`);
    return;
  }
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  try {
    const meta = (metadata ?? {}) as never;
    if (a.log === "operational") {
      await supabase.from("activity_log").insert({
        user_id: uid,
        tenant_id: tenantId ?? null,
        action: a.id,
        feature_id: a.featureId,
        metadata: meta,
      });
    } else {
      // Compliance writes go through the protected server writer.
      // Direct INSERT on compliance_audit_log is revoked for authenticated.
      const { writeComplianceLog } = await import("./compliance-log.functions");
      await writeComplianceLog({
        data: {
          action: a.id,
          featureId: a.featureId,
          category: a.category ?? "other",
          tenantId: tenantId ?? null,
          preview: (metadata ?? {}) as Record<string, unknown>,
        },
      });
    }
  } catch (e) {
    console.error("[ActionRegistry] record failed", a.id, e);
  }
}
