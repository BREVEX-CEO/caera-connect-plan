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
  | "data_change"
  | "consent"
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
  {
    id: "admin.country_pack.update_version",
    featureId: "admin.country_packs",
    title: "Update country-pack version",
    log: "compliance",
    category: "approval",
    description: "Admin edited rules, effective dates, applicability or pilot evidence on a country-pack version.",
    requiresPreview: true,
    confirmation: "confirm",
  },
  {
    id: "admin.country_pack.add_source",
    featureId: "admin.country_packs",
    title: "Add rule source reference",
    log: "compliance",
    category: "approval",
    description: "Admin attached a statute / notification / circular citation to a rule.",
  },
  {
    id: "admin.country_pack.add_review",
    featureId: "admin.country_packs",
    title: "Submit professional pack review",
    log: "compliance",
    category: "approval",
    description: "Licensed reviewer signed off (or requested changes) on a country-pack version.",
    requiresPreview: true,
    confirmation: "strong",
    confirmPhrase: "sign",
  },
  {
    id: "admin.country_pack.run_tests",
    featureId: "admin.country_packs",
    title: "Run historical test harness",
    log: "operational",
    description: "Runs every historical test case for a country-pack version against its pinned rules.",
  },
  {
    id: "admin.country_pack.promote",
    featureId: "admin.country_packs",
    title: "Promote country-pack version",
    log: "compliance",
    category: "approval",
    description: "Advances a country-pack version stage. GA is blocked by DB trigger without approved review, pilot evidence and passing tests.",
    requiresPreview: true,
    confirmation: "strong",
    confirmPhrase: "promote",
  },
  {
    id: "ficia.company.create",
    featureId: "ficia.company",
    title: "Create company",
    log: "compliance",
    category: "approval",
    description: "Creates a company tenant, marks the current user as owner and records legal identity.",
    requiresPreview: true,
    confirmation: "confirm",
  },
  {
    id: "ficia.company.update",
    featureId: "ficia.company",
    title: "Update company profile",
    log: "compliance",
    category: "approval",
    description: "Edits legal identity or profile fields on a company the caller owns.",
    requiresPreview: true,
    confirmation: "confirm",
  },
  {
    id: "ficia.access.request",
    featureId: "ficia.access",
    title: "Request access to an existing company",
    log: "compliance",
    category: "approval",
    description: "Sends a pending access request to the target company's owner.",
  },
  {
    id: "ficia.access.decide",
    featureId: "ficia.access",
    title: "Decide access request",
    log: "compliance",
    category: "approval",
    description: "Owner approves or rejects a pending access request.",
    requiresPreview: true,
    confirmation: "confirm",
  },
  // FICIA people
  { id: "ficia.people.invite", featureId: "ficia.people", title: "Invite person", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.people.suspend", featureId: "ficia.people", title: "Suspend person", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "confirm", description: "Immediately removes tenant access." },
  { id: "ficia.people.terminate", featureId: "ficia.people", title: "Terminate person", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "strong", confirmPhrase: "TERMINATE" },
  { id: "ficia.people.restore", featureId: "ficia.people", title: "Restore person", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.org.create", featureId: "ficia.people", title: "Create department / team / location", log: "operational" },
  // FICIA roles
  { id: "ficia.roles.upsert", featureId: "ficia.roles", title: "Create or edit custom role", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.roles.grant", featureId: "ficia.roles", title: "Grant role to user", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.roles.revoke", featureId: "ficia.roles", title: "Revoke role from user", log: "compliance", category: "role_change", requiresPreview: true, confirmation: "confirm" },
  // FICIA approvals
  { id: "ficia.approvals.policy_upsert", featureId: "ficia.approvals", title: "Create or edit approval policy", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.approvals.submit", featureId: "ficia.approvals", title: "Submit for approval", log: "compliance", category: "approval" },
  { id: "ficia.approvals.approve", featureId: "ficia.approvals", title: "Approve request", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.approvals.reject", featureId: "ficia.approvals", title: "Reject request", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.approvals.release", featureId: "ficia.approvals", title: "Release approved request", log: "compliance", category: "approval", requiresPreview: true, confirmation: "strong", confirmPhrase: "RELEASE" },
  { id: "ficia.approvals.sod_override", featureId: "ficia.approvals", title: "Segregation-of-duties override", log: "compliance", category: "approval", requiresPreview: true, confirmation: "strong", confirmPhrase: "OVERRIDE", description: "Documented override — requires reason and appears in compliance audit." },
  // FICIA messenger
  { id: "ficia.messenger.thread.create", featureId: "ficia.messenger", title: "Create messenger thread", log: "operational" },
  { id: "ficia.messenger.thread.update", featureId: "ficia.messenger", title: "Update thread settings", log: "operational" },
  { id: "ficia.messenger.member.add", featureId: "ficia.messenger", title: "Add thread member", log: "operational" },
  { id: "ficia.messenger.member.remove", featureId: "ficia.messenger", title: "Remove thread member", log: "compliance", category: "role_change" },
  { id: "ficia.messenger.send", featureId: "ficia.messenger", title: "Send message", log: "operational" },
  { id: "ficia.messenger.edit", featureId: "ficia.messenger", title: "Edit message", log: "operational" },
  { id: "ficia.messenger.delete", featureId: "ficia.messenger", title: "Delete message", log: "compliance", category: "data_change", requiresPreview: true, confirmation: "confirm", description: "Company message retention governs whether authors can delete after 30 days." },
  { id: "ficia.messenger.attachment", featureId: "ficia.messenger", title: "Attach file or voice note", log: "operational" },
  { id: "ficia.messenger.pin", featureId: "ficia.messenger", title: "Pin or unpin message", log: "operational" },
  { id: "ficia.messenger.link_action", featureId: "ficia.messenger", title: "Link message to task, approval or evidence", log: "compliance", category: "data_change" },
  { id: "ficia.messenger.convert_approval", featureId: "ficia.messenger", title: "Convert message to approval request", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.messenger.cross_company.request", featureId: "ficia.messenger", title: "Request cross-company access", log: "compliance", category: "consent", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.messenger.cross_company.decide", featureId: "ficia.messenger", title: "Approve or reject cross-company access", log: "compliance", category: "consent", requiresPreview: true, confirmation: "confirm" },

  // FICIA Timesheets & Attendance
  { id: "ficia.time.policy.save", featureId: "ficia.timesheet", title: "Save timesheet policy", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm", description: "Owner or manager edited workdays, shifts, breaks, holidays, overtime, idle threshold or billable defaults." },
  { id: "ficia.time.project.upsert", featureId: "ficia.timesheet", title: "Create or edit project", log: "operational" },
  { id: "ficia.time.task.upsert", featureId: "ficia.timesheet", title: "Create or edit task", log: "operational" },
  { id: "ficia.time.consent.save", featureId: "ficia.timesheet", title: "Record timesheet consent", log: "compliance", category: "consent", requiresPreview: true, confirmation: "confirm", description: "Employee accepted or updated activity monitoring and auto-pause terms. Screen recording remains per-session opt-in." },
  { id: "ficia.time.consent.revoke", featureId: "ficia.timesheet", title: "Revoke timesheet consent", log: "compliance", category: "consent", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.time.clock_in", featureId: "ficia.timesheet", title: "Clock in", log: "operational" },
  { id: "ficia.time.clock_out", featureId: "ficia.timesheet", title: "Clock out", log: "operational" },
  { id: "ficia.time.break_start", featureId: "ficia.timesheet", title: "Start break", log: "operational" },
  { id: "ficia.time.break_end", featureId: "ficia.timesheet", title: "End break", log: "operational" },
  { id: "ficia.time.manual_entry", featureId: "ficia.timesheet", title: "Add manual time entry", log: "operational", description: "Manual entries require a description and are marked as manual source in the audit trail." },
  { id: "ficia.time.entry.update", featureId: "ficia.timesheet", title: "Update time entry", log: "operational" },
  { id: "ficia.time.entry.delete", featureId: "ficia.timesheet", title: "Delete draft time entry", log: "operational", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.time.entry.submit", featureId: "ficia.timesheet", title: "Submit time entries for approval", log: "compliance", category: "approval", description: "Employee submitted one or more draft entries for manager review." },
  { id: "ficia.time.entry.approve", featureId: "ficia.timesheet", title: "Approve time entry", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.time.entry.reject", featureId: "ficia.timesheet", title: "Reject time entry", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.time.entry.request_correction", featureId: "ficia.timesheet", title: "Request correction on time entry", log: "compliance", category: "approval", requiresPreview: true, confirmation: "confirm" },
  { id: "ficia.time.period.lock", featureId: "ficia.timesheet", title: "Lock timesheet period", log: "compliance", category: "approval", requiresPreview: true, confirmation: "strong", confirmPhrase: "LOCK", description: "Locks every approved entry inside the date range. Locked entries cannot be edited or deleted." },
  { id: "ficia.time.activity_samples", featureId: "ficia.timesheet", title: "Record activity samples", log: "operational", description: "Consent-gated active/idle/minimized/closed samples. Refused server-side without an active consent row." },
  { id: "ficia.time.auto_pause", featureId: "ficia.timesheet", title: "Auto-pause running timer", log: "operational", description: "Timer was auto-stopped at the last active moment because idle exceeded the company threshold." },
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
  { id: "ocade.providers.save_prefs", featureId: "ocade.models", title: "Save OCADE provider preferences", log: "operational" },
  { id: "ocade.providers.test_connection", featureId: "ocade.models", title: "Test OCADE provider connection", log: "operational" },
  { id: "ocade.providers.set_bridge_url", featureId: "ocade.models", title: "Set Ollama local bridge URL", log: "operational" },
  { id: "ocade.providers.enable_openai_direct", featureId: "ocade.models", title: "Enable OpenAI Direct", log: "operational" },

  // CANIA
  { id: "cania.topic.save", featureId: "cania.topics", title: "Save CANIA topic", log: "operational" },
  { id: "cania.topic.delete", featureId: "cania.topics", title: "Delete CANIA topic", log: "operational" },
  { id: "cania.alert.create", featureId: "cania.alerts", title: "Create CANIA alert", log: "operational" },
  { id: "cania.alert.toggle", featureId: "cania.alerts", title: "Toggle CANIA alert", log: "operational" },
  { id: "cania.alert.delete", featureId: "cania.alerts", title: "Delete CANIA alert", log: "operational" },
  { id: "cania.settings.save", featureId: "cania.settings", title: "Save CANIA settings", log: "operational" },
  { id: "cania.location.grant", featureId: "cania.settings", title: "Grant CANIA location", log: "operational",
    description: "User granted the browser geolocation permission for CANIA weather and traffic." },

  // MADEE Resume Builder
  { id: "madee.resume.create", featureId: "madee.resume", title: "Create resume project", log: "operational",
    description: "New resume project, requires owner attestation before insert." },
  { id: "madee.resume.upload_parse", featureId: "madee.resume", title: "Parse uploaded resume", log: "operational" },
  { id: "madee.resume.save_version", featureId: "madee.resume", title: "Save resume version", log: "operational" },
  { id: "madee.resume.rename_version", featureId: "madee.resume", title: "Rename resume version", log: "operational" },
  { id: "madee.resume.duplicate", featureId: "madee.resume", title: "Duplicate resume project", log: "operational" },
  { id: "madee.resume.delete_version", featureId: "madee.resume", title: "Delete resume version", log: "operational",
    confirmation: "confirm",
    description: "Removes one version. Other versions remain." },
  { id: "madee.resume.delete_project", featureId: "madee.resume", title: "Delete resume project", log: "compliance",
    category: "deletion", confirmation: "strong", confirmPhrase: "delete resume",
    description: "Permanently deletes the project and every version." },
  { id: "madee.resume.export_pdf", featureId: "madee.resume", title: "Export resume as PDF", log: "operational" },
  { id: "madee.resume.export_docx", featureId: "madee.resume", title: "Export resume as DOCX", log: "operational" },
  { id: "madee.resume.ai_bullet", featureId: "madee.resume_ai", title: "AI: improve bullet", log: "operational" },
  { id: "madee.resume.ai_summary", featureId: "madee.resume_ai", title: "AI: draft summary", log: "operational" },
  { id: "madee.resume.ai_grammar", featureId: "madee.resume_ai", title: "AI: grammar check", log: "operational" },
  { id: "madee.resume.ai_ats", featureId: "madee.resume_ai", title: "AI: ATS review", log: "operational" },
  { id: "madee.resume.ai_jd_match", featureId: "madee.resume_ai", title: "AI: job description match", log: "operational" },
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
