
# CAERA CADANE — Revised Master Plan (v3)

Corrections applied per user directive. Preserves Foundation Alpha, hardens integrity gaps, then ships in disciplined vertical slices with honest completion claims.

---

## Rollback Checkpoint

**Name:** `caera-foundation-alpha-0`
**Scope:** Foundation Alpha + P3.5 Integrity Hardening (unified auth, onboarding gate, deep-link return, device registration, two-log split, ActionRegistry, OCADE identity contract stub, server-side compliance writer, protected-route error boundary).
**Lovable revert-point:** this message. Restore here if a later slice regresses auth, onboarding, RLS, or the two-log model.
**GitHub sync:** owned by the user — tag `caera-foundation-alpha-0` after next push. The agent does not rewrite repository history.

---

## 1. Core Idea

Privacy-first, evidence-first, cross-device AI work OS: **OCADE** (assistant/copilot/learning), **FICIA** (commerce/finance/compliance), **MADEE** (studio/resume), **CANIA** (world intelligence). Visible assistant identity is always **"OCADE by CAERA CADANE"** — but provider identity is never falsified (see §12).

Differentiators: local-first vault + PC pairing, automated Signature Trust Network, Penalty Prevention Engine with evidence packs, Intern Learning Replay, deterministic finance.

---

## 2. Current Project Audit

Working: 8 routes, unified auth (Google/Apple/Phone OTP/Email OTP), 8 DB tables with RLS + `enforce_device_cap`, 11 reusable shells, FeatureRegistry, session hook, AI Gateway installed.

Gaps to fix in P3.5 before any new feature:
- **G1** `/home` bypasses `profiles.onboarding_completed`.
- **G2** Deep-link `next` broken — `_authenticated` sends absolute URL, `/auth` `safeNext` rejects.
- **G3** `devices` table dormant — no registration on sign-in.
- **G4** `settings.privacy`/`settings.devices` marked active with no UI.
- **G5** No `ActionRegistry`; `audit_log` never written.
- **G6** `main_purpose` free-text (no enum contract).
- **G7** No error boundaries on protected routes.
- **G8** OCADE identity contract not shipped.

Placeholder bodies safe to replace: `/ocade`, `/ficia`, `/madee`, `/cania`, `/home`, `/settings` beyond sign-out.

---

## 3. Competitor Weaknesses

- **LLM chat products**: no company evidence, no signature verification, no accounting truth, no local vault.
- **Accounting suites (QuickBooks/Xero/Zoho/Tally)**: strong ledger, weak AI, no signature trust network, no evidence-backed penalty defence, no cross-role chat, no learning replay.
- **Collab (Notion/Slack/Teams)**: no finance truth, no compliance calendar, no signature layer.
- **DocuSign/Adobe Sign**: signature strong, no OS around it, no automated bulk regulator verification.

Unclaimed intersection: AI + finance truth + evidence + signature verification + local-first vault + teaching replay.

---

## 4. Competitor-Killing Advantages

1. Signature Trust Network with public verification (§7).
2. PC Device Vault via native companion (§6, later phase).
3. Penalty Prevention Engine with evidence packs (§8).
4. Intern Learning Replay (§11).
5. Deterministic finance (LLM never touches money math).
6. Honest identity (§12).
7. Country packs (India first).
8. Data-class-scoped privacy modes.

---

## 5. Hidden Opportunities

- Cross-browser continuity on same PC (post-companion).
- Regulator bulk-verification dashboards.
- Auto evidence packs per filing.
- Intern time-to-productivity metric.
- Country pack marketplace (reviewed).
- Trust badge network effect (`verify.caeracadane.com/<id>` on every signed doc).

---

## 6. Device Storage Architecture

**Device model correction: one physical PC = one desktop device slot.** Multiple approved browsers on the same PC share that slot via separate `browser_grants`. The third **physical PC** triggers the cap, not the third browser.

### Mode A — Browser Only (IndexedDB)

