# OCADE 77 Readiness Contract

> This is the reconstructed 77-item readiness contract derived from the prior audit themes. The recovered original Phase-5 production-wiring authority is tracked separately in `docs/ocade-phase5-production-wiring.md`; this file remains the auditable 77-row completion contract for the hardening branch.

## How to read the status

The `Resolution` column keeps the implementation classification from the original reconstruction:

- **source+test** — implementation plus focused test/proof code was already present when the 77-row contract was created.
- **source-inspected** — implementation/source boundary was originally verified by repository inspection.
- **truthful-unavailable** — the gap is materially resolved by making the capability explicitly unavailable/not configured and fail-closed. Functional availability is **not** claimed.

Those implementation classifications are no longer the proof-artifact count. The previously source-inspected and truthful-unavailable rows now have explicit focused Vitest regressions, so **all 77/77 rows own a committed test/proof artifact**.

Fresh hosted GitHub Actions, live production Supabase, physical-device behavior, store signing, code signing, notarization, and production deployment are separate proof layers. Committed proof code never substitutes for observing those proofs execute successfully.

Run `npm run ocade:77-check` to verify there are exactly 77 IDs, all evidence paths exist, the implementation classification remains 49/18/10, and the focused-proof overlay covers the remaining 28 rows for a total of **77/77 committed test/proof artifacts**.

## Focused proof overlay added for the remaining 28

- `src/lib/__tests__/ocade-readiness-source-boundaries.test.ts` — IDs **9, 16, 17, 19, 22, 31, 34, 35, 37, 38, 39, 40, 42, 43, 44, 47, 70, 76**.
- `src/lib/__tests__/ocade-readiness-unavailable-ui.test.ts` — IDs **18, 20, 45, 46, 48**.
- `src/lib/__tests__/ocade-readiness-unavailable-runtime.test.ts` — IDs **49, 61, 65, 69, 71**.

The checker requires each mapped test file to exist and to contain an explicit regression named with that readiness `#ID`; a generic directory or unrelated test file is not enough for these 28 additions.

