# OCADE — Complete Path to 100%: Full Phase-by-Phase Implementation Plan

Upload this once. Send **one phase as one goal prompt at a time**, only after the previous
phase reports back with real command output. Never send this whole file as one goal — your
own audit already caught false "100%," "71%," and "24/24 gates" claims, every one of them
produced by a broad goal instead of a scoped one.

**Transparency note:** sections 3.4–3.6 below (macOS, mobile, hosted staging) are built from
the category names and the "not complete" list already confirmed earlier in this project,
not a verbatim copy of your source document's exact bullet wording for those sections — a
tool error prevented re-reading that exact passage this session. Have Claude Code cross-check
those three sections against your own source file's §5.11–§5.16 for exact wording before
executing them, if precision on the exact original phrasing matters to you.

---

## 1. Definition of Done — Read This Before Every Phase

### 1.1 The evidence ladder (applies to every requirement, no exceptions)

```
NOT STARTED
  → SOURCE COMPLETE (code exists, not wired to a real entry point)
    → PRODUCTION WIRED (reachable from a real route, still untested)
      → UNIT TESTED
        → INTEGRATION TESTED (real collaborators, no mocks, still not the real target)
          → SIMULATED RUNTIME VERIFIED (ran against a twin/simulator, not the real thing)
            → HOSTED RUNTIME VERIFIED (ran in real CI, not on the real target device)
              → REAL-TARGET RUNTIME VERIFIED (ran on the real device/app/network)
                → PRODUCTION READY (also passed security, packaging, clean-machine,
                  long-duration, and monitoring checks)
```

A requirement is not "done" until it reaches REAL-TARGET RUNTIME VERIFIED at minimum. Source
existing, or tests passing in a mock, is real progress — it is not done.

### 1.2 Function-level checklist (every button, every action, every route)

Worked example — the send button: it exists because a typed message with no way to submit it
makes the whole chat feature dead. It works by checking, on click, whether the trimmed text is
empty (`if` empty — don't send, leave the box active, no blank message ever enters history;
`else` — send it, show it immediately, clear the box, disable it while the reply streams,
re-enable on completion or failure, and show any real failure explicitly rather than dropping
the message silently).

Generalize that into the checklist every function must pass:
1. Plain-language purpose stated.
2. Exact trigger defined.
3. Input validated with a real check, never assumed.
4. Performs the real underlying action — never a placeholder.
5. Shows a loading/in-progress state.
6. Shows both success and failure honestly.
7. Independently verifies its own result before calling itself done.
8. Specific, actionable error message on failure — never generic.
9. Disabled or hidden when not currently valid to use — no dead clickable controls.
10. Has an automated test for both the success path and the rejection path.
11. Reachable by keyboard, labeled for screen readers.

### 1.3 Section-level done

A section (Chat, Desktop Control, Browser Control, Mobile, etc.) is done only when **every**
function inside it independently reaches REAL-TARGET RUNTIME VERIFIED (or PRODUCTION READY
once packaged), with the raw evidence retained — command output, test logs, receipts,
screenshots — not a narrated summary claiming it.

### 1.4 Program-level done — what "100%, all working, no errors" actually means

OCADE is 100% only when **every requirement in every phase below** has reached REAL-TARGET
RUNTIME VERIFIED or PRODUCTION READY, backed by retained raw evidence. Not when code exists
for everything. Not when tests pass against mocks. Not when a report says so without evidence
attached. After every phase, re-run the full verification bundle — typecheck, lint, full test
suite, build, every gate — and require it fully green before advancing to the next phase.
"No errors" means every one of those checks is green with real output to prove it, not that
no error was ever encountered during development.

---

## 2. Local LLM Choice — All Devices