- Scope: one browser on one PC. Clearly labeled limitation.
- **Encryption (corrected)**:
  - Data encrypted with an AES-GCM **Data Encryption Key (DEK)**.
  - DEK is **never stored in usable form beside ciphertext**. Instead the DEK is wrapped by a **Key Encryption Key (KEK)** derived at unlock time.
  - KEK sources, in priority order at unlock:
    1. **WebAuthn PRF** where supported (platform authenticator; hardware-bound; no passphrase re-entry per session).
    2. **User passphrase → Argon2id → KEK** (memory ≥ 64 MiB, iterations tuned per device; salt stored, KEK never).
    3. (Later, once companion ships) **OS keychain–backed KEK** via companion.
  - Only the wrapped DEK, the KDF salt, WebAuthn credential ID, and metadata live in IndexedDB. Unwrapped DEK exists only in memory during an unlocked session; auto-locks on idle.
  - **Recovery**: at vault creation, user must download a one-time recovery kit (recovery key + printable QR + acknowledgement checkbox). Losing both passphrase/WebAuthn and recovery kit = **unrecoverable, permanent data loss**. UI shows a red hard-warning at vault creation and each re-key rotation.
  - Rotation supported (re-wrap DEK under new KEK) without re-encrypting all data.

### Mode B — PC Device Vault (native companion) — deferred phase

- **Not claimed working until compiled, signed and runtime-proven.** In web-only slices, Lovable ships: UI, typed bridge contract (`LocalControlAdapter`, `NativeCompanionAdapter`), security protocol spec, and source scaffold under `native/companion/` — nothing runs until a real signed binary is built and tested outside Lovable.
- One vault per PC; shared across approved browsers via loopback HTTPS bridge on random loopback port; self-signed cert trusted at companion install.
- Pairing: companion shows QR → first browser scans → gets short-lived approval token → server writes `devices` row (physical PC) + first `browser_grants` row. Additional browsers on same PC request approval; approved by any already-paired browser or the tray UI. **No new device slot consumed** — same `device_id`.
- **Browser identity is a random locally generated `browser_install_id`** stored in that browser's IndexedDB. **No browser fingerprinting.** If the browser clears its storage, it must re-pair.
- Every bridge request carries: user access token + `browser_grant_token` + origin. Bridge verifies all three.
- Revoke a browser grant without touching the vault. Revoke the PC device revokes the vault access and frees the desktop slot.
- OS keychain integration for KEK once companion exists.
- Feature `pc_vault.available` = false until companion health check passes; UI renders `NativeCompanionRequired`.

### Mode C — Private Sync (Supabase)

- Existing schema. RLS on `auth.uid()` + tenant membership. Respects device cap.

### Adapter contract

```ts
interface StorageAdapter {
  mode: 'browser_only' | 'pc_vault' | 'private_sync';
  read(class_: DataClass, id: string): Promise<...>;
  write(class_: DataClass, id: string, v: ...): Promise<void>;
  list(class_: DataClass, q: Query): Promise<Entry[]>;
  delete(class_: DataClass, id: string): Promise<void>;
  attest(): Promise<AttestationReport>;
}
```

Choice per data class (chats, images, files, recordings, copilot history, replays, resumes, company records, timesheets, accounting).

### DB additions

- Extend `devices`: `device_kind = 'desktop_pc' | 'mobile'`, `physical_pc_id` (random UUID from companion, or WebAuthn-anchored ID pre-companion).
- New: `browser_grants(id, device_id, user_id, browser_install_id, origin, approved_by_grant_id, created_at, revoked_at, last_seen_at)`.
- New: `data_class_privacy(user_id, data_class enum, mode enum)`.
- Update `enforce_device_cap` to count **distinct desktop `device_id`**, not grants. Cap: 2 desktop devices, 2 mobile devices per user.

---

## 7. Signature Trust Network

### Signature record (fields)

`verification_id` (short human ID), `document_hash` (SHA-256, per version), `company_id`, `company_legal_name`, `company_reg_or_tax_id`, `signer_user_id`, `signer_role`, `authority_level`, `country`, `jurisdiction`, `signature_method`, `signed_at`, `document_version`, `certificate_status`, `expires_at`, `revoked_at`, `approval_chain[]`, `audit_ref`, `tamper_status`, plus **new required fields**:

