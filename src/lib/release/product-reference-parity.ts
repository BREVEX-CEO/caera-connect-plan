/**
 * Dated, public-reference capability inventory required by PLAN.md §3.
 *
 * This is a behavioral comparison only. It is deliberately made from public
 * product documentation, never from Anthropic source, prompts, private APIs,
 * assets, or product trade dress. A record saying `complete` means its cited
 * OCADE behavior exists; it does not claim that every requirement in the
 * owning continuation block is complete.
 */

export type ProductSurface = "web" | "desktop" | "mobile" | "extension" | "cli";

export interface ProductParityRecord {
  id: string;
  referenceProduct: "chat" | "cowork" | "code" | "team" | "enterprise";
  capability: string;
  documentedSource: string;
  sourceCheckedAt: string;
  requiredSurfaces: ProductSurface[];
  currentOcadeAuthority?: string;
  disposition:
    | "PARITY"
    | "OCADE_SUPERSET"
    | "REPLACE_WITH_OCADE_AUTHORITY"
    | "PROVIDER_GATED"
    | "NOT_APPLICABLE_TO_OCADE";
  implementationState: "missing" | "partial" | "complete";
  requiredTests: string[];
  evidence: string[];
  reason: string;
}

const CHECKED_AT = "2026-09-05";

const SOURCES = {
  chat: "https://support.claude.com/en/articles/8114491-get-started-with-claude",
  files: "https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude",
  artifacts:
    "https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them",
  projects: "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects",
  projectRag:
    "https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects",
  sharing: "https://support.claude.com/en/articles/10593882-share-and-unshare-chats",
  cowork: "https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork",
  computerUse:
    "https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork",
  dispatch:
    "https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork",
  chrome: "https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome",
  coworkAdmin:
    "https://support.claude.com/en/articles/13455879-use-claude-cowork-on-team-and-enterprise-plans",
  codeWeb: "https://support.claude.com/en/articles/12618689-claude-code-on-the-web",
  codeTips: "https://support.claude.com/en/articles/14554000-claude-code-power-user-tips",
  mobileLinks:
    "https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link",
  directory:
    "https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory",
  skills: "https://support.claude.com/en/articles/12512180-use-skills-in-claude",
  plugins: "https://support.claude.com/en/articles/13837440-use-plugins-in-claude",
  members:
    "https://support.claude.com/en/articles/13133750-manage-members-on-team-and-enterprise-plans",
  roles: "https://support.claude.com/en/articles/13930452-manage-custom-roles-on-enterprise-plans",
  connectorAuth:
    "https://support.claude.com/en/articles/15537633-authorize-mcp-connectors-for-your-entire-organization",
  chromeAdmin: "https://support.claude.com/en/articles/13065128-claude-in-chrome-admin-controls",
  pluginAdmin:
    "https://support.claude.com/en/articles/13837433-manage-plugins-for-your-organization",
  audit: "https://support.claude.com/en/articles/9970975-access-audit-logs",
} as const;

type RecordInput = Omit<ProductParityRecord, "sourceCheckedAt">;

function record(input: RecordInput): ProductParityRecord {
  return { ...input, sourceCheckedAt: CHECKED_AT };
}

