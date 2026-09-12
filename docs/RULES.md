# OCADE Engineering Rules

## 1. Simplicity wins

If a final behavior can be delivered with fewer routes, stores, components or runtimes, use the smaller architecture.

High-quality obsolete code is still obsolete. Delete it.

## 2. Read before delete

Aggressive cleanup is required, but every deletion first traces reachable callers, data dependencies, security implications and the final behavior that replaces it.

After the first cleanup, read the reduced repository again before rebuilding.

## 3. No duplicate authorities

One identity authority. One usage authority. One Chat store. One Library authority. One online-intelligence boundary. One Offline Intelligence manager. One Cowork runtime after PLAN2.

Do not create `v2`, `new`, `replacement`, duplicate hooks/stores/routes when the canonical authority can be replaced directly.

## 4. Customer UI hides plumbing

Normal UI never displays the internal offline model name, provider/model identifiers, GGUF, hashes, WebGPU/WASM, key slots, process details or raw diagnostics.

Customer terms: `OCADE`, `Auto`, `Offline`, `Offline Intelligence`.

## 5. Never redownload a valid model because app code changed

Website SHA, deploy SHA, service-worker version, login state and account state are not model identities.

Reuse a verified compatible OPFS model. Download only absent/incompatible bytes; repair only missing/corrupt chunks.

## 6. Secrets stay server-side

Gemini keys live only in server/Edge Function secret storage. Never expose them to browser code, normal database tables, source control, logs or artifacts.

## 7. Usage cannot be bypassed

All AI-generating surfaces share the same account allowance. Offline is not a loophole. One successful user request counts once; internal execution steps do not multiply the charge.

## 8. Persistent customer content belongs in Supabase

Normal durable chats/files/settings/account content → Supabase/PostgreSQL/private Storage.

OPFS → model data only.

RAM → transient execution/UI state.

## 9. Automation must be truthful

No browser/computer/file action is reported complete before re-observation/postcondition verification. Unsupported/unavailable actions fail closed.

## 10. UI stays sparse

Use the design references for simplicity and density, not copied branding/assets. Avoid card walls, long explanations, duplicate controls and permanent diagnostic panels.

## 11. Accessibility and performance are requirements

Keyboard, focus, screen-reader semantics, reduced motion, responsive layout and safe-area/virtual-keyboard behavior are mandatory. Heavy runtimes are lazy-loaded.

## 12. Database cleanup is migration-safe

Never drop a table/function merely because a page disappeared. Prove no final caller needs it, decide data disposition, migrate, verify RLS/grants/types and retain rollback capability.

## 13. Plans are sequential

`PLAN.md` must finish first. Do not integrate OCADE JARVIS early. `PLAN2.md` starts only after the core product is proven.

## 14. Markdown is canonical and minimal

Allowed Markdown files only:

- `CLAUDE.md`
- `PLAN.md`
- `PLAN2.md`
- the eleven canonical docs in `docs/`.

Do not add more Markdown. Put generated evidence in machine-readable files.

## 15. No fake green

A skipped/unavailable hardware or deployment proof is named as external/unproven, never converted into a passing test.

## 16. Measure the result

Record tracked source LOC before cleanup, after PLAN and after PLAN2 using the same deterministic inclusion/exclusion rules. LOC is a measurement, not a target that overrides correctness.