- `certificate_chain` (X.509 chain to a trusted root, when provider issues one)
- `provider_certificate_id` + `provider_name` + `provider_policy_version`
- `trusted_timestamp` (RFC 3161 TSA token) with `tsa_authority`
- `key_id` + `key_generation` (for rotation lineage)
- `revocation_check` (`ocsp_status`, `crl_checked_at`, `next_check_at`)
- `signer_reauth` (`method`: WebAuthn / OTP / DSC PIN / provider MFA; `reauth_at`)
- `signing_policy_id` + `signing_policy_version` (per-company policy that dictated required level)
- `signed_evidence_manifest_hash` (Merkle root over evidence pack files + calculations + assumptions + rule refs)
- `verification_event_history[]` (append-only: every verification attempt — id, at, ip-hash, outcome)

### Authority Matrix (unchanged)

`ai_prepared` → `owner_approved` → `officer_approved` → `company_digital_signature` → `licensed_professional` → `government_provider` → `manual_legal_review`.

FICIA picks required level from country + document type + amount + policy + role + regulator + risk.

### Verification page (`verify.caeracadane.com/<id>`)

- **Never presents verification ID + hash alone as legal validity.** Every response includes a legal-effect disclaimer scoped to jurisdiction and authority level, and shows the full trust context: chain valid?, TSA token valid?, key not rotated out?, OCSP/CRL fresh?, signer reauth captured?, policy version at signing, evidence manifest match.
- States: `valid`, `expired`, `revoked`, `altered_after_signing`, `signer_not_authorized`, `certificate_chain_untrusted`, `timestamp_missing_or_invalid`, `revocation_status_unknown`, `provider_not_configured`, `jurisdiction_review_required`.
- Hash-compare upload: local hash only, never document body. Rate-limited, CAPTCHA on bursts, every attempt recorded in `verification_event_history`.

### Bulk regulator dashboard

CSV of verification IDs → parallel verify → CSV/PDF report. Public-permission signatures or scoped grants only.

### Honesty guardrails

Where DSC / QES / licensed professional / officer signature is legally required, FICIA prepares + packages + routes to the qualified human and records their signature. **Never** simulates authority. Verification page carries: *"Verification confirms the record on file. Legal effect depends on jurisdiction, signer authority, and applicable law."*

### DB additions

`signatures`, `signature_events`, `signature_authorities`, `signature_providers`, `signing_policies`, `certificate_stores`, `revocation_cache`.

---

## 8. Penalty Prevention Engine

- **India-only country pack at launch.** All other countries: `planned` status in registry. India pack must pass: deterministic tests, historical-case testing (last 3 years of well-documented filings), professional review by ≥2 licensed CAs, and a private pilot with ≥5 real companies before pack v1.0 is marked `ga`.
- Data: `country_packs`, `compliance_events`, `company_obligations`, `evidence_packs`.
- Warning stages: (1) early, (2) urgent, (3) filing/payment **blocked** if evidence pack incomplete.
- Never "zero penalties guaranteed"; uncertain rules render `Legal or provider verification required`.
- Evidence pack per filing: source docs (hashes + origin), deterministic calc trace, flagged assumptions, rule refs pinned to pack version, reviewer signature (Authority Matrix), post-filing acknowledgement + receipt matching.

---

## 9. FICIA Full Scope — reordered

Order corrected:

1. Company identity and duplicate prevention
   `(country, registration_number)` + `(country, tax_id)` unique. Display-name similarity warns only.
2. Employees, departments and roles
   Multi-role per user; segregation-of-duties matrix.
3. Group chat and DMs
   §10 primitives.
4. Timesheets and attendance
   §11 rules.
5. Files and document ingestion
   OCR, classification, versioning, retention tags.
6. Invoices and expenses
   Deterministic; approvals; supplier/customer registry.
7. Accounting and reports
   Double-entry engine. Money math never LLM.
8. Payroll
   Country-pack rules; payslip signing.
9. Tax and compliance
   Country-pack rules + calendar.
10. Penalty Prevention
    Evidence packs; blocked-on-incomplete.
11. Signature Trust Network
    Wired across bills, invoices, payslips, filings.
12. Audit and regulator dashboards
    Immutable Compliance Audit Log; bulk verification.

