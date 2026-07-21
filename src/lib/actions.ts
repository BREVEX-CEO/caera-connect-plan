/**
 * ActionRegistry — every triggerable app action must have an entry.
 *
 * Hardened in Prompt 5:
 * - Actions declare confirmation strength, timeout, preview, log target.
 * - executeAction() enforces confirmation + timeout and records success/failure.
 * - validateRegistry() fails when a non-viewOnly active feature has no action.
 */

import { supabase } from "@/integrations/supabase/client";
import { listFeatures, getFeature } from "./features";

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

export type ConfirmationLevel = "none" | "confirm" | "strong";

export interface Action {
  id: string;
  featureId: string;
  title: string;
  log: LogTarget;
  /** Required when log === "compliance". */
  category?: ComplianceCategory;
  description?: string;
  /** UI must present a preview before executing. */
  requiresPreview?: boolean;
  /** none | confirm | strong (strong requires exact phrase). */
  confirmation?: ConfirmationLevel;
  /** Exact string the user must type for strong confirmation. */
  confirmPhrase?: string;
  /** Max runtime for the handler, ms. Default 30_000. */
  timeoutMs?: number;
  /** Coverage marker — id of the smoke check that exercises this action. */
  test?: string;
}

const registry = new Map<string, Action>();

export function registerAction(a: Action) {
  if (a.log === "compliance" && !a.category) {
    throw new Error(
      `[ActionRegistry] ${a.id} logs to compliance but has no category.`,
    );
  }
  if (a.confirmation === "strong" && !a.confirmPhrase) {
    throw new Error(
      `[ActionRegistry] ${a.id} requires strong confirmation but has no confirmPhrase.`,
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
    featureId: "settings.appearance",
    title: "Change theme",
    log: "operational",
  },
  {
    id: "settings.appearance.change",
    featureId: "settings.appearance",
    title: "Change appearance",
    log: "operational",
    description: "Theme, cursor, motion or performance preference update.",
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
    requiresPreview: true,
    confirmation: "strong",
    confirmPhrase: "revoke",
  },
  { id: "vault.setup", featureId: "settings.vault", title: "Set up Browser Vault", log: "operational",
    description: "Creates an AES-GCM data key wrapped by a passphrase or WebAuthn PRF." },
  { id: "vault.unlock", featureId: "settings.vault", title: "Unlock Browser Vault", log: "operational" },
  { id: "vault.lock", featureId: "settings.vault", title: "Lock Browser Vault", log: "operational" },
  { id: "vault.rotate", featureId: "settings.vault", title: "Rotate vault credential", log: "compliance",
    category: "role_change", description: "Re-wraps the data key with a fresh credential.",
    requiresPreview: true, confirmation: "confirm" },
  { id: "vault.recovery_used", featureId: "settings.vault", title: "Recovered vault with recovery kit", log: "compliance",
    category: "role_change", description: "One-time recovery kit was used to unlock the browser vault." },
  {
    id: "activity.clear_operational",
    featureId: "settings.activity",
    title: "Clear old operational activity",
    log: "operational",
    description: "Deletes the user's own activity_log rows older than 30 days.",
    requiresPreview: true,
    confirmation: "strong",
    confirmPhrase: "clear",
  },
  {

    id: "admin.launch_gate.update",
    featureId: "admin.launch_gate",
    title: "Update launch-gate item",
    log: "compliance",
    category: "approval",
    description: "Admin changed status, evidence, owner or blocker flag on a launch-gate item.",
    requiresPreview: true,
    confirmation: "confirm",
  },
  {
    id: "admin.feature_flag.upsert",
    featureId: "admin.launch_gate",
    title: "Update feature flag stage",
    log: "compliance",
    category: "approval",
    description: "Admin changed a feature flag's stage, applicable modules or enabled state. GA is refused while any required blocker is unresolved.",
    requiresPreview: true,
    confirmation: "strong",
    confirmPhrase: "activate",
  },
  { id: "ocade.chat.send", featureId: "ocade.chat", title: "Send OCADE message", log: "operational" },

  { id: "ocade.chat.regenerate", featureId: "ocade.chat", title: "Regenerate OCADE response", log: "operational" },
  { id: "ocade.chat.stop", featureId: "ocade.chat", title: "Stop OCADE response", log: "operational" },
  { id: "ocade.chat.improve_prompt", featureId: "ocade.chat", title: "Improve prompt", log: "operational" },
  { id: "ocade.conversation.new", featureId: "ocade.chat", title: "New OCADE conversation", log: "operational" },
  { id: "ocade.conversation.rename", featureId: "ocade.chat", title: "Rename OCADE conversation", log: "operational" },
  { id: "ocade.conversation.pin", featureId: "ocade.chat", title: "Pin OCADE conversation", log: "operational" },
  { id: "ocade.conversation.archive", featureId: "ocade.chat", title: "Archive OCADE conversation", log: "operational" },
  { id: "ocade.conversation.export", featureId: "ocade.chat", title: "Export OCADE conversation", log: "operational" },
  {
    id: "ocade.conversation.delete",
    featureId: "ocade.chat",
    title: "Delete OCADE conversation",
    log: "operational",
    description: "Permanently removes a conversation and its messages.",
    requiresPreview: true,
    confirmation: "strong",
    confirmPhrase: "delete",
  },
  {
    id: "ocade.chat.cloud_transfer_approved",
    featureId: "ocade.chat",
    title: "Approved cloud transfer for Browser Only chats",
    log: "compliance",
    category: "sensitive_export",
    description: "User acknowledged that a message stored under Browser Only privacy will be sent to a cloud model.",
  },
  { id: "ocade.model.change", featureId: "ocade.models", title: "Change OCADE model", log: "operational" },
];



for (const a of actions) registerAction(a);

// --------------- Writers ---------------

interface RecordArgs {
  actionId: string;
  metadata?: Record<string, unknown>;
  tenantId?: string | null;
}

/** Record an action against the correct log. Never throws to callers. */
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

// --------------- Executor ---------------

export interface ExecuteOpts<T> {
  run: () => Promise<T>;
  confirmed?: boolean;
  confirmPhrase?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string | null;
}

export class ActionConfirmationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ActionConfirmationError";
  }
}

