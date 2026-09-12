# OCADE Project Memory

## Current mission

OCADE is executing the simplification/rebuild mission in `PLAN.md`. The previous broad implementation was completed and merged to `main` at commit `4424a15abfe0fcf6b0e5550a0ee27095e7522029`, but that architecture is now intentionally superseded by the product decisions in these rewritten authorities.

Implementation branch: `claude/ecstatic-goldberg-4nycdu`, created from `origin/main` at `36df21d692ab22181b9637d7d4b6770d3b801405`.

## Progress

### Phase 0 — baseline, total read and isolated branch — DONE

- Baseline measured with `node scripts/measure-loc.mjs --by-dir` on the tracked source tree: **1904 files, 398,999 lines**.
- Method: git-tracked files with source extensions (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .css .sql .rs .py .java .kt .swift .html .sh`), excluding `node_modules/`, `dist/`, `build/`, `docs/design-references/`, `vendor/`, `*.d.ts`, `*.gen.ts`, `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts`. The same command is used at every later checkpoint.
- Top-level baseline: src 292,770 · scripts 43,935 · native 34,482 · supabase 22,259 · extension 2,213 · root 698 · ios 668 · mobile 629 · public 523 · android 504 · relay 318.
- Full KEEP/REUSE/REPLACE/DELETE map recorded in `release/OCADE_PLAN_CLASSIFICATION.json`.

Traced final authorities that must survive: Supabase Auth/integration, `src/lib/security`, `src/lib/commercial` (usage), `src/lib/limits` (rate limiting only), `src/lib/intelligence` + `supabase/functions/ocade-intelligence` (Gemini boundary), `src/lib/brain` OPFS model lifecycle, `src/lib/ocade-chat-store.ts` + `ocade.functions.ts`, `src/lib/files`, account/notification settings, payments/entitlement authority, hidden admin gate, legal/founder content.

Phase 0 decisions: one offline runtime backend (WASM GGUF, `@wllama/wllama`) because the stored model is a GGUF and an MLC/WebGPU backend would need a second model; `commercial` is the single usage authority; Supabase rows are the only chat storage.

## New final product

Primary customer destinations:

- Chat
- Library
- Cowork, with Cowork/Jarvis modes inside it
- Account → Settings

Public retained pages: About, Help, Terms, Privacy.

Retired as standalone customer products: Code, Projects, Tasks, Artifacts, Customize, Devices, Search dashboard, pricing, old landing, desktop/Copilot and old Jarvis/Cowork UI.

## Execution order

1. `PLAN.md`: read/scan, aggressive cleanup, read again, then rebuild Chat/Auth/Usage/Gemini/Offline Intelligence/Library/Settings/Supabase core.
2. Prove the core completely.
3. `PLAN2.md`: extract `.incoming/OCADE_JARVIS.zip`, make it the canonical Cowork/Jarvis runtime, delete superseded old runtimes, then prove full product.

Do not start PLAN2 early.

## UI references

The only visual UI reference set is:

- `docs/design-references/grok/` — primary and sole layout/density/UI reference.

Use `docs/UI_REFERENCE_CHECKLIST.md` for the lightweight production checklist.

The former Stitch/Jarvis 3D reference folder/archive is removed and must not be treated as a design source. Build original OCADE UI; references do not authorize proprietary asset/copy cloning.

## Offline Intelligence

Internal model: Qwen 2.5 1.5B, never customer-facing by real name.

Customer terms: OCADE / Offline / Offline Intelligence.

Required lifecycle: automatic first-visit preparation, OPFS, adaptive parallel chunks, resume, integrity verify, repair only missing/corrupt chunks, install once, reuse across refresh/sign-in/out/service-worker/deploy/commit/main merges. Model identity is independent of app SHA.

## Online Intelligence

Use exactly these Supabase server/Edge secrets:

- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_SECONDARY`
- `GEMINI_API_KEY_TERTIARY`

Never put them in normal tables/browser bundles.

## Usage

Free: 28 successful user requests / 388 minutes, account-wide across devices and online/offline. One successful user request counts once even when Cowork later performs many internal steps.

## Auth

Supabase Auth remains authority. Primary Google, plus email OTP and phone OTP with country picker. Optional password may live under Account. Production provider availability must match actual configured delivery/provider state.

## Supabase

Last verified live project before redesign: `sazhgaisyhkdbrooycdv`. Re-verify before migrations.

The redesign will remove database objects dedicated only to retired standalone products after final dependency tracing. RLS/least privilege and the single subscription/usage authorities remain mandatory.

## OCADE JARVIS donor

Archive: `.incoming/OCADE_JARVIS.zip`.

The owner wants its donor feature set retained when PLAN2 begins. It becomes the single Cowork runtime. Normal Cowork is prompt/task UI; Jarvis is online-Gemini voice/hands-free presentation over the same runtime.

## Agent defaults

Always:

```text
/ponytail full
/caveman full
```

Ponytail controls engineering behavior. Caveman compresses chat output only. Correctness/PLAN authority always wins over compression.

## Next action

`PLAN.md` Phase 1 — approximately 90% legacy cleanup. Execute the deletion map in
`release/OCADE_PLAN_CLASSIFICATION.json`, remove the retired dependencies, remeasure with
`node scripts/measure-loc.mjs --by-dir`, then reread the reduced repository before rebuilding.

Update this file after every verified major phase with current branch/SHA, completed gate, exact next action and LOC checkpoints when measured.