Qwen3 family (Apache 2.0, no commercial restriction, native tool-calling in its chat template
— required for OCADE's typed-action system).

| Device class | Model | Why |
|---|---|---|
| Phone (any) | Qwen3 1.7B | Phones can't run more; used only for standalone chat/voice, real tasks route to the paired PC |
| Weak PC (4–8GB RAM) | Qwen3 4B | Smallest tier that still handles tool-calling reliably |
| Mid PC, CPU-only (16GB RAM, no GPU) | Qwen3 8B, Q4 quantized | Best accuracy-to-latency balance with no GPU available |
| Strong PC (16GB+ with a GPU) | Qwen3 14B | Meaningfully better reasoning once real GPU acceleration exists |
| High-end (24GB+ VRAM) | Qwen3 14B–30B-A3B | Future tier, not needed for initial launch |

**Alternate if tool-call accuracy underperforms:** Llama-3-Groq-8B-Tool-Use — same size class,
purpose-built for function calling, strong benchmark performance specifically on tool use.

**The bundling trick, applied everywhere below:** exactly the pattern that worked for the
model — never ask the user to install anything separately, detect hardware automatically,
download and verify silently, run it under the product's own name, never expose the
underlying tool name in the UI. Section 4 applies this same pattern to every other phase.

---

## 3. Phase-by-Phase Plan

### Phase 0 — Repository Truth (send first)
**Purpose:** every later phase's evidence is worthless if the repo's own state can't be
trusted first.
**Build:** an OCADE-only requirement ledger excluding the other three bundled products
(workforce management, world-intelligence dashboard, document builder); review and commit
every modified/untracked file in path-scoped commits; push; get CI running for the first
time.
**Done when:** `git status` is clean or fully explained, CI is green, and the OCADE-only
percentage is recalculated from real evidence, not carried forward from a prior claim.
**Goal prompt:**
```
Execute Phase 0 only. Create an OCADE-only requirement ledger, excluding workforce
management, the world-intelligence dashboard, and the document builder entirely. Review
every modified and untracked file, excluding secrets/caches/build output/model weights.
Create path-scoped commits, push to the approved branch, run CI. Report raw git status
before and after, and the raw CI result. Recalculate the OCADE-only completion percentage
from this evidence. Stop after reporting — do not begin Phase 1.
```

### Phase 1 — Local AI Model Lifecycle Completion
**Purpose:** this is the single largest concrete coding gap already identified — the current
code is a *client* expecting the user to already have a model server running; it cannot
download, verify, install, repair, update, or roll back a model itself.
**Build:** resumable download of the chosen tier from §2; digest/manifest verification before
install; install to the app-managed directory only (`%LOCALAPPDATA%\OCADE\models` on Windows,
`~/Library/Application Support/OCADE/models` on macOS, app-private storage on mobile);
present it in-UI as "OCADE Local Engine," never the raw model name; repair path for a
corrupted install; update path that piggybacks on the app's normal auto-updater rather than a
separate flow; uninstall path that fully removes it and reports the space freed.
**Hardware-to-code applied:** no server, no separate install, no API key — the entire
lifecycle is code bundled in the app itself.
**Done when:** on a clean machine, first launch detects hardware, downloads the correct tier
with a visible progress indicator, verifies it, starts it, and a real chat message gets a real
reply — with zero manual steps and zero mention of the underlying model name anywhere in the
UI. Corrupt-file and interrupted-download recovery both independently tested and proven.
**Goal prompt:**
```
Execute Phase 1 only. Complete the local model lifecycle: resumable download, digest
verification, install to the app-managed directory, branded as "OCADE Local Engine" in all
UI, repair path, update path via the existing auto-updater, uninstall path. Test on a clean
machine (or clean VM/container): first launch through to a real, verified chat reply, with
no manual steps. Separately test recovery from a corrupted file and an interrupted download.
Paste raw test output for each case. Stop after reporting — do not begin Phase 2.
```

### Phase 2 — Real Windows PC Control Proof
**Purpose:** PC control cannot currently execute at all — the live adapter throws on every
action. This proves it for real, on one real application first.
**Build/prove, with real command output for each:** companion starts and stops cleanly;
pairing between UI and companion succeeds; emergency stop actually halts an in-progress
action; active window is correctly identified; safe text entry works in a real text field;
safe button activation works; file create/copy/move/rename/reversible-delete/rollback all
work and are independently verified against the real file system, not just "no error
thrown"; screen capture works and is scoped to only the approved window; verification
correctly *catches* a deliberately wrong outcome (a planted-failure test, not just a
happy-path test); unsupported or out-of-scope actions correctly refuse; confirm no
unrestricted shell or global input authority exists anywhere in the companion.
**Hardware-to-code applied:** the companion binary itself bundles whatever automation
libraries it needs — nothing the end user installs separately.
**Done when:** every item above passes against one real, ordinary Windows app (Notepad or
File Explorer), with raw evidence retained for each, including at least one deliberately
planted failure that the verification step correctly caught.
**Goal prompt:**
```
Execute Phase 2 only, using a controlled test account, a scoped test folder, and one
low-risk real application (Notepad or File Explorer). Prove, with real command output for
each: companion start/stop, pairing, emergency stop, active-window detection, safe text
entry, safe button activation, file create/copy/move/rename/reversible-delete/rollback,
scoped screen capture, verification correctly catching one deliberately planted wrong
outcome, correct refusal of an out-of-scope action, and confirmation of no unrestricted
shell/global-input authority. Stop after reporting — do not begin Phase 3.
```

### Phase 3 — Real Browser Control Proof
**Purpose:** same proof requirement as Phase 2, applied to Chrome/Edge, on one real website.
**Build/prove:** the extension installs via the silent, policy-based mechanism (no manual
"Developer Mode" / "Load Unpacked" step for the end user); pairs with the desktop companion
over the existing authenticated local channel; reads the real page DOM/accessibility tree
(not a screenshot) to identify elements; fills a real form field; clicks a real button;
confirms navigation completed by checking the extension's own tab/navigation events, not a
screenshot; handles one dynamic-loading wait correctly; refuses to act inside a password or
OTP field; a deliberately planted wrong-outcome test is correctly caught by verification.
**Hardware-to-code applied:** silent registry-based extension install instead of manual
developer-mode loading — the specific fix already identified for this exact requirement.
**Done when:** all of the above passes on one real, ordinary public website (something with a
simple form is enough — no login required for this first proof), with raw evidence for each
step, including the planted-failure test.
**Goal prompt:**
```
Execute Phase 3 only, on one real, ordinary public website with a simple form (no login
required). Prove, with real evidence for each: silent extension install (no manual developer
mode), pairing with the companion, real DOM-based element identification, a real form field
fill, a real button click, navigation confirmation via extension events, one dynamic-page
wait handled correctly, correct refusal to touch a password/OTP-style field, and one
deliberately planted wrong-outcome test caught by verification. Stop after reporting — do
not begin Phase 4.
```

### Phase 4 — macOS Parity
**Purpose:** bring the desktop companion and browser control to macOS at the same evidence
level already proven on Windows in Phases 2–3, using macOS's own Accessibility framework in
place of Windows UI Automation.
**Build/prove:** companion equivalent built and signed for macOS (self-signed test
identity is acceptable at this stage — real notarization is Phase 7); the same start/stop,
pairing, emergency-stop, window-detection, text-entry, button-activation, file-operation, and
screen-capture checks from Phase 2 repeated and independently verified on macOS; the same
browser-control checks from Phase 3 repeated for macOS Chrome/Edge.
**Hardware-to-code applied:** build and sign through a cloud-hosted macOS CI runner (GitHub
Actions offers this directly) rather than requiring you to personally own a Mac.
**Done when:** every check from Phases 2 and 3 passes on real macOS, with raw evidence
retained for each, same planted-failure requirement as before.
**Goal prompt:**
```
Execute Phase 4 only. Using a cloud-hosted macOS CI runner, build and self-sign the macOS
companion. Repeat every check from Phase 2 (start/stop, pairing, emergency stop, window
detection, text entry, button activation, file operations, scoped screen capture, planted-
failure verification, out-of-scope refusal) and every check from Phase 3 (extension install,
pairing, DOM-based control, navigation confirmation, dynamic wait, protected-field refusal,
planted-failure verification) on real macOS. Paste raw evidence for each. Stop after
reporting — do not begin Phase 5.
```

### Phase 5 — Mobile App and Remote Supervision (the Jarvis-style layer)
**Purpose:** the phone should behave like Claude's own remote-dispatch/monitoring view — a
thin, focused window into what the PC is doing — plus standalone chat/voice using the small
bundled mobile model from §2 when the PC isn't reachable.
**Build:** Android build via emulator-based CI (no physical device required for this phase);
chat + voice using the bundled 1.7B model, fully offline-capable on its own; a "watch this PC
task" screen laid out as one focused task card — live status, current step, approve/deny
buttons for any risky action, pause/resume/cancel, emergency stop — over the existing LAN-only
authenticated channel (no relay server needed yet, that's Phase 6); reconnection after a
dropped connection correctly resumes without repeating an already-completed action
(idempotency, not just "reconnect and hope").
**Hardware-to-code applied:** emulator instead of a purchased physical phone for this proof;
the small mobile model is bundled the same silent way as the PC model, never exposed by name.
**Done when:** on a real or emulated Android device, standalone chat/voice works fully
offline; a live PC task shows correct real-time status over LAN; an approve/deny tap on the
phone correctly reaches and affects the real PC task; a deliberately interrupted connection
reconnects without duplicating a mutation.
**Goal prompt:**
```
Execute Phase 5 only. Build the Android app via an emulator (no physical device required).
Prove, with raw evidence: offline standalone chat and voice using the bundled small model;
a live "watch this PC task" screen showing correct real-time status over the local network;
an approve/deny tap on the phone correctly affecting a real running PC task; a deliberately
interrupted connection reconnecting without repeating an already-completed action. Stop
after reporting — do not begin Phase 6.
```

### Phase 6 — Hosted Staging, Remote Relay, and Payments
**Purpose:** move from "same WiFi only" to real remote access, and turn on real (sandboxed
first) billing.
**Build:** apply the prepared database migrations to a real staging project, with real
cross-tenant isolation tests, not just schema validation; deploy the relay using the
signaling-through-Supabase-plus-peer-to-peer pattern already specified, with a minimal paid
relay fallback only for the connections that can't go direct; connect a payment provider in
full sandbox/test mode — real test webhooks, real test subscription lifecycle, entitlement
checks server-side and signed so the client can't self-grant a tier; implement the exact
weekly-limit and expiration behavior already specified (composer and PC-control lock at the
28-hour mark with a live countdown, but never abort a task mid-action — let it reach its next
safe checkpoint first; on expiration, save all local state, show a plain notice, revert to
Free tier without deleting anything).
**Hardware-to-code applied:** database changes as versioned code applied via CI, not manual
dashboard clicks; TLS certificates via free automatic renewal (Let's Encrypt/Caddy), not a
manual purchase; the relay itself deployed via one script, not manual server configuration.
**Done when:** a real staging database enforces real tenant isolation (proven with an actual
cross-tenant attack attempt that correctly fails); a phone on a different network reaches a
real PC task through the relay; a full sandbox subscription lifecycle (subscribe, use a
gated feature, expire, revert) is proven end to end with raw evidence.
**Goal prompt:**
```
Execute Phase 6 only, entirely in staging/sandbox mode — no real charges, no production
data. Apply migrations to a real staging database and prove tenant isolation with an actual
cross-tenant attack attempt that correctly fails. Deploy the relay and prove a phone on a
different network reaching a real PC task through it. Connect the payment provider in
sandbox mode and prove a full lifecycle: subscribe, use a gated feature, force expiration,
confirm graceful save-and-revert to Free tier. Prove the 28-hour composer/PC-control lock
triggers correctly and never aborts a task mid-action. Paste raw evidence for each. Stop
after reporting — do not begin Phase 7.
```

### Phase 7 — Packaging, Signing, and Launch
**Purpose:** turn a working build into something a stranger can install on a machine you've
never touched.
**Build:** real code-signing (cloud-based signing service preferred over a physical hardware
token where available); real macOS notarization; installer bundles for each platform;
auto-updater fully activated (not the placeholder/inactive state); clean-machine install,
upgrade, and rollback all independently proven, not just built; uninstall proven to fully
remove the app and, separately, to optionally preserve or remove user data based on explicit
user choice; store submissions prepared (Chrome Web Store, Play Store, App Store) where
applicable.
**Hardware-to-code applied:** CI hands you a genuinely clean machine on every run for the
install/upgrade/rollback proof — no manually maintained spare test machine needed.
**Done when:** a signed installer installs cleanly on a machine that has never run any version
of the app, an upgrade from the previous version succeeds without data loss, and a rollback
to the previous version succeeds without data loss — all three proven on a freshly provisioned
CI machine, with raw logs retained.
**Goal prompt:**
```
Execute Phase 7 only. Complete real code-signing and notarization. Activate the
auto-updater fully. On a freshly provisioned, genuinely clean CI machine, prove: clean
install, upgrade from the previous version with no data loss, and rollback to the previous
version with no data loss. Prove uninstall fully removes the app and separately test the
user-data-preservation choice. Paste raw logs for each. Stop after reporting.
```

### Phase 8 — Universal Software Control Expansion (ongoing, never "finished")
**Purpose:** this is the category that grows OCADE from "controls a couple of apps" toward
"controls real software broadly" — and it is intentionally not a single phase with an end
date, the same way Phase 7 has one and this doesn't.
**Approach:** one real application category at a time, free/open tools first (FreeCAD instead
of SolidWorks, Blender instead of Premiere, CalculiX instead of a paid solver) so each
category's control logic and verification method is proven before any paid license is needed.
Full per-category detail (control route, verification method, real risks, example apps) is
already written out in the earlier `OCADE_COMBINED_MASTER_PLAN.md` playbook covering 31
categories — reuse that document directly rather than rewriting it here; do not start this
phase's engineering work until Phases 0–7 are runtime-verified, per the sequencing already
established. Each new category gets its own goal prompt, following the exact same
Definition-of-Done structure in Section 1 above, one category at a time.

---

## 4. Hardware-to-Code Conversions, Applied Per Phase

| Phase | Normally needs | Code-only fix used above |
|---|---|---|
| 1 | User-managed model server or API key | Silent bundled download, verify, install, branded engine name |
| 2 | Separate automation-framework install | Compiled directly into the companion binary |
| 3 | Manual "developer mode" extension load | Silent, policy-based extension install |
| 4 | A physical Mac to build/sign on | Cloud-hosted macOS CI runner |
| 5 | A physical Android phone to test on | Emulator-based CI |
| 6 | A manually run relay server, manual DB admin, manual TLS renewal | One-command relay deploy, migrations as versioned code, free automatic TLS |
| 7 | A spare physical "clean" test machine | Freshly provisioned CI machine, every run |
| 7 | Physical hardware security token for code signing | Cloud-based signing service |

Already covered in full elsewhere in this project and not repeated here: the 15-item and
12-item hardware-to-code conversion lists from earlier files, and the repo's own 50-item HWE
requirement register — extend those directly for anything not listed above rather than
duplicating them again.

---

## 5. Goal-Prompt Index (send in this exact order, one at a time)

1. Phase 0 — Repository Truth
2. Phase 1 — Local AI Model Lifecycle
3. Phase 2 — Real Windows Control Proof
4. Phase 3 — Real Browser Control Proof
5. Phase 4 — macOS Parity
6. Phase 5 — Mobile App and Remote Supervision
7. Phase 6 — Hosted Staging, Relay, and Payments
8. Phase 7 — Packaging, Signing, and Launch
9. Phase 8 — Universal Software Control Expansion (ongoing, one category per prompt after this)

OCADE reaches genuine 100% only when Phases 0–7 are each independently REAL-TARGET RUNTIME
VERIFIED or PRODUCTION READY with retained evidence, and Phase 8's category coverage matches
what you've committed to support — not before, regardless of how long it takes to get there
honestly.

---

## 6. Reusable Prompt — Send the Same Text After Every Phase

Instead of copying a different prompt each time, paste this exact text after each phase
finishes. It reads this file and your checkpoint, figures out the correct next phase itself,
executes only that one, and stops.

```
Continue OCADE from its current verified state. Read OCADE_COMPLETE_PATH_TO_100_PERCENT.md
and CHECKPOINT.md (if present) in the repo before doing anything else.

Determine the last phase (in Section 5's order: 0, 1, 2, 3, 4, 5, 6, 7, then Phase 8 one
application category at a time) that has real, retained evidence of reaching REAL-TARGET
RUNTIME VERIFIED or PRODUCTION READY — not a phase that was merely claimed complete. If no
phase has verified evidence yet, start at Phase 0.

Execute ONLY the next unverified phase in that order — nothing from a later phase, even if it
looks quick or related. Follow that phase's exact "Build/prove" list and Definition of Done
from the file.

Do not summarize progress from memory. For every check in that phase, run the real command or
perform the real action and paste the raw output. If something fails, show the exact failure —
do not soften it or reinterpret it as a partial success.

When the phase is genuinely complete, update or create CHECKPOINT.md with: the phase just
finished, the raw evidence for each item in it, and the exact next phase. Commit and push.

Then stop. Report exactly which phase you executed, the raw evidence for each item, and the
name of the next phase. Do not begin that next phase in this same session unless I explicitly
tell you to continue.
```
