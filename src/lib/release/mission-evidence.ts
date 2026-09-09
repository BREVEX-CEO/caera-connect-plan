/**
 * Executable continuation map for every semantic block in PLAN.md.
 *
 * Individual records inherit a section status. That status is intentionally
 * called `sectionProgress`: it accounts for the requirement and its owner but
 * does not pretend every sentence in a partially proven section has itself
 * been runtime-proven. Feature-level claims remain in the parity, route, gap,
 * donor, and final verification ledgers composed by the generator.
 */

export type MissionProgress = "COMPLETE" | "PARTIAL" | "NOT_STARTED";
export type MissionProofLevel =
  | "SPECIFIED"
  | "SOURCE_PRESENT"
  | "STATICALLY_REACHABLE"
  | "TESTED"
  | "RUNTIME_PROVEN"
  | "EXTERNALLY_BLOCKED"
  | "HIDDEN"
  | "NOT_APPLICABLE";

export interface MissionSectionState {
  section: string;
  continuationBlock: number;
  sectionProgress: MissionProgress;
  proofLevel: MissionProofLevel;
  currentAuthority: string;
  evidence: string[];
  evidenceTarget: string;
  remainingAction: string;
}

export interface ExtractedPlanRequirement extends MissionSectionState {
  id: string;
  planLine: number;
  sectionTitle: string;
  subsectionTitle?: string;
  kind: "paragraph" | "bullet" | "ordered" | "table-row";
  requirement: string;
  proofLevelScope: "section";
}

const section = (
  sectionId: string,
  continuationBlock: number,
  sectionProgress: MissionProgress,
  proofLevel: MissionProofLevel,
  currentAuthority: string,
  evidence: string[],
  evidenceTarget: string,
  remainingAction: string,
): MissionSectionState => ({
  section: sectionId,
  continuationBlock,
  sectionProgress,
  proofLevel,
  currentAuthority,
  evidence,
  evidenceTarget,
  remainingAction,
});