/**
 * Runs an action handler with timeout + confirmation enforcement and
 * records success/failure to the appropriate log.
 */
export async function executeAction<T>(actionId: string, opts: ExecuteOpts<T>): Promise<T> {
  const a = registry.get(actionId);
  if (!a) throw new Error(`[ActionRegistry] unknown action id: ${actionId}`);

  const level: ConfirmationLevel = a.confirmation ?? "none";
  if (level !== "none" && !opts.confirmed) {
    throw new ActionConfirmationError(`Action "${a.id}" requires confirmation.`);
  }
  if (level === "strong" && a.confirmPhrase && opts.confirmPhrase !== a.confirmPhrase) {
    throw new ActionConfirmationError(
      `Action "${a.id}" requires typing the phrase "${a.confirmPhrase}" exactly.`,
    );
  }

  const timeoutMs = a.timeoutMs ?? 30_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race<T>([
      opts.run(),
      new Promise<T>((_res, rej) => {
        timer = setTimeout(
          () => rej(new Error(`Action "${a.id}" timed out after ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
    void recordAction({
      actionId,
      metadata: { ...(opts.metadata ?? {}), result: "success" },
      tenantId: opts.tenantId,
    });
    return value;
  } catch (e) {
    void recordAction({
      actionId,
      metadata: {
        ...(opts.metadata ?? {}),
        result: "failure",
        error: e instanceof Error ? e.message : String(e),
      },
      tenantId: opts.tenantId,
    });
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// --------------- Registry validation ---------------

export interface RegistryValidationIssue {
  kind: "feature_missing_action" | "action_missing_feature" | "compliance_no_category";
  id: string;
  message: string;
}

/**
 * Ensures the ActionRegistry and FeatureRegistry stay in sync.
 * - Every Action must reference a registered Feature.
 * - Every active/beta Feature (unless viewOnly) must have at least one Action.
 * Returns an empty array on success; the caller may throw on issues.
 */
export function validateRegistry(): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];

  for (const a of registry.values()) {
    if (!getFeature(a.featureId)) {
      issues.push({
        kind: "action_missing_feature",
        id: a.id,
        message: `Action "${a.id}" references unknown feature "${a.featureId}".`,
      });
    }
    if (a.log === "compliance" && !a.category) {
      issues.push({
        kind: "compliance_no_category",
        id: a.id,
        message: `Action "${a.id}" logs to compliance without a category.`,
      });
    }
  }

  const actionsByFeature = new Map<string, number>();
  for (const a of registry.values()) {
    actionsByFeature.set(a.featureId, (actionsByFeature.get(a.featureId) ?? 0) + 1);
  }
  for (const f of listFeatures()) {
    if (f.viewOnly) continue;
    if (f.status !== "active" && f.status !== "beta") continue;
    if ((actionsByFeature.get(f.id) ?? 0) === 0) {
      issues.push({
        kind: "feature_missing_action",
        id: f.id,
        message: `Feature "${f.id}" is ${f.status} but has no registered actions.`,
      });
    }
  }

  return issues;
}

// Development-time self-check. Throws in dev so broken registry surfaces
// immediately; logs only in production to avoid taking a live app down.
try {
  const issues = validateRegistry();
  if (issues.length > 0) {
    const msg = issues.map((i) => `  - ${i.message}`).join("\n");
    if (import.meta.env.DEV) {
      throw new Error(`[Registry] ${issues.length} issue(s):\n${msg}`);
    } else {
      console.error(`[Registry] ${issues.length} issue(s):\n${msg}`);
    }
  }
} catch (e) {
  if (import.meta.env.DEV) throw e;
}