Roles supported (all equal, multi per user): CEO, owner, CA, CMA, accountant, payroll, HR, tax, auditor, finance, treasury, procurement, manager, employee, consultant, advisor. Family / Marriage / Divorce / Asset-Protection module remains a first-class FICIA sibling (educational + document checklists + counsel routing; refuses illegal patterns).

---

## 10. Company Chat and Collaboration

Groups (company, department, role, project, private, cross-tenant with explicit consent), DMs, replies, reactions, edit history (kept), mentions, file mentions, attachments, voice notes, pins, search, read receipts. Message → task / approval / timesheet entry / evidence primitives, each auditable.

---

## 11. Timesheets and Honest Work Measurement

Clock in/out, breaks, shifts, holidays, overtime, projects, tasks, billable/non-billable. Time classes: `manual`, `ai_assisted`, `ai_autonomous`. With per-company written employee consent: detect active/idle/minimized/closed/disconnected; auto-pause after threshold (default 5 min). Never silent keystroke/screen capture. Any recording is opt-in per session with visible indicator.

---

## 12. OCADE — Copilot, Learning, and Honest Identity

### Identity contract (corrected — no falsification)

- **Chat/voice/exports never advertise the underlying provider.** UI shows only "OCADE by CAERA CADANE".
- When a user **directly asks** what model or provider is being used, OCADE answers truthfully: *"I'm OCADE by CAERA CADANE. Your current session is using **{model_display_name}** — you can change this in Model Settings."* Never denies being an AI, never denies that a third-party model powers the response.
- Never claims to be a specific competitor product (never "I am ChatGPT / Claude / Gemini"). Never fabricates that CAERA CADANE built the underlying weights.
- Provider names are always visible in: Model Settings (`/ocade/models`), per-message usage record (expandable), technical diagnostics, exported transcript footers, audit log entries.
- Server-side implementation: `src/lib/ocade/identity.server.ts` injects a system prompt with the above rules, plus a response filter that rewrites competitor self-identification into the truthful form ("I'm OCADE by CAERA CADANE — currently on {model}"). Filter is **truthful**, not concealing.
- Regression tests across every provider × modality × common probe questions ("what model are you", "who made you", "are you ChatGPT", "what company built you").

### Browser copilot

Navigate app tabs, fill in-app forms, permitted downloads/uploads, drive OCADE panels. Cannot control other tabs or apps — stated plainly.

### Native companion copilot (deferred to post-web-core phase)

Mouse, keyboard, terminal, filesystem, clipboard, app launch/switch, screenshots, local Ollama, opt-in recording, OS emergency-stop hotkey. Password/OTP/banking redaction lists. Not claimed to exist until compiled, signed, runtime-proven.

### Intern Learning Replay

Per completed task with consent: original + improved prompt, plan, app, steps, shortcuts, formulas, files changed, result, errors, corrections, time saved → fast replay, normal-speed teaching, pause-at-step, written guide, shortcut list, practice mode, quiz, manual-vs-smart comparison. Skill profiles start with Excel and Blender (verifiable web-instrumentable subset first); Premiere / LS-DYNA / accounting apps require companion.

---

## 13. Premium Themes and Cursor

Dark (default, existing tokens become preset), Light (silver/ivory + gold), REAL (gradients + liquid morph + motion blur, with reduced-motion + low-performance fallbacks). Theme stored in `user_settings.theme`. Cursor picker: system, CAERA Black Arrow, CAERA White Arrow, Auto Contrast (background luminance sampled), Upload Custom (PNG/SVG ≤ 128×128 validated), Size, Trail toggle, Accessibility fallback.

---

## 14. Big-Company Build Strategy

Reusable design system, limited page templates, FeatureRegistry (present) + ActionRegistry (new), typed adapters (`StorageAdapter`, `AIProviderAdapter`, `NotificationAdapter`, `PlatformAdapter`, `LocalControlAdapter`, `PaymentAdapter`, `SignatureProviderAdapter`, `CountryPackAdapter`, `NativeCompanionAdapter`). Vertical slices, feature flags, staged rollout, rollback checkpoint per slice, No-Dead-Button gate walks registry, tenant isolation spec per FICIA slice. Two-log model (§15) enforced.