export const PRODUCT_REFERENCE_PARITY: readonly ProductParityRecord[] = [
  record({
    id: "CHAT-CHAT-SURFACES",
    referenceProduct: "chat",
    capability: "One account can continue conversations on web, desktop, and mobile surfaces.",
    documentedSource: SOURCES.chat,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/ocade-chat-store.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/ocade-chat-store.test.ts"],
    evidence: ["src/routes/_authenticated/ocade.index.tsx"],
    reason:
      "One conversation authority in the account, readable from every signed-in surface. A turn produced on the device while the account is unreachable waits in the open tab, marked, and uploads exactly once.",
  }),
  record({
    id: "CHAT-MODEL-CONTROLS",
    referenceProduct: "chat",
    capability:
      "A user can choose response mode or effort and see which intelligence path answered.",
    documentedSource: SOURCES.chat,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/engine/resolve.ts",
    disposition: "REPLACE_WITH_OCADE_AUTHORITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/engine-routing-single-policy.test.ts"],
    evidence: ["src/components/ocade/chat/EngineBadge.tsx"],
    reason:
      "OCADE exposes Automatic, Online, and Local-only intelligence instead of copying provider model branding.",
  }),
  record({
    id: "CHAT-FILE-CREATION",
    referenceProduct: "chat",
    capability:
      "Create and edit downloadable documents, spreadsheets, presentations, PDFs, and code-backed files.",
    documentedSource: SOURCES.files,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/artifacts/chat-output-flow.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/chat-output-flow.test.ts"],
    evidence: ["src/routes/_authenticated/ocade.artifacts.tsx"],
    reason:
      "Artifact creation exists; durable lineage and all renderer/export paths are completed in Block 22.",
  }),
  record({
    id: "CHAT-ARTIFACTS",
    referenceProduct: "chat",
    capability:
      "Open generated output beside a conversation, revise it, recover from render errors, and export it.",
    documentedSource: SOURCES.artifacts,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/artifacts/store.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/artifacts.test.ts"],
    evidence: ["src/lib/artifacts/versioning.ts"],
    reason:
      "OCADE adds originating-run lineage and offline access; the final storage migration remains in Block 22.",
  }),
  record({
    id: "CHAT-PROJECTS",
    referenceProduct: "chat",
    capability:
      "Projects group chats, knowledge, files, instructions, sharing, archive, and deletion.",
    documentedSource: SOURCES.projects,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/ocade-projects.functions.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/unbounded-queries.test.ts"],
    evidence: ["src/routes/_authenticated/ocade.projects.tsx"],
    reason:
      "OCADE Projects also own Code, Tasks, Artifacts, memory, permissions, and offline context after Block 20.",
  }),
  record({
    id: "CHAT-PROJECT-KNOWLEDGE",
    referenceProduct: "chat",
    capability: "Project knowledge can be searched when it exceeds direct context capacity.",
    documentedSource: SOURCES.projectRag,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/search/results.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/search/__tests__/results.test.ts"],
    evidence: ["src/lib/memory/session-memory.ts"],
    reason:
      "OCADE searches the account's own rows through parameterized filters, ranks them explainably, and adds scoped memory and explicit source age rather than copying provider RAG internals.",
  }),
  record({
    id: "CHAT-SHARING",
    referenceProduct: "chat",
    capability:
      "Share a point-in-time conversation snapshot and revoke it without exposing private attachment or tool data.",
    documentedSource: SOURCES.sharing,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/chat/conversation-sharing.ts",
    disposition: "PARITY",
    implementationState: "complete",
    requiredTests: ["src/lib/chat/__tests__/conversation-sharing.test.ts"],
    evidence: ["src/routes/share.$token.tsx", "docs/MEMORY.md"],
    reason:
      "The share/revoke checkpoint implements a bounded snapshot and keeps attachment/tool internals private.",
  }),
  record({
    id: "COWORK-SHARED-COMPOSER",
    referenceProduct: "cowork",
    capability: "Chat and Cowork share one home and composer while changing execution mode.",
    documentedSource: SOURCES.cowork,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/components/ocade/chat/ChatComposer.tsx",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/chat-ui.test.tsx"],
    evidence: ["src/routes/_authenticated/ocade.cowork.tsx"],
    reason:
      "The shared shell exists; final task, permit, and remote-executor composition remains in Block 18.",
  }),
  record({
    id: "COWORK-PROGRESS-STEERING",
    referenceProduct: "cowork",
    capability:
      "Long tasks show progress and can be steered, paused, stopped, resumed, or taken over.",
    documentedSource: SOURCES.cowork,
    requiredSurfaces: ["web", "desktop", "mobile"],
    currentOcadeAuthority: "src/lib/work/use-mission.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/mission-modes.test.ts"],
    evidence: ["src/lib/tasks/unified-task.ts"],
    reason:
      "OCADE adds explicit STOP, PAUSE, RESUME, TAKE OVER, receipts, and postcondition verification.",
  }),
  record({
    id: "COWORK-PARALLEL-AGENTS",
    referenceProduct: "cowork",
    capability:
      "A complex task can coordinate parallel sub-agents while preserving one visible mission.",
    documentedSource: SOURCES.cowork,
    requiredSurfaces: ["web", "desktop"],
    currentOcadeAuthority: "src/lib/agent/loop.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/agent-loop.test.ts"],
    evidence: ["src/lib/skills/concurrency.ts"],
    reason:
      "The agent and concurrency foundations exist; one-permit mission accounting remains in Blocks 8 and 18.",
  }),
  record({
    id: "COWORK-PRECISE-TOOL-ORDER",
    referenceProduct: "cowork",
    capability:
      "Prefer a connector or semantic browser/native tool before slower screen-coordinate interaction.",
    documentedSource: SOURCES.computerUse,
    requiredSurfaces: ["desktop", "extension"],
    currentOcadeAuthority: "src/lib/skills/route-selector.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/route-selector.test.ts"],
    evidence: ["src/lib/native/automation-observer.ts"],
    reason:
      "OCADE formalizes connector, DOM/accessibility, native semantics, vision, then guarded coordinates.",
  }),
  record({
    id: "COWORK-PER-APP-PERMISSION",
    referenceProduct: "cowork",
    capability:
      "Computer control asks permission before accessing an application or destructive operation.",
    documentedSource: SOURCES.computerUse,
    requiredSurfaces: ["desktop"],
    currentOcadeAuthority: "src/lib/runtime/permissions.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/runtime/__tests__/permissions.test.ts"],
    evidence: ["src/lib/runtime/execute.ts"],
    reason:
      "OCADE applies one policy authority across browser, native, shell, Git, file, and network actions.",
  }),
  record({
    id: "COWORK-DISPATCH",
    referenceProduct: "cowork",
    capability:
      "Assign from mobile, execute through an awake paired desktop, and monitor or steer the same session.",
    documentedSource: SOURCES.dispatch,
    requiredSurfaces: ["mobile", "desktop"],
    currentOcadeAuthority: "src/lib/mobile/mission-control.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/mobile-mission-control.test.ts"],
    evidence: ["src/lib/automation-worker-host.ts"],
    reason:
      "The mobile and worker foundations exist; durable RemoteExecutor leases and recovery remain in Block 14.",
  }),
  record({
    id: "COWORK-CROSS-SURFACE",
    referenceProduct: "cowork",
    capability:
      "The same task can be opened and steered from web, desktop, mobile, or the browser side panel.",
    documentedSource: SOURCES.cowork,
    requiredSurfaces: ["web", "desktop", "mobile", "extension"],
    currentOcadeAuthority: "src/lib/tasks/runs.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/tasks/__tests__/runs.test.ts"],
    evidence: ["src/lib/native/extension-bridge.ts"],
    reason:
      "Durable cross-surface state is retained as a parity target for Blocks 13, 14, 18, and 26.",
  }),
  record({
    id: "COWORK-USER-CHROME",
    referenceProduct: "cowork",
    capability:
      "Read and act in a user-approved Chrome context, including DOM, console, network, navigation, clicks, and typing.",
    documentedSource: SOURCES.chrome,
    requiredSurfaces: ["extension", "desktop"],
    currentOcadeAuthority: "src/lib/native/cdp-browser-bridge.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/cowork-extension.test.ts"],
    evidence: ["extension/src/background.js", "extension/tests/cowork-e2e.mjs"],
    reason:
      "The extension is real and tested; production context reacquisition and permission minimization remain in Block 24.",
  }),
  record({
    id: "CODE-LOCAL-WORKSPACE",
    referenceProduct: "code",
    capability:
      "Read and edit a real repository, run commands, inspect diagnostics, and review exact changes.",
    documentedSource: SOURCES.codeTips,
    requiredSurfaces: ["desktop", "cli"],
    currentOcadeAuthority: "src/lib/code/workspace.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/code-workspace.test.ts"],
    evidence: ["src/routes/_authenticated/ocade.code.tsx"],
    reason:
      "OCADE already has immutable maps, hashes, patches, diagnostics, and undo; live Git/LSP/terminal wiring remains.",
  }),
  record({
    id: "CODE-WEB-TASKS",
    referenceProduct: "code",
    capability:
      "Run isolated repository tasks remotely, continue without supervision, and return a reviewable branch or pull request.",
    documentedSource: SOURCES.codeWeb,
    requiredSurfaces: ["web", "mobile"],
    currentOcadeAuthority: "src/lib/automation-worker-host.ts",
    disposition: "PROVIDER_GATED",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/automation-worker-host.test.ts"],
    evidence: ["src/lib/tasks/runs.ts"],
    reason:
      "The portable contract can be completed locally; a configured repository host is required before advertising remote PR delivery.",
  }),
  record({
    id: "CODE-PARALLEL-ISOLATION",
    referenceProduct: "code",
    capability: "Run multiple code tasks in isolated workspaces without cross-task state leakage.",
    documentedSource: SOURCES.codeWeb,
    requiredSurfaces: ["web", "desktop", "cli"],
    currentOcadeAuthority: "src/lib/tasks/runs.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/tasks/__tests__/runs.test.ts"],
    evidence: ["src/lib/code/workspace.ts"],
    reason:
      "Task isolation exists as a foundation; real repository-host and recovery proof remain in Blocks 14 and 19.",
  }),
  record({
    id: "CODE-BROWSER-VERIFY",
    referenceProduct: "code",
    capability:
      "Close the build-test-verify loop in Chrome using DOM, console, and network evidence.",
    documentedSource: SOURCES.chrome,
    requiredSurfaces: ["desktop", "extension", "cli"],
    currentOcadeAuthority: "src/lib/native/extension-adapter.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/cowork-extension.test.ts"],
    evidence: ["extension/tests/cowork-e2e.mjs"],
    reason:
      "The packaged extension proves the primitives; Code-to-browser task composition remains in Block 19.",
  }),
  record({
    id: "CODE-EXTENSIBILITY",
    referenceProduct: "code",
    capability:
      "Skills, plugins, hooks, sub-agents, MCP-style tools, and LSP integrations extend Code workflows.",
    documentedSource: SOURCES.codeTips,
    requiredSurfaces: ["desktop", "cli"],
    currentOcadeAuthority: "src/lib/skills/pack-registry.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/skill-pack.test.ts"],
    evidence: ["src/lib/agent/loop.ts"],
    reason:
      "OCADE keeps one governed registry; invalid manifests, permission bypass, and failure isolation remain in Block 23.",
  }),
  record({
    id: "CODE-MOBILE-REMOTE",
    referenceProduct: "code",
    capability:
      "Open, prefill, continue, or steer a Code session from mobile and hand it back to desktop.",
    documentedSource: SOURCES.mobileLinks,
    requiredSurfaces: ["mobile", "web", "desktop", "cli"],
    currentOcadeAuthority: "src/lib/mobile/mission-control.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/mobile-continuity-flow.test.ts"],
    evidence: ["src/lib/tasks/runs.ts"],
    reason:
      "Deep-link and mission-control foundations exist; final RemoteExecutor and platform proof remain.",
  }),
  record({
    id: "TEAM-UNIFIED-DIRECTORY",
    referenceProduct: "team",
    capability:
      "Discover and manage skills, connectors, and plugins from one customization directory.",
    documentedSource: SOURCES.directory,
    requiredSurfaces: ["web", "desktop"],
    currentOcadeAuthority: "src/lib/skills/marketplace.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/skill-pack.test.ts"],
    evidence: ["src/routes/_authenticated/ocade.customize.tsx"],
    reason:
      "Customize is canonical; provider-backed connector availability and organization distribution remain in Blocks 23 and 27.",
  }),
  record({
    id: "TEAM-SKILLS",
    referenceProduct: "team",
    capability:
      "Enable personal and organization-provisioned skills and apply them automatically when relevant.",
    documentedSource: SOURCES.skills,
    requiredSurfaces: ["web", "desktop"],
    currentOcadeAuthority: "src/lib/skills/skill-pack.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/skill-pack.test.ts"],
    evidence: ["src/lib/skills/pack-registry.ts"],
    reason:
      "The governed skill authority exists; organization provisioning and revocation remain in Blocks 23 and 27.",
  }),
  record({
    id: "TEAM-PLUGINS",
    referenceProduct: "team",
    capability:
      "Plugins bundle skills, connectors, hooks, and agents with scoped availability across Chat and Cowork.",
    documentedSource: SOURCES.plugins,
    requiredSurfaces: ["web", "desktop"],
    currentOcadeAuthority: "src/lib/skills/pack-registry.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/skill-pack.test.ts"],
    evidence: ["src/lib/skills/skill-trust.ts"],
    reason:
      "OCADE does not create a second plugin system; capability scope and failure isolation remain in Block 23.",
  }),
  record({
    id: "TEAM-MEMBERS",
    referenceProduct: "team",
    capability:
      "Invite, list, search, change role, deactivate, remove, and export organization members safely.",
    documentedSource: SOURCES.members,
    requiredSurfaces: ["web"],
    currentOcadeAuthority: "src/lib/organizations/authority.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/organizations/__tests__/organization-model.test.ts"],
    evidence: ["src/routes/_authenticated/organization.tsx"],
    reason:
      "Core invitations and ownership safety are proven; groups, full export, deactivation, and role matrix remain in Block 27.",
  }),
  record({
    id: "ENTERPRISE-CUSTOM-ROLES",
    referenceProduct: "enterprise",
    capability:
      "Custom roles and groups control product capabilities, connectors, and delegated administrative areas.",
    documentedSource: SOURCES.roles,
    requiredSurfaces: ["web"],
    currentOcadeAuthority: "src/lib/organizations/policy.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/organizations/__tests__/organization-policy.test.ts"],
    evidence: ["src/lib/organizations/policy.server.ts"],
    reason:
      "Server-enforced policy foundations exist; the complete custom-role/group UI and precedence proof remain in Block 27.",
  }),
  record({
    id: "ENTERPRISE-MANAGED-CONNECTORS",
    referenceProduct: "enterprise",
    capability:
      "Administrators can authorize connectors centrally and scope access by group or role.",
    documentedSource: SOURCES.connectorAuth,
    requiredSurfaces: ["web"],
    currentOcadeAuthority: "src/lib/organizations/policy.server.ts",
    disposition: "PROVIDER_GATED",
    implementationState: "partial",
    requiredTests: ["src/lib/organizations/__tests__/organization-policy.test.ts"],
    evidence: ["src/routes/_authenticated/ocade.connectors.tsx"],
    reason:
      "Policy and unavailable-state contracts are repository-controlled; each live connector still needs real credentials and revocation proof.",
  }),
  record({
    id: "ENTERPRISE-BROWSER-POLICY",
    referenceProduct: "enterprise",
    capability:
      "Administrators can enable browser control and apply site allowlists or blocklists.",
    documentedSource: SOURCES.chromeAdmin,
    requiredSurfaces: ["web", "desktop", "extension"],
    currentOcadeAuthority: "src/lib/computer-use-settings.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/enterprise-browser-policy.test.ts"],
    evidence: ["release/OCADE_ENTERPRISE_BROWSER_POLICY.json"],
    reason:
      "OCADE adds origin, permission, injection, protected-field, and postcondition policies; organization UI proof remains.",
  }),
  record({
    id: "ENTERPRISE-PLUGIN-MARKETPLACE",
    referenceProduct: "enterprise",
    capability:
      "Owners can distribute a curated plugin marketplace to an organization and control availability.",
    documentedSource: SOURCES.pluginAdmin,
    requiredSurfaces: ["web", "desktop"],
    currentOcadeAuthority: "src/lib/skills/marketplace.ts",
    disposition: "PARITY",
    implementationState: "partial",
    requiredTests: ["src/lib/__tests__/skill-pack.test.ts"],
    evidence: ["src/lib/skills/skill-trust.ts"],
    reason:
      "Marketplace and trust policy exist; organization distribution and revocation remain in Blocks 23 and 27.",
  }),
  record({
    id: "ENTERPRISE-AUDIT-LOGS",
    referenceProduct: "enterprise",
    capability:
      "Authorized administrators can inspect and export immutable organization audit events without exposing content by default.",
    documentedSource: SOURCES.audit,
    requiredSurfaces: ["web"],
    currentOcadeAuthority: "src/lib/admin/operations.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/admin/__tests__/operations.test.ts"],
    evidence: ["src/routes/_authenticated/admin.operations.tsx"],
    reason:
      "OCADE already records administrative operations; complete tenant-wide audit coverage and export remain in Block 27.",
  }),
  record({
    id: "ENTERPRISE-COWORK-POLICY",
    referenceProduct: "enterprise",
    capability:
      "Organization policy can separately govern Cowork, cloud execution, browsers, plugins, and local data boundaries.",
    documentedSource: SOURCES.coworkAdmin,
    requiredSurfaces: ["web", "desktop", "mobile", "extension"],
    currentOcadeAuthority: "src/lib/organizations/policy.ts",
    disposition: "OCADE_SUPERSET",
    implementationState: "partial",
    requiredTests: ["src/lib/organizations/__tests__/organization-policy.test.ts"],
    evidence: ["src/lib/computer-use-settings.ts"],
    reason:
      "OCADE additionally distinguishes local-only, online, offline leases, and RemoteExecutor access.",
  }),
] as const;

