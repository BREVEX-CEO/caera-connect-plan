/**
 * THE REMAINING-GAP LEDGER, AND THE RULES THAT KEEP IT HONEST.
 *
 * PLAN.md §P asks for a ledger of the gaps still open against the product, with
 * a status for each and — crucially — a set of conditions that must FAIL
 * verification. Those conditions are the whole design: a checklist nobody can
 * fail is a document, and this repository already has enough documents.
 *
 * WHAT MAKES A LEDGER LIE, AND WHAT STOPS IT HERE:
 *
 *   "Implemented" claimed from a file existing. So an entry has to name the
 *   authority that implements it, and the generator refuses an entry whose
 *   named authority is not on disk.
 *
 *   "Runtime-proven" claimed from a passing unit test. So `RUNTIME-PROVEN`
 *   requires runtime evidence, and `TESTED` requires test evidence, and neither
 *   accepts the other's.
 *
 *   An external blocker used as a place to put unfinished work. So
 *   `EXTERNALLY-BLOCKED` requires the repository-controlled part to be
 *   complete AND the affected interface to have been verified as hidden or
 *   truthfully unavailable — both asserted, not assumed.
 *
 *   A generated report that has drifted from its source. So the Markdown is
 *   produced from this data and compared byte-for-byte in CI.
 *
 * The data lives here rather than in JSON so the rules can be typed and the
 * whole thing can be tested. `scripts/generate-remaining-gaps.mjs` writes the
 * two files PLAN.md names; `npm run gaps:check` fails when they are stale.
 */

export type GapStatus =
  "MISSING" | "IMPLEMENTED" | "TESTED" | "RUNTIME-PROVEN" | "EXTERNALLY-BLOCKED" | "NOT-APPLICABLE";

export type GapDisposition = "FIX" | "COMPLETE" | "MERGE" | "REPLACE" | "REMOVE";

export interface ExternalBlocker {
  /** The exact thing that is unavailable. Never a category. */
  dependency: string;
  /** Why it cannot be obtained or simulated here. */
  exactReason: string;
  /** Every repository-controlled part of the requirement is finished. */
  repositoryWorkComplete: boolean;
  /** The interface was checked and does not claim the capability works. */
  unavailableUiVerified: boolean;
}

export interface RemainingProductGap {
  id: string;
  area: string;
  requirement: string;
  /** Where this gap was found. Never "the plan says so" alone. */
  discoveredFrom: string;
  /** The module that owns this behaviour, or null when nothing does yet. */
  existingAuthority: string | null;
  disposition: GapDisposition;
  status: GapStatus;
  implementationEvidence: string[];
  testEvidence: string[];
  runtimeEvidence: string[];
  externalBlocker?: ExternalBlocker;
  lastVerifiedAt: string;
}

/** Statuses that assert the behaviour exists and is connected. */
const IMPLEMENTED_OR_BETTER: ReadonlySet<GapStatus> = new Set([
  "IMPLEMENTED",
  "TESTED",
  "RUNTIME-PROVEN",
]);

/**
 * Every rule PLAN.md §P says must FAIL verification.
 *
 * Returned as a list of problems rather than thrown one at a time, so a single
 * run reports everything wrong with the ledger instead of the first thing.
 */
