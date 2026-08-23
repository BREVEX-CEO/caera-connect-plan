/**
 * OCADE 77 readiness contract.
 *
 * Reconstructed from the prior audit themes because the original verbatim
 * numbered checklist is not present in the accessible repository/history.
 *
 * Classification meanings:
 * - source+test: implementation plus focused test/proof code is present.
 * - source-inspected: implementation was manually inspected in repository source.
 * - truthful-unavailable: the gap is materially resolved by explicit,
 *   fail-closed unavailability; functional availability is NOT claimed.
 *
 * None of these classifications means current-head hosted CI, production DB,
 * hardware, store-signing, notarization, or deployment proof has passed.
 */
export const OCADE_77_READINESS = [
  {
    id: 1,
    requirement: "Auth route fails closed on server responses",
    classification: "source+test",
    evidence: ["src/lib/auth/session-failure.ts", "src/lib/__tests__/session-failure.test.ts"],
  },
  {
    id: 2,
    requirement: "Cached-session fallback only for true transport failure and current sessions",
    classification: "source+test",
    evidence: ["src/lib/auth/session-failure.ts", "src/lib/__tests__/session-failure.test.ts"],
  },
  {
    id: 3,
    requirement: "Session failure regression coverage",
    classification: "source+test",
    evidence: ["src/lib/__tests__/session-failure.test.ts"],
  },
  {
    id: 4,
    requirement: "Public-table RLS source gate and tenant isolation",
    classification: "source+test",
    evidence: ["src/integrations/supabase/types.ts", "src/lib/__tests__"],
  },
  {
    id: 5,
    requirement: "Migrations rebuild from zero in DB twin",
    classification: "source+test",
    evidence: ["supabase/migrations", "src/lib/__tests__"],
  },
  {
    id: 6,
    requirement: "Supabase generated types stay in migration parity",
    classification: "source+test",
    evidence: ["src/integrations/supabase/types.ts", "scripts/check-supabase-types.mjs"],
  },
  {
    id: 7,
    requirement: "Environment and secret hygiene",
    classification: "source+test",
    evidence: [".gitignore", ".env.example"],
  },
  {
    id: 8,
    requirement: "Service-worker API/private-response cache safety",
    classification: "source+test",
    evidence: ["src/lib/__tests__"],
  },
  {
    id: 9,
    requirement: "Offline/local-first boundary is documented truthfully",
    classification: "source-inspected",
    evidence: ["README.md"],
  },
  {
    id: 10,
    requirement: "Private Sync boundary is explicit",
    classification: "source+test",
    evidence: ["README.md", "src/lib/capabilities/registry.ts"],
  },
  {
    id: 11,
    requirement: "Public-cloud inference is absent and cannot be selected",
    classification: "source+test",
    evidence: ["README.md", "src/lib/capabilities/registry.ts"],
  },
  {
    id: 12,
    requirement: "Free-launch mode is centralized",
    classification: "source+test",
    evidence: ["src/lib/launch-mode.ts", "src/lib/__tests__/free-launch-payments.test.ts"],
  },
  {
    id: 13,
    requirement: "Paid entitlement gate is disabled during free launch",
    classification: "source+test",
    evidence: ["src/lib/launch-mode.ts", "src/lib/__tests__/free-launch-payments.test.ts"],
  },
  {
    id: 14,
    requirement: "Provider checkout bootstrap fails closed during free launch",
    classification: "source+test",
    evidence: ["src/lib/paddle.ts", "src/lib/__tests__/free-launch-payments.test.ts"],
  },
  {
    id: 15,
    requirement: "Every checkout hook caller fails closed during free launch",
    classification: "source+test",
    evidence: ["src/hooks/usePaddleCheckout.ts", "src/lib/paddle.ts"],
  },
  {
    id: 16,
    requirement: "Pricing, upgrade and billing surfaces are withdrawn during free launch",
    classification: "source-inspected",
    evidence: ["src/routes/pricing.tsx", "src/routes/_authenticated/settings.billing.tsx"],
  },
  {
    id: 17,
    requirement: "Historical payment records and signed webhook source are preserved",
    classification: "source-inspected",
    evidence: ["src/routes/api/public/payments/webhook.ts", "src/integrations/supabase/types.ts"],
  },
  {
    id: 18,
    requirement: "Desktop downloads are unavailable for this launch",
    classification: "truthful-unavailable",
    evidence: ["src/lib/capabilities/use-capabilities.ts", "src/routes/download.tsx"],
  },
  {
    id: 19,
    requirement: "Desktop release workflow cannot publish installers",
    classification: "source-inspected",
    evidence: [".github/workflows/release.yml"],
  },
  {
    id: 20,
    requirement: "Updater/signing/notarization claims remain gated",
    classification: "truthful-unavailable",
    evidence: ["README.md", ".github/workflows/release.yml"],
  },
  {
    id: 21,
    requirement: "OCADE Chat uses a real on-device inference path",
    classification: "source+test",
    evidence: ["src/routes/_authenticated/ocade.index.tsx", "src/lib/brain", "src/lib/__tests__"],
  },
  {
    id: 22,
    requirement: "Long chat transcripts have bounded rendering",
    classification: "source-inspected",
    evidence: ["src/components/ocade/chat/MessageList.tsx"],
  },
  {
    id: 23,
    requirement: "Streaming snapshots are requestAnimationFrame-coalesced",
    classification: "source+test",
    evidence: ["src/lib", "src/lib/__tests__"],
  },
  {
    id: 24,
    requirement: "Drafts persist through offline/refresh paths",
    classification: "source+test",
    evidence: ["src/lib", "src/lib/__tests__"],
  },
  {
    id: 25,
    requirement: "Assistive tech gets one completion announcement, never per-token announcements",
    classification: "source+test",
    evidence: [
      "src/components/ocade/chat/MessageList.tsx",
      "src/lib/__tests__/message-list-a11y.test.tsx",
    ],
  },
  {
    id: 26,
    requirement: "Chat failures and retries do not imply success",
    classification: "source+test",
    evidence: [
      "src/routes/_authenticated/ocade.index.tsx",
      "src/lib/ocade-chat-store.ts",
      "src/lib/__tests__",
    ],
  },
  {
    id: 27,
    requirement: "Answer provenance and receipts are retained",
    classification: "source+test",
    evidence: ["src/lib/__tests__/answer-provenance.test.ts", "src/lib"],
  },
  {
    id: 28,
    requirement: "Files use real file/storage paths rather than demo-only cards",
    classification: "source+test",
    evidence: ["src/lib/attachments", "src/lib/__tests__"],
  },
  {
    id: 29,
    requirement: "Artifacts retain real generated outputs and evidence",
    classification: "source+test",
    evidence: ["src/routes/_authenticated/ocade.artifacts.tsx", "src/lib/artifacts"],
  },
  {
    id: 30,
    requirement: "Projects use durable device-authoritative scoped records",
    classification: "source+test",
    evidence: [
      "src/routes/_authenticated/ocade.projects.tsx",
      "src/lib/projects/local-projects.ts",
    ],
  },
  {
    id: 31,
    requirement: "Universal Search reads device records first and merges private sync",
    classification: "source-inspected",
    evidence: ["src/routes/_authenticated/ocade.search.tsx", "src/lib/search/local-search.ts"],
  },
  {
    id: 32,
    requirement: "Tasks use one persisted unified task runtime",
    classification: "source+test",
    evidence: ["src/lib/tasks/unified-task.ts", "src/lib/tasks/__tests__/unified-task.test.ts"],
  },
  {
    id: 33,
    requirement: "Task state transitions are validated",
    classification: "source+test",
    evidence: ["src/lib/tasks/unified-task.ts", "src/lib/tasks/__tests__/unified-task.test.ts"],
  },
  {
    id: 34,
    requirement: "Inbox is backed by real automation run state",
    classification: "source-inspected",
    evidence: ["src/routes/_authenticated/ocade.inbox.tsx", "src/lib/tasks/unified-task.ts"],
  },
  {
    id: 35,
    requirement: "Activity reads the real account activity ledger",
    classification: "source-inspected",
    evidence: [
      "src/routes/_authenticated/ocade.activity.tsx",
      "src/integrations/supabase/types.ts",
    ],
  },
  {
    id: 36,
    requirement: "Devices list and revoke real registered devices",
    classification: "source+test",
    evidence: ["src/routes/_authenticated/ocade.devices.tsx", "src/integrations/supabase/types.ts"],
  },
  {
    id: 37,
    requirement: "Connectors show observed capability state only",
    classification: "source-inspected",
    evidence: [
      "src/routes/_authenticated/ocade.connectors.tsx",
      "src/lib/capabilities/use-capabilities.ts",
    ],
  },
  {
    id: 38,
    requirement: "Permissions page exposes permission-bearing capability state",
    classification: "source-inspected",
    evidence: [
      "src/routes/_authenticated/ocade.permissions.tsx",
      "src/lib/capabilities/registry.ts",
    ],
  },
  {
    id: 39,
    requirement: "Health page centralizes capability diagnostics",
    classification: "source-inspected",
    evidence: [
      "src/routes/_authenticated/ocade.health.tsx",
      "src/lib/capabilities/use-capabilities.ts",
    ],
  },
  {
    id: 40,
    requirement: "System hub contains advanced/runtime controls",
    classification: "source-inspected",
    evidence: ["src/routes/_authenticated/ocade.system.tsx"],
  },
  {
    id: 41,
    requirement: "Cmd/Ctrl+K command palette is keyboard and focus safe",
    classification: "source+test",
    evidence: ["src/components/shell/CommandPalette.tsx", "src/lib/__tests__"],
  },
  {
    id: 42,
    requirement: "Mobile OCADE navigation is explicit and reachable",
    classification: "source-inspected",
    evidence: ["src/components/shell/OcadeMobileBottomNav.tsx"],
  },
  {
    id: 43,
    requirement: "Primary navigation is compressed around core work",
    classification: "source-inspected",
    evidence: ["src/lib/shell-nav.ts"],
  },
  {
    id: 44,
    requirement: "Studio and Lab have separate user/engineering purposes",
    classification: "source-inspected",
    evidence: [
      "src/routes/_authenticated/ocade.studio.tsx",
      "src/routes/_authenticated/ocade.lab.tsx",
    ],
  },
  {
    id: 45,
    requirement: "Unwired Studio generators are marked NOT_CONFIGURED",
    classification: "truthful-unavailable",
    evidence: ["src/routes/_authenticated/ocade.studio.tsx"],
  },
  {
    id: 46,
    requirement: "Shared has a truthful no-public-sharing boundary",
    classification: "truthful-unavailable",
    evidence: ["src/routes/_authenticated/ocade.shared.tsx"],
  },
  {
    id: 47,
    requirement: "Templates provide usable starter prompts without fake workflows",
    classification: "source-inspected",
    evidence: ["src/routes/_authenticated/ocade.templates.tsx"],
  },
  {
    id: 48,
    requirement: "Knowledge exposes the current no-global-index boundary",
    classification: "truthful-unavailable",
    evidence: ["src/routes/_authenticated/ocade.knowledge.tsx"],
  },
  {
    id: 49,
    requirement: "Notifications expose the current no-background-push boundary",
    classification: "truthful-unavailable",
    evidence: ["src/routes/_authenticated/ocade.notifications.tsx"],
  },
  {
    id: 50,
    requirement: "Local AI readiness comes from an engine probe",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 51,
    requirement: "Cloud AI readiness comes from deployment/provider evidence",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 52,
    requirement: "Private Sync readiness comes from signed-in storage mode",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 53,
    requirement: "Browser control readiness comes from a bridge status probe",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 54,
    requirement: "Computer control requires a native companion path",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/native"],
  },
  {
    id: 55,
    requirement: "Voice capability is feature/permission detected",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 56,
    requirement: "Vision capability is tied to an image-capable engine",
    classification: "source+test",
    evidence: ["src/lib/capabilities/registry.ts", "src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 57,
    requirement: "Code ingests real user-selected repository text files",
    classification: "source+test",
    evidence: ["src/components/ocade/CodeWorkspacePanel.tsx", "src/lib/code"],
  },
  {
    id: 58,
    requirement: "Code patch preview/apply/undo is deterministic",
    classification: "source+test",
    evidence: ["src/components/ocade/CodeWorkspacePanel.tsx", "src/lib/code"],
  },
  {
    id: 59,
    requirement: "Code changes retain before/after checkpoint hashes",
    classification: "source+test",
    evidence: ["src/components/ocade/CodeWorkspacePanel.tsx", "src/lib/code"],
  },
  {
    id: 60,
    requirement: "Generated Code sandbox denies network and undeclared access",
    classification: "source+test",
    evidence: ["src/components/ocade/CodeWorkspacePanel.tsx", "src/lib/code/generated-sandbox.ts"],
  },
  {
    id: 61,
    requirement: "Code terminal refuses to fake output without a verified command host",
    classification: "truthful-unavailable",
    evidence: [
      "src/components/ocade/CodeWorkspacePanel.tsx",
      "src/lib/capabilities/use-capabilities.ts",
    ],
  },
  {
    id: 62,
    requirement: "Control + Work is a separate action runtime from Chat",
    classification: "source+test",
    evidence: [
      "src/routes/_authenticated/ocade.work.tsx",
      "src/components/ocade/control/ControlWorkPanel.tsx",
    ],
  },
  {
    id: 63,
    requirement: "Work STOP, pause/resume and takeover are immediate controls",
    classification: "source+test",
    evidence: ["src/components/ocade/control/ControlWorkPanel.tsx"],
  },
  {
    id: 64,
    requirement: "Work approval/risk boundaries remain user-visible",
    classification: "source+test",
    evidence: ["src/components/ocade/control/ControlWorkPanel.tsx"],
  },
  {
    id: 65,
    requirement: "Work file attachment is visibly marked not configured",
    classification: "truthful-unavailable",
    evidence: ["src/routes/_authenticated/ocade.work.tsx"],
  },
  {
    id: 66,
    requirement: "Automation has a durable queue controller",
    classification: "source+test",
    evidence: [
      "src/lib/automation-worker-controller.ts",
      "src/lib/__tests__/automation-worker-controller.test.ts",
    ],
  },
  {
    id: 67,
    requirement: "Automation performs stale-claim recovery, dedupe and bounded dispatch",
    classification: "source+test",
    evidence: [
      "src/lib/automation-worker-controller.ts",
      "src/lib/__tests__/automation-worker-controller.test.ts",
    ],
  },
  {
    id: 68,
    requirement: "Automation only counts verified success and records outcomes",
    classification: "source+test",
    evidence: [
      "src/lib/automation-worker-controller.ts",
      "src/lib/__tests__/automation-worker-controller.test.ts",
    ],
  },
  {
    id: 69,
    requirement: "Global automation readiness is not inferred from shell presence",
    classification: "truthful-unavailable",
    evidence: ["src/lib/capabilities/use-capabilities.ts"],
  },
  {
    id: 70,
    requirement: "Saved monitor definitions are distinguished from execution",
    classification: "source-inspected",
    evidence: [
      "src/routes/_authenticated/ocade.monitors.tsx",
      "src/lib/capabilities/use-capabilities.ts",
    ],
  },
  {
    id: 71,
    requirement: "Monitor polling is never claimed without a runner heartbeat",
    classification: "truthful-unavailable",
    evidence: [
      "src/routes/_authenticated/ocade.monitors.tsx",
      "src/lib/capabilities/use-capabilities.ts",
    ],
  },
  {
    id: 72,
    requirement: "Action execution prefers deterministic integrations before visual control",
    classification: "source+test",
    evidence: ["src/lib/actions.ts", "src/lib/__tests__"],
  },
  {
    id: 73,
    requirement: "Native/bridge permissions, signing and secret isolation are enforced in source",
    classification: "source+test",
    evidence: ["src/lib/native", "src/lib/__tests__"],
  },
  {
    id: 74,
    requirement: "Emergency stop, replay/receipts and tamper-evidence paths exist",
    classification: "source+test",
    evidence: ["src/lib", "src/lib/__tests__"],
  },
  {
    id: 75,
    requirement: "Adversarial prompt-injection, egress and redaction controls have gates",
    classification: "source+test",
    evidence: ["src/lib/__tests__/adversarial-matrix.test.ts", "src/lib"],
  },
  {
    id: 76,
    requirement:
      "CI defines cross-platform, DB, mutation, browser, Rust, performance and accessibility proof gates",
    classification: "source-inspected",
    evidence: [".github/workflows/ci.yml"],
  },
  {
    id: 77,
    requirement:
      "Final readiness/launch authority is evidence-gated and never equates source with production",
    classification: "source+test",
    evidence: ["scripts/launch-authority.mjs", "README.md"],
  },
];