const LEGACY_MISSION_SECTION_STATES: readonly MissionSectionState[] = [
  section(
    "1",
    29,
    "PARTIAL",
    "SOURCE_PRESENT",
    "PLAN.md",
    ["docs/mission/OCADE_EXECUTION_STATE.md"],
    "Block 29C complete final receipt",
    "Keep the mission interpretation enforced through the final integration.",
  ),
  section(
    "2",
    29,
    "PARTIAL",
    "TESTED",
    "PLAN.md",
    ["docs/mission/OCADE_EXECUTION_STATE.md"],
    "Block 29C clean-tree and Git proof",
    "Continue checkpoint discipline, preserve user work, and enforce the external-action boundaries.",
  ),
  section(
    "3",
    2,
    "COMPLETE",
    "TESTED",
    "src/lib/release/product-reference-parity.ts",
    ["docs/product-reference/OCADE_REFERENCE_PARITY.json"],
    "Regenerate immediately before release",
    "Keep the dated official-source ledger current as reference products change.",
  ),
  section(
    "4",
    2,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/release/route-dispositions.ts",
    ["release/checklists/OCADE_ROUTE_DISPOSITIONS.json", "scripts/e2e/route-qa.mjs"],
    "Blocks 5, 21, and 29C route matrix",
    "Complete every MIGRATE/ABSORB route and remove obsolete emitted chunks after callers move.",
  ),
  section(
    "5",
    1,
    "COMPLETE",
    "RUNTIME_PROVEN",
    "src/lib/release/route-dispositions.ts",
    ["src/lib/__tests__/demo-removal.test.ts", "scripts/e2e/customer-journey.mjs"],
    "Block 29C final demo-absence scan",
    "Preserve complete demo removal and prevent anonymous generation bypasses from returning.",
  ),
  section(
    "6",
    4,
    "PARTIAL",
    "SOURCE_PRESENT",
    "src/lib/runtime/execute.ts",
    ["src/lib/__tests__/production-reachability.test.ts"],
    "Block 4 import-boundary graph",
    "Move dependency-closed authorities incrementally and reject duplicate architectural islands.",
  ),
  section(
    "7",
    17,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/components/ocade/chat/ChatComposer.tsx",
    ["src/lib/__tests__/chat-ui.test.tsx", "scripts/e2e/customer-journey.mjs"],
    "Blocks 17 and 18 shared-composer journeys",
    "Finish mode continuity, attachments, tool state, mobile behavior, and task/project context.",
  ),
  section(
    "8",
    17,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/routes/_authenticated/ocade.index.tsx",
    ["src/lib/chat/conversation-sharing.ts", "docs/mission/OCADE_EXECUTION_STATE.md"],
    "Block 17 complete Chat customer journey",
    "Wire the completed Chat features to final usage, intelligence, storage, project, and sync authorities.",
  ),
  section(
    "9",
    18,
    "PARTIAL",
    "TESTED",
    "src/lib/work/use-mission.ts",
    ["src/routes/_authenticated/ocade.cowork.tsx", "src/lib/__tests__/mission-modes.test.ts"],
    "Block 18 resilient mission runtime proof",
    "Complete observation, permission, action, re-observation, verification, recovery, and control transitions.",
  ),
  section(
    "10",
    19,
    "PARTIAL",
    "TESTED",
    "src/lib/code/workspace.ts",
    ["src/lib/__tests__/code-workspace.test.ts"],
    "Block 19 temporary-repository runtime journey",
    "Replace sample wiring with real persistence, Git, LSP, terminal, task, project, and artifact flows.",
  ),
  section(
    "11",
    14,
    "PARTIAL",
    "TESTED",
    "src/lib/automation-worker-host.ts",
    ["src/lib/__tests__/automation-worker-host.test.ts"],
    "Block 14 multi-device RemoteExecutor harness",
    "Complete claims, heartbeats, capabilities, reconnect, cancellation, receipts, and partial-success recovery.",
  ),
  section(
    "12",
    5,
    "PARTIAL",
    "TESTED",
    "src/lib/ocade-identity.ts",
    ["src/lib/__tests__/ocade-identity.test.ts"],
    "Block 5 all-backend identity matrix",
    "Use the exact canonical identity through every online, local, native, and fallback path.",
  ),
  section(
    "13",
    6,
    "PARTIAL",
    "TESTED",
    "src/lib/commercial/generation-gate.ts",
    ["src/lib/commercial/__tests__/generation-gate.test.ts"],
    "Block 6 concurrent server-backed dual-window proof",
    "Replace in-memory paid accounting with atomic Free and percentage-only Pro/Max session-plus-weekly authority.",
  ),
  section(
    "14",
    8,
    "PARTIAL",
    "TESTED",
    "src/lib/commercial/use-generation-permit.ts",
    ["src/lib/commercial/__tests__/every-ai-surface-is-gated.test.ts"],
    "Block 8 complete AI call-graph proof",
    "Require one permit before every intelligence path and preserve it across retry, tool loops, and fallback.",
  ),
  section(
    "15",
    7,
    "PARTIAL",
    "SOURCE_PRESENT",
    "src/lib/time/trusted-clock.ts",
    ["src/lib/time/__tests__/trusted-clock.test.ts"],
    "Block 7 signed lease concurrency and reconciliation proof",
    "Add signed device allocations, local atomic counters, trusted-time rollback lock, refill, return, and reconciliation.",
  ),
  section(
    "16",
    9,
    "PARTIAL",
    "TESTED",
    "src/lib/engine/resolve.ts",
    ["src/lib/__tests__/engine-routing-single-policy.test.ts"],
    "Block 9 online/local/fallback runtime matrix",
    "Converge every backend on OcadeIntelligence and add the secure authenticated online server boundary.",
  ),
  section(
    "17",
    10,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/brain/installation-authority.ts",
    ["scripts/e2e/customer-journey.mjs", "src/routes/__root.tsx"],
    "Block 10 authenticated automatic-preparation journey",
    "Retain non-blocking automatic preparation and finish pause, cancellation, resume, and verified activation.",
  ),
  section(
    "18",
    10,
    "PARTIAL",
    "TESTED",
    "src/lib/brain/browser-catalogue.ts",
    ["release/OCADE_BROWSER_MODEL_CATALOGUE.json"],
    "Block 10 technical benchmark plus separate compliance gate",
    "Select by technical score only while keeping distribution and compliance as an independent release gate.",
  ),
  section(
    "19",
    10,
    "PARTIAL",
    "TESTED",
    "src/lib/brain/model-transfer.ts",
    ["src/lib/brain/__tests__/model-transfer.test.ts"],
    "Block 10 real bandwidth, interruption, mirror, and zero-redownload proof",
    "Implement the final adaptive 2–8 range, 8–32 MiB chunk, OPFS, hashing, mirror-failover contract.",
  ),
  section(
    "20",
    24,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/native/automation-observer.ts",
    ["extension/tests/cowork-e2e.mjs", "release/OCADE_WINDOWS_PROOF_EVIDENCE.json"],
    "Blocks 24 and 25 user-browser and native journeys",
    "Complete context reacquisition and consolidate semantic browser/native control before guarded coordinates.",
  ),
  section(
    "21",
    27,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/organizations/authority.ts",
    [
      "src/lib/organizations/__tests__/organization-model.test.ts",
      "scripts/e2e/run-organization-journey.mjs",
    ],
    "Block 27 complete owner/admin/member matrix",
    "Finish groups, roles, policies, audit/export, deactivation, seats, and tenant-isolated administration.",
  ),
  section(
    "22",
    29,
    "PARTIAL",
    "TESTED",
    "src/lib/payments/pricing.ts",
    ["src/lib/payments/__tests__/webhook-apply.test.ts"],
    "Block 29A sandbox and no-charge commercial matrix",
    "Reconcile subscription tables and complete verified payment, refund, fraud, history, and admin-grant flows last.",
  ),
  section(
    "23",
    15,
    "PARTIAL",
    "TESTED",
    "src/integrations/supabase/types.ts",
    ["src/lib/__tests__/security-definer.test.ts"],
    "Block 15 live migration, RLS, advisor, auth, and types proof",
    "Reconcile source/live migrations and remove unsafe grants and callable elevated functions without reapplying history.",
  ),
  section(
    "24",
    5,
    "PARTIAL",
    "TESTED",
    "src/styles.css",
    ["src/lib/__tests__/palette.test.ts"],
    "Blocks 5 and 29B static plus screenshot chroma audits",
    "Create the canonical monochrome tokens and remove customer-facing hue from every rendered asset and state.",
  ),
  section(
    "25",
    3,
    "PARTIAL",
    "TESTED",
    "scripts/generate-integration-report.mjs",
    ["imports/ocade-primary-logic/INTEGRATION_REPORT.json"],
    "Block 3 required 2,126-record JSONL ledger",
    "Upgrade the donor schema, preserve provenance, verify 37/37 reachability, and merge only stronger behavior.",
  ),
  section(
    "26",
    29,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "package.json",
    ["scripts/check-asset-budgets.mjs", "scripts/e2e/accessibility-journey.mjs"],
    "Blocks 4 and 29B clean install, locale, accessibility, performance, and CI proof",
    "Increase bundle margin, finish eight locales, physical assistive-tech proof, clean installs, SBOM, and CI parity.",
  ),
  section(
    "27",
    2,
    "PARTIAL",
    "SOURCE_PRESENT",
    "PLAN.md",
    ["docs/mission/OCADE_EXECUTION_STATE.md"],
    "All 29 continuation checkpoints",
    "Execute the dependency-ordered blocks without redoing verified work.",
  ),
  section(
    "28",
    29,
    "NOT_STARTED",
    "SPECIFIED",
    "PLAN.md",
    ["docs/mission/OCADE_EXECUTION_STATE.md"],
    "Block 29C one uninterrupted final matrix",
    "Run every source, runtime, browser, database, platform, security, and commercial final gate together.",
  ),
  section(
    "28A",
    29,
    "NOT_STARTED",
    "SPECIFIED",
    "PLAN.md",
    ["release/checklists/OCADE_REMAINING_PRODUCT_GAPS.json"],
    "Block 29B zero applicable MISSING and shipped runtime proof",
    "Regenerate all checklists against the final tree and reject source-only completion claims.",
  ),
  section(
    "29",
    29,
    "NOT_STARTED",
    "SPECIFIED",
    "PLAN.md",
    ["docs/mission/OCADE_EXECUTION_STATE.md"],
    "Block 29C remote-main SHA and tree verification",
    "Reconcile latest main, rerun the full gate, create one main-facing commit, fast-forward, push, and verify.",
  ),
  section(
    "A",
    11,
    "PARTIAL",
    "TESTED",
    "src/lib/brain/model-vault.ts",
    [
      "src/lib/__tests__/chat-incognito-and-delete-all.test.ts",
      "src/lib/__tests__/service-worker-background-fetch.test.ts",
    ],
    "Block 11 browser deletion/offline/no-network journey",
    "Prove every IndexedDB deletion path leaves OPFS model identity and network behavior unchanged.",
  ),
  section(
    "B",
    16,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/security/mfa.ts",
    ["src/lib/security/__tests__/mfa.test.ts", "scripts/e2e/run-mfa-journey.mjs"],
    "Block 16 live setup, challenge, recovery, regeneration, and removal proof",
    "Finish live Supabase composition and high-risk reauthentication across every factor lifecycle edge case.",
  ),
  section(
    "C",
    16,
    "PARTIAL",
    "TESTED",
    "src/lib/security/sessions.functions.ts",
    ["src/lib/security/__tests__/assurance.test.ts"],
    "Block 16 multi-session revocation and assurance journey",
    "Complete recent-strong-auth enforcement, callback cleanup, rate limits, and all session edge cases.",
  ),
  section(
    "D",
    28,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/notifications/preferences.ts",
    ["scripts/e2e/run-notification-journey.mjs"],
    "Block 28 real configured channel/device proof",
    "Complete push/email adapters and leave each unavailable channel disabled until physical delivery is proven.",
  ),
  section(
    "E",
    28,
    "PARTIAL",
    "TESTED",
    "src/lib/notifications/send.server.ts",
    ["src/lib/notifications/__tests__/notification-senders.test.ts"],
    "Block 28 real transactional sender and retry proof",
    "Finish templates, delivery audit, suppression, idempotency, secure links, and truthful unconfigured states.",
  ),
  section(
    "F",
    27,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/organizations/authority.ts",
    ["scripts/e2e/run-organization-journey.mjs"],
    "Block 27 invitation, role, group, removal, and export matrix",
    "Complete the remaining membership and group operations under server/RLS authority.",
  ),
  section(
    "G",
    27,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/admin/operations.ts",
    ["scripts/e2e/run-admin-operations-journey.mjs"],
    "Block 27 strict-role and tenant-isolation matrix",
    "Finish billing/seat overview, capability policy, audit export, security, and danger-zone operations.",
  ),
  section(
    "H",
    29,
    "PARTIAL",
    "TESTED",
    "src/lib/payments/pricing.ts",
    ["src/lib/payments/__tests__/webhook-apply.test.ts"],
    "Block 29A complete commercial lifecycle",
    "Remove legacy contradictions, unify subscription authority, and prove verified payment through entitlement and refunds.",
  ),
  section(
    "I",
    26,
    "PARTIAL",
    "TESTED",
    "src/lib/mobile/mission-control.ts",
    ["src/lib/__tests__/mobile-native-parity.test.ts"],
    "Block 26 compliant physical-platform subscription management proof",
    "Expose only store/provider-compliant management, restore, history, tax, help, and entitlement refresh.",
  ),
  section(
    "J",
    28,
    "COMPLETE",
    "RUNTIME_PROVEN",
    "src/routes/security.tsx",
    [
      "src/lib/security/__tests__/public-security-claims.test.ts",
      "scripts/e2e/run-settings-audit.mjs",
    ],
    "Block 29C final public-claim scan",
    "Keep the Security surface factual and reject fabricated certifications or assessments.",
  ),
  section(
    "K",
    28,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/status/feed.ts",
    ["scripts/e2e/status-feed.mjs"],
    "Block 28 configured subscription and independent-host proof",
    "Preserve data-backed incidents and keep subscriptions/independent hosting truthfully unavailable until configured.",
  ),
  section(
    "L",
    28,
    "COMPLETE",
    "RUNTIME_PROVEN",
    "src/lib/support/catalogue.ts",
    ["scripts/e2e/help-center-journey.mjs"],
    "Block 29C final version-aware article journey",
    "Keep search, suggestions, categories, dates, related content, feedback, and escalation current.",
  ),
  section(
    "M",
    27,
    "COMPLETE",
    "TESTED",
    "src/components/ui/ocade-data-table.tsx",
    ["src/components/ui/__tests__/ocade-data-table.test.tsx"],
    "Block 27 authorized-result export and admin runtime matrix",
    "Reuse the canonical table and do not create per-screen grid implementations.",
  ),
  section(
    "N",
    29,
    "PARTIAL",
    "RUNTIME_PROVEN",
    "src/lib/__tests__/accessibility-gate.test.ts",
    ["scripts/e2e/accessibility-journey.mjs"],
    "Block 29B NVDA/Chrome and VoiceOver/Safari proof",
    "Fix every physical assistive-technology, keyboard, zoom, focus, touch, and reduced-motion defect found.",
  ),
  section(
    "O",
    16,
    "COMPLETE",
    "RUNTIME_PROVEN",
    "src/lib/account/data-rights.ts",
    ["src/lib/account/__tests__/data-rights.test.ts", "scripts/e2e/run-organization-journey.mjs"],
    "Block 29C final two-account export/deletion proof",
    "Preserve ownership-safe deletion, retention refusals, receipts, and OPFS isolation.",
  ),
  section(
    "P",
    2,
    "COMPLETE",
    "TESTED",
    "src/lib/release/remaining-gaps.ts",
    ["release/checklists/OCADE_REMAINING_PRODUCT_GAPS.json"],
    "Regenerate after each block and require zero MISSING at Block 29B",
    "Keep the remaining-gap ledger gap-only and evidence-enforced while this mission graph accounts for the whole plan.",
  ),
] as const;

