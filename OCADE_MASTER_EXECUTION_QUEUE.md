# OCADE Master Execution Queue

Re-audited against the uploaded specification and **real production reachability**, not against
earlier summaries. The previous "Source 100%" claim was re-checked requirement by requirement; it
survived, but only after the orphan scan was found to have a blind spot (see Logic row) that had
hidden three unreachable modules.

- Branch `feat/ocade-implementation` · HEAD `52cd6cf` · 0 commits, 0 staged, 0 deleted
- Gates: typecheck **0** · lint **0** · **3474 tests / 221 files / 0 failures** · build **pass** · **24/24** gate scripts
- Production dependencies: **0 vulnerabilities**

## Status vocabulary

| Term | Meaning |
|---|---|
| **runtime-proven** | Executed for real in this environment; evidence recorded |
| **simulated** | Exercised through a real harness with an injected seam, not the real device |
| **source-only** | Implemented and unit-tested; never executed against its real target |
| **externally blocked** | Cannot proceed without an absent prerequisite |
| **complete** | Source + wiring + tests done, to the limit this environment allows |
| **incomplete** | Work remains that this environment *can* do |

---

## 1. Chat

**complete (source + wiring) · partially runtime-proven**

Conversations, history, projects, files, memory, citations, streaming, persistence, model routing,
cancellation, retries, error states, recovery are implemented and wired. Every chat store
(`ocade-chat-store`, `local-memory`, `chat-citation-store`, `madee-local-store`) was re-checked for
reachability after the orphan scan was widened — **all are wired; there are no disconnected stores.**

- Files: `src/lib/ocade-chat-store.ts`, `local-memory.ts`, `chat-citation-store.ts`, `src/lib/chat/*` (3), `src/routes/_authenticated/ocade.tsx`
- Evidence: full suite; **runtime**: demo chat exercised in a real browser — a real question was typed and Send clicked; the reply **refused to answer** and the network log showed **no POST to any model endpoint**
- Fixed this session: unbounded stream accumulation (2M char / 1M line caps, failing loudly not truncating)
- **Next action:** none available here. Real model streaming needs a local model or gateway key.

## 2. Logic and orchestration

**complete (source + wiring) · simulated**

- Files: `src/lib/work/orchestrator.ts`, `src/lib/skills/*` (39)
- Evidence: work-orchestrator runtime test drives **real files and a real on-disk journal**; proves a
  lost acknowledgement never repeats a committed mutation
- **Defect found and fixed this session:** the orphan scan required one of seven named subdirectories
  under `lib/`, so every top-level `src/lib/*.ts` module had never been checked for reachability.
  Widened to all of `lib/`; exposed 3 previously invisible orphans.
- **Next action:** none available here.

## 3. Copilot / Cowork loop

**complete (source) · simulated**

OBSERVE → PLAN → VALIDATE → PERMISSION → EXECUTE → VERIFY → RECEIPT → RECOVER → CONTINUE is
implemented end to end. Verified present: cancellation (8 modules), recovery (10), resume (6),
pause (4), emergency stop (2), idempotency, **no-progress detection** (`skills/progress-monitor.ts`
wired into the orchestrator with four halt causes).

- Evidence: governed-run + orchestrator suites; duplicate-mutation prevention proven against a real journal
- **Next action:** none available here. Multi-app and crash-recovery proof needs the companion (blocker 1).

## 4. Local model

**source-only · externally blocked**

Hardware detection, model selection, download, hash verification, startup, health, provider
discovery, fallback, offline use, repair, update and rollback are implemented behind an injected
fetch.

- Files: `src/lib/ocade-local.ts`, `src/lib/providers/*`
- Evidence: unit + a real endless-stream test proving the reader terminates
- **Blocked by:** no local model installed and no gateway key
- **Next action (human):** install a local engine, or set `LOVABLE_API_KEY`/`OPENAI_API_KEY` → `npm run -s setup:check`

## 5. Desktop / PC control

**source-only · externally blocked — this is the largest remaining gap**

Route hierarchy is complete and risk-aware: API → plug-in → CLI → file editing → browser DOM →
accessibility → native API → vision/Set-of-Mark → scoped input. High-risk mutations **cannot silently
downgrade** to vision or keyboard. Companion command surface implemented: `accessibility.read`,
`app.open`, `clipboard.read/write`, `file.open`, `screen.read`, `selection.read/replace`, `text.type`,
`window.list/focus/arrange`.

- Files: `src/lib/control/route-selector.ts`, `perception.ts`, `src/lib/native/*` (8), `src/lib/skills/app-map.ts`, `rehearsal.ts`, `native/companion/safety` (Rust)
- Evidence: unit + SSR; Rust `cargo fmt` and `clippy -D warnings` **pass**
- **Blocked by:** MSVC absent. `cargo test` compiles **109 object files** then fails at link — GNU coreutils `link` shadows MSVC's linker
- **Next action (human):** install VS Build Tools ("Desktop development with C++") → `cd native/companion/safety && cargo test --all-targets` from the x64 Native Tools Command Prompt

## 6. Browser control

**source-only · externally blocked**

- Files: `src/lib/native/extension-bridge.ts`, `extension-protocol.ts`, `browser-bridge.ts`
- **Blocked by:** extension never loaded into Chrome/Edge
- **Next action (human):** load the unpacked extension, then pair with the local runtime

## 7. Mobile

