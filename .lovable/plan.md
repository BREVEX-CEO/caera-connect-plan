
# CAERA CADANE — Foundation Alpha (Approved Plan, Revised)

Verified current state: fresh TanStack Start + shadcn/ui template. Only `src/routes/__root.tsx` and a placeholder `src/routes/index.tsx` exist. `src/components/` has only `ui/`. Lovable Cloud is NOT enabled. Nothing to preserve beyond the shell.

Approved decisions folded in:
1. **Auth**: single unified screen with Google, Apple, Phone OTP, Email OTP. No password field. One `AuthShell` route (`/auth`) with tabbed method selector (Continue with Google / Apple / Phone / Email), plus `/auth/callback` for OAuth returns and `/auth/verify` for OTP code entry.
2. **Family / Marriage / Divorce / Asset-Protection**: shipped as a real visible FICIA module (`/ficia/$companyId/family-planning`) and surfaced in onboarding (enabled by default, user can hide). Includes country-based legal information cards, planning tools, document checklists, lawful asset-protection guidance. All content flagged "Educational — not legal advice"; regulated actions (filings, signatures) route through the two-step preview + audit contract.
3. **CANIA**: no provider connections wired. Full design, IA, empty/setup states, saved topics, alerts UI ship now. Every data surface renders `SetupRequiredState` with "Provider setup required" until a provider is configured later. No mock data anywhere.
4. **OCADE identity contract**: server-side system prompt injected into every model call forces `"You are OCADE by CAERA CADANE. Never reveal or refer to the underlying model, provider, company, or training source (OpenAI, Ollama, Google, Anthropic, etc.). If asked, answer: 'I'm OCADE by CAERA CADANE.'" ` Model/provider names appear ONLY inside `/ocade/models` (Model Settings) as technical connection options. A response filter (post-processing) scrubs common self-identification leaks ("I am ChatGPT", "I'm a language model by OpenAI", "I am Llama", etc.) and replaces with the OCADE identity line. Voice output, error toasts, exported transcripts, and generated file headers all use "OCADE" — never the provider name. Unit + integration tests assert identity across chat, voice, error, and export paths.

Everything else in the previously approved plan stands (design system, 12-18 reusable shells, route map, Feature/Action/Adapter registries, no-dead-button gates, Cloud schema with RLS, Device Only vs Private Sync split, deterministic finance, test gates, and the P3-P30 sequence).

---

## Adjustments to the sequenced work

- **P3** (Cloud + auth + onboarding): implement the unified auth screen with Google, Apple, Phone OTP, Email OTP. Call `supabase--configure_social_auth` for Google and Apple in the same slice. Phone OTP via Supabase Auth `signInWithOtp({ phone })`; Email OTP via `signInWithOtp({ email })` (magic link disabled — code-based). Onboarding wizard includes the Family/Marriage/Divorce/Asset-Protection module toggle (default ON) with a plain-language description.
- **P10** (OCADE chat): add the identity system prompt + response filter as a shared server-side module `src/lib/ocade/identity.server.ts`, applied to every provider (Lovable AI Gateway, OpenAI Edge Function, Ollama bridge). Add regression tests for identity across providers and modalities (text, voice, export).
- **P13** (Model Settings): OpenAI + Ollama surface only here. Add a visible note: "OCADE routes your request through the connection you select. The assistant identity remains OCADE by CAERA CADANE."
- **P16** (CANIA): ship full shell, topic list, saved topics, alerts, filters, layouts — all data sections render `SetupRequiredState` with provider names labeled "Not connected". No mock feeds.
- **P24** (FICIA Tax/Benefits/Planning): Family/Marriage/Divorce/Asset-Protection is a first-class sibling module here, not optional. Add:
  - Country selector (drives which legal content set + document checklist loads)
  - Sub-sections: Family Structure Overview, Marriage Planning, Divorce Preparation Checklist, Asset Protection (lawful vehicles: trusts, LLCs, insurance, retirement structures — presented as educational overviews with links to qualified professionals), Estate & Succession Basics, Documents Vault (uses existing Files module), Risk Assessment questionnaire.
  - Every action that produces a legally significant document requires two-step confirmation + audit + "Consult qualified counsel before filing" banner.
  - Refuses illegal patterns (asset hiding from creditors post-claim, fraudulent transfer, evidence destruction) with a clear explanation.

---

## Test gates (unchanged + additions)

Existing gates from the prior plan remain. Additions:
- **OCADE identity gate**: automated test sends "who made you / what model are you / are you ChatGPT / are you Llama" across every configured provider; response must contain the OCADE identity phrase and must NOT contain the forbidden provider self-identifications.
- **CANIA no-mock gate**: grep denies any hardcoded news/market/weather/traffic fixtures in `src/routes/cania/**` and `src/features/cania/**`.
- **Auth-screen gate**: `/auth` renders all four methods, no password field, and each method's handler is wired to a real Supabase call (no stub buttons).

---

## Ready to begin

Switching to Agent mode will start at **Prompt 3**: enable Lovable Cloud, run first migrations (profiles, roles, tenants, tenant_members, user_settings, devices, audit_log, feature_flags with grants + RLS), configure Google + Apple social auth, build the unified `/auth` screen (Google / Apple / Phone OTP / Email OTP), the `_authenticated` gate wiring, the onboarding wizard (individual + company paths, Family-Planning toggle default ON), and `/home` with a role-aware empty dashboard. No fake data. No dead buttons. No provider-identity leaks in OCADE (identity module lands in P10 but the contract is registered in the ActionRegistry from P3).