/** Current PLAN.md is phase-based; the legacy section map remains below as audit history only. */
export const MISSION_SECTION_STATES: readonly MissionSectionState[] = Array.from(
  { length: 21 },
  (_, phase) =>
    section(
      String(phase),
      phase + 1,
      phase === 0 ? "PARTIAL" : "NOT_STARTED",
      phase === 0 ? "SOURCE_PRESENT" : "SPECIFIED",
      "PLAN.md",
      ["docs/MEMORY.md"],
      `Complete and verify PLAN.md Phase ${phase}`,
      `Execute the focused implementation and verification gate for Phase ${phase}.`,
    ),
);

void LEGACY_MISSION_SECTION_STATES;

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

interface RawBlock {
  line: number;
  section: string;
  sectionTitle: string;
  subsectionTitle?: string;
  kind: ExtractedPlanRequirement["kind"];
  text: string;
}

/** Extract every prose/list/table block outside examples and type declarations. */
export function extractPlanRequirements(planText: string): ExtractedPlanRequirement[] {
  const lines = planText.replace(/\r\n?/g, "\n").split("\n");
  const raw: RawBlock[] = [];
  let currentSection = "";
  let sectionTitle = "";
  let subsectionTitle: string | undefined;
  let inFence = false;
  let active: RawBlock | null = null;

  const flush = () => {
    if (!active) return;
    active.text = active.text.replace(/\s+/g, " ").trim();
    if (active.text) raw.push(active);
    active = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index]!;
    if (/^```/.test(line.trim())) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const h2 =
      line.match(/^###\s+Phase\s+(\d+)\s+[—-]\s+(.+)$/) ??
      line.match(/^##\s+((?:\d+[A-Z]?|[A-P]))\.\s+(.+)$/);
    if (h2) {
      flush();
      currentSection = h2[1]!;
      sectionTitle = h2[2]!.trim();
      subsectionTitle = undefined;
      continue;
    }
    const lowerHeading = line.match(/^#{3,4}\s+(.+)$/);
    if (lowerHeading) {
      flush();
      subsectionTitle = lowerHeading[1]!.trim();
      continue;
    }
    if (!currentSection || /^#/.test(line)) {
      flush();
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }

    const list = line.match(/^\s*(-|\*)\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    const table = /^\|.*\|\s*$/.test(line);
    if (list || ordered || table) {
      flush();
      if (table && /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line)) continue;
      active = {
        line: lineNumber,
        section: currentSection,
        sectionTitle,
        subsectionTitle,
        kind: table ? "table-row" : ordered ? "ordered" : "bullet",
        text: table ? line.trim() : (ordered?.[1] ?? list?.[2] ?? "").trim(),
      };
      continue;
    }

    if (active) {
      active.text += ` ${line.trim()}`;
    } else {
      active = {
        line: lineNumber,
        section: currentSection,
        sectionTitle,
        subsectionTitle,
        kind: "paragraph",
        text: line.trim(),
      };
    }
  }
  flush();

  const states = new Map(MISSION_SECTION_STATES.map((item) => [item.section, item]));
  const idCounts = new Map<string, number>();
  return raw.map((item) => {
    const state = states.get(item.section);
    if (!state) throw new Error(`PLAN.md section ${item.section} has no continuation owner`);
    const baseId = `PLAN-${item.section}-${stableHash(`${item.section}\n${item.text}`)}`;
    const occurrence = (idCounts.get(baseId) ?? 0) + 1;
    idCounts.set(baseId, occurrence);
    return {
      ...item,
      ...state,
      id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
      planLine: item.line,
      requirement: item.text,
      proofLevelScope: "section" as const,
    };
  });
}

export function validateMissionEvidence(
  requirements: readonly ExtractedPlanRequirement[],
  fileExists: (path: string) => boolean,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const mapped = new Set(MISSION_SECTION_STATES.map((item) => item.section));

  for (const state of MISSION_SECTION_STATES) {
    if (!fileExists(state.currentAuthority)) {
      problems.push(`section ${state.section}: authority ${state.currentAuthority} does not exist`);
    }
    if (!state.remainingAction.trim() || !state.evidenceTarget.trim()) {
      problems.push(`section ${state.section}: missing remaining action or evidence target`);
    }
  }
  for (const item of requirements) {
    if (seen.has(item.id)) problems.push(`${item.id}: duplicate id`);
    seen.add(item.id);
    if (!mapped.has(item.section)) problems.push(`${item.id}: unmapped section ${item.section}`);
    if (item.requirement.length < 2) problems.push(`${item.id}: empty requirement`);
    if (item.continuationBlock < 1 || item.continuationBlock > 29) {
      problems.push(`${item.id}: invalid continuation block ${item.continuationBlock}`);
    }
    if (!fileExists(item.currentAuthority)) {
      problems.push(`${item.id}: authority ${item.currentAuthority} does not exist`);
    }
  }
  return problems;
}