|   # | Readiness requirement                                                                             | Resolution             | Evidence                                                                                              |
| --: | ------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
|   1 | Auth route fails closed on server responses                                                       | `source+test`          | `src/lib/auth/session-failure.ts`<br>`src/lib/__tests__/session-failure.test.ts`                      |
|   2 | Cached-session fallback only for true transport failure and current sessions                      | `source+test`          | `src/lib/auth/session-failure.ts`<br>`src/lib/__tests__/session-failure.test.ts`                      |
|   3 | Session failure regression coverage                                                               | `source+test`          | `src/lib/__tests__/session-failure.test.ts`                                                           |
|   4 | Public-table RLS source gate and tenant isolation                                                 | `source+test`          | `src/integrations/supabase/types.ts`<br>`src/lib/__tests__`                                           |
|   5 | Migrations rebuild from zero in DB twin                                                           | `source+test`          | `supabase/migrations`<br>`src/lib/__tests__`                                                          |
|   6 | Supabase generated types stay in migration parity                                                 | `source+test`          | `src/integrations/supabase/types.ts`<br>`scripts/check-supabase-types.mjs`                            |
|   7 | Environment and secret hygiene                                                                    | `source+test`          | `.gitignore`<br>`.env.example`                                                                        |
|   8 | Service-worker API/private-response cache safety                                                  | `source+test`          | `src/lib/__tests__`                                                                                   |
|   9 | Offline/local-first boundary is documented truthfully                                             | `source-inspected`     | `README.md`                                                                                           |
|  10 | Private Sync boundary is explicit                                                                 | `source+test`          | `README.md`<br>`src/lib/capabilities/registry.ts`                                                     |
|  11 | Public-cloud inference is absent and cannot be selected as a fallback                              | `source+test`          | `README.md`<br>`src/lib/__tests__/no-cloud-inference.test.ts`                                         |
|  12 | Free-launch mode is centralized                                                                   | `source+test`          | `src/lib/launch-mode.ts`<br>`src/lib/__tests__/free-launch-payments.test.ts`                          |
|  13 | Paid entitlement gate is disabled during free launch                                              | `source+test`          | `src/lib/launch-mode.ts`<br>`src/lib/__tests__/free-launch-payments.test.ts`                          |
|  14 | Provider checkout bootstrap fails closed during free launch                                       | `source+test`          | `src/lib/paddle.ts`<br>`src/lib/__tests__/free-launch-payments.test.ts`                               |
|  15 | Every checkout hook caller fails closed during free launch                                        | `source+test`          | `src/hooks/usePaddleCheckout.ts`<br>`src/lib/paddle.ts`                                               |
|  16 | Pricing, upgrade and billing surfaces are withdrawn during free launch                            | `source-inspected`     | `src/routes/pricing.tsx`<br>`src/routes/_authenticated/settings.billing.tsx`                          |
|  17 | Historical payment records and signed webhook source are preserved                                | `source-inspected`     | `src/routes/api/public/payments/webhook.ts`<br>`src/integrations/supabase/types.ts`                   |
|  18 | Desktop downloads are unavailable for this launch                                                 | `truthful-unavailable` | `src/lib/capabilities/use-capabilities.ts`<br>`src/routes/download.tsx`                               |
|  19 | Desktop release workflow cannot publish installers                                                | `source-inspected`     | `.github/workflows/release.yml`                                                                       |
|  20 | Updater/signing/notarization claims remain gated                                                  | `truthful-unavailable` | `README.md`<br>`.github/workflows/release.yml`                                                        |
|  21 | OCADE Chat uses a real on-device inference path                                                   | `source+test`          | `src/routes/_authenticated/ocade.index.tsx`<br>`src/lib/brain`<br>`src/lib/__tests__`                 |
|  22 | Long chat transcripts have bounded rendering                                                      | `source-inspected`     | `src/components/ocade/chat/MessageList.tsx`                                                           |
|  23 | Streaming snapshots are requestAnimationFrame-coalesced                                           | `source+test`          | `src/lib`<br>`src/lib/__tests__`                                                                      |
|  24 | Drafts persist through offline/refresh paths                                                      | `source+test`          | `src/lib`<br>`src/lib/__tests__`                                                                      |
|  25 | Assistive tech gets one completion announcement, never per-token announcements                    | `source+test`          | `src/components/ocade/chat/MessageList.tsx`<br>`src/lib/__tests__/message-list-a11y.test.tsx`         |
|  26 | Chat failures and retries do not imply success                                                    | `source+test`          | `src/routes/_authenticated/ocade.index.tsx`<br>`src/lib/ocade-chat-store.ts`<br>`src/lib/__tests__`   |
|  27 | Answer provenance and receipts are retained                                                       | `source+test`          | `src/lib/__tests__/answer-provenance.test.ts`<br>`src/lib`                                            |
|  28 | Files use real file/storage paths rather than demo-only cards                                     | `source+test`          | `src/lib/attachments`<br>`src/lib/__tests__`                                                          |
|  29 | Artifacts retain real generated outputs and evidence                                              | `source+test`          | `src/routes/_authenticated/ocade.artifacts.tsx`<br>`src/lib/artifacts`                                |
|  30 | Projects use durable device-authoritative scoped records                                          | `source+test`          | `src/routes/_authenticated/ocade.projects.tsx`<br>`src/lib/projects/local-projects.ts`                |
|  31 | Universal Search reads device records first and merges private sync                               | `source-inspected`     | `src/routes/_authenticated/ocade.search.tsx`<br>`src/lib/search/local-search.ts`                      |
|  32 | Tasks use one persisted unified task runtime                                                      | `source+test`          | `src/lib/tasks/unified-task.ts`<br>`src/lib/tasks/__tests__/unified-task.test.ts`                     |
|  33 | Task state transitions are validated                                                              | `source+test`          | `src/lib/tasks/unified-task.ts`<br>`src/lib/tasks/__tests__/unified-task.test.ts`                     |
|  34 | Inbox is backed by real automation run state                                                      | `source-inspected`     | `src/routes/_authenticated/ocade.inbox.tsx`<br>`src/lib/tasks/unified-task.ts`                        |
|  35 | Activity reads the real account activity ledger                                                   | `source-inspected`     | `src/routes/_authenticated/ocade.activity.tsx`<br>`src/integrations/supabase/types.ts`                |
|  36 | Devices list and revoke real registered devices                                                   | `source+test`          | `src/routes/_authenticated/ocade.devices.tsx`<br>`src/integrations/supabase/types.ts`                 |
|  37 | Connectors show observed capability state only                                                    | `source-inspected`     | `src/routes/_authenticated/ocade.connectors.tsx`<br>`src/lib/capabilities/use-capabilities.ts`        |
|  38 | Permissions page exposes permission-bearing capability state                                      | `source-inspected`     | `src/routes/_authenticated/ocade.permissions.tsx`<br>`src/lib/capabilities/registry.ts`               |
|  39 | Health page centralizes capability diagnostics                                                    | `source-inspected`     | `src/routes/_authenticated/ocade.health.tsx`<br>`src/lib/capabilities/use-capabilities.ts`            |
|  40 | System hub contains advanced/runtime controls                                                     | `source-inspected`     | `src/routes/_authenticated/ocade.system.tsx`                                                          |
|  41 | Cmd/Ctrl+K command palette is keyboard and focus safe                                             | `source+test`          | `src/components/shell/CommandPalette.tsx`<br>`src/lib/__tests__`                                      |
|  42 | Mobile OCADE navigation is explicit and reachable                                                 | `source-inspected`     | `src/components/shell/OcadeMobileBottomNav.tsx`                                                       |
|  43 | Primary navigation is compressed around core work                                                 | `source-inspected`     | `src/lib/shell-nav.ts`                                                                                |
|  44 | Studio and Lab have separate user/engineering purposes                                            | `source-inspected`     | `src/routes/_authenticated/ocade.studio.tsx`<br>`src/routes/_authenticated/ocade.lab.tsx`             |
|  45 | Unwired Studio generators are marked NOT_CONFIGURED                                               | `truthful-unavailable` | `src/routes/_authenticated/ocade.studio.tsx`                                                          |
|  46 | Shared has a truthful no-public-sharing boundary                                                  | `truthful-unavailable` | `src/routes/_authenticated/ocade.shared.tsx`                                                          |
|  47 | Templates provide usable starter prompts without fake workflows                                   | `source-inspected`     | `src/routes/_authenticated/ocade.templates.tsx`                                                       |
|  48 | Knowledge exposes the current no-global-index boundary                                            | `truthful-unavailable` | `src/routes/_authenticated/ocade.knowledge.tsx`                                                       |
|  49 | Notifications expose the current no-background-push boundary                                      | `truthful-unavailable` | `src/routes/_authenticated/ocade.notifications.tsx`                                                   |
|  50 | Local AI readiness comes from an engine probe                                                     | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/capabilities/use-capabilities.ts`                      |
|  51 | Cloud AI readiness comes from deployment/provider evidence                                        | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/capabilities/use-capabilities.ts`                      |
|  52 | Private Sync readiness comes from signed-in storage mode                                          | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/capabilities/use-capabilities.ts`                      |
|  53 | Browser control readiness comes from a bridge status probe                                        | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/capabilities/use-capabilities.ts`                      |
|  54 | Computer control requires a native companion path                                                 | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/native`                                                |
|  55 | Voice capability is feature/permission detected                                                   | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/capabilities/use-capabilities.ts`                      |
|  56 | Vision capability is tied to an image-capable engine                                              | `source+test`          | `src/lib/capabilities/registry.ts`<br>`src/lib/capabilities/use-capabilities.ts`                      |
|  57 | Code ingests real user-selected repository text files                                             | `source+test`          | `src/components/ocade/CodeWorkspacePanel.tsx`<br>`src/lib/code`                                       |
|  58 | Code patch preview/apply/undo is deterministic                                                    | `source+test`          | `src/components/ocade/CodeWorkspacePanel.tsx`<br>`src/lib/code`                                       |
|  59 | Code changes retain before/after checkpoint hashes                                                | `source+test`          | `src/components/ocade/CodeWorkspacePanel.tsx`<br>`src/lib/code`                                       |
|  60 | Generated Code sandbox denies network and undeclared access                                       | `source+test`          | `src/components/ocade/CodeWorkspacePanel.tsx`<br>`src/lib/code/generated-sandbox.ts`                  |
|  61 | Code terminal refuses to fake output without a verified command host                              | `truthful-unavailable` | `src/components/ocade/CodeWorkspacePanel.tsx`<br>`src/lib/capabilities/use-capabilities.ts`           |
|  62 | Control + Work is a separate action runtime from Chat                                             | `source+test`          | `src/routes/_authenticated/ocade.work.tsx`<br>`src/components/ocade/control/ControlWorkPanel.tsx`     |
|  63 | Work STOP, pause/resume and takeover are immediate controls                                       | `source+test`          | `src/components/ocade/control/ControlWorkPanel.tsx`                                                   |
|  64 | Work approval/risk boundaries remain user-visible                                                 | `source+test`          | `src/components/ocade/control/ControlWorkPanel.tsx`                                                   |
|  65 | Work file attachment is visibly marked not configured                                             | `truthful-unavailable` | `src/routes/_authenticated/ocade.work.tsx`                                                            |
|  66 | Automation has a durable queue controller                                                         | `source+test`          | `src/lib/automation-worker-controller.ts`<br>`src/lib/__tests__/automation-worker-controller.test.ts` |
|  67 | Automation performs stale-claim recovery, dedupe and bounded dispatch                             | `source+test`          | `src/lib/automation-worker-controller.ts`<br>`src/lib/__tests__/automation-worker-controller.test.ts` |
|  68 | Automation only counts verified success and records outcomes                                      | `source+test`          | `src/lib/automation-worker-controller.ts`<br>`src/lib/__tests__/automation-worker-controller.test.ts` |
|  69 | Global automation readiness is not inferred from shell presence                                   | `truthful-unavailable` | `src/lib/capabilities/use-capabilities.ts`                                                            |
|  70 | Saved monitor definitions are distinguished from execution                                        | `source-inspected`     | `src/routes/_authenticated/ocade.monitors.tsx`<br>`src/lib/capabilities/use-capabilities.ts`          |
|  71 | Monitor polling is never claimed without a runner heartbeat                                       | `truthful-unavailable` | `src/routes/_authenticated/ocade.monitors.tsx`<br>`src/lib/capabilities/use-capabilities.ts`          |
|  72 | Action execution prefers deterministic integrations before visual control                         | `source+test`          | `src/lib/actions.ts`<br>`src/lib/__tests__`                                                           |
|  73 | Native/bridge permissions, signing and secret isolation are enforced in source                    | `source+test`          | `src/lib/native`<br>`src/lib/__tests__`                                                               |
|  74 | Emergency stop, replay/receipts and tamper-evidence paths exist                                   | `source+test`          | `src/lib`<br>`src/lib/__tests__`                                                                      |
|  75 | Adversarial prompt-injection, egress and redaction controls have gates                            | `source+test`          | `src/lib/__tests__/adversarial-matrix.test.ts`<br>`src/lib`                                           |
|  76 | CI defines cross-platform, DB, mutation, browser, Rust, performance and accessibility proof gates | `source-inspected`     | `.github/workflows/ci.yml`                                                                            |
|  77 | Final readiness/launch authority is evidence-gated and never equates source with production       | `source+test`          | `scripts/launch-authority.mjs`<br>`README.md`                                                         |

## Count

- Materially resolved contract items: **77/77** when `ocade:77-check` passes.
- **Committed test/proof artifacts: 77/77.**
- Original implementation classification: **49 source+test / 18 source-inspected / 10 truthful-unavailable**.
- Newly added focused proof overlay: **28/28** of the previously non-test-classified rows.
- Fresh current-head executed test/CI proof: **must be observed from an actual run; never inferred from committed files**.

## Merge rule

The branch may only be described as fully runtime-proven when the external proof layers required by a given capability have actually executed successfully. A merge can establish the 77/77 source/material-resolution and 77/77 committed-proof-artifact baseline; it cannot manufacture production, hardware, signing, store, database-migration, or deployment evidence.