export function validateGapLedger(
  gaps: readonly RemainingProductGap[],
  fileExists: (path: string) => boolean,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const gap of gaps) {
    const where = `${gap.id}`;

    // Duplicate gap.
    if (seen.has(gap.id)) problems.push(`${where}: duplicate id`);
    seen.add(gap.id);

    /*
     * AREA-001, where the area may carry a digit.
     *
     * The first version was `[A-Z]+-[0-9]{3}` and refused `A11Y-001` — the
     * clearest possible name for an accessibility gap. The rule exists to keep
     * ids readable and stop gibberish, not to ban a numeral inside a word
     * everybody already writes that way.
     */
    if (!/^[A-Z][A-Z0-9]*-[0-9]{3}$/.test(gap.id)) {
      problems.push(`${where}: id must look like AREA-001`);
    }
    // Missing reason. Every gap says where it was found, in words.
    if (gap.discoveredFrom.trim().length < 12) {
      problems.push(`${where}: discoveredFrom must say where this was found`);
    }
    if (gap.requirement.trim().length < 12) {
      problems.push(`${where}: requirement must state what is required`);
    }

    // Missing authority: anything claimed as built must name what builds it.
    if (IMPLEMENTED_OR_BETTER.has(gap.status) && !gap.existingAuthority) {
      problems.push(`${where}: status ${gap.status} without an existing authority`);
    }
    if (gap.existingAuthority && !fileExists(gap.existingAuthority)) {
      problems.push(`${where}: authority ${gap.existingAuthority} does not exist`);
    }

    /*
     * Implementation is never concluded from a file existing — §P says so
     * explicitly — so an implemented entry must cite something specific, and
     * each cited path must be real.
     */
    if (IMPLEMENTED_OR_BETTER.has(gap.status) && gap.implementationEvidence.length === 0) {
      problems.push(`${where}: status ${gap.status} without implementation evidence`);
    }
    // Runtime claims without evidence, and tested claims without tests.
    if (gap.status === "RUNTIME-PROVEN" && gap.runtimeEvidence.length === 0) {
      problems.push(`${where}: RUNTIME-PROVEN without runtime evidence`);
    }
    if (
      (gap.status === "TESTED" || gap.status === "RUNTIME-PROVEN") &&
      gap.testEvidence.length === 0
    ) {
      problems.push(`${where}: ${gap.status} without test evidence`);
    }
    // A gap that is still MISSING cannot also be claiming proof.
    if (gap.status === "MISSING" && gap.runtimeEvidence.length > 0) {
      problems.push(`${where}: MISSING but citing runtime evidence`);
    }
    if (gap.status === "NOT-APPLICABLE" && gap.discoveredFrom.trim().length < 12) {
      problems.push(`${where}: NOT-APPLICABLE without a concrete reason`);
    }

    // External blockers.
    if (gap.status === "EXTERNALLY-BLOCKED") {
      const blocker = gap.externalBlocker;
      if (!blocker) {
        problems.push(`${where}: EXTERNALLY-BLOCKED without an externalBlocker`);
      } else {
        if (blocker.dependency.trim().length < 6) {
          problems.push(`${where}: external blocker must name the exact dependency`);
        }
        if (blocker.exactReason.trim().length < 12) {
          problems.push(`${where}: external blocker must give the exact reason`);
        }
        if (!blocker.repositoryWorkComplete) {
          problems.push(`${where}: external blocker with repository work still incomplete`);
        }
        if (!blocker.unavailableUiVerified) {
          problems.push(`${where}: external blocker whose interface still claims availability`);
        }
      }
    } else if (gap.externalBlocker) {
      problems.push(`${where}: externalBlocker on a gap that is not EXTERNALLY-BLOCKED`);
    }

    // Every cited path must exist, or the citation proves nothing.
    for (const [label, paths] of [
      ["implementationEvidence", gap.implementationEvidence],
      ["testEvidence", gap.testEvidence],
    ] as const) {
      for (const path of paths) {
        if (isPath(path) && !fileExists(path)) {
          problems.push(`${where}: ${label} cites missing ${path}`);
        }
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(gap.lastVerifiedAt)) {
      problems.push(`${where}: lastVerifiedAt must be an ISO date`);
    }
  }

  return problems;
}

/**
 * Is this citation a repository path, or a command/description?
 *
 * Runtime evidence is often "npm run audit:routes:prod, 816/816" — a thing that
 * happened, not a file — and demanding a path for it would push people towards
 * citing a file that proves less.
 */
function isPath(value: string): boolean {
  return /^(src|scripts|supabase|release|native|extension|docs)\//.test(value);
}

/**
 * The open gaps.
 *
 * Each entry was established by doing the thing named in `discoveredFrom` —
 * reading the tree, running the suite, driving a browser — not by reading the
 * plan and assuming. An area absent from this list is an area whose PLAN
 * requirements were checked and found met, or one not yet examined; the mission
 * state file records which is which.
 */