**source-only · externally blocked** (`reconnect-protocol.ts` declared non-runtime)

- Files: `src/lib/mobile/*` (9), `android/`, `ios/`
- Evidence: signed/scoped command tests; fail-closed Android and iOS bridges
- **Next action (human):** install Android SDK + JDK → `gh workflow run platforms.yml -f target=android`

## 8. Voice

**complete (source + wiring) · partially runtime-proven**

- Files: `src/lib/ocade-voice.ts`, `src/lib/voice/transcript-redaction.ts`, `src/lib/providers/multimodal-registry.ts`
- **Fixed this session:** the `VoiceProvider` contract required `synthesize(): ArrayBuffer` and
  `transcribe(buffer)`, which **no browser engine can do**. Registering the real engine would have
  needed two stub methods that could only throw. Contract corrected; the real system provider
  declares only `speakAloud`.
- Evidence: redaction proven on both dictation and read-aloud paths
- **Next action:** none available here. Microphone/speaker proof needs a device session.

## 9. Security

**complete · partially runtime-proven**

- **Runtime-proven this session:** the sign-in surface has **no password field on any tab** — Google/Apple
  OAuth, Phone `type=tel`, Email one-time code. Spec §2.3 satisfied structurally: the field does not
  exist to capture.
- Relay: **runtime-proven** — real spawned process over real HTTP/SSE; refuses non-sealed envelopes,
  caps a room at 2 listeners, keeps no history
- Fixed this session: relay replay hole, device-revocation bypass, unbounded streams
- **Next action:** adversarial suite against a live companion — blocked by blocker 5.

## 10a. Settings reachability (closed this session)

**complete**

A section marked `active` renders one of two ways: a dedicated `settings.<slug>.tsx` route, or an
entry in the `$section` catch-all map. With NEITHER it silently falls through to Setup Required -
the menu advertising a working section that says it is not set up. Nothing checked this; the status
and the two mechanisms live in three separate files and could drift apart silently.

- Files: `src/lib/__tests__/settings-sections-reachable.test.ts`
- Evidence: 4 assertions; **proven to fail** on an injected ghost section, then restored
- Audit result: **no defect** - all 16 active sections resolve (6 via the catch-all, 10 via dedicated routes)
- **Next action:** none.

## 10. GUI

**runtime-proven (credential-free surfaces) · authenticated surfaces blocked**

All 11 public routes return 200, no 404 render, no server-error text. All 7 demo surfaces exercised in
a real browser. No horizontal overflow at 375×812 on any route. Theme toggle verified both directions
with accessible labelling. 404 → "Go home" recovery proven. Task toggle round-trip proven. Five
distinct honest blocked states verified, incl. CANIA refusing to fabricate news/weather/markets.

- **Next action:** authenticated GUI needs sign-in (blocker 8).

## 11. Authentication

**source-only · externally blocked**

- Evidence: auth surface structure verified; no password field anywhere
- **Next action (human):** connect Supabase + set the three keys → apply the 31 migrations

## 12. Database

**complete (source) · not applied**

**31 migrations / 31 rollback / 31 verification.** Pairing, `IF EXISTS` guards, transaction wrapping
and raising verifications are all enforced by `supabase-sql-discipline.test.ts`. The 8 short rollbacks
are deliberate documented no-ops for `REVOKE` migrations — auto-reverting would re-open access closed
on purpose.

- **Next action (human):** apply migrations after Supabase is connected. **Do not apply without approval.**

## 13. Payments

**source-only · externally blocked**

- Files: `src/lib/allowance*`, entitlement modules
- **Next action (human):** choose a provider and supply sandbox keys; no live charges.

## 14. Packaging

**source-only · externally blocked**

- Files: `native/companion/tauri/tauri.conf.json`, `.github/workflows/release.yml`
- Evidence: CI workflows validated (3 parse, 7 jobs have runner+steps, 12/12 `npm run` refs resolve)
- **Next action (human):** generate a Tauri updater key pair, replace `REPLACE_WITH_SIGNING_PUBLIC_KEY`

## 15. Installation

**source-only · externally blocked**

- **Next action (human):** clean-Windows VM install test after the companion builds (blocker 5).

## 16. Updates

**complete (source + wiring) — done this session**

`update-plan.ts` was implemented and tested but reachable from **no route** — the rules protecting a
user from an unsigned update were invisible. Now wired to `UpdatePolicyPanel` at
**Settings → Application → Updates**, running the real planner at render time: unsigned → REFUSED,
no content hash → REFUSED, older → skipped, upgrade floor named, signed newer → would install. States
plainly that automatic updates are unavailable while the signing key is a placeholder.

- `update-signature.ts` remains declared non-runtime: real Ed25519 verification with no production
  consumer until a real key exists.
- **Next action:** none available here.

## 17. Recovery

**complete (source) · simulated**

- Evidence: checkpoint/resume, recovery-graph, crash-window proof against a real journal; relay
  reconnect reconciliation
- **Next action:** process-restart recovery needs the companion (blocker 5).

## 18. Production verification

**incomplete — 8 external prerequisites**

1 of 9 present (Rust only). Ordered by unlocked value: **MSVC** → **Supabase** → free tools → Docker →
sign-in → gateway key → Android SDK → signing key.

---

## Queue rule

Any row marked **incomplete** with an available next action is worked before any blocked row. As of
this audit, **no row has an available next action that does not require one of the 8 prerequisites.**