---

## 15. Logging Model — Compliance vs Operational

**Corrected separation** — do not overload the legal audit log with harmless preference changes.

### Compliance Audit Log (`compliance_audit_log`)

Immutable, append-only, hash-chained (each row includes hash of prior row's canonical form; periodic anchor to Merkle root), retention = country-pack minimum (India: 8 years). Covers ONLY:

- Finance changes (ledger postings, invoice/bill create/edit/void, expense create/edit)
- Payments (initiated, approved, released, failed, refunded)
- Filings (prepared, reviewed, submitted, acknowledged)
- Signatures (created, revoked, re-signed, verification result)
- Approvals (any approval-chain step)
- Role changes (grant/revoke inside a tenant)
- Sensitive exports (accounting export, evidence pack export, employee data export)
- Deletions of any of the above

Written by trusted server functions only. Never editable via UI. Regulator export tool bundles Merkle proofs.

### Operational Activity Log (`activity_log`)

Ordinary product telemetry — theme change, cursor change, chat threads opened, files viewed, non-sensitive setting toggles. Retention short (default 90 days). User can clear their own operational log; compliance log cannot be cleared by users.

Existing `audit_log` table is renamed/repurposed to `compliance_audit_log`; `activity_log` is new.

---

## 16. Pre-Launch Legal, Privacy, Security and Reliability Gate (new)

**Must pass before any public marketing or GA of FICIA/Signature/Penalty modules.**

Legal & privacy:
- Terms of Service, Privacy Policy, Cookie Policy, Acceptable Use Policy — reviewed by counsel.
- DPA (data processing addendum) for company tenants.
- End-user consent flows (chat data usage, model provider disclosure, cross-border transfer notice).
- Employee-monitoring consent workflow (per-company, per-employee written acknowledgement; audit trail; localised copy; India-first).
- Retention policy per data class, published and enforced.
- Data export (self-serve full user export, per-tenant company export).
- Deletion (self-serve account deletion + tenant deletion; grace period; irreversible warnings; compliance log retained per regulator).
- Jurisdiction limitations page listing supported countries and features per country.
- Professional-review boundaries page: what CAERA prepares vs what a licensed professional must sign; disclaimers wired into every regulated action.

Security:
- External security review of signature stack, RLS, and companion protocol (once companion ships).
- Secret management, key rotation policy, SBOM.
- Incident response plan with severity levels, on-call, user notification thresholds.
- Vulnerability disclosure policy + reporting inbox.

Reliability:
- Automated backups (Supabase + object storage), tested restoration drill quarterly.
- Outage handling: status page, degraded-mode banner, feature flag kill switches.
- Monitoring: uptime, error rate, server-fn latency p95, signature-verification success rate, filing block-rate.
- SLOs published for GA modules.

Gate is a checklist route in admin (`/admin/launch-gate`) with per-item status, owner, evidence link, and blocker flag. GA of a module requires all its rows green.

---

## 17. Exact Prompt Sequence

Legend: **Purpose · Builds · Files/Systems · Preserve · Test gate · Rollback · Truthful completion**.

### α0 — Rollback checkpoint (no code)
Record `caera-foundation-alpha-0`. GitHub tag by user after sync. Lovable revert-point noted in `.lovable/plan.md`.

### P3.5 — Integrity hardening (G1-G8)
- Purpose: close all gaps.
- Builds: onboarding gate; `safeNext` accepts absolute-origin URLs; device registration on sign-in (physical PC detection via WebAuthn credential or generated `browser_install_id` pre-companion, promoted when companion arrives); `/settings/privacy` and `/settings/devices` real UI; `ActionRegistry`; `compliance_audit_log` + `activity_log` migration (rename existing `audit_log`); audit writer helper; error boundaries on protected routes; `main_purpose` enum; OCADE identity contract stubbed (returns identity string; wired to chat in P10).
- Files: `_authenticated/route.tsx`, `_authenticated/settings/*`, `src/lib/actions.ts`, `src/lib/compliance-audit.functions.ts`, `src/lib/activity-log.functions.ts`, migration.
- Preserve: auth flow, onboarding wizard, all shells, existing tables/policies.
- Test gate: registry no-dead-button test green; new user forced through `/onboarding`; deep-link post-login lands correctly; 3rd physical PC hits cap; extra browser on paired PC does NOT hit cap; every mutation writes correct log; error boundary catches loader failure.
- Rollback: α0. Truthful completion: gaps closed; two-log split live.

### P4 — Themes + cursor
Three themes, reduced-motion, low-perf fallback, cursor picker + upload. Test: contrast in all themes; persistence across reload. Rollback: P3.5.

### P5 — StorageAdapter + Browser Only (encryption corrected)
Adapter contract; IndexedDB impl with WebAuthn PRF → Argon2id → wrapped DEK; recovery kit generation; unlock/lock flow; per-class privacy UI. Test: DEK never persisted unwrapped; recovery kit round-trip; auto-lock; clearing IndexedDB shows empty state; Private Sync unchanged.

### P6 — Demo Mode
In-memory demo tenant, watermark, destructive actions disabled. Test: no writes to Supabase.

### P7 — ActionRegistry hardening + `/settings/activity` UI
Both logs surface (compliance vs operational, filtered). Test: every action visible within 2s in correct log.

### P8 — Pre-launch Gate scaffold
`/admin/launch-gate` UI + rows for every §16 item; module GA gated on flag. Test: enabling a module without gate-green fails.

### P10 — OCADE chat + honest identity
Chat UI (threads, projects, files upload), server fn `ocade.chat`, `identity.server.ts` implementing §12 (truthful, model-name-disclosing when asked; provider hidden from casual UI). Lovable AI Gateway default; OpenAI/Ollama wired but exposed only in P13. Regression tests: identity honesty across providers and probes.

### P13 — Model Settings
`/ocade/models` shows providers, per-request usage records, technical diagnostics. Truthful-completion: no provider name leaks outside these surfaces; when-asked truthful disclosure works.

### P16 — CANIA shell (no providers)
Full IA, saved topics, alerts, filters — all data surfaces `SetupRequiredState`. Test: grep denies fixtures.

### P18 — MADEE Resume Builder
End-to-end resume, versions, export. Storage per user's per-class choice.

### P19 — India country pack framework
`country_packs`, `compliance_events`, admin loader, versioned schema, source citations, deterministic test harness. Only India pack is authored. Others remain `planned`. Test: pack loads; deterministic tests pass; historical-case tests pass.

### P20 — FICIA-1: Company identity + duplicate prevention
Company create/edit, legal profile, GSTIN/PAN/registration validation, unique constraints, review-before-create step. Test: duplicate registration blocked; similar display name only warns.

### P21 — FICIA-2: Employees, departments, roles
Multi-role, segregation-of-duties matrix, approval chains. Test: SoD violation blocked.

### P22 — FICIA-3: Company chat + DMs
Groups, DMs, message→action primitives, cross-tenant consent record. Test: tenant isolation.

### P23 — FICIA-4: Timesheets + attendance
Clock, breaks, idle/minimized detection with consent, auto-pause, reports. Test: no capture without consent; auto-pause fires.

### P24 — FICIA-5: Files + document ingestion
OCR, classification, versioning, retention tags. Test: version hashes stable.

### P25 — FICIA-6: Invoices + expenses (deterministic)
Test: money math unit tests; approvals wired.

### P26 — FICIA-7: Accounting engine + reports
Double-entry ledger; P&L, balance sheet, cash flow. Test: LLM cannot touch postings; deterministic replay.

### P27 — FICIA-8: Payroll
India pack rules; payslip generation; signing via Authority Matrix. Test: payroll numbers deterministic; payslip signature recorded.

### P28 — FICIA-9: Tax and compliance (India)
GST, TDS, income tax filings prep; calendar. Test: pack version pinned in every evidence pack.

### P29 — FICIA-10: Penalty Prevention Engine
Obligations, three-stage warnings, evidence-pack-required blocking. Test: incomplete evidence blocks; three stages fire on schedule.

### P30 — FICIA-11: Signature Trust Network
Signature records, Authority Matrix, verification page, hash-compare upload, bulk regulator dashboard, chain/timestamp/revocation/reauth/policy/manifest/event history. Test: altered doc detected; expired cert flagged; missing TSA flagged; unauthorized signer flagged; every response includes legal-effect disclaimer.

### P31 — FICIA-12: Audit + regulator dashboards
Compliance log export with Merkle proofs; regulator bulk verification; retention enforcement. Test: log immutability; export replay verifies.

### P32 — Family/Marriage/Divorce/Asset-Protection FICIA module
Educational + document checklists + counsel routing. Refuses illegal patterns. Test: refusal cases enumerated.

### P33 — Pre-Launch Gate closure for FICIA India GA
Every §16 row green; module flipped to `ga` behind flag. External security review completed for signature stack.

### P34 — OCADE Computer Copilot (browser mode) + task replay
Test: visible plan/pause/stop; replay artifact per run.

### P35 — Native Companion v1 (post-web-core)
UI + typed bridge contract + security protocol + source scaffold shipped inside Lovable. Real Windows build produced and signed **outside Lovable**, runtime-tested, then feature flag `pc_vault.available` flips true. macOS/Linux follow-ups.

### P36 — PC Device Vault activation (only after P35 runtime proof)
Pairing, browser grants, OS-keychain KEK, revocation.

### P37 — Intern Learning Replay (post-companion for OS-level; web-instrumentable skills earlier)

### P38 — CANIA providers (news, weather, FX first)

### P39 — Cross-platform packaging (Tauri desktop, Capacitor mobile)

### P40 — Enterprise: SSO, SCIM, DPA surfaces, tenant admin export

Slices halt on failed test gates. No slice claims completion of a later slice's scope.

---

## 18. Acceptance Tests (per slice minimum)

UI (mobile/tablet/desktop) · Zod both sides · service via server fn/adapter · storage class correct per user · RLS + role check + tenant isolation spec · **correct log target** (compliance vs operational) · states (loading/empty/error/SetupRequired/NativeCompanionRequired/AccessDenied) · No-Dead-Button registry walk · identity honesty regression (OCADE slices) · country-pack determinism (FICIA slices) · signature trust chain checks (signature slices).

CI-style locally: `bunx vitest run` and `tsgo`. No slice ships red.

---

## 19. Risks and Fixes

| Risk | Reality | Mitigation |
|---|---|---|
| "AI signature replaces legal signature" | False. | Authority Matrix; human sign-off routing; verification page discloses legal-effect limits. |
| "Guaranteed zero penalties" | Impossible. | Penalty engine + evidence-required blocking; never zero-promise. |
| Cross-browser same-PC vault seems trivial | Requires native bridge. | Companion + loopback HTTPS + pairing; feature gated until proven. |
| Web ≠ OS control | True. | Browser copilot does browser things only; rest requires companion; UI states this. |
| Provider falsification | Illegal / dishonest. | Truthful identity contract: identity always CAERA, model disclosed when asked, always visible in settings/usage/diagnostics. |
| Verification ID = legal validity | False. | Chain, timestamp, revocation, reauth, policy, manifest, event history — plus explicit legal-effect disclaimer. |
| Encryption key at rest | Unsafe if plain. | KEK-wrapped DEK, WebAuthn PRF / Argon2id, recovery kit, unrecoverable warnings. |
| Native companion "already works" | False until built + signed + tested. | Deferred to P35+; only UI + contract + scaffold in web phase. |
| Free-form LLM money math | Wrong. | Deterministic engine; LLM writes narrative only. |
| Country pack drift | Laws change. | Versioned packs; source URLs; stale warnings; India-only until pilot passes. |
| Overloaded audit log | Legal/perf risk. | Two-log split; compliance immutable + hash-chained; operational short retention. |
| Cross-tenant leak | Common failure. | Isolation spec in every FICIA slice. |
| Trillion-dollar promises | Not credible. | Plan separates ambition from feasibility and milestones. |

---

## 20. Honest Completion Estimate (corrected — no single %)

Baseline = the full CAERA CADANE scope described here, not Foundation Alpha alone.

| Track | Today | After P3.5 | After P10 | After FICIA India GA (P33) | After P36 | After P39 |
|---|---|---|---|---|---|---|
| Web GUI (shells + module surfaces) | ~30% | ~35% | ~45% | ~75% | ~80% | ~90% |
| Web workflows (routing, auth, adapters, chat, docs) | ~15% | ~25% | ~40% | ~70% | ~75% | ~85% |
| **Verified finance / compliance (deterministic + reviewed + piloted)** | 0% | 0% | 0% | India ~60% (v1 pilot); other countries 0% | India ~65% | India ~75% |
| Signature Trust Network (chain + TSA + revocation + verification page + regulator dash) | 0% | 0% | 0% | ~60% (India pilot) | ~65% | ~75% |
| Native runtime (companion binary signed + runtime-proven) | 0% | 0% | 0% | 0% | Windows ~60% (signed + tested); macOS/Linux 0% | Windows ~70%; macOS ~40%; Linux ~20% |
| Cross-platform packaging (Tauri desktop shell + Capacitor mobile) | 0% | 0% | 0% | 0% | 0% | Desktop ~50%; mobile ~30% |

Rules:
- "Verified finance/compliance" advances only after deterministic tests + historical cases + professional review + private pilot for that country.
- Native runtime cannot advance from 0% inside Lovable — advances only when a real signed binary is compiled and runtime-tested outside Lovable.
- Do not describe the product as "90% complete" because most screens exist. Screens ≠ verified finance ≠ signed native runtime ≠ shipped mobile app.

---

## 21. What Lovable Can Complete

All web UI, all server functions (chat wrapper, identity guard, deterministic accounting, country pack loader, signature records, verification API, evidence pack builder, log writers), Supabase schema/RLS/triggers, India country pack authoring surface, Browser Only storage (with corrected encryption), Demo Mode, browser-mode copilot, regulator dashboards, verification page, launch-gate admin, regression tests.

---

## 22. What Requires Native Companion or Providers

**Native companion (Tauri sidecar / Capacitor plugin)** — PC Device Vault, cross-browser pairing, OS keychain KEK, mouse/keyboard/terminal/filesystem/clipboard/app control, screenshots, local Ollama, OS emergency-stop, screen recording, OS-level Intern Learning capture. Must be compiled + signed + runtime-proven; not claimed until so.

**External providers** — signature (DSC via emSigner-class client, DocuSign/Adobe Sign, eIDAS QES via Namirial/InfoCert), TSA (RFC 3161 provider), revocation (OCSP responders / CRLs), CANIA (news/weather/FX/traffic/markets), payments (Stripe/Paddle via connectors), banking (Account Aggregator India first; Plaid/Salt Edge later), gov filing (GSTN first; HMRC/IRS later), SSO/SCIM.

Every such item shows `SetupRequired` or `NativeCompanionRequired` until connected — never faked.

---

## 23. Final Best Version

- **Web** — full UI, Browser Only storage (WebAuthn-anchored), Private Sync, browser copilot, all evidence + verification surfaces, deterministic finance, India country pack.
- **Desktop companion** (Tauri, post-P35) — PC Vault, cross-browser pairing under one desktop slot, full computer control, local Ollama, Intern Learning capture, opt-in recording, OS-keychain KEK.
- **Mobile companion** (Capacitor) — 2 mobile-device cap, secure enclave keys, push, offline replays.
- **Verification network** — `verify.caeracadane.com` with chain + TSA + revocation + reauth + policy + manifest + event history.
- **India country pack GA first**; other countries follow the same pilot bar.
- **Identity contract enforced everywhere** — "OCADE by CAERA CADANE" always visible; model name always truthfully available on request and in settings/usage/diagnostics.

Roadmap discipline: α0 → P3.5 → P4 → P5 → P6 → P7 → P8 → P10 → P13 → P16 → P18 → P19 → P20-P32 (FICIA in reordered sequence) → P33 (India GA gate) → P34 → P35-P36 (native companion + vault) → P37 → P38 → P39 → P40.

No slice starts until previous test gate is green. No claim ships unbacked. Rollback checkpoint at every boundary.

---

## Approval

Approve to switch to Agent mode. On approval I record **α0** then execute **P3.5** (integrity hardening) — no other slice starts until P3.5 test gate is green.