export const REMAINING_PRODUCT_GAPS: readonly RemainingProductGap[] = [
  {
    id: "STATUS-001",
    area: "Status system (PLAN §K)",
    requirement:
      "Incident creation, timestamped incident history, maintenance scheduling and administrator incident controls.",
    discoveredFrom:
      "Repository inspection while building the status data authority: there was no incident store, and no route or table that could hold one. This gap was recorded as EXTERNALLY-BLOCKED on the reading that its persistence was Supabase work the mission owner had deferred. That reading was wrong: the deferral is specifically payments, refunds, billing, fraud controls, admin grants and custom entitlements, and Supabase work outside those has been in scope throughout. Nothing external was ever required, so it was built. Status SUBSCRIPTIONS are not part of this entry — PLAN.md §K holds them, with the independence claim, until an independent host exists, which is STATUS-002.",
    existingAuthority: "src/lib/status/catalogue.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904180000_status_incidents_and_maintenance.sql",
      "src/lib/status/incidents.ts",
      "src/lib/status/feed.ts",
      "src/routes/api/public/status.ts",
      "src/routes/status.tsx",
      "src/routes/_authenticated/admin.status.tsx",
    ],
    testEvidence: [
      "src/lib/status/__tests__/incidents.test.ts",
      "src/lib/status/__tests__/status-incident-schema.test.ts",
      "src/lib/status/__tests__/status-authority.test.ts",
      "supabase/verification/20260904180000_status_incidents_and_maintenance_verify.sql",
    ],
    runtimeEvidence: ["scripts/e2e/admin-operations-journey.mjs", "scripts/e2e/status-feed.mjs"],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "STATUS-002",
    area: "Status system (PLAN §K)",
    requirement: "An independently hosted status service on a separate domain.",
    discoveredFrom:
      "Repository inspection: every probe runs from OCADE's own origin, so a total outage takes the status page with it.",
    existingAuthority: "src/lib/status/catalogue.ts",
    disposition: "COMPLETE",
    status: "EXTERNALLY-BLOCKED",
    implementationEvidence: ["src/lib/status/catalogue.ts"],
    testEvidence: ["src/lib/status/__tests__/status-authority.test.ts"],
    runtimeEvidence: [],
    externalBlocker: {
      dependency: "An independent host and domain for the status service.",
      exactReason:
        "Independence cannot be simulated from inside the deployment being reported on; it requires infrastructure OCADE does not have.",
      repositoryWorkComplete: true,
      unavailableUiVerified: true,
    },
    lastVerifiedAt: "2026-09-03",
  },
  {
    id: "SUPPORT-001",
    area: "Help Center (PLAN §L)",
    requirement:
      "An administrator publishing workflow for help articles, with draft and published state editable outside the repository.",
    discoveredFrom:
      "The article model has carried a draft/published state since the Help Center was built, and the only way to change one was to edit a TypeScript file and ship it — a publishing workflow for engineers, which is not what §L asks for. This gap was recorded as EXTERNALLY-BLOCKED on the reading that its store was Supabase work the mission owner had deferred; that reading was wrong in the same way STATUS-001's was. The deferral is specifically payments, refunds, billing, fraud controls, admin grants and custom entitlements. Nothing external was required, so it was built.",
    existingAuthority: "src/lib/support/articles.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904190000_support_article_publishing.sql",
      "src/lib/support/catalogue.ts",
      "src/lib/support/use-catalogue.ts",
      "src/lib/admin/help-publishing.ts",
      "src/routes/_authenticated/admin.help.tsx",
      "src/routes/support.index.tsx",
      "src/routes/support.$slug.tsx",
      "src/routes/faq.tsx",
    ],
    testEvidence: [
      "src/lib/support/__tests__/catalogue.test.ts",
      "src/lib/support/__tests__/support-publishing-schema.test.ts",
      "supabase/verification/20260904190000_support_article_publishing_verify.sql",
    ],
    runtimeEvidence: ["scripts/e2e/admin-operations-journey.mjs"],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "SUPPORT-002",
    area: "Help Center (PLAN §L)",
    requirement: "Locale support for help articles beyond English.",
    discoveredFrom:
      "Repository inspection: every article declared locale 'en' — which is not a tag SUPPORTED_LOCALES recognises, so every comparison against a reader's locale was against a value that does not exist — and no article carried a translation. The mechanism is now complete: an article resolves to the reader's locale, falls back to the original when there is none, and says which it gave them. What remains is the TEXT.",
    existingAuthority: "src/lib/support/article-locales.ts",
    disposition: "COMPLETE",
    status: "EXTERNALLY-BLOCKED",
    implementationEvidence: [
      "src/lib/support/article-locales.ts",
      "src/lib/support/articles.ts",
      "src/routes/support.$slug.tsx",
      "src/routes/support.index.tsx",
    ],
    testEvidence: [
      "src/lib/support/__tests__/article-locales.test.ts",
      "src/lib/support/__tests__/help-center.test.ts",
    ],
    runtimeEvidence: [
      "scripts/e2e/help-center-journey.mjs — 24/24, including an untranslated article that says so, a translated one that does not apologise, and the Help Center stating coverage once",
    ],
    externalBlocker: {
      dependency:
        "A professional translator for each of Hindi, German, French, Spanish and Japanese, to write twenty-one help articles.",
      exactReason:
        "PLAN.md §26 settled that OCADE does not ship machine-translated interface text, and an article somebody reads while they are already stuck is the worst place to break that rule: a machine translation of 'OCADE never grants paid access from a redirect' that comes out slightly wrong is worse than English they can paste into a translator themselves, and the person affected is the one least able to tell OCADE it is wrong. Generating the text here would be fabricating the very evidence the requirement asks for.",
      repositoryWorkComplete: true,
      unavailableUiVerified: true,
    },
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "SECURITY-001",
    area: "Public security surface (PLAN §J)",
    requirement: "A verified security contact address on the OCADE domain.",
    discoveredFrom:
      "Repository inspection: no mailbox on the domain has been activated, and the support page already says so.",
    existingAuthority: "src/lib/security/public-posture.ts",
    disposition: "COMPLETE",
    status: "EXTERNALLY-BLOCKED",
    implementationEvidence: ["src/lib/security/public-posture.ts", "src/routes/security.tsx"],
    testEvidence: ["src/lib/security/__tests__/public-security-claims.test.ts"],
    runtimeEvidence: ["npm run audit:routes:prod covers /security signed out and signed in"],
    externalBlocker: {
      dependency: "An activated and delivery-verified mailbox on the OCADE domain.",
      exactReason:
        "Publishing an address nobody reads is worse than publishing none: the reporter believes they have told somebody, and nobody has been told.",
      repositoryWorkComplete: true,
      unavailableUiVerified: true,
    },
    lastVerifiedAt: "2026-09-03",
  },
  {
    id: "STORAGE-001",
    area: "Local data and model isolation (PLAN §A)",
    requirement:
      "Per-chat and per-selection deletion controls in Settings → Privacy, backed by the canonical local-data deletion authority.",
    discoveredFrom:
      "Repository inspection while building the deletion authority: the authority deletes by class, and the Privacy screen offered no per-selection control on top of it. Per-chat deletion already existed on the chat surface (deleteConversationLocally plus the server function beside it), which is where a person deletes one conversation; what was missing was the per-selection control on the privacy screen.",
    existingAuthority: "src/lib/device/local-data.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "src/lib/device/local-data.ts",
      "src/components/settings/LocalDataPanel.tsx",
    ],
    testEvidence: ["src/lib/device/__tests__/local-data-deletion.test.ts"],
    runtimeEvidence: [
      "npm run audit:settings against the production build: /settings/privacy renders the per-selection controls, 827/827 route checks signed in, 16/16 settings checks",
    ],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "DATA-001",
    area: "Data rights (PLAN §O)",
    requirement:
      "Machine-readable export of synchronised account data, and per-data-class deletion of account-held records.",
    discoveredFrom:
      "Repository inspection while completing account deletion: there is no export path at all, and deletion is all-or-nothing.",
    existingAuthority: "src/lib/account/data-rights.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "src/lib/account/data-classes.ts",
      "src/lib/account/data-rights.ts",
      "src/lib/account-data.functions.ts",
      "src/components/settings/AccountDataPanel.tsx",
    ],
    testEvidence: [
      "src/lib/account/__tests__/data-rights.test.ts",
      "src/lib/account/__tests__/data-rights-map.test.ts",
    ],
    runtimeEvidence: [
      "npm run audit:settings against the production build: /settings/privacy renders both panels, 827/827 route checks signed in, 544 controls pressed, 16/16 settings checks",
    ],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "DATA-002",
    area: "Data rights (PLAN §O)",
    requirement:
      "Transfer organization ownership before deleting an owner, and refuse deletion of the last owner.",
    discoveredFrom:
      "Recorded NOT-APPLICABLE while OCADE had no ownership model. Building one (ORG-001) made it applicable, and made it urgent: `ocade_organization_members.user_id` is ON DELETE CASCADE, so deleting an identity removes the membership with no OCADE code involved — silently leaving an organization with nobody who can administer it. The first `created_by` column made it worse in the other direction: NOT NULL ... ON DELETE RESTRICT refused the deletion at `auth.admin.deleteUser`, which the deletion path runs LAST, so the account would be gutted and then fail to be deleted.",
    existingAuthority: "src/lib/account.functions.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904140000_organization_ownership_before_account_deletion.sql",
      "src/lib/account.functions.ts",
      "src/components/settings/DeleteAccountCard.tsx",
      "src/lib/organizations/authority.ts",
    ],
    testEvidence: [
      "src/lib/organizations/__tests__/organization-schema.test.ts",
      "supabase/verification/20260904140000_organization_ownership_before_account_deletion_verify.sql",
    ],
    runtimeEvidence: ["scripts/e2e/organization-journey.mjs"],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "NOTIFY-001",
    area: "Notifications (PLAN §D)",
    requirement:
      "Cross-device synchronisation of notification preferences, notification history with read state, delivery state, duplicate collapse and dead-letter handling.",
    discoveredFrom:
      "Repository inspection while building the preference authority: preferences were stored on the device, and there was no record of what was delivered. The preference half is now synchronised through the account; the history half has a schema and no producer.",
    existingAuthority: "src/lib/notifications/preference-sync.ts",
    disposition: "COMPLETE",
    status: "TESTED",
    implementationEvidence: [
      "supabase/migrations/20260904090000_notification_preferences_and_history.sql",
      "src/lib/notifications/preference-sync.ts",
      "src/lib/notifications/supabase-backend.ts",
      "src/components/settings/NotificationPreferencesPanel.tsx",
    ],
    testEvidence: [
      "src/lib/notifications/__tests__/preference-sync.test.ts",
      "src/lib/notifications/__tests__/notification-schema.test.ts",
      "src/lib/notifications/__tests__/notification-preferences.test.ts",
    ],
    runtimeEvidence: [],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "NOTIFY-003",
    area: "Notifications (PLAN §D)",
    requirement:
      "Notification history a person can read: in-app list, unread state, mark one read, mark all read, delivery state per channel, and dead-letter handling for a delivery that never succeeds.",
    discoveredFrom:
      "Building the notification schema: the tables, the idempotent recorder and the two mark-read functions exist and are proven against Postgres, but nothing in the product writes a notification and no screen reads one. A history nobody writes to is a table, not a feature.",
    existingAuthority: "src/lib/notifications/send.server.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "src/lib/notifications/send.server.ts",
      "src/lib/notifications/delivery.ts",
      "src/lib/notifications/history.ts",
      "src/routes/_authenticated/ocade.notifications.tsx",
      "src/components/shell/NotificationBell.tsx",
      "src/lib/security/sessions.functions.ts",
      "src/lib/security/mfa.functions.ts",
    ],
    testEvidence: [
      "src/lib/notifications/__tests__/delivery-state.test.ts",
      "src/lib/notifications/__tests__/notification-senders.test.ts",
      "src/lib/notifications/__tests__/notification-schema.test.ts",
    ],
    runtimeEvidence: [
      "scripts/e2e/notification-history-journey.mjs",
      "scripts/e2e/run-notification-journey.mjs",
    ],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "NOTIFY-002",
    area: "Notifications (PLAN §D)",
    requirement:
      "Real delivery on web push, FCM and APNs, proven by receipt on a real browser and real devices.",
    discoveredFrom:
      "Repository inspection: no provider credentials are configured on this deployment, so every channel but in-app resolves as unavailable.",
    existingAuthority: "src/lib/notifications/channels.ts",
    disposition: "COMPLETE",
    status: "EXTERNALLY-BLOCKED",
    implementationEvidence: ["src/lib/notifications/channels.ts"],
    testEvidence: ["src/lib/notifications/__tests__/notification-preferences.test.ts"],
    runtimeEvidence: [],
    externalBlocker: {
      dependency:
        "Configured VAPID, FCM and APNs credentials, and physical Android and Apple devices to receive on.",
      exactReason:
        "PLAN.md §D forbids claiming push works because an abstraction exists; a receipt on a real device cannot be simulated from this repository.",
      repositoryWorkComplete: true,
      unavailableUiVerified: true,
    },
    lastVerifiedAt: "2026-09-03",
  },
  {
    id: "A11Y-001",
    area: "Accessibility runtime proof (PLAN §N)",
    requirement:
      "NVDA with Chrome on Windows, and VoiceOver with Safari on macOS, exercised against the required journeys.",
    discoveredFrom:
      "Running the accessibility journey: Chromium's accessibility tree is what a screen reader is given, but it is not evidence about how NVDA or VoiceOver speaks it.",
    existingAuthority: "scripts/e2e/accessibility-journey.mjs",
    disposition: "COMPLETE",
    status: "EXTERNALLY-BLOCKED",
    implementationEvidence: [
      "scripts/e2e/accessibility-journey.mjs",
      "scripts/check-accessibility.mjs",
    ],
    testEvidence: ["src/lib/__tests__/hidden-file-inputs.test.ts"],
    runtimeEvidence: [
      "npm run audit:settings runs the accessibility journey signed out and signed in",
    ],
    externalBlocker: {
      dependency:
        "A Windows host running NVDA with Chrome, and a macOS host running VoiceOver with Safari.",
      exactReason:
        "Neither screen reader runs on this Linux container, and how a reader speaks a page cannot be simulated from the accessibility tree without inventing the result.",
      repositoryWorkComplete: true,
      unavailableUiVerified: true,
    },
    lastVerifiedAt: "2026-09-03",
  },
  {
    id: "ORG-001",
    area: "Product hierarchy and team management (PLAN §4, §F)",
    requirement:
      "Organization administration at /organization: the organizations an account belongs to, its role in each, and member management where authorized.",
    discoveredFrom:
      "Building the route-disposition ledger §4 asks for: /organization is in §4's canonical table and nothing serves it. The schema has `tenants` and `tenant_members`, but they are FICIA's company-entity model — its roles are owner, manager, employee, accountant, auditor, consultant and advisor — so building OCADE's team surface on them would adopt another product's authority to make a route exist.",
    existingAuthority: "src/lib/organizations/authority.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904120000_ocade_organizations_and_membership.sql",
      "src/lib/organizations/model.ts",
      "src/lib/organizations/authority.ts",
      "src/lib/organizations/invite-token.ts",
      "src/routes/_authenticated/organization.tsx",
      "src/routes/invite.tsx",
    ],
    testEvidence: [
      "src/lib/organizations/__tests__/organization-schema.test.ts",
      "src/lib/organizations/__tests__/organization-model.test.ts",
      "supabase/verification/20260904120000_ocade_organizations_and_membership_verify.sql",
    ],
    runtimeEvidence: [
      "scripts/e2e/organization-journey.mjs",
      "scripts/e2e/run-organization-journey.mjs",
    ],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "ORG-002",
    area: "Session assurance for high-risk team actions (PLAN §B, §F, §G)",
    requirement:
      "Deleting an organization, handing it to somebody else, changing what a member may do and removing a member must require a strongly and recently authenticated session, enforced on the server.",
    discoveredFrom:
      "Tracing PLAN.md §G's 'recent reauthentication and AAL2' against the organization surface §F had just built. OCADE already had the rule — `assurance.ts`, pure and exhaustively tested — and enforced it with `requireAssurance(HIGH_RISK)` on every server function that does something irreversible. The organization mutations are RPCs the browser calls DIRECTLY through PostgREST, so no middleware ever ran in front of them: an unlocked laptop and ten seconds deleted a workspace. Two smaller defects came out with it. `SignInMethodsPanel` treated an `aal2` session as proof and skipped its password check, which is exactly the case `assurance.ts` documents — a session that answered a code this morning is fully assured and not recent — so a passer-by could move the address a password reset is sent to. And the danger zone cleared the typed confirmation on every refusal, including the one somebody is meant to answer and continue from.",
    existingAuthority: "src/lib/security/assurance.ts",
    disposition: "FIX",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904150000_high_risk_organization_actions_require_recent_strong_auth.sql",
      "src/lib/security/reauthentication.ts",
      "src/lib/organizations/authority.ts",
      "src/routes/_authenticated/organization.tsx",
      "src/components/settings/SignInMethodsPanel.tsx",
      "src/routes/_authenticated/settings.security.tsx",
    ],
    testEvidence: [
      "src/lib/organizations/__tests__/organization-assurance.test.ts",
      "src/lib/security/__tests__/reauthentication.test.ts",
      "supabase/verification/20260904150000_high_risk_organization_actions_require_recent_strong_auth_verify.sql",
      "src/lib/auth/__tests__/account-safety.test.ts",
    ],
    runtimeEvidence: ["scripts/e2e/organization-journey.mjs"],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "ORG-003",
    area: "Organization capability and connector policy (PLAN §21, §G)",
    requirement:
      "An organization must be able to withhold capabilities and whole tool areas from its members, enforced where OCADE acts and visible to the people it governs.",
    discoveredFrom:
      "PLAN.md §21 lists 'capability policy' and 'connector tool permissions'; §G asks the admin panel to manage them. Nothing served either. Two vocabularies already existed and neither was a policy: `capabilities/registry.ts` answers whether a capability works on THIS DEVICE, and `agent/domains.ts` groups the tools the router loads. The policy is expressed in exactly those, so an administrator withholding 'Computer control' withholds the thing a person sees named that, and withholding an area removes a coherent set rather than a list of tool names that goes stale the day one is added.",
    existingAuthority: "src/lib/organizations/authority.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904160000_organization_capability_and_tool_policies.sql",
      "src/lib/organizations/policy.ts",
      "src/lib/organizations/policy.server.ts",
      "src/lib/organizations/authority.ts",
      "src/lib/capabilities/use-capabilities.ts",
      "src/lib/agent/loop.ts",
      "src/lib/agent.functions.ts",
      "src/lib/work/use-mission.ts",
      "src/routes/_authenticated/organization.tsx",
    ],
    testEvidence: [
      "src/lib/organizations/__tests__/organization-policy.test.ts",
      "src/lib/organizations/__tests__/organization-schema.test.ts",
      "src/lib/organizations/__tests__/organization-assurance.test.ts",
      "src/lib/__tests__/agent-loop.test.ts",
      "supabase/verification/20260904160000_organization_capability_and_tool_policies_verify.sql",
    ],
    runtimeEvidence: ["scripts/e2e/organization-journey.mjs"],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "ADMIN-001",
    area: "Admin operations console (PLAN §G)",
    requirement:
      "The admin panel must show a usage overview, commercial-usage windows, the organization audit log and notification delivery status, with authorized exports, and give ordinary users neither the route content nor the underlying data.",
    discoveredFrom:
      "Tracing §G's list against /admin. Four screens existed — accounts, support, launch gate, payments checklist — and none of these four surfaces did. The data was not merely unrendered: usage, and the organization audit log outside one's own workspaces, were unreadable by any role, so the screens could not have been written without granting the reads first. Notification delivery was the one that had to be shaped differently: answering 'is delivery working?' from raw rows would hand an operator every title and body in the deployment, so it is an aggregate over categories, channels and states with no admin policy on the table for anything else to fall back to.",
    existingAuthority: "src/lib/admin/route-gate.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "supabase/migrations/20260904170000_admin_operations_read_surfaces.sql",
      "src/lib/admin/operations.ts",
      "src/routes/_authenticated/admin.operations.tsx",
      "src/routes/_authenticated/admin.index.tsx",
      "src/lib/release/route-dispositions.ts",
    ],
    testEvidence: [
      "src/lib/admin/__tests__/operations.test.ts",
      "src/lib/admin/__tests__/admin-operations-schema.test.ts",
      "supabase/verification/20260904170000_admin_operations_read_surfaces_verify.sql",
    ],
    runtimeEvidence: [
      "scripts/e2e/admin-operations-journey.mjs",
      "scripts/e2e/run-admin-operations-journey.mjs",
    ],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "ADMIN-002",
    area: "Admin billing and payment-event surfaces (PLAN §G)",
    requirement: "The admin panel must show a billing and seat overview and payment-event state.",
    discoveredFrom:
      "The rest of §G's list is served by /admin/operations. These two are not, and the reason is a defect underneath them rather than a missing screen: the deployment carries TWO subscription tables written by two different paths. `subscriptions` is what the Paddle webhook and `payments.functions.ts` write; `ocade_subscriptions` is what `entitlement-resolver.ts` reads to decide a tier. A billing overview has to read one of them, and picking one asserts an answer to the question §H's payments work exists to settle — so a screen built now would either be confidently wrong or would have to be rebuilt immediately.",
    existingAuthority: "src/lib/commercial/entitlement-resolver.ts",
    disposition: "FIX",
    // MISSING, and honestly so. It is sequenced with the §H payments work
    // rather than blocked by anything outside the repository, and marking it
    // anything else would let the final gate pass over a §G requirement that
    // has not been built. No admin read was granted on `ocade_payment_events`
    // or `ocade_invoices` in the meantime, and the operations migration's
    // verification asserts that none was — so nothing here has to be undone
    // when the payments work picks it up.
    status: "MISSING",
    implementationEvidence: [
      "supabase/migrations/20260904170000_admin_operations_read_surfaces.sql",
    ],
    testEvidence: [
      "supabase/verification/20260904170000_admin_operations_read_surfaces_verify.sql",
    ],
    runtimeEvidence: [],
    lastVerifiedAt: "2026-09-04",
  },
  {
    id: "CHAT-001",
    area: "Chat parity (PLAN §8)",
    requirement:
      "Incognito conversations excluded from ordinary history and memory, and memory import and export.",
    discoveredFrom:
      "Surveying §8's list against the chat surface. `incognito` appeared nowhere in Chat — only in the browser-control policy, which is a different thing — and the memory panel offered review, edit, pause, reset and deletion but neither of the two that let somebody carry what OCADE knows about them or check it. Both are privacy requirements whose partial versions are the dangerous ones: a conversation kept out of the sidebar whose messages sit in the vault, and an export read from the screen rather than from the authority, which on a PAUSED memory would have produced an empty file and reported 'Exported 0 memories' as the answer to 'what does OCADE know about me'.",
    existingAuthority: "src/lib/ocade-chat-store.ts",
    disposition: "COMPLETE",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "src/lib/chat/incognito.ts",
      "src/lib/ocade-chat-store.ts",
      "src/lib/runtime/use-ocade-runtime.ts",
      "src/routes/_authenticated/ocade.index.tsx",
      "src/lib/memory/portable.ts",
      "src/components/settings/MemoryPanel.tsx",
    ],
    testEvidence: [
      "src/lib/chat/__tests__/incognito.test.ts",
      "src/lib/memory/__tests__/portable.test.ts",
      "src/lib/__tests__/hidden-file-inputs.test.ts",
    ],
    runtimeEvidence: [
      "scripts/e2e/incognito-and-memory-journey.mjs",
      "scripts/e2e/run-incognito-and-memory-journey.mjs",
    ],
    lastVerifiedAt: "2026-09-05",
  },
  {
    id: "PERF-002",
    area: "Performance (PLAN §26)",
    requirement:
      "The landing route must keep Total Blocking Time under 200 ms at four-times CPU throttling.",
    discoveredFrom:
      "npm run audit:web-vitals against the production build measured 2,705 ms of blocking time on /, against 64 ms on /pricing and 0 ms on /support. Four causes were isolated in the browser and fixed. The hero scene built a WebGL system on a software rasteriser. Offline Intelligence began preparing for visitors who were not signed in. The entry chunk statically imported 203 KiB of Supabase — through `auth-middleware`, which `start.ts` registers globally, and then through `tslib`, which had no chunk group of its own and was pulled into the Supabase chunk, so the entry imported all of it to reach three helper functions with a provably clean source graph. And the particle intro was 563 ms of self time inside the first-paint window, for an animation whose brand mark and heading are both real DOM beneath it.",
    existingAuthority: "scripts/check-asset-budgets.mjs",
    disposition: "FIX",
    status: "RUNTIME-PROVEN",
    implementationEvidence: [
      "src/lib/session.ts",
      "src/integrations/supabase/configuration.ts",
      "src/integrations/supabase/auth-middleware.ts",
      "src/components/landing/ParticleLogoIntro.tsx",
      "vite.config.ts",
      "scripts/check-asset-budgets.mjs",
    ],
    testEvidence: [
      "npm run performance:budget — asserts the Supabase chunk is not in the entry graph, fault-injected by removing the tslib chunk group",
    ],
    runtimeEvidence: [
      "scripts/e2e/web-vitals.mjs — 12/12, / TBT 186 ms at four-times CPU throttling, down from 2,705 ms",
    ],
    lastVerifiedAt: "2026-09-04",
  },
];