const OFFICIAL_HOSTS = new Set([
  "support.claude.com",
  "docs.claude.com",
  "code.claude.com",
  "anthropic.com",
  "www.anthropic.com",
]);

export function validateProductReferenceParity(
  records: readonly ProductParityRecord[],
  fileExists: (path: string) => boolean,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const item of records) {
    if (seen.has(item.id)) problems.push(`${item.id}: duplicate id`);
    seen.add(item.id);
    if (!/^[A-Z]+-[A-Z0-9-]+$/.test(item.id)) problems.push(`${item.id}: invalid id`);
    if (item.capability.trim().length < 20) problems.push(`${item.id}: capability is too vague`);
    if (item.reason.trim().length < 24) problems.push(`${item.id}: reason is too vague`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.sourceCheckedAt)) {
      problems.push(`${item.id}: sourceCheckedAt must be an ISO date`);
    }
    try {
      const source = new URL(item.documentedSource);
      if (source.protocol !== "https:" || !OFFICIAL_HOSTS.has(source.hostname)) {
        problems.push(`${item.id}: source is not an approved official HTTPS host`);
      }
    } catch {
      problems.push(`${item.id}: documentedSource is not a URL`);
    }
    if (item.requiredSurfaces.length === 0) problems.push(`${item.id}: no required surface`);
    if (item.implementationState !== "missing" && !item.currentOcadeAuthority) {
      problems.push(`${item.id}: ${item.implementationState} without an OCADE authority`);
    }
    if (item.currentOcadeAuthority && !fileExists(item.currentOcadeAuthority)) {
      problems.push(`${item.id}: authority ${item.currentOcadeAuthority} does not exist`);
    }
    for (const test of item.requiredTests) {
      if (!fileExists(test)) problems.push(`${item.id}: required test ${test} does not exist`);
    }
    for (const path of item.evidence) {
      if (
        /^(src|scripts|docs|release|extension|native|supabase)\//.test(path) &&
        !fileExists(path)
      ) {
        problems.push(`${item.id}: evidence ${path} does not exist`);
      }
    }
    if (
      item.implementationState === "complete" &&
      (item.requiredTests.length === 0 || item.evidence.length === 0)
    ) {
      problems.push(`${item.id}: complete without tests and evidence`);
    }
    if (item.disposition === "PROVIDER_GATED" && !item.currentOcadeAuthority) {
      problems.push(`${item.id}: provider-gated without a repository authority`);
    }
  }

  return problems;
}
