# OCADE — 246-repository source architecture blueprint

> Research only. No application code was changed for this document. Branch `ocade/p00-p22-implementation`.
> Date of the source snapshots: 14 November 2026 (each repository's exact commit is in its Appendix A entry).
> OCADE baseline read: commit `760c08d`. The branch then advanced 54 commits to `4a7daf0`, made in a parallel
> session. §0.1 re-checks every gap against `4a7daf0`; where they differ, §0.1 wins.
> This file is supporting research for `plan.md`, which stays the single engineering authority. Nothing here
> overrides an owner decision (plan.md §2, O1–O16). Where a recommendation conflicts with an owner decision, it is
> marked **OWNER DECISION** and is not a plan change until the owner approves it.

## 0. Answer first

**What was done.**

- I cloned 245 of the 246 requested repositories at their default-branch head. Each clone was shallow (depth 1) and
  skipped single blobs over 1 MiB.
- One repository could not be cloned and was resolved to its real owner: `alibaba/UI-TARS` → `bytedance/UI-TARS`.
- One repository is inaccessible: `AI-Architect-Studio/awesome-hermes-agent-skills`. A same-name substitute by
  another owner was scanned and is labelled as a substitute (§2.4).
- Two requested entries are the same repository: `OpenHands/OpenHands` and `All-Hands-AI/OpenHands` (same commit).
- For every repository I measured its size, read its key source files and recorded each finding with a path and
  line reference. I also read OCADE's own documents and source on the execution path.

**What was not done, stated plainly.** The prompt asks for every file of every repository to be read line by line.
That is not physically possible in one research session, and I did not do it:

- The 244 measured clones hold **761,781 files and 200.8 million lines** (118.3 million lines of code).
- The reads logged by my reading tool cover **10,964 lines in 184 files across 113 repositories**. That is about
  **0.009 %** of the code.
- I read more than that through targeted searches, slices, README and manifest reads and directory listings. Those
  reads were not line-logged, so this document does not count them.
- Every finding below cites the lines that were actually read. Nothing is claimed about files that were not opened.
- Per-repository coverage is in §12 and Appendix B.

Because of that, the "≥99 % of useful capabilities per repository" target is **not verified**. What I can state is
narrower: in each repository, I located and read the files that implement its headline mechanisms, and I extracted
every capability those reads showed. Large repositories have more mechanisms than I read. §12.3 lists the main ones
that are known to exist but were not read.

**The most important findings.** These are verified against OCADE source and ranked by expected effect on the
benchmark blockers in plan.md §3 and docs/research/OCADE_ARCHITECTURE_REVIEW_2026-11-08.md:

1. **OCADE never forces Gemini to answer with a function call.**
   - Evidence: `src/lib/intelligence/edge-handler.ts:495-513` sends `function_declarations` with `parameters` and no
     `toolConfig`. Every planner turn must end in a function (operation, `finish` or `ask`), yet the model may answer
     in prose.
   - This matches review failures 5 ("text-only finals") and 6 (`invalid_goal`, no call).
   - Fix: set `functionCallingConfig.mode: 'ANY'` plus `allowedFunctionNames`, as vercel/ai does
     (`packages/google/src/google-prepare-tools.ts:260-310`). It is about a 10-line change.
   - Live-session models may behave differently, so this must be tested.
2. **Per-step `expect` guards (plan.md §13) are not in the code.**
   - At `760c08d`, `planner.server.ts:1266-1284` batched only read-only proposals.
   - Upstream commit `5355327` (P3) added guarded batches of reversible steps: the first failed step stops the rest
     (`planner.server.ts:1005-1008, 1443-1459` at `4a7daf0`, plus a SQL function).
   - Steps still carry no `expect` predicate. Each step is judged only by its own failure, not by a postcondition.
   - The review's plan-first lever is therefore half built. §5.1 lists what is still missing.
3. **The schema sent to the planning model is lossy.**
   - `providerSchema()` (`planner.server.ts:383-404`) drops `additionalProperties` and `propertyNames`, and rewrites
     exclusive bounds.
   - Gemini now accepts full JSON Schema through `parametersJsonSchema` (vercel/ai `google-prepare-tools.ts:320-326`).
     Only `const` must become a single-value `enum` (`sanitize-response-json-schema.ts:3-21`).
   - Sending the full schema should cut schema-invalid proposals. This is not measured.
4. **Desktop observation is the next accuracy limit after the model loop.**
   - `windows_worker.ui_inspect` walks `descendants()[:150]` depth-first with one COM call per property and truncates
     without telling the model (`windows_worker.py:225-237`).
   - `mac_worker` never turns on `AXManualAccessibility`, so Chrome, Electron and VS Code windows show near-empty
     trees (`mac_worker.py:211-215`).
   - Neither bridge has a scroll operation. grep finds no "scroll" in windows_worker.py, mac_worker.py or
     web_worker.py.
   - Each gap has a small, proven fix from the repositories (§5.2).
5. **Pattern-based UI actions are blocked whenever the person types anywhere.** `ui.invoke` and `ui.set_value` call
   `_person_quiet()` (`windows_worker.py:253, 283`; `mac_worker.py:352, 370`), but these actions send no input and
   need no focus. trycua's cua-driver shows a safe split: background accessibility delivery versus foreground input
   (`libs/cua/skills/cua-driver/WINDOWS.md:14-57`). With that split, OCADE could keep working while the person works.
   **OWNER DECISION**, because this changes the "mutations pause while the person is active" rule in plan.md §13.
6. **The 150 s Supabase Edge wall clock is a structural risk with a ready alternative.**
   - OCADE already runs on Cloudflare Workers (`wrangler.json`).
   - cloudflare/agents shows per-task Durable Objects with alarms and hibernating WebSockets
     (`packages/agents/src/index.ts:699-947, 1133-1218`).
   - Moving the planner turn there removes the platform kill behind review failure 2 (§5.4). **OWNER DECISION.**
7. **Verified work is not reused as a plan.** At `760c08d`, every repeat task was re-planned from scratch. At
   `4a7daf0`, C9 passes the closest verified route as a one-line guide, but nothing is replayed (§0.1). Microsoft CUAWright's Skill
   Factory admits a solved task into a reusable, parameterised script only through an independent gate, and reruns it
   with no model call (`extensions/skill-factory/.../gate.py:1-23`, `route.py:1-16`). OCADE's independent verifier is
   exactly the gate those projects lack. A verified plan library is the largest repeat-task speed lever (§5.7).
   **OWNER DECISION** on O8 wording.
8. **Prompt injection defence can move from "quote and hope" to taint tracking.** Microsoft Agent Framework's FIDES
   labels every content item with integrity and confidentiality, and keeps untrusted text behind variable handles
   (`python/packages/core/agent_framework/security.py:343-400, 725-760`). A lightweight version fits OCADE's existing
   confirmation gate (§5.5).
9. **On Windows, shell commands run with the person's full token.** On Windows, `shell.run`, `job.*` and verifier
   re-runs have only job-object containment (`command_worker.py:1-14`; `verify_worker.py:806` "copy-only"). Codex's
   windows-sandbox shows restricted-token, workspace-ACL and WFP network containment without admin rights per command
   (`codex-rs/windows-sandbox-rs/src/token.rs:372-513`, `wfp.rs:84-332`).

**About multi-agent teamwork.** The prompt asks for it, but the evidence argues against a product swarm.

- OCADE's measured bottleneck is model calls on a 16k-input-tokens-per-minute free quota (review §0 and §2). Every
  extra agent spends that same quota.
- plan.md §14 rejects agent swarms.
- What the repositories do support is a **team of roles under one authority**:
  - a compiler model for the plan;
  - a fast repair or locate model;
  - the existing deterministic independent verifier;
  - optionally, a quarantined reader for untrusted content (FIDES).
  - Independent milestones on different resources may run in parallel, using a UFO Galaxy-style ready queue.
- This is "teamwork" with fewer model calls, not more (§4.3).

**Expected versus measured.** Every benefit in this document is **expected**, not measured, unless it is labelled
_measured_. The only measured OCADE figures are those already recorded in plan.md §3 and the 8 November review.
Figures quoted from repositories are their own claims and were not re-run here.

## 0.1 Status against the newer upstream head `4a7daf0` (verified by `git show` and grep)

The parallel session also committed `docs/research/OCADE_SOURCE_REVIEW_2026-11-14.md` (deep source review of 58
desktop/browser/CUA repositories) and `docs/research/OCADE_REPOSITORY_LEDGER_246.md` (an automated digest of all 246
repositories). This blueprint is complementary:

- It gives an individual entry for every one of the 246 repositories.
- It covers the model loop, runtime, security and evaluation repositories as well.
- It ends in one unified roadmap.

Where the documents overlap, the source review's file:line evidence and this document's evidence were taken
independently.

| Gap (§3.2)                             | At `760c08d`       | At `4a7daf0`                                                                                                                                                              | Evidence at `4a7daf0`                                                                                                    |
| -------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G1 forced function call                | absent             | **still absent**                                                                                                                                                          | edge-handler.ts:505-508 `function_declarations` with `parameters`; grep finds no `toolConfig` or `functionCallingConfig` |
| G2 lossy schema                        | yes                | **still**                                                                                                                                                                 | planner.server.ts:412-430, 544 `providerSchema`                                                                          |
| G3 guarded steps                       | read-only batching | **partial**: reversible batches, first failure stops (P3); no `expect` predicates                                                                                         | planner.server.ts:1005-1008, 1443-1459; commit 5355327                                                                   |
| G4 full history                        | yes                | **partial**: "structured clipping", newest batch results kept                                                                                                             | planner.server.ts:782; commit 89405c7                                                                                    |
| G5 per-instance thinking               | yes                | **still**                                                                                                                                                                 | edge-handler.ts:174, 1205, 1330                                                                                          |
| G6 inspect first 150                   | yes                | **still** `descendants()[:150]`. Added: refs `e1…`, change-only listing (`changesOnly`), region preview                                                                   | windows_worker.py:272-300; commits 3c5e1e9, cc99303                                                                      |
| G7 macOS Electron AX                   | absent             | **still absent**                                                                                                                                                          | grep `AXManualAccessibility` in mac_worker.py = 0                                                                        |
| G8 scroll                              | absent             | **still absent**                                                                                                                                                          | grep "scroll" = 0 in windows_worker.py, mac_worker.py, web_worker.py                                                     |
| G9 quiet rule on pattern actions       | yes                | **still**                                                                                                                                                                 | windows_worker.py `_person_quiet()` 6 calls                                                                              |
| G10 ancestry selectors                 | absent             | **still absent**; refs now identify elements of one observation                                                                                                           | windows_worker.py refs                                                                                                   |
| G11 custom web observation             | yes                | **still custom**, now "settled web observations" (C15)                                                                                                                    | grep `aria_snapshot` = 0                                                                                                 |
| G12 Windows containment                | absent             | **still absent**                                                                                                                                                          | grep `CreateRestrictedToken` = 0                                                                                         |
| G13 SSRF transition forms              | ipv4_mapped only   | **still**                                                                                                                                                                 | web_worker.py (1 hit for the ipv4 unwrap patterns)                                                                       |
| G14 workbook error scan                | absent             | **still absent**                                                                                                                                                          | grep "#REF/#DIV/#NAME" in verify_worker.py = 0                                                                           |
| G15 realpath timeout                   | absent             | **unchanged** (realpath calls, no timeout found)                                                                                                                          | sandbox.py                                                                                                               |
| G16 schema bounds                      | absent             | **unchanged**                                                                                                                                                             | catalog.py                                                                                                               |
| G17 refusal hints                      | absent             | **still absent** (no `hint` field)                                                                                                                                        | gateway.py                                                                                                               |
| G18 reuse of verified work             | absent             | **partial**: C9 "precedent": the route of the closest verified earlier task, given as a one-line guide (similarity ≥0.6, rankBySimilarity on titles); nothing is replayed | planner.server.ts:907-922; commit a28ac5e                                                                                |
| `ui.wait` (bounded wait for a control) | absent             | **added**                                                                                                                                                                 | windows_worker.py:313; protocol now 49 operations                                                                        |
| Blocking dialogs listed                | —                  | **added**                                                                                                                                                                 | commit 9eb1e63                                                                                                           |

Consequences for the recommendations:

- **R3** (settle wait) and **R4** (auto-wait) are partly met by `ui.wait`. R4's ancestry descriptor is still open.
- **R14** (zoom) is partly met by `region` inspection.
- **R21** (deltas) is partly met by `changesOnly` and structured clipping.
- **R50** (plan library) is partly met by C9 precedent. Its remaining step is _replay_, with guards, of a verified
  parameterised list. Today the precedent is only a guide.
- **R1** is reduced to adding `expect` predicates and the external-effect-last rule to the existing P3 batches.
- Every other gap in §3.2 is still open at `4a7daf0`.

## 1. Scope, rules and how to read this document

- **Verdict legend** (per capability):
  - **ADD**: OCADE lacks it and should gain it.
  - **REPLACE**: an OCADE mechanism should be swapped for the named superior one.
  - **IMPROVE**: OCADE has it partly; extend the existing owner.
  - **MERGE**: overlapping capabilities from several repositories become one OCADE mechanism.
  - **KEEP**: OCADE already has it, equal or better.
  - **REJECT**: not for OCADE, with the reason.
  - "ADD (technique only)" means adopt the idea, not the code.
- **Evidence tags:**
  - `path:line` refers to the cloned repository named in the entry.
  - OCADE paths are relative to this repository.
  - "Read:" lines in Appendix A list exactly what was read.
- **Owner decisions that constrain recommendations:**
  - O1: Windows and macOS are mandatory.
  - O2 and O14: Gemini is the planner; the model integration stays unchanged until the owner authorises a change.
  - O3: no paid infrastructure.
  - O4: one coding agent.
  - O8: no hardcoded applications, journeys or answers.
  - O9: one task authority.
  - O12: no scheduled automations.
  - O16: research into alternative models comes only after the 12 runs.
  - plan.md §14 REJECT list: local LLM or vector DB, agent swarms, cloud desktop, auto-installed registry MCP servers,
    continuous screenshot streaming.
  - Recommendations that touch these are marked OWNER DECISION or are rejected with the reason.

## 2. Method and reading coverage (measured)

### 2.1 Acquisition

- Command: `git clone --depth 1 --filter=blob:limit=1m` with 12 parallel workers and 3 retries.
- Result: 244 of 246 cloned directly. One was resolved to its real owner, one is inaccessible.
- The clone results log is in the research scratch area. Each repository's commit hash and date are in Appendix A.

### 2.2 Size measurement (measured)

A per-repository script counted files and lines by extension. It treats files with NUL bytes in their first 8 KB as
binary.

| Measure                                                                  | Value                                                                                                                            |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Unique repositories measured                                             | 244 (246 requested − 1 inaccessible − 1 duplicate; UI-TARS counted under its real owner). The substitute is excluded from totals |
| Files                                                                    | 761,781                                                                                                                          |
| Total lines (all text)                                                   | 200,830,234                                                                                                                      |
| Code lines (source extensions, excluding md/json/yaml/txt/html/css/toml) | 118,305,414                                                                                                                      |
| Largest repositories by code lines                                       | openclaw/openclaw 13.3M · n8n 5.5M · litellm 4.8M · orca 4.4M · mastra 4.2M · hermes-agent 4.1M · sglang 3.6M                    |

### 2.3 Reading method (measured where stated)

For each repository, in this order:

1. The survey printed the commit, licence line, size statistics, top-level layout and the largest non-test source
   files.
2. I located the files that implement the repository's headline mechanisms, using names, docstrings and targeted
   searches.
3. I read those files through a logging reader. It records path and line range.
4. I read the README or specification only for orientation or where the repository is a specification or list. For
   catalogue repositories, the Markdown is the source.

Logged coverage, measured:

| Measure                             | Value                           |
| ----------------------------------- | ------------------------------- |
| Repositories with line-logged reads | 113                             |
| Files line-logged                   | 184                             |
| Lines line-logged                   | 10,964 (≈0.009 % of code lines) |

Reads that were not line-logged (targeted searches with context, sed slices, manifest and notebook parsing, licence
heads, directory listings) were also used. They are not counted. The remaining 131 repositories have no line-logged
read. Their findings come from those unlogged reads, and each Appendix A entry says which ones.

**OCADE coverage:**

- OCADE's tracked source (`src`, `device-agent`, `scripts`, `tests`, `supabase`, `.github`) is ≈113,058 lines. The
  whole repository has 1,037 tracked files, including evidence and documents.
- Logged reads cover 1,732 lines in 23 files.
- About 930 more lines were read through slices and the full review document.
- In total that is ≈2.4 % of OCADE's tracked source. It covers the whole execution path:
  - gateway.py: fully read.
  - planner.server.ts: the prompt, history, offered operations and batching.
  - edge-handler.ts: the request body construction.
  - windows_worker.py and mac_worker.py: inspect, act and quiet rules.
  - web_worker.py: observation and SSRF checks.
  - engine.py: fully read.
  - The headers of every device worker.
  - plan.md §0–§3 and §12–§14.
  - The 8 November architecture review (fully).
  - ToRemove.md (fully).

### 2.4 Inaccessible, resolved and duplicate repositories

| Requested                                         | Outcome                                                                                                                                                                     | Evidence                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alibaba/UI-TARS`                                 | **Resolved** to `bytedance/UI-TARS` (582f3a7). No `alibaba` repository exists.                                                                                              | Three clone failures with "could not read Username" (GitHub's answer for a missing repo). `search/repositories q="UI-TARS user:alibaba"` returned total_count 0. |
| `AI-Architect-Studio/awesome-hermes-agent-skills` | **Unresolved / inaccessible.** Substitute `frankxai/awesome-hermes-agent-skills` was scanned and labelled SUBSTITUTE. No finding is attributed to the requested repository. | Three clone failures; search found no repository under that owner.                                                                                               |
| `All-Hands-AI/OpenHands`                          | **Duplicate** of `OpenHands/OpenHands` (same commit 830c0459e2f6).                                                                                                          | GitHub redirect.                                                                                                                                                 |
| `openinterpreter/openinterpreter`                 | Now a distribution fork of OpenAI Codex (Rust). Analysed with `openai/codex`.                                                                                               | FORK_BRANDING.md:1-30                                                                                                                                            |
| `microsoft/autogen`                               | Archived. Successor is `microsoft/agent-framework`.                                                                                                                         | README.md:25-31                                                                                                                                                  |

## 3. OCADE as it is (baseline read from source)

### 3.1 Components and what they already do well

| OCADE component   | What it does (verified)                                                                                                                                                                                           | Evidence                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Task authority    | Request-driven, one decision per call, durable SQL state. No in-memory loop holds a task. Device requests are signed with P-256 and rate-limited.                                                                 | `src/lib/jarvis/authority.server.ts:1-14, 800-896`                                                          |
| Protocol          | One registry of 48 operations with risk classes read / reversible_write / external_effect. JSON Schema is generated for the device.                                                                               | `src/lib/jarvis/contracts.ts:1-25`; `device-agent/windows/ocade_agent/protocol.json` (48 ops, 5 pure reads) |
| Planner (RTAA)    | One function call per turn. Up to 5 read-only calls are batched. Full step history is kept to a 24k-character budget. Stall detection. Grant/engine-filtered operations.                                          | `planner.server.ts:46-49, 298-312, 342-377, 741-792, 826-840, 1266-1284`                                    |
| Gemini boundary   | Streaming, retries before output, quota waits until Pacific midnight, a Live-session adapter, per-instance `withoutThinking`.                                                                                     | `src/lib/intelligence/edge-handler.ts:91-106, 395-513, 521-590, 1135, 1261`; `live-session.ts:1-15`         |
| Gateway           | Official MCP SDK stdio workers started lazily, with prewarm. Exact tools/list pinning plus schema fingerprints. STOP epoch, deadlines, honest receipts (`unknown`/`maybeChanged`), redaction, 16 KB evidence cap. | `device-agent/windows/ocade_agent/gateway.py:1-415`                                                         |
| External MCP      | Owner-placed SHA-256-pinned manifests, with states registered → authorised.                                                                                                                                       | `catalog.py:1-19`                                                                                           |
| Journal           | SQLite WAL, intent before effect, receipt replay.                                                                                                                                                                 | `journal.py:1-16`                                                                                           |
| Workspace sandbox | Path resolution, `OCADE output/`, atomic no-replace writes.                                                                                                                                                       | `sandbox.py:1-14, 131-188`                                                                                  |
| Windows bridge    | Window lease (pid/hwnd/exe/start time); UIA invoke/value; foreground-only send_keys; window-fraction click_point with patch revalidation.                                                                         | `windows_worker.py:1-15, 63-144, 213-351`; `vision.py:1-27`                                                 |
| macOS bridge      | Same operations through AX; AXObserver change events.                                                                                                                                                             | `mac_worker.py:1-15, 171-245`                                                                               |
| Web               | Own Playwright profile; site bound per page; private-IP refusal; controls from the newest observation.                                                                                                            | `web_worker.py:1-18, 232-262, 527-586`                                                                      |
| Verifier          | Separate process. Re-reads saved files, pages and windows: workbook cells and formulas, PDF render, docx, glTF, media quality, web text, commands under bwrap/unshare/sandbox-exec.                               | `verify_worker.py:1-8, 89-1311, 778-806`                                                                    |
| Media and scene   | FFmpeg timeline with OTIO export; SDF WebGL2 renderer with glTF export.                                                                                                                                           | `media_worker.py:1-9, 577-641`; `scene_gl.py`                                                               |
| Office engine     | Excel/Word COM or LibreOffice headless; recalculation with macros disabled.                                                                                                                                       | `engine.py:1-148`                                                                                           |
| Long jobs         | Process-group jobs that outlive a call; cancel; status without a model call.                                                                                                                                      | `jobs.py:1-16`; `supervisor.ts:128` (followJobs)                                                            |

These are strong foundations. Many repositories reach the same invariants independently, which confirms the design.
cua-driver's rules (SKILL.md:57-65) state OCADE's own invariants almost word for word.

### 3.2 OCADE gaps verified in source (not from documents)

| #   | Gap                                                                                    | Evidence                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | No forced function calling.                                                            | edge-handler.ts:495-513 (no `toolConfig`)                                                                                                                               |
| G2  | Lossy tool schema conversion.                                                          | planner.server.ts:383-404                                                                                                                                               |
| G3  | Guarded step lists claimed but absent at 760c08d (partially added upstream, see §0.1). | plan.md:504 versus planner.server.ts:1266-1284; no `expect` in src/lib/jarvis                                                                                           |
| G4  | Full step history every turn (no delta).                                               | planner.server.ts:741-792                                                                                                                                               |
| G5  | Per-instance thinking capability, not durable.                                         | edge-handler.ts:174, 1135, 1261                                                                                                                                         |
| G6  | ui.inspect: first 150 descendants, per-property COM calls, silent truncation.          | windows_worker.py:225-237                                                                                                                                               |
| G7  | macOS: no AXManualAccessibility; recursive per-attribute IPC.                          | mac_worker.py:110-116, 211-215                                                                                                                                          |
| G8  | No scroll operation on any bridge.                                                     | grep: zero "scroll" hits in the three workers                                                                                                                           |
| G9  | Pattern actions blocked by person activity.                                            | windows_worker.py:253, 283; mac_worker.py:352, 370                                                                                                                      |
| G10 | Element re-find has no ancestry or ordinal, so ambiguity blocks.                       | windows_worker.py:129-144                                                                                                                                               |
| G11 | Web observation is custom and truncates by popping controls.                           | web_worker.py:527-586                                                                                                                                                   |
| G12 | No Windows OS containment for shell and verifier re-runs.                              | command_worker.py:1-14; verify_worker.py:806                                                                                                                            |
| G13 | SSRF check unwraps only IPv4-mapped IPv6.                                              | web_worker.py:232-238                                                                                                                                                   |
| G14 | No workbook error scan after recalculation.                                            | grep: no "#REF"/"#DIV"/"#NAME" in ocade_agent                                                                                                                           |
| G15 | Workspace realpath without timeout (cloud placeholders).                               | sandbox.py:139-149                                                                                                                                                      |
| G16 | External MCP schemas compiled without size or depth bound.                             | catalog.py; gateway.py:404-411                                                                                                                                          |
| G17 | Device refusal codes carry no repair hint.                                             | gateway.py receipts (`errorCode` only, e.g. `element_ambiguous`, `invalid_intent`); the planner-side refusal does quote validation issues (planner.server.ts:1286-1290) |
| G18 | No reuse of verified plans; no per-site or per-app lessons.                            | No such store in src or supabase                                                                                                                                        |

## 4. Unified future architecture

### 4.1 Design principle

Keep the 12 mechanisms of the 8 November review and OCADE's invariants. Add only what removes a measured blocker or
a verified gap. Nearly all additions are edits of existing owners. Only three are new modules:

- the plan library;
- observation handles (an extension of the journal);
- the optional extension bridge.

### 4.2 Target flow

```text
Request ─▶ Task authority (Supabase; grants, STOP epoch, journal, budgets)             [KEEP]
            │  capability record (measured per model: function-call reliability, thinking, TPM/RPD,
            │  real context, latency class, cache hit rate)                             [ADD §5.4]
            ▼
 Route    : plan library lookup (objective shape + app/site + platform)                 [ADD §5.7]
            ├─ hit & all slots fill ─▶ replay verified guarded list (0 model calls)
            └─ miss ─▶ Compile
 Compile  : ONE strong-model turn, forced function call (mode ANY), full JSON schemas, [IMPROVE §5.3]
            facts ledger (given / to look up), checks + milestones + guarded step list
            ▼
 Execute  : device runs the guarded list locally: per-step policy gate, lease,         [ADD §5.1]
            ui.verify / expect guards, settle wait, background accessibility delivery,
            taint check on external effects; stops at first failed guard / unknown / STOP
            │   observations stored as handles; planner receives deltas only          [ADD §5.2]
            ▼ (surprise only)
 Repair   : fast-model DELTA turn (objective, remaining plan, last delta, failure,     [IMPROVE §5.3]
            refusal hint, site/app gotchas); ≤2 per milestone; visual fallback =
            Gemini Computer Use on the leased window preview with set-of-marks         [ADD §5.2]
            ▼
 Verify   : independent verifier (existing) + new kinds (workbook_no_errors, image SSIM,
            table compare, window_element_exists); verification tier label             [IMPROVE §5.6]
            ▼
 Deliver  : artifacts + receipt; on PASS → admit parameterised plan to the library     [ADD §5.7]
```

### 4.3 "Team of roles" instead of a swarm

| Role                          | Model or engine                                                         | Calls per task (target)             | Source pattern                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Compiler                      | Strongest allowed Gemini (function-reliable per capability record)      | 1                                   | aider architect (`aider/coders/architect_coder.py:11-48`); gemini-cli routing (`classifierStrategy.ts:27-84`) |
| Repair / locate               | Fast Gemini (e.g. Flash-Lite) with delta context                        | 0–2 per milestone                   | midscene planning versus locate models (`agent.ts:1294-1295`)                                                 |
| Visual grounding              | Gemini Computer Use tool (same API and keys)                            | Only after the semantic route fails | adk-python `computer_use_toolset.py:893-903`                                                                  |
| Quarantined reader (optional) | Fast model with no tools; reads untrusted text and returns typed values | Only when needed                    | agent-framework FIDES `security.py:105-132, 725-760`                                                          |
| Verifier                      | Deterministic worker (existing)                                         | 0 model calls                       | OCADE verify_worker.py                                                                                        |

Parallelism: only independent milestones on different resources, under the same authority, using a ready-queue
scheduler like UFO Galaxy (`galaxy/constellation/task_constellation.py:279-294`). Effects stay one at a time per
resource (existing locks).

## 5. Recommendations (ADD / REPLACE / IMPROVE / MERGE), with exact OCADE owners

Each item lists: the verdict; the OCADE files affected; the source mechanism with its path:line; the expected effect;
and the risk. All effects are **expected**, not measured.

### 5.1 Plan-first guarded execution (speed, the core lever)

| ID  | Verdict | Change                                                                                                                                                                                      | OCADE owner                                                                                                                              | Source mechanism                                                                                                                                                                                      | Risk                                                                                                                          |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | ADD     | `decision.kind = "list"`: ≤5 typed steps, each with an `expect` predicate. Only read and reversible steps, plus at most one confirmed external effect, which comes last (plan.md §13 rule). | contracts.ts (decision schema), planner.server.ts (planStep), supervisor.ts, authority.server.ts (dispatch), agent.py (sequential claim) | mcp-windows `UIBatchTool.cs:72-200` (stopOnError, `$prev` chaining, post-snapshot); OpenAdapt `ir.py:1-20, 467-527` (guarded steps with anchors and postconditions); openai-cua-sample-app README:5-7 | A wrong list could run several steps before detection. Mitigated by expect guards, a reversible-only rule and the STOP epoch. |
| R2  | ADD     | `ui.verify(window, expect[])`: pure read returning satisfied, unsatisfied or unknown. Used as a step guard and as a verifier check `window_element_exists`.                                 | windows_worker.py, mac_worker.py, verify_worker.py, contracts.ts                                                                         | cua-driver `WORKFLOW.md:103-109`                                                                                                                                                                      | Weak predicates; the planner must choose task-specific ones.                                                                  |
| R3  | ADD     | Settle wait after each UI mutation: poll cheap state every 0.2 s for up to 1 s before readback.                                                                                             | windows_worker.py (after invoke/set_value/send_keys); mac fallback                                                                       | orca `main.swift:372-384`                                                                                                                                                                             | +≤1 s per step (bounded)                                                                                                      |
| R4  | IMPROVE | Element descriptor with ancestry path and same-identity ordinal; bounded auto-wait before `element_not_found`.                                                                              | windows_worker.py `_element` 129-144; mac_worker.py `_element` 245                                                                       | terminator `engine.rs:1019-1029`; mcp-windows `SnapshotDiffEngine.cs:200-237, 280-281`                                                                                                                | Ordinals change when the UI changes; a fresh observation still wins.                                                          |
| R5  | MERGE   | One "guard" vocabulary for UI, web and files: element exists / value equals / window title / file hash / page URL.                                                                          | contracts.ts                                                                                                                             | Playwright ariaSnapshot 'autoexpect' (`ariaSnapshot.ts:72-75`); OpenAdapt postconditions                                                                                                              | —                                                                                                                             |

### 5.2 Desktop and browser control (accuracy and reach)

| ID  | Verdict                  | Change                                                                                                                                                                                                                                                             | OCADE owner                                                                                                   | Source mechanism                                                                                                                            | Risk                                                                                                                               |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R6  | IMPROVE                  | Windows inspect: UIA CacheRequest + compound condition (enabled, on-screen, control element, control types) in one cross-process call; breadth-first with node and depth budgets; report `truncated` counts.                                                       | windows_worker.py `ui_inspect` 213-246                                                                        | UFO `inspector.py:323-370`; computer-use-linux `atspi_tree.rs:138-160`; agent-desktop CONCEPTS.md:38-41                                     | pywinauto raw COM interop is needed (UFO shows how).                                                                               |
| R7  | IMPROVE                  | macOS inspect: set AXManualAccessibility, else AXEnhancedUserInterface, for Chromium/Electron apps and wait ≤2 s; read attributes in batches with AXUIElementCopyMultipleAttributeValues.                                                                          | mac_worker.py 110-116, 211-245                                                                                | open-computer-use `AccessibilitySnapshot.swift:107, 532-542`, `AXSnapshotReadCache.swift:4-33`; agent-desktop locator README:28-30          | Some apps slow down with the enhanced UI flag. Detect the engine from shipped frameworks (`WindowOcclusionKeepAlive.swift:27-34`). |
| R8  | ADD                      | `ui.scroll` (UIA ScrollPattern / ScrollItemPattern.ScrollIntoView; AX scroll; `web.scroll` via scrollIntoView or wheel) as reversible_write; list scrollable containers in inspect.                                                                                | contracts.ts, windows_worker.py, mac_worker.py, web_worker.py                                                 | Windows-Use tree (`awesome-llm-apps/.../windows_use/tree/__init__.py:18-77`); cua-driver input tools (WINDOWS.md:27-29)                     | —                                                                                                                                  |
| R9  | IMPROVE                  | Collapse web wrappers (anonymous Group/Pane chains cost no logical depth); `ui.inspect(scope=element\|surface)` drill-down and open-menu/dialog surfaces; tri-state evidence (absent vs unknown).                                                                  | windows_worker.py, mac_worker.py                                                                              | agent-desktop CONCEPTS.md:5-56                                                                                                              | —                                                                                                                                  |
| R10 | IMPROVE (OWNER DECISION) | Allow accessibility-channel actions (Invoke/Value/Toggle, AXPress/AXValue) on a leased **background** window while the person works elsewhere. Keep the quiet rule for synthetic keyboard and pointer input and for the person's own foreground window.            | windows_worker.py 253, 283; mac_worker.py 352, 370                                                            | cua-driver WINDOWS.md:14-57 (background is the default; never fronts or raises)                                                             | Surprise to the person. Needs a visible "OCADE is acting" overlay (interpreter-workstation `tools.ts:40-45`).                      |
| R11 | ADD                      | Receipt fields `effect` (confirmed\|partial\|unverifiable\|suspected_noop) and `route` (accessibility\|synthetic\|dom); explicit refusal codes for known-dropped routes (LibreOffice accelerators, Chromium DOM keys).                                             | gateway.py receipt(), workers                                                                                 | cua-driver WORKFLOW.md:111-127, WINDOWS.md:35                                                                                               | —                                                                                                                                  |
| R12 | ADD                      | Live-document operations for files the person has open: LibreOffice through UNO (`soffice --accept=socket…;urp`) and Excel/Word through COM GetActiveObject: `office.live_read_range`, `office.live_set_cells` on a leased document.                               | office_worker.py, engine.py, contracts.ts                                                                     | Agent-S `gui_agents/s3/agents/grounding.py:91-118`; UFO `excel_wincom_mcp_server.py:88-256`                                                 | Macro security (keep engine.py profile rules); confirmation for edits of the person's open file.                                   |
| R13 | ADD                      | Visual fallback with Gemini Computer Use: leased-window preview in; accept only click_at / type_text_at / scroll_at; map 1000×1000 → window fractions → the existing click_point path (lease, vision patch, foreground).                                           | edge-handler.ts (tool declaration), planner.server.ts (fallback route), windows_worker/mac_worker click_point | adk-python `computer_use_toolset.py:53-108, 893-903`, `computer_use_tool.py:35-57`                                                          | O14: a new tool on the same model family. Measure on the visual tasks first.                                                       |
| R14 | ADD                      | Set-of-marks overlay: number the UIA/AX boxes on the preview so the model answers "element 7". Preview crop/zoom argument.                                                                                                                                         | windows_worker.py/mac_worker.py preview; media_worker.media_preview                                           | OmniParser `util/utils.py:417-499` (technique only); mcp-windows AnnotatedScreenshotService.cs; Qwen-Agent `image_zoom_in_qwen3vl.py:31-35` | Larger previews; keep the 30 KB cap.                                                                                               |
| R15 | REPLACE                  | Web observation: `page.aria_snapshot(mode="ai", depth=…)` with refs instead of the custom `_CONTROLS` script. Refs belong to the observation token; site binding unchanged.                                                                                        | web_worker.py 527-586                                                                                         | Playwright `injected/src/ariaSnapshot.ts:40-71`, `client/page.ts:941-942`; playwright-mcp README:16, 454                                    | The pinned Python Playwright must expose `mode`. Verify and upgrade the pin if needed.                                             |
| R16 | ADD (OWNER DECISION)     | Browser extension bridge (visible, store-published, person-installed): chrome.debugger + nativeMessaging to the companion, limited to tabs the person shares. Gives access to the person's real signed-in browser. Same site binding, STOP and confirmation rules. | new extension + web_worker.py transport + catalog                                                             | Tencent BrowserSkill README:68-91; open-browser-use `manifest.json`, `background.js:118, 550-587`; BrowserMCP README:3-11                   | Broad permissions; Chrome's debugging banner; store review; ARCHITECTURE.md "no hidden extension" (this one is visible).           |
| R17 | IMPROVE                  | Take Over → Resume reconciliation: diff the new observation against the last one; optionally summarise the person's UIA/AX-resolved actions during Take Over (passwords redacted).                                                                                 | planner.server.ts observedSinceTakeOver 198; agent.py                                                         | BrowserSkill README:74; bytebot `input-tracking.helpers.ts`; deploymenttheory `journeyrecord.go:13-60`                                      | Privacy: opt-in, redaction.                                                                                                        |

### 5.3 Model loop (calls, tokens, reliability)

| ID  | Verdict      | Change                                                                                                                                                                                                                                                                               | OCADE owner                                                                                             | Source mechanism                                                                                                                                                                                                                           | Risk                                                                                      |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| R18 | IMPROVE (P0) | `toolConfig.functionCallingConfig = {mode:'ANY', allowedFunctionNames:[offered…, 'finish','ask']}`; goal turn `['set_goal']`.                                                                                                                                                        | edge-handler.ts 495-513; planner.server.ts callPlanner 472                                              | vercel/ai `google-prepare-tools.ts:260-310`                                                                                                                                                                                                | Live models may ignore it. Test per model; record the result in the capability record.    |
| R19 | REPLACE      | Send `parametersJsonSchema` (full JSON Schema; only `const` → `enum`) and retire the lossy `providerSchema()` where the model supports it.                                                                                                                                           | planner.server.ts 383-404, 861-875; edge-handler.ts 505-509; live-session.ts 73-76                      | vercel/ai `google-prepare-tools.ts:320-326`, `sanitize-response-json-schema.ts:3-21`                                                                                                                                                       | Older or Live models may reject it. Keep a per-model fallback from the capability record. |
| R20 | ADD          | Durable capability record per model: function-call reliability, thinking support, TPM/RPD, real context window, TTFT and steady rate, implicit-cache hit rate. Learned from provider errors (update only when lower) and measured probes. Seed values come from LiteLLM's catalogue. | edge-handler.ts (replaces `withoutThinking` 174/1135/1261) + 1 migration; scripts/model-availability.ts | freellmapi `services/ratelimit.ts:1647-1740`, `lib/fallback-loop.ts:3-81`; litellm `model_prices_and_context_window.json` (5,988 entries); FreeLlmApiBenchmark `benchmark.js:3-19`; gemini-cli `availability/errorClassification.ts:14-37` | —                                                                                         |
| R21 | IMPROVE      | Delta prompts: the step turn carries the objective, remaining plan, last observation delta, failure and refusal hint, plus a structured progress summary (Actions Completed / Current State). Older observations become handles, not clipped text.                                   | planner.server.ts history() 741-792                                                                     | magentic-ui `_compaction.py:23-50`; deepagents `_overflow_clip.py:1-14`; mcp-windows SnapshotDiffEngine (UI deltas)                                                                                                                        | Less context may lower accuracy; review §8 test 3 applies.                                |
| R22 | ADD          | Observation handles: the device keeps full evidence per step (journal folder); the planner gets a summary + handle and may call a pure-read `observation.read(handle, range)`.                                                                                                       | journal.py, gateway.py (16 KB cap stays), contracts.ts                                                  | deepagents `_overflow_clip.py:8-13`; BrowserSkill `view` (README:79); agent-framework ContentVariableStore `security.py:725-760`                                                                                                           | Local disk use (bounded retention).                                                       |
| R23 | IMPROVE      | Prompt-prefix stability: SYSTEM text and tool declarations byte-identical across a task, per-turn delta last, so Gemini implicit caching applies. Log `cachedContentTokenCount`.                                                                                                     | planner.server.ts SYSTEM 342-377; edge-handler.ts health record                                         | hermes `memory_tool.py:2-4`; adk-js `token_usage.ts:78`; MCP spec cacheable list results (2026-07-28 blog 34)                                                                                                                              | —                                                                                         |
| R24 | IMPROVE      | Actionable `hint` on every device refusal and receipt error code: one generic sentence naming the fix.                                                                                                                                                                               | gateway.py receipt(); worker `Refused` codes; plannerMessage 330                                        | hermes `skill_manager_batch.py:30-45`; OpenCLI README:22-27                                                                                                                                                                                | —                                                                                         |
| R25 | ADD          | Architect/editor split for configuration C: the strong model compiles once; the fast model repairs with a fresh minimal context. Choose by plan length instead of an extra classifier call.                                                                                          | edge-handler.ts route; planner escalation                                                               | aider `architect_coder.py:11-48`; gemini-cli `classifierStrategy.ts:27-84`                                                                                                                                                                 | O14/O15: model roles are owner-directed.                                                  |
| R26 | ADD          | Facts ledger in compileGoal: facts GIVEN versus TO LOOK UP (with source). Feeds checks and the "never from memory" rule.                                                                                                                                                             | planner.server.ts compileGoal 620-715                                                                   | semantic-kernel `_magentic_prompts.py:3-31`; TuriX `planner_service.py:39-47`                                                                                                                                                              | +tokens in the goal turn only.                                                            |
| R27 | ADD          | Reasoning scaffold for non-thinking models (capability record thinking=none): a PLANNING/REPLANNING section inside the function `reason` argument.                                                                                                                                   | planner.server.ts SYSTEM                                                                                | adk-js `plan_re_act_planner.ts:15-40`                                                                                                                                                                                                      | —                                                                                         |
| R28 | ADD          | Hard per-task input-token budget (review target ≤3k per step turn) with an honest block when exceeded.                                                                                                                                                                               | planner.server.ts; authority budgets                                                                    | Shannon README:33                                                                                                                                                                                                                          | —                                                                                         |
| R29 | ADD          | Typed blocker enum on wait/block (missing_evidence, needs_user_input, permission_required, external_wait, run_failed, budget_exceeded) plus `relied_on_assumption` on finish.                                                                                                        | supervisor.ts Decision; planner.server.ts                                                               | deer-flow `agents/goal_state.py:5-33`                                                                                                                                                                                                      | —                                                                                         |

### 5.4 Runtime placement (latency, reliability) — OWNER DECISION

| ID  | Verdict              | Change                                                                                                                                                                                                                                                                                                      | OCADE owner                                                                       | Source mechanism                                                    | Risk                                                                                                                           |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| R30 | ADD (OWNER DECISION) | Run the planner model turn from the Cloudflare Worker / Durable Object that already hosts OCADE instead of the 150 s Supabase Edge Function. One DO per active task holds the device WebSocket with hibernation and uses an alarm instead of the global per-minute cron. Supabase stays the authority (O9). | wrangler.json, src/cloudflare-entry.ts, edge-handler.ts placement, agent.py nudge | cloudflare/agents `packages/agents/src/index.ts:699-947, 1133-1218` | Workers free-plan CPU and DO limits must be checked first (not verified here); secrets placement; one more runtime to qualify. |

### 5.5 Security

| ID  | Verdict              | Change                                                                                                                                                                                                                                                                   | OCADE owner                                                         | Source mechanism                                                                                               | Risk                                                                                                                   |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R31 | ADD                  | Taint tracking: any argument value copied from an untrusted observation (web text, file content, external MCP) is marked. A tainted value flowing into an external_effect argument always needs explicit confirmation, with the taint shown.                             | planner.server.ts intent(); contracts.ts; authority confirmation    | agent-framework FIDES `security.py:343-400, 467, 546-652`                                                      | False positives cause more confirmations.                                                                              |
| R32 | ADD                  | Windows containment for shell.run/job.\* and verifier re-runs: restricted token (workspace-write) via CreateRestrictedToken + CreateProcessAsUser; per-process network block. WFP needs a one-time admin setup (OWNER DECISION).                                         | command_worker.py, jobs.py, verify_worker.py `_containment` 791-806 | codex `windows-sandbox-rs/src/token.rs:372-513`, `wfp.rs:84-332`                                               | Some tools break under restricted tokens; report the containment level as the verifier already does.                   |
| R33 | IMPROVE              | macOS seatbelt profile for shell.run/job.\*: writes only to the workspace and temp; network per grant. Reuse the verifier's own profile.                                                                                                                                 | command_worker.py                                                   | OCADE verify_worker.py:778-789; strands box README:28-71                                                       | —                                                                                                                      |
| R34 | ADD (OWNER DECISION) | Read-only command classifier (prefix rules, canonical caseless matching, compound commands split, strictest verdict wins, unknown → confirm) to skip confirmation ONLY for provably read-only diagnostics; deterministic risk labels on every command confirmation card. | command_worker.py; authority confirmation; UI                       | magentic-ui `_command_policy.py:1-87`; codex `execpolicy/src/rule.rs:16-65`; goose `security/patterns.rs:5-30` | Classifier bypass. Mitigation: fail-safe default, no LLM judging (hermes approval_smart and goose adversary REJECTED). |
| R35 | ADD                  | Pre/post stat diff evidence for path-bearing destructive commands.                                                                                                                                                                                                       | command_worker.py                                                   | magentic-ui `_verifier.py:16-30`                                                                               | —                                                                                                                      |
| R36 | IMPROVE              | SSRF: decode embedded IPv4 in 6to4, NAT64, Teredo and ISATAP addresses; bounded Accept-Encoding (identity, gzip) for the verifier's fetch.                                                                                                                               | web_worker.py 232-238; verify_worker.py `_web_fetch` 1088           | pydantic-ai `_ssrf.py:24-37`                                                                                   | —                                                                                                                      |
| R37 | IMPROVE              | Bound external MCP schema node count and depth.                                                                                                                                                                                                                          | catalog.py load; gateway.py validator                               | openai-agents-python `strict_schema.py:18-26`                                                                  | —                                                                                                                      |
| R38 | IMPROVE              | Bounded realpath/listdir (cloud placeholders), walk caps, no hydration of online-only files during fs.list.                                                                                                                                                              | sandbox.py 131-149; office_worker fs.list                           | modelcontextprotocol/servers `src/filesystem/lib.ts:50-70`                                                     | —                                                                                                                      |
| R39 | IMPROVE              | Split app permission into inspect and control.                                                                                                                                                                                                                           | contracts.ts capability; authority grants; Settings UI              | interpreter-workstation `shared/cuaAccessPolicy.ts:1-50`                                                       | Migration of existing grants.                                                                                          |
| R40 | ADD                  | Heartbeat-gap STOP: when the device loses the server during an external effect beyond N seconds, it fences further effects. Add a provider-generation stamp to receipts.                                                                                                 | agent.py watch loop; gateway receipt                                | deploymenttheory `server.go:544-560`; openclaw `node-host/computer-command.ts:13-33`                           | —                                                                                                                      |
| R41 | ADD                  | Optional pre-approval scan of an external MCP or skill package (SkillSpector offline mode) before the owner pins it.                                                                                                                                                     | developer tooling; catalog docs                                     | NVIDIA SkillSpector README:25-33                                                                               | Advice only; never auto-trust.                                                                                         |
| R42 | IMPROVE              | Trifecta notice: once a task has read untrusted content and private data, every later external-effect confirmation says so.                                                                                                                                              | authority confirmation text                                         | archestra README:5-9                                                                                           | —                                                                                                                      |

### 5.6 Verification and evaluation

| ID  | Verdict | Change                                                                                                                                                                                                                 | OCADE owner                                                                   | Source mechanism                                                                                    | Risk                                                        |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R43 | ADD     | `workbook_no_errors` check plus error-cell report after recalculation; capability note that LibreOffice cannot evaluate XLOOKUP/XMATCH/dynamic arrays.                                                                 | verify_worker.py `_check` 89; office_worker.py write/edit_workbook; engine.py | anthropics/skills `skills/xlsx/SKILL.md:23-75`                                                      | —                                                           |
| R44 | ADD     | Image structure check (SSIM/MSE) and table comparison semantics as verify kinds.                                                                                                                                       | verify_worker.py                                                              | OSWorld-V2 `desktop_env/evaluators/metrics/gimp.py:203-260`, `table.py:232-287`                     | Threshold tuning.                                           |
| R45 | ADD     | Verification tier label on receipts: same_screen / reopened / separate_session / system_of_record.                                                                                                                     | verify_worker.py; supervisor.ts settleChecks 228                              | OpenAdapt `readback_ladder.py:1-28`                                                                 | —                                                           |
| R46 | ADD     | Hidden-answer qualification suite: an OSWorld-V2 subset (calc/writer/impress, GIMP, Chrome, VS Code, multi_apps) plus WindowsAgentArena tasks; V2 categories (dynamic environment, human in the loop, implicit state). | tests/jarvis/benchmark.py, live_eval.py; plan.md §19                          | OSWorld-V2 evaluation_examples (≈369 tasks + V2 categories); EvoCUA README:23                       | Linux-centred tasks need porting (O1); check data licences. |
| R47 | ADD     | Report fields: failure taxonomy, first point of failure, step efficiency, invalid-intent rate, model served, prompt version id, cache hit.                                                                             | benchmark.py, live_eval.py, task report                                       | 0xNyk playbook:107-117; fara `verifier_agent.py:1-23`; deepeval metrics; langfuse prompt versioning | —                                                           |
| R48 | ADD     | Offline step-level planner regression tests from recorded observation → expected-action pairs (no live model); "bugged tool" adversarial tests.                                                                        | tests/jarvis                                                                  | OpenCUA AgentNetBench; openai/evals `elsuite/bugged_tools`                                          | —                                                           |
| R49 | ADD     | Optional rubric grading for subjective deliverable quality (images, video) BEFORE the deterministic verifier. It never replaces the verifier.                                                                          | planner visual loop                                                           | deepagents `rubric.py:2-10`; mcp-agent `evaluator_optimizer.py:25-46`                               | One extra call; creative tasks only.                        |

### 5.7 Learning and reuse — OWNER DECISION (O8 wording, data rights)

| ID  | Verdict     | Change                                                                                                                                                                                                                                                                                                                                                            | OCADE owner                                                                              | Source mechanism                                                                                                                                                          | Risk                                                                                                                   |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R50 | ADD / MERGE | **Verified plan library.** After a verifier PASS, store the guarded list parameterised (paths and values as slots), keyed by objective shape + app/site + platform + engine. Route the next task: run (all slots fill; fall back on any guard failure), adapt (plan as prior), or skip. Mark entries stale on failure. Per account; never shared across accounts. | new table + planner.server.ts route; data-rights class (src/lib/account/data-classes.ts) | CUAWright `skill_factory/gate.py:1-23`, `route.py:1-16`; midscene `task-cache.ts:25-80`; stagehand `observeService.ts:21-41`; OpenAdapt self-repair `self_repair.py:1-60` | Stale plans: guards and the verifier catch them. Not a hardcoded journey: learned from the person's own verified runs. |
| R51 | ADD         | "Show me" demonstration recorder: UIA/AX-resolved clicks, password redaction, assertion marks → guarded list draft for the planner.                                                                                                                                                                                                                               | windows_worker/mac_worker (record mode); UI                                              | deploymenttheory `journeyrecord.go:13-60`; OpenAdapt `compiler/compile.py:1-7`                                                                                            | Privacy, opt-in.                                                                                                       |
| R52 | ADD         | Per-site and per-app "gotchas": short, non-personal lessons from failed or blocked steps (field format, needs a wait, widget pattern), offered when the same origin or app appears.                                                                                                                                                                               | new table; planner prompt                                                                | browser-use `agent/judge.py:28-40` (privacy rules at 38-40)                                                                                                               | Lesson quality: admit only lessons tied to a later PASS.                                                               |
| R53 | ADD         | Capability notes (Agent Skills format): owner-authored, app-family notes of capabilities and pitfalls, loaded only when the discovered app matches (progressive disclosure). Never journeys or answers.                                                                                                                                                           | new folder + planner prompt assembly                                                     | agentskills `docs/specification.mdx:6-88`; CLI-Anything `HARNESS.md:10-72`                                                                                                | O8 boundary must be written down.                                                                                      |
| R54 | ADD         | Developer-time optimisation of the SYSTEM prompt and operation descriptions on the hidden-answer suite: bounded edits accepted only on strict held-out improvement.                                                                                                                                                                                               | scripts/, tests/jarvis                                                                   | microsoft SkillOpt README:38-45; Agent-S4 README:3-25                                                                                                                     | Overfitting; held-out split required. O16 order.                                                                       |

### 5.8 Files and formats

| ID  | Verdict | Change                                                                                                                                | OCADE owner                                           | Source mechanism                                              |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| R55 | ADD     | `fs.read_document`: markitdown (MIT) for pdf/docx/pptx/xlsx/html/epub/msg as bounded Markdown; LLM-caption and Azure converters off.  | office_worker.py; contracts.ts; licence inventory     | markitdown `_markitdown.py:1-80`, converters/                 |
| R56 | ADD     | Lint before accept on fs.edit_text / fs.replace_text for code-like files, using the verifier's existing parsers.                      | office_worker.py edits; verify_worker parsers 395-407 | SWE-agent `tools/windowed_edit_linting`                       |
| R57 | ADD     | MCP progress notifications from long worker calls, forwarded as content-free progress receipts; declare outputSchema on worker tools. | gateway.py; media_worker.py                           | MCP python-sdk `_v2026_07_28/__init__.py:569, 973, 1538-1551` |
| R58 | ADD     | pptx thumbnail preview for presentation deliverables.                                                                                 | office_worker.write_presentation; media.preview       | anthropics/skills `pptx/scripts/thumbnail.py`                 |

## 6. Replacements (weaker OCADE mechanism → superior mechanism)

| OCADE today                                                                          | Replace with                                | Why it is superior (evidence)                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `providerSchema()` lossy OpenAPI subset (planner.server.ts:383-404)                  | `parametersJsonSchema` (R19)                | Full constraint fidelity at the model, not only server-side validation (vercel/ai google-prepare-tools.ts:320-326) |
| Per-instance `withoutThinking` Set (edge-handler.ts:174, 1135, 1261)                 | Durable measured capability record (R20)    | Learned once per deployment, not per cold start (review failure 3: 51 wasted turns, _measured_ there)              |
| Custom web `_CONTROLS` extraction + pop-to-fit (web_worker.py:527-586)               | Playwright `aria_snapshot(mode="ai")` (R15) | Engine-maintained accessible names, shadow DOM, stable refs; smaller output                                        |
| Depth-first `descendants()[:150]` (windows_worker.py:225)                            | CacheRequest + condition + BFS budgets (R6) | One cross-process call; complete within the budget; truncation reported                                            |
| Full history clip (planner.server.ts:741-792)                                        | Delta + handles (R21, R22)                  | Review target ≤3k input tokens per step turn                                                                       |
| Bare device refusal codes (gateway.py `receipt(..., error)`; worker `Refused(code)`) | Per-code actionable hint (R24)              | Small models retry blindly on a bare error (hermes skill_manager_batch.py:30-36)                                   |

## 7. Merged mechanisms (one implementation instead of several frameworks)

| One OCADE mechanism                            | Merges these repository capabilities                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verified plan library** (R50)                | CUAWright Skill Factory; midscene plan and locate caches; stagehand observe→act cache; OpenAdapt compiled bundles + self-repair; goose recipes; OpenCLI adapters (idea only) |
| **Guarded step list** (R1–R5)                  | mcp-windows ui_batch; OpenAdapt guarded IR; cua-driver verify_state; openai-cua-sample-app runtime loops; smolagents CodeAgent (typed form only)                             |
| **Observation delta + handles** (R21, R22, R9) | mcp-windows SnapshotDiffEngine; MacosUseSDK traverse-diff; agent-desktop drill-down and partial observation; deepagents offload; BrowserSkill view; FIDES variable store     |
| **Capability record** (R20)                    | freellmapi learned limits; litellm catalogue; gemini-cli error classes; kaiser-data header-driven limits; FreeLlmApiBenchmark probes; RelayFreeLLM capability routing        |
| **Extension browser bridge** (R16)             | BrowserSkill; open-browser-use; BrowserMCP; OpenCLI logged-in Chrome; dev-browser attach                                                                                     |
| **Command safety** (R32–R35)                   | codex execpolicy + windows-sandbox; magentic-ui classifier + fs verifier; goose threat patterns; coleam00 allowlist; strands box; OCADE verifier containment                 |
| **Evaluation suite** (R46–R48)                 | OSWorld-V2; EvoCUA/WAA; harbor job diff; fara first-point-of-failure; 0xNyk taxonomy; OpenCUA offline bench; openai/evals bugged tools                                       |

## 8. Removals: OCADE components with evidence

After the W12 debloat (ToRemove.md:3-11), I found **no further OCADE code that is provably unused**. The candidates
below are simplification candidates. Each needs the removal proof in ToRemove.md:60-62 before removal. None is
removed by this document.

| Candidate                                                                          | Evidence                                                                                                                                                                                                                                   | Safe to remove?                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim "guarded step lists behind a flag" (plan.md:504, still present at 4a7daf0)   | At 760c08d no such code. At 4a7daf0, guarded batches exist (P3) but without `expect` predicates and not behind a flag (§0.1).                                                                                                              | **Correct the document.** It no longer describes the code: batches are on, guards are failure-only.                                          |
| `providerSchema()` (planner.server.ts:383-404)                                     | Superseded by R19 once every allowed model accepts `parametersJsonSchema`.                                                                                                                                                                 | After R19 passes per model. Keep it as a per-model fallback until the capability record shows no model needs it.                             |
| `withoutThinking` per instance (edge-handler.ts:174, 1135, 1261)                   | Superseded by R20.                                                                                                                                                                                                                         | After R20 is deployed and covered by its contract test (review failure 3 regression test).                                                   |
| `rankBySimilarity` TF-IDF for external MCP tools (planner.server.ts:84-140, 74-82) | Only caller is `routeExternalTools` (planner.server.ts:1076). Built-in operations already moved to a deterministic list (ToRemove.md:7). External servers are capped at 4 active (gateway.py:207-210) and 12 tools (planner.server.ts:47). | Not proven. Remove only if grant-filtered deterministic order plus the 12 cap gives equal recall on a test with more than 12 external tools. |
| Live-session planning route for configuration B (live-session.ts)                  | AUDIO-only output on every turn (review §2 row 7).                                                                                                                                                                                         | Not removable. It is an owner-directed comparison (O15). Recommendation: keep Live for voice only after the 12 runs.                         |

Nothing else qualified. The prior debloat already removed dead files (ToRemove.md:7-11), and the remaining modules
each have callers on the verified execution path (§3.1).

## 9. Evaluation of the top recommendations

Scale: ↑ better, ↓ worse, = neutral, ? unmeasured. All entries are expected effects.

| ID                    | Correctness       | Speed                                                               | Reliability       | Resources     | Security            | Compatibility                  | Maintenance          | Licence of source                    |
| --------------------- | ----------------- | ------------------------------------------------------------------- | ----------------- | ------------- | ------------------- | ------------------------------ | -------------------- | ------------------------------------ |
| R18 force call        | ↑                 | ↑ (fewer retries)                                                   | ↑                 | =             | =                   | ? Live models                  | =                    | Apache-2.0 (technique)               |
| R19 full schema       | ↑                 | =                                                                   | ↑                 | =             | =                   | ? older models                 | ↓ fallback path      | Apache-2.0 (technique)               |
| R1 guarded list       | ? (guard quality) | ↑↑ (1–4 calls instead of 5–30, review §4)                           | ↑                 | ↓ tokens      | =                   | =                              | ↓ new decision kind  | MIT/Apache (techniques)              |
| R6/R7 inspect         | ↑                 | ↑                                                                   | ↑                 | =             | =                   | ? per app                      | =                    | MIT (UFO, open-computer-use)         |
| R10 background a11y   | =                 | ↑ (no waiting for the person)                                       | ↑                 | =             | ↓ (surprise)        | ? UWP/Win32                    | =                    | MIT (cua)                            |
| R15 aria snapshot     | ↑                 | ↑                                                                   | ↑                 | ↓ tokens      | =                   | Playwright pin                 | ↑ (less custom code) | Apache-2.0                           |
| R20 capability record | ↑                 | ↑                                                                   | ↑                 | =             | =                   | =                              | ↓ table              | MIT (freellmapi), MIT (litellm data) |
| R30 Workers/DO        | =                 | ↑                                                                   | ↑ (no 150 s kill) | ? free limits | =                   | new runtime                    | ↓                    | MIT (technique)                      |
| R31 taint             | ↑                 | ↓ (more confirmations)                                              | =                 | =             | ↑↑                  | =                              | ↓                    | MIT (technique)                      |
| R32 Windows sandbox   | =                 | =                                                                   | =                 | =             | ↑↑                  | ? tools under restricted token | ↓                    | Apache-2.0 (technique)               |
| R50 plan library      | ?                 | ↑↑ on repeats (CUAWright reports zero tokens on reuse — repo claim) | ↑                 | ↓ storage     | = (per account)     | =                              | ↓                    | MIT (technique)                      |
| R16 extension bridge  | ↑ (real sign-ins) | ↑                                                                   | ?                 | =             | ↓ broad permissions | Chrome/Edge only               | ↓↓ store upkeep      | MIT (BrowserSkill, open-browser-use) |

## 10. Licensing requirements

| Use                                     | Repositories (licence)                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Requirement                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Libraries OCADE may bundle              | markitdown (MIT); Playwright (Apache-2.0, already used); MCP python-sdk (MIT); pywinauto (already used)                                                                                                                                                                                                                                                                                                                                                                         | Add to `THIRD_PARTY_NOTICES.md` and `scripts/licence-inventory.mjs`; keep NOTICE for Apache-2.0  |
| Technique-only sources (no code copied) | vercel/ai, codex, cua, agent-desktop, UFO, OpenAdapt, CUAWright, FIDES/agent-framework, midscene, stagehand, open-computer-use, playwright, pydantic-ai, deepagents, magentic-ui, adk-python                                                                                                                                                                                                                                                                                    | No obligation for ideas. If code is copied, keep the copyright line and licence (MIT/Apache-2.0) |
| Data seeds                              | LiteLLM model catalogue JSON (MIT outside enterprise/)                                                                                                                                                                                                                                                                                                                                                                                                                          | Notice if shipped                                                                                |
| Evaluation data                         | OSWorld-V2 tasks (Apache-2.0 code; per-asset licences vary)                                                                                                                                                                                                                                                                                                                                                                                                                     | Check every task asset before redistribution; keep benchmark data out of the product bundle      |
| **Do not copy code**                    | AGPL-3.0: skyvern, beta9, AI-Horde, T3MP3ST, archestra (default); Polyform Shield: AutoGPT `autogpt_platform/`; Sustainable Use: n8n; BSL 1.1: mcp-server-macos-use; modified Apache with multi-tenant restriction: dify; no licence file: skillhubz, libukai, linny006, Prat011, vibetest-use, Clevrr, XuexGao, malda231125, reqsgjh, AILookup, devanasolver, zenrran4nlp, trycua/acu, vercel-labs/ai-sdk-computer-use, kyrolabs, appcypher, bradAGI/awesome-cli-coding-agents | OCADE is a multi-account network service: AGPL and multi-tenant clauses would bind it            |
| Avoid entirely                          | XuexGao/free-llm-router (reverse-engineered vendor auth, account pooling); multi-provider free-tier aggregation (ToS, consent covers Gemini only)                                                                                                                                                                                                                                                                                                                               | Legal and security risk                                                                          |

## 11. Prioritised implementation roadmap (research proposal, not a plan change)

The order follows code dependency and the review's falsification tests (review §8). O16 is respected: no new model
providers. R13 and R25 stay inside the Gemini family and still need owner approval (O14).

| Step | Items                                                                                                                                                                                 | Owner files                                                                               | Depends on | Acceptance (measurable)                                                                                               | Reversal trigger                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0    | Correct plan.md:504 (batches are on and guards are failure-only, §0.1); add review §6 step-1 diagnostics (attempt key, model served, rejection branch, TTFT and total, cached tokens) | plan.md, planner.server.ts, authority.server.ts                                           | —          | Task report shows these fields on every turn                                                                          | —                                                                       |
| 1    | R18 force call; R24 hints; review's attempt identity fix                                                                                                                              | edge-handler.ts, planner.server.ts, gateway.py                                            | 0          | Text-only finals = 0 on generateContent models across 24 tasks; `invalid_goal` with `no_call` = 0 for non-Live models | If accuracy drops on E1 by >2 points, revert                            |
| 2    | R20 capability record (seeded, learned); R19 full schema per capability                                                                                                               | edge-handler.ts, 1 migration, planner.server.ts                                           | 1          | Thinking refusals once per model per deployment; schema-invalid proposals ↓                                           | If any allowed model rejects `parametersJsonSchema`, the fallback stays |
| 3    | R6 R7 R8 R9 R11 R3 R4 (observation and reach)                                                                                                                                         | windows_worker.py, mac_worker.py, web_worker.py, contracts.ts                             | —          | Inspect p50 ≤300 ms on fixtures; Electron app tree non-empty on macOS; scroll reaches below-fold controls in tests    | —                                                                       |
| 4    | R15 aria snapshot; R36 SSRF; R37 schema bounds; R38 bounded realpath                                                                                                                  | web_worker.py, catalog.py, sandbox.py                                                     | —          | Web suite green; SSRF tests for NAT64/6to4                                                                            | —                                                                       |
| 5    | R1 R2 R5 guarded lists (flagged), R21 R22 deltas and handles, R23 prefix stability, R28 token budget, R29 typed blockers                                                              | contracts.ts, planner.server.ts, supervisor.ts, authority.server.ts, agent.py, journal.py | 1–4        | Step-turn input ≤3k tokens; model calls per simple task ≤3 (review §7)                                                | Review §8 tests 2–3                                                     |
| 6    | R43 R44 R45 verifier kinds and tiers; R47 report fields; R48 offline tests                                                                                                            | verify_worker.py, benchmark.py, tests/jarvis                                              | 5          | New checks pass on oracles; reports carry taxonomy                                                                    | —                                                                       |
| 7    | Rerun the owner's 24 tasks (plan.md §19.4)                                                                                                                                            | —                                                                                         | 1–6        | Measured against review §7 targets                                                                                    | —                                                                       |
| 8    | R31 taint; R32/R33 containment; R34/R35 command safety (OWNER DECISION on R34); R39 inspect/control split; R40 heartbeat                                                              | planner, authority, command_worker.py, jobs.py, verify_worker.py                          | 5          | Injection suite extended; containment reported per run                                                                | —                                                                       |
| 9    | OWNER DECISIONS: R10 background accessibility; R30 Workers/DO planner; R13 Computer Use fallback; R25 role split                                                                      | as listed                                                                                 | 7          | Owner approval, then A/B on the 24 tasks                                                                              | Revert on any safety regression                                         |
| 10   | OWNER DECISIONS: R50 plan library; R51 recorder; R52 gotchas; R53 capability notes; R12 live documents; R16 extension bridge                                                          | new tables and modules                                                                    | 5–7        | Repeat-task model calls → 0 when all guards hold (measure)                                                            | Library hit causing a wrong result → disable the entry class            |
| 11   | R46 hidden-answer suite; R54 prompt optimisation (developer-time)                                                                                                                     | tests/jarvis, scripts                                                                     | 6          | ≥90 % first-attempt target tracked (plan.md §1)                                                                       | Held-out regression                                                     |

## 12. Coverage, limitations and open questions

### 12.1 Coverage summary (measured)

See §2.2–2.3 and Appendix B. Per repository, Appendix B gives files, code lines, the line-logged files and lines,
and the other evidence used.

### 12.2 Limitations

- **The "read every line" requirement is unmet.** It covers 200.8 million lines. This research read the
  implementation files of headline mechanisms, not whole repositories.
- **Capability completeness per repository is not verified.** Large repositories (openclaw, n8n, litellm, orca,
  mastra, hermes-agent, sglang, vllm, codex, cua, langfuse) certainly contain useful mechanisms that were not opened.
- **Shallow clones** omit history. Blobs over 1 MiB (assets, some generated files) were not fetched.
- **No repository code was executed.** Repository claims (benchmarks, speed-ups) are quoted as claims.
- **OCADE was read on its execution path, not completely** (≈2.4 % of tracked lines). Conclusions about OCADE are
  limited to the cited lines and greps. In particular, the Supabase SQL functions (authority internals) and the
  website components were not read.
- **Free-plan limits** for Cloudflare Durable Objects and Workers CPU (R30) and the Gemini `functionCallingConfig`
  and `parametersJsonSchema` behaviour of the Live models (R18, R19) were **not verified** against current provider
  documentation in this session.

### 12.3 Known but unread mechanisms worth a later pass

- trycua cua-driver Rust sources: background delivery implementation, recording.
- openclaw: node-host exec policy and auto-update.
- OpenAdapt: runtime/replayer.py (20k lines) and attended runtime.
- codex: guardian-context and windows-sandbox setup (elevated paths).
- UFO: AIP resilience.
- agent-desktop: Windows probe results.
- hermes-agent: approval floors and browser real-profile handling.
- pydantic-ai: durable_exec.
- browser-use: repl worker isolation.

### 12.4 Owner decisions requested by this research

R10, R13, R16, R25, R30, R34, R50, R51, R52, R53. Each is listed in §11 step 9 or 10 with the source evidence.

---

## Appendix A — Repository-by-repository analysis (all 246, in the requested order)

Each entry states: licence, language, commit and date, size, exactly what was read ("Read:"), the capabilities found with `path:line`, the OCADE comparison, and verdicts. "ADD (technique only)" means adopt the idea without copying code. Line numbers refer to the cloned commit shown in the entry.

### A.1. microsoft/UFO — MIT, Python, eae3c0a (2026-10-14); 932 files, 132.9k py lines

**Read:** ufo/automator/ui_control/controller.py 182-260; inspector.py 314-470; galaxy/constellation/task_constellation.py 279-300; grounding/omniparser.py 1-60; function indexes (grep def/class) of controller.py, task_constellation.py, orchestrator.py, excel_wincom_mcp_server.py, summarizer.py, retriever.py; directory tree.

**Capabilities:**

- UIA CacheRequest + compound condition (IsEnabled, !IsOffscreen, IsControlElement, ControlType OR-list) fetches filtered control list in one cross-process call (inspector.py:323-370). OCADE windows_worker.py:225 walks `target.descendants()[:150]` with per-element pywinauto COM calls and no filter (first 150 in document order, may miss controls; slow).
- Text input ladder with verification: set_edit_text → verify window_text contains text → type_keys fallback → pyautogui last resort (controller.py:182-259).
- HostAgent/AppAgent split (ufo/agents/agent/host_agent.py, app_agent.py): host picks app, app agent acts inside it.
- App-native COM MCP servers: Excel table2markdown/insert_table/select_range/reorder_columns/get_range_values (excel_wincom_mcp_server.py:88-256); Word, PowerPoint, PDF reader servers (local_servers/).
- Galaxy "TaskConstellation": DAG of TaskStars with dependencies, ready-task priority scheduling (task_constellation.py:279-294), validate_dag (483), orchestrator assigns devices and runs ready tasks concurrently (orchestrator.py:143-515) — multi-device orchestration.
- Visual grounding via OmniParser service (grounding/omniparser.py:25-60) for controls without UIA.
- Experience learning: summarise successful trajectories into YAML + vector DB (experience/summarizer.py:18-165); offline help-doc RAG per app (rag/retriever.py:81-107).
- AIP protocol package (aip/: endpoints, resilience, transport) for client/server device agents.

OCADE compare & verdicts:

- IMPROVE windows_worker.ui_inspect with UIA CacheRequest+condition (exact mechanism inspector.py:323-370) — expected faster, more complete inspect (not measured).
- IMPROVE ui.set_value with readback-verified ladder (OCADE already does readback; add type_keys fallback only within lease rules).
- ADD (later, opt-in) app-native COM ops for open Excel workbook ranges (get_range_values/select_range) — OCADE office_worker edits files, not live open workbooks; benchmark review §10 says UI route needed when file open.
- ADD experience memory as deterministic "recipe" cache, NOT vector DB (plan.md §14 rejects vector DB) — store verified step lists per (app, goal-shape) for plan-first reuse.
- REJECT Galaxy multi-device DAG now (O4/O9 single task authority; one device per task) — keep DAG/ready-queue idea for milestone parallelism (plan.md §13 says independent milestones may run in parallel).
- REJECT OmniParser model hosting (GPU, local model; plan §14 rejects local model). License MIT.

### A.2. sbroenne/mcp-windows — MIT, C#/.NET 10, 36b6863 (2026-11-11)

**Read:** Automation/SnapshotDiffEngine.cs 1-366 (full), Automation/Tools/UIBatchTool.cs 1-200, Automation/ElementIdGenerator.cs 1-80; README head. Listed sizes of all 70+ src .cs files.

**Capabilities:**

- Snapshot diff of UIA compact tree: parent-scoped semantic identity Type+Name (SnapshotDiffEngine.cs:280-281), returns add/remove/update changes (CompareSiblings 172-239); ambiguous duplicate counts reported as remove+add rather than wrong update (218-237); layout-only nodes flattened (89-93); redundant leaves dropped (56-75). => send only changed controls to model ("snapshotSince" token).
- ui_batch tool: JSON array of steps executed in one call, `$prev` chaining of element ids, stopOnError, optional post-snapshot diff (UIBatchTool.cs:72-200).
- ElementIdGenerator: bounded (4096) immutable element ids with generation, runtime identity (ElementIdGenerator.cs:10-67).
- Other components seen by file list: UIA3 COM wrapper, OCR (LegacyOcrService.cs), AnnotatedScreenshotService.cs (numbered overlays), OpenDialog handler (763 L), Table reading (UIAutomationService.Table.cs), CLI daemon (Cli/Service/DaemonHost.cs), LLM usage evals (tests/usage_evals).

**OCADE compare:** OCADE windows_worker.py ui.inspect returns full tree each time; no diff, no batch.

**Verdicts:** ADD semantic UIA tree diff to ui.inspect (windows_worker.py, mac_worker.py) — cuts tokens per turn (matches review fix "delta prompts"). ADD ui.batch-like guarded step list executed device-side (aligns plan.md §13 guarded step lists) — IMPROVE. REJECT adopting C# server wholesale (OCADE is Python MCP workers; .NET runtime extra dependency). License MIT: technique reuse OK with notice.

### A.3. deploymenttheory/windows-mcp-server — MIT, Go, 3da251a (2026-10-15); 19k Go lines

**Read:** internal/winmcp/server.go 520-600; internal/desktop/journeyrecord.go 1-60; policy/examples/audit.json, dual-control.json (heads); file listing internal/desktop (40 files).

**Capabilities:**

- Device-posture policy engine: signals (mdm-enrolled, bitlocker, secure-boot, vbs, run-context) with TTLs; rules by toolset/annotation ("destructive") with on_fail deny/kill; audit vs enforce mode (policy/examples/audit.json).
- Dual control: HMAC-signed approval webhook with timeout/poll before destructive steps (server.go:520-531).
- Plan-and-apply planner: steps planned then applied, abandoned when kill switch trips (server.go:533-542).
- Kill triggers: sentinel, posture drift, rug-pull detector (tool baseline pinned after AddTool; change trips), heartbeat gap (server.go:544-560).
- OTLP telemetry middleware, off by default, auth headers from env only (server.go:562-590).
- Journey recorder: low-level input hooks; each click resolved to UIA element+state at hit-test, keystrokes to chars with password redaction, F8 assertion marks, F9 stop; double-click merge (journeyrecord.go:13-60). Replays journeys (journeys/examples/notepad-smoke.json).
- Desktop toolkit files: uia.go, pattern.go, selector.go, snapshot.go, overlay.go, clipboard.go, wmi.go, credentials.go (Windows Credential Manager), ffmpeg/avi screen recording.

**OCADE compare:** OCADE has pinning at start (gateway.\_tool_problem), STOP epoch, person confirmation in server UI; lacks runtime rug-pull re-check of live tools/list, heartbeat-gap kill, and demonstration recording.

**Verdicts:**

- ADD "Show me" demonstration recorder (UIA-resolved clicks, password redaction, assertion marks) producing a guarded step list the planner can reuse. Not a hardcoded journey (O8) because the person records it; needs owner decision. Mechanism: journeyrecord.go:13-60.
- ADD heartbeat-gap auto-STOP on device when server poll is lost during an external_effect (agent.py watch loop) — IMPROVE.
- KEEP OCADE consent model; REJECT MDM/BitLocker posture signals (consumer product, plan.md §1).
- REJECT Go rewrite. MIT.

### A.4. iFurySt/open-computer-use — MIT, Swift (macOS) + Go (Windows/Linux), e25be21 (2026-11-13); 69k code lines

**Read:** OpenComputerUseKit/SkyClickSimulation.swift 1-45, SkyLightSPI.swift 1-45, LockedUseStateMachine.swift 1-45, AXSnapshotReadCache.swift 1-45, WindowOcclusionKeepAlive.swift 1-45, SetValueReadBack.swift 1-45; grep of ComputerUseService.swift tool functions (listApps 691, performSecondaryAction 931, scroll 962, drag 1006, typeText 1031, pressKey 1079, setValue 1119), AccessibilitySnapshot.swift 107/310/532-542.

**Capabilities:**

- Chromium/Electron AX enablement: sets AXManualAccessibility (+AXEnhancedUserInterface) on app element and waits up to ~2 s for lazy web tree (AccessibilitySnapshot.swift:107, 532-542); engine detected from shipped frameworks, not bundle-id list (WindowOcclusionKeepAlive.swift:27-34).
- Batched AX attribute reads with AXUIElementCopyMultipleAttributeValues, per-snapshot cache, transient errors not cached (AXSnapshotReadCache.swift:4-33).
- Typed set_value readback: literal string compare, number/bool coercion only when AX returns that type (SetValueReadBack.swift:3-25).
- Background (non-frontmost) click/focus via private SkyLight SPI synthetic focus plan + primer events (SkyLightSPI.swift:6-37; SkyClickSimulation.swift).
- Window occlusion grid check (16x16) before freezing visible state (WindowOcclusionKeepAlive.swift:5-25).
- "Locked use" experiment: state machine to act while screen locked with permits, stop on physical input/lease expiry (LockedUseStateMachine.swift:3-35).
- Software cursor overlay, virtual display, element index identity, Windows/Linux Go apps.

**OCADE compare:** mac_worker.py \_walk (L211-215) reads AXChildren recursively per attribute (one IPC per attribute), no AXManualAccessibility => Chrome/Electron/VS Code windows expose near-empty trees.

**Verdicts:**

- IMPROVE mac_worker.ui_inspect: set AXManualAccessibility/AXEnhancedUserInterface before walking Chromium/Electron apps (exact mechanism AccessibilitySnapshot.swift:532-542). High value, small change.
- IMPROVE mac_worker attribute reads via AXUIElementCopyMultipleAttributeValues (pyobjc exposes it) — fewer IPC round trips (expected, not measured).
- IMPROVE mac/windows set_value readback typed comparison (SetValueReadBack.swift:3-25).
- REJECT SkyLight private SPI background input (private API, breaks on OS updates, conflicts with OCADE "input only to frontmost app" rule plan.md review §10) and locked-screen use (security). MIT.

### A.5. OpenAdaptAI/OpenAdapt — MIT, Python, 420ccf2 (2026-11-13); 11,709 files, 1.27M py lines (largest Python repo here)

**Read:** packages/flow/openadapt_flow/ir.py 1-90, 467-527; compiler/compile.py 1-70; repair/self_repair.py 1-60; readback_ladder.py 1-40; listing of openadapt_flow (≈230 modules). Not read: >99% of lines (runtime/replayer.py 20k lines, **main**.py 14k etc.).

**Capabilities:**

- Compile a recorded demonstration (events.jsonl + before/after frames) into a Workflow bundle: straight-line steps or a ProgramGraph state machine with guarded branches, loops, subflows, exception paths; pre/post contracts per action (ir.py:1-20; compiler/compile.py:1-7). Bundle sealed/encrypted with manifest hashes (ir.py:73-89).
- Anchor = redundant target evidence with a resolution ladder: structural locator (DOM selector/UIA AutomationId/role+name) → template crop local/global → OCR text → landmarks → grounder model (ir.py:467-491). Repo states structural rung 21/21 vs 6/21 visual on its own desktop benchmark (ir.py:487-488; repo claim, not re-measured).
- Identity check before every click: row context text / structured identity (exact characters) to avoid wrong-record actions (ir.py:498-522).
- Self-repair: on halt BEFORE effect, a CU agent proposes ≤3 corrective actions, patch, probe replay stops before first save, person approves, canary re-run (self_repair.py:1-60). Healthy run = zero model calls.
- Readback ladder: unchecked / same_screen / reopened / separate_session / system_of_record; VERIFIED only from independent readback (readback_ladder.py:1-28).
- Also present (by module names): durable attended runtime, undo/rollback, shadow runs, PHI redaction, fault campaigns, fleet, RL env, taskgen.

**OCADE compare:** OCADE has per-step model calls; no compiled reusable program; verifier = independent re-read of saved files (≈ system_of_record tier). No anchor ladder (window lease + vision patch only).

**Verdicts:**

- ADD "compiled plan IR" concept for OCADE plan-first (review §4 step 3): guarded steps with structural anchor + fallback evidence + postcondition; deterministic replay; model only on halt. Mechanism: ir.py Anchor/Step/Postcondition, self_repair.py halt-propose-probe flow. Highest-value design source for M2/M4.
- ADD verification tier label to OCADE verifier receipts (verify_worker.py) using readback ladder semantics (readback_ladder.py:3-24).
- IMPROVE target identity: add row-context identity check before ui.invoke/web.click (ir.py:498-522).
- REJECT importing the package (1.27M lines, healthcare/enterprise scope, PHI/FHIR). MIT; techniques reusable.

### A.6. HKUDS/CLI-Anything — Apache-2.0, Python, 34f5195 (2026-09-22); 1,872 files, 310k py lines, 83 app harness folders

**Read:** cli-anything-plugin/HARNESS.md 1-80 (of 747); freecad_cli.py 1-60; freecad core/session.py 1-60; blender utils/blender_backend.py grep (find_blender, render_script `blender --background --python`); directory listings (freecad core: 18 modules incl. sketch/body/assembly/techdraw/fem/cam; gimp core: canvas/layers/filters/export; libreoffice core: calc/writer/impress/styles).

**Capabilities:**

- SOP to turn a GUI app into a stateful JSON CLI for agents: find backend engine, map GUI actions to API calls, data model, existing CLIs, undo command pattern (HARNESS.md:10-72).
- 83 per-app harnesses (FreeCAD, Blender, GIMP, Kdenlive, Shotcut, LibreOffice, Inkscape, Krita, Audacity, OBS, MuseScore, QGIS, drawio, n8n, obsidian …) each with --json, REPL, session undo (MAX_UNDO 50, session.py:51-54) and file-locked session JSON (session.py:17-48).
- Backends wrap the real program headless (blender --background --python, libreoffice --headless --convert-to).
- skill_generator.py / cli-hub registry (registry.json, matrix_registry.json) to publish harnesses as agent skills.

**OCADE compare:** OCADE runs FreeCAD/Blender "through their own Python as job.\*" (review §10) with model-written scripts each time; office via engine.py LibreOffice headless. Benchmark apps (Calc, GIMP, FreeCAD, Blender) match harnesses here.

**Verdicts:**

- ADD (owner decision needed vs O8): optional pinned "app capability packs" — typed operations derived from these harnesses (e.g. FreeCAD sketch/body/export, GIMP layers/export, Blender render) exposed via OCADE's external-MCP manifest path (catalog.py). This is capability knowledge, not a fixed journey; reduces model-written scripts and failure.
- IMPROVE OCADE job.\* scripts by reusing harness backend invocation patterns (headless flags) as reference.
- REJECT bundling all 83 (size, maintenance; many SaaS-specific). Apache-2.0: keep NOTICE.

### A.7. openinterpreter/openinterpreter — Apache-2.0, now a distribution fork of OpenAI Codex (Rust), f09c887 (2026-11-14); 8,721 files, 1.94M Rust lines

**Read:** FORK_BRANDING.md 1-40; codex-rs/core/src/harness/claude_code.rs 1-40 (imports); codex-rs crate list (≈120 crates); size list of largest files.

**Capabilities (fork-specific):** multi-provider "harness" layer (harness/claude_code.rs, harness_aliases.rs 5.5k lines) that runs Codex core against Anthropic Messages API with cache_control, context editing, thinking config, child-agent system prompts (claude_code.rs:1-40); product identity via one Product module (FORK_BRANDING.md:8-30). Everything else = Codex (see openai/codex note: sandboxing bwrap/windows-sandbox, execpolicy, memories, apply-patch, mcp-server, hooks, skills, realtime-webrtc).

**Verdicts:** MERGE into openai/codex analysis (same mechanisms). REJECT as dependency (Rust 1.9M lines; OCADE planner is server-side TS). Provider-adapter idea already exists in OCADE (workers-ai.ts, live-session.ts) — KEEP.

### A.8. openinterpreter/interpreter-workstation — Apache-2.0, TypeScript/Electron, aae3346 (2026-11-14); 473k TS lines

**Read:** server/tools/builtin-tools/cua-driver/tools.ts 1-50 (of 3,984); windows-uia.ps1 function index (4,552 lines PowerShell UIA driver); shared/cuaAccessPolicy.ts 1-50.

**Capabilities:**

- Per-app Computer-Use access policy with two permission kinds, inspect vs control, each ask/deny/all, default ask (cuaAccessPolicy.ts:1-50).
- Windows UIA driver as one PowerShell script with persisted driver state and agent-cursor overlay anchored to target HWND (windows-uia.ps1:1031-1205); mac driver over a unix socket per pid (tools.ts:50); activity overlay (JXA) hidden after 3.5 s idle (tools.ts:40-45).
- Desktop workstation app: PDF/movie viewers, Codex app-server client (src/lib/codex/app-server-client.ts), overlay run-engine.

**OCADE compare:** OCADE grants `app:<exe>` as one permission; inspect and act are the same grant.

**Verdicts:** IMPROVE OCADE grants: split app permission into inspect (ui.inspect, apps.list) and control (ui.invoke/set_value/send_keys/click_point) — lets planner observe before the person approves control (authority.server.ts permission check; contracts.ts capability). ADD visible "agent is acting" cursor/overlay on device (trust UX). REJECT PowerShell UIA driver (OCADE Python pywinauto is equivalent). Apache-2.0.

### A.9. QwenLM/Qwen3-VL — Apache-2.0, model repo (cookbooks, eval, finetune), 9658872 (2026-01-30); 8,980 py lines + notebooks

**Read:** cookbooks/computer_use.ipynb all cells (setup, API grounding, local model); cookbooks/utils/agent_function_call.py 149-230 (ComputerUse tool schema) + def index (mobile actions 119-143, desktop actions 259-271).

**Capabilities:** open-weight VLM (e.g. Qwen3-VL-30B-A3B-Instruct) doing GUI grounding from screenshot → click point; image resized with smart_resize(factor=32, min_pixels 3136, max_pixels 12,845,056) and coordinates mapped back (notebook cell 6); action space key/type/mouse_move/left_click/drag/right/middle/double/triple_click/scroll/hscroll/wait/terminate/answer (agent_function_call.py:160-195); mobile action space click/long_press/swipe/system_button/open (119-143); finetune code (qwen-vl-finetune), eval suites (MMMU, VideoMME, ODinW).

**OCADE compare:** OCADE visual fallback = Gemini sees preview + window-fraction click_point + vision.py patch revalidation.

**Verdicts:** REJECT local VLM hosting (plan.md §14 rejects local LLM; O2 Gemini only). KEEP OCADE window-fraction coordinates (resolution independent) — confirms smart-resize mapping pitfalls OCADE avoids. ADD (later, owner decision O16) Qwen3-VL via a free hosted API as candidate grounding model for the visual fallback in model comparison. Apache-2.0 (weights have own licence).

### A.10. QwenLM/Qwen-Agent — Apache-2.0, Python, 31a4d36 (2026-03-04); 32.6k py lines

**Read:** qwen_agent/agents/fncall_agent.py 1-120 (full); tools/image_zoom_in_qwen3vl.py 1-40; llm/fncall_prompts/nous_fncall_prompt.py def index; agents/ and tools/ listings.

**Capabilities:** FnCallAgent loop with MAX_LLM_CALL_PER_RUN budget, stream yield, tool detection per message (fncall_agent.py:73-107); Nous-style function-call prompt for models without native tools (nous_fncall_prompt.py:27-300, extract_fn 300); image_zoom_in tool crops bbox region for a second, higher-detail look (image_zoom_in_qwen3vl.py:31-35); group_chat + auto router multi-agent (agents/group_chat\*.py); MCP manager (tools/mcp_manager.py); code_interpreter, doc parsing/RAG, virtual memory agent; DeepPlanning benchmark (benchmark/deepplanning).

**OCADE compare:** OCADE planner already budgets calls (MAX_FAILURES, stepBudget), validates calls strictly; preview images are whole-window JPEG ≤30 KB (windows_worker.py ui_inspect).

**Verdicts:** ADD zoom/crop region argument to media.preview / ui.inspect preview so the model can request a high-detail crop instead of a larger full image (image_zoom_in_qwen3vl.py mechanism) — IMPROVE visual accuracy at same bytes. ADD text-protocol function-call fallback (nous_fncall_prompt.py) ONLY as diagnosis aid for models that emit no toolCall (review failure 6) — owner decision; validator never loosened. REJECT group chat multi-agent (plan.md §14). Apache-2.0.

### A.11. microsoft/playwright-cli — Apache-2.0, JS, b217248 (2026-11-11); 575 code lines (thin wrapper over playwright-core cli-client)

**Read:** playwright-cli.js 1-156 (full); README key sections; skills/playwright-cli file list (SKILL.md 493 lines + 10 reference docs).

**Capabilities:** CLI front-end to playwright-core's tool registry (`playwright-core/lib/tools/cli-client/program`, playwright-cli.js:24-26); element refs from accessibility snapshots (`check e21`); named sessions, storage-state, tracing, video, request mocking, test generation documented as a SKILL; `--json` errors (playwright-cli.js:36-55). README argues CLI+skill is more token-efficient than MCP because page data is not forced into context.

**OCADE compare:** OCADE web_worker.py `_observe` (L527-586) builds its own controls list + body inner_text (TEXT_LIMIT) + tables, truncating to 16 KB by popping text then controls — content loss on large pages.

**Verdicts:** IMPROVE web observation: use Playwright's built-in AI aria snapshot with refs (same engine as playwright-cli/playwright-mcp) for compact, stable element refs instead of the custom \_CONTROLS script; keep OCADE site binding and newest-observation rule. Detail under microsoft/playwright-mcp note. REJECT CLI wrapper itself (OCADE workers already hold Playwright in-process). Apache-2.0.

### A.12. web-infra-dev/midscene — MIT, TypeScript, bcb3498 (2026-11-13); 3,156 files, 401k TS lines

**Read:** packages/core/src/agent/task-cache.ts 1-120; agent.ts 1266-1330 (aiAct) + API index (aiTap 902 … aiLocate 1552); package listing (android, ios, harmony, computer win/mac/linux with rdp, xvfb, windows-dpi.ts, web-integration puppeteer/playwright/chrome-extension, recorder, yaml runtime).

**Capabilities:**

- Two-level cache: PlanningCache prompt→YAML workflow, LocateCache prompt→element feature (xpath/ElementCacheFeature); consumed entries marked stale when the action using them fails and only those are replaced on re-locate (task-cache.ts:25-80). => repeat tasks replay without planning calls.
- Split model roles: planning model vs locate model resolved separately (agent.ts:1294-1295); effort levels fast/balance/deepThink (1301-1318).
- Typed extraction API: aiQuery/aiBoolean/aiNumber/aiString/aiAsk/aiLocate (agent.ts:1524-1552) plus aiAssert-style checks.
- YAML scripts runtime (core/src/yaml-runtime.ts), HTML visual reports (report-generator.ts), recorder (packages/recorder), desktop device with DPI handling (computer/src/windows-dpi.ts), RDP session (computer/native/rdp).

**OCADE compare:** OCADE has no plan or locate cache; every repeat task re-plans from scratch with Gemini.

**Verdicts:**

- ADD task-level plan cache keyed by (objective-shape, app/site, grants) → verified guarded step list; stale-marking on failed guard; matches review §4 plan-first. Mechanism task-cache.ts:25-80. Store per account in Supabase (one table) — owner decision (plan.md §14 rejects vector DB; this is exact-key cache, not vectors).
- ADD separate "locate" role: cheaper/faster model for target grounding vs planner (fits review "capability record per model", edge-handler.ts route).
- REJECT replacing OCADE web_worker with Midscene (no site binding/STOP fences). MIT.

### A.13. microsoft/magentic-ui — MIT, Python + TS frontend, d3c9d13 (2026-07-23); 35k py + 28k TS lines

**Read:** teams/omniagent/\_command_policy.py 1-90; approval.py 1-46 (full); \_verifier.py 1-70; \_compaction.py 1-50; directory listings (omniagent: \_handoff, \_continuation, \_user_interjection, \_harness; web_surfer/fara; sandbox \_quicksand/\_path_validator).

**Capabilities:**

- Shell command classifier ALLOW / REQUIRE_APPROVAL / DENY with categories (destructive_file_op, network, code_exec, system_mod, privilege_escalation, package_mgmt, process_mgmt, dangerous_git); compound commands split, strictest wins; unknown defaults to approval; pipe-to-shell & escalation denied (\_command_policy.py:1-87).
- Approval provenance: APPROVE/DENY/ALTERNATIVE; status user/auto_session/auto_policy/auto_safe recorded on each tool call (approval.py:10-46).
- Post-hoc filesystem verifier for destructive shell commands: stat probes PRE_AND_POST for rm/rmdir/shred, POST_ONLY for mv/cp/chmod/ln/tee/truncate; skips when unquoted metacharacters (\_verifier.py:1-66) → model sees real effect, self-corrects no-op typos.
- Context compaction to a structured handoff summary (Task / Actions Completed / Current State …) when history crosses threshold (\_compaction.py:23-50).
- User interjection mid-run (\_user_interjection.py), Fara-7B CUA web surfer (agents/web_surfer/fara), sandboxes (null/local/quicksand) with path validation.

**OCADE compare:** every shell.run is external_effect needing confirmation (command_worker.py:1-14); receipts report exit code + bounded output only; history() clips old observations (planner.server.ts:741-792) rather than summarising.

**Verdicts:**

- ADD read-only command classifier to skip confirmation ONLY for provably read-only diagnostic commands (fail-safe default = confirm). Owner decision: changes consent UX. Mechanism \_command_policy.py:21-26.
- ADD pre/post stat diff evidence to shell.run receipts for path-bearing destructive commands (command_worker.py) — gives verifier/model real effect evidence. Mechanism \_verifier.py:16-30.
- ADD "alternative" answer to confirmation (person edits proposed step) — IMPROVE authority confirmAction (authority.server.ts:594).
- IMPROVE planner history: structured progress summary (Actions Completed/Current State) for delta prompts (review fix 4). MIT.

### A.14. temporalio/sdk-typescript — MIT, TypeScript (+Rust core-bridge), 4a5ee34 (2026-11-13); 128k TS lines

**Read:** packages/workflow/src/workflow.ts 1-60 + exported API index (sleep 190, scheduleActivity 364, scheduleLocalActivity 393, proxyActivities 739, startChild/executeChild 946-1122, continueAsNew 1283, patched 1317, deprecatePatch 1343, condition 1376, defineUpdate/Signal/Query 1429-1465); internals.ts 1-50; packages and common/src listings (retry-policy.ts, failure.ts, payload-cache.ts, worker-deployments.ts).

**Capabilities:** durable execution by deterministic workflow replay of an event history; activities with retry policies, timeouts and heartbeats; local activities; child workflows; signals/queries/updates (incl. update validators); durable timers & condition(); continueAsNew to bound history; patched()/deprecatePatch versioning for in-flight code changes; worker deployments/versioning; Nexus cross-namespace ops.

**OCADE compare:** OCADE task authority is a request-driven Supabase state machine (authority.server.ts:1-14) with journal + idempotency keys; device jobs (jobs.py) polled; no deterministic replay; code changes mid-task are not versioned.

**Verdicts:** REJECT Temporal server dependency (needs hosted cluster; O3 no paid infra; Cloudflare Workers runtime). ADD (technique only) patterns: (1) explicit non-retryable vs retryable failure classes per operation (retry-policy.ts) — IMPROVE planner retry; (2) activity heartbeat timeout for job.\* (jobs.py) so a silent job is declared lost on time; (3) task "logic version" stamped on each task (≈patched) so a deploy never changes semantics of an in-flight task — ADD to authority task row; (4) continue-as-new idea = bounded history per milestone (supports delta prompts). MIT.

### A.15. NousResearch/hermes-agent — MIT, Python + TS (desktop/TUI), d3d4ee4c (2026-11-14); 25,791 files, 2.83M py + 1.19M TS lines

**Read:** agent/context*compressor.py 1-80 (of 5,679); tools/skill_manager_batch.py 1-50; tools/approval_smart.py 1-50; tools/memory_tool.py 1-40; listings of root (≈90 hermes_state*_ modules), agent/ (≈300 modules), tools/ (approval_, browser\*, delegation, cron …).

**Capabilities:**

- Context compression: cheap auxiliary model summarises middle turns; head and tail protected; tool-output pruning first; token-budget tail; pinned fallback route for one retry after a stalled summary (context_compressor.py:1-80).
- Agent-authored skills: `skill_manage` create/patch/write_file/remove_file, atomic batch ≤20 ops, argument checks before effect, actionable error messages naming exact fix because "a bare required error is a dead end" for small models (skill_manager_batch.py:15-45).
- Curated persistent memory MEMORY.md/USER.md injected as frozen snapshot at session start so prompt-prefix cache survives mid-session writes (memory_tool.py:1-5).
- Smart approval: auxiliary LLM rates shell commands APPROVE/DENY/ESCALATE; strips shell comments first (injection vector), wraps command in delimiters (approval_smart.py:1-38); many approval modules (floors, provenance, yolo, gateway wait).
- Multi-platform gateway (Telegram/Slack/Discord adapters), cron scheduler (cron/), async delegation to subagents (tools/async_delegation\*.py), browser tools incl. CDP and real-profile logins, ACP adapter, trajectory compressor (RL data).

**OCADE compare:** OCADE refusal codes are terse (e.g. invalid_intent) — model gets little repair guidance; no memory across tasks; no compression (clips).

**Verdicts:**

- IMPROVE OCADE refusal/receipt errors: add a one-line actionable hint per refusal code for the planner (gateway.py receipt errorCode; planner.server.ts plannerMessage) — mechanism skill_manager_batch.py:30-45. Cheap, likely accuracy gain (unmeasured).
- ADD prompt-prefix-stable design: keep SYSTEM + tool schemas byte-identical across turns to use Gemini implicit context caching; put per-turn delta last (memory_tool.py:2-4 principle).
- ADD per-account "what worked" notes = verified plan cache (see midscene) instead of free-text memory; REJECT free-form agent memory (privacy, plan.md §14).
- REJECT LLM-judged approval (approval_smart) for OCADE: consent stays with the person (O9); a model may never approve.
- REJECT chat-platform gateways, cron (O12 no scheduled automations), subagent delegation (plan.md §14). MIT.

### A.16. xlang-ai/OSWorld-V2 — Apache-2.0, Python, 3f7bee3 (2026-11-14); 183k py lines

**Read:** desktop_env/evaluators/metrics/gimp.py 203-260 + def index of table.py, gimp.py; mm_agents/accessibility_tree_wrap/heuristic_retrieve.py 1-60; listings: desktop_env (actions, controllers, providers, safety, user_simulator), evaluators/metrics (21 app metric modules), evaluation_examples (chrome 46, gimp 26, calc 47, impress 47, writer 23, multi_apps 101, os 24, thunderbird 15, vlc 17, vs_code 23 task files; new V2 categories: conflict_disambiguation, cross_source_reasoning, dynamic_environment, human_in_the_loop, implicit_state_inference, multi_item_state_tracking, multimodal_editing), mm_agents (≈45 agent baselines incl. gemini_agent, openai_cua, uitars, opencua, agent-s-like maestro/coact).

**Capabilities:** reproducible desktop benchmark with VM/docker providers (desktop_env/providers: docker, vmware, virtualbox, aws, azure, gcp, aliyun); execution-based evaluators per app: compare_table/compare_csv (table.py:232-287), image SSIM/MSE structure checks and brightness/saturation checks (gimp.py:203-354); accessibility-tree leaf filtering heuristics for prompting (heuristic_retrieve.py:8-50); safety guards (desktop_env/safety: disk, escalation_guards, files, monitor); user simulator for human-in-the-loop tasks.

**OCADE compare:** OCADE benchmark.py has 4 owner tasks; plan.md §1 needs ≥90% on a "representative hidden-answer suite"; verifier has workbook/pdf/media checks but no image-similarity (SSIM) check.

**Verdicts:**

- ADD OSWorld-V2 subset (LibreOffice calc/writer/impress, GIMP, Chrome, VS Code, OS, multi_apps) as the hidden-answer qualification suite for E1/W13 — Linux-only tasks matter less (O1), but evaluators and task specs transfer. Highest-value evaluation source.
- ADD verify kinds: image structure similarity (SSIM/MSE) and table compare semantics into verify_worker.py `_check` (verify_worker.py:89) — mechanisms gimp.py:203-260, table.py:232-287.
- ADD the V2 category taxonomy (dynamic_environment, human_in_the_loop, implicit_state_inference) to plan.md §19.2 test categories.
- REJECT running their agents. Apache-2.0 (task data licences vary per asset — check before redistribution).

### A.17. microsoft/markitdown — MIT, Python, ed17895 (2026-11-06); 22.8k py lines

**Read:** packages/markitdown/src/markitdown/\_markitdown.py 1-80 (converter registry imports, content-disposition parsing); converters/ listing (24 converters).

**Capabilities:** any-file→Markdown for LLMs: PDF, DOCX (incl. OMML math → LaTeX), XLSX/XLS, PPTX, HTML, CSV, EPUB, ZIP (recursive), Outlook .msg, images (EXIF + optional LLM caption), audio (transcription), ipynb, RSS, Wikipedia/YouTube/Bing SERP; Azure Document Intelligence and Content Understanding converters; markitdown-ocr plugin for scanned PDFs; plugin system; MCP server package.

**OCADE compare:** OCADE fs.read_text reads text files; office.inspect_workbook for xlsx; verify_worker.\_text extracts pdf/docx text for checks; no general converter for pptx/epub/msg/html → planner sees no content of such inputs.

**Verdicts:** ADD markitdown (MIT, pure Python, pip) inside office_worker as `fs.read_document` (read-only, pure local) returning bounded Markdown for pdf/docx/pptx/xlsx/html/epub/msg — fewer tokens than raw text, tables preserved. Keep LLM-caption/Azure converters disabled (no extra services, O3). Add to licence inventory (scripts/licence-inventory.mjs).

### A.18. tashfeenahmed/freellmapi — MIT, TypeScript, 730ba79 (2026-11-14); 192k TS lines

**Read:** server/src/lib/fallback-loop.ts 1-90; services/ratelimit.ts 1647-1740 (learnLimitFromError, learnContextWindowFromError).

**Capabilities:** self-hosted OpenAI/Responses/Anthropic-compatible proxy over many free LLM providers; one shared retry/fallback loop for all surfaces (fallback-loop.ts:3-18), FALLBACK_MAX_RETRIES 20 (70-71); fine-grained error classes (rate-limit, daily quota, payment required, model not found, forbidden, context too large, stream truncated …; 38-56); per-key cooldowns and model-level benching across keys by sliding failure window (73-81); learns real provider limits and true context windows from error text and persists them (ratelimit.ts:1647-1740); catalog sync of free models.

**OCADE compare:** OCADE edge-handler.ts has providerWait/providerQuota (L521-590) and per-instance withoutThinking; review §4 step 2 asks for a durable, measured capability record — not built.

**Verdicts:**

- ADD durable capability record learned from provider errors: thinking unsupported, TPM/RPM/day limit, real context window, no_call rate, latency class — exact mechanism learnLimitFromError/learnContextWindowFromError (UPDATE only when lower) into one Supabase table (edge-handler.ts owner). Matches review fix 3.
- ADD model-level benching across keys/projects (sliding failure window) for the three Gemini projects (O15).
- REJECT aggregating many third-party free providers through one proxy: ToS and privacy risk (online-consent covers Gemini only, online-consent.functions.ts), and O2. MIT.

### A.19. pydantic/pydantic-ai — MIT, Python, fb64b41 (2026-11-13); 5,996 files, 1.26M py lines (much is generated/cassettes; yaml 1.38M)

**Read:** THREAT_MODEL.md 1-60 (of 258); pydantic_ai/\_tool_search.py 1-50; \_deferred.py 1-40; \_ssrf.py 1-40; module listing (≈110 modules: \_durable_replay, \_fallback, \_model_request_attempts, \_history_processor, \_context_size, \_cache_health, durable_exec/, realtime/, workspaces/, toolsets/, capabilities/) and pydantic_evals listing (dataset, evaluators, online evaluation, otel).

**Capabilities:**

- Tool search: native provider tool search or local `search_tools` fallback; discovered tools survive provider switches by translating history parts (\_tool_search.py:1-21) — large tool catalogs without sending all schemas.
- Deferred tools: kinds approval / question / external; run pauses and resumes with DeferredToolResults (\_deferred.py:28-37) — clean human-in-the-loop model.
- SSRF-safe download: resolve host, block private/internal ranges incl. IPv6 transition forms (6to4, NAT64, IPv4-mapped, ISATAP decoded to embedded IPv4; Teredo listed whole), cloud metadata, bounded Accept-Encoding identity/gzip to avoid decompression bombs (\_ssrf.py:24-37).
- Threat model doc with deployment profiles, assets, adversaries, data flow (THREAT_MODEL.md:7-55).
- Durable execution integrations (Temporal/DBOS/Prefect in durable_exec/), FallbackModel, pydantic_evals (datasets, LLM judges, online evals, OTel).

**OCADE compare:** web_worker.\_private_address (web_worker.py:232-238) unwraps only ipv4_mapped; 6to4/NAT64/Teredo-embedded private IPv4 not decoded (NAT64 64:ff9b::/96 counts as global in Python ipaddress) — low-severity SSRF gap on NAT64 networks. OCADE offers grant-filtered operations (offeredOperations planner.server.ts:826) — all at once.

**Verdicts:**

- IMPROVE web_worker.\_private_address and verify_worker.\_web_target with embedded-IPv4 decoding (mechanism \_ssrf.py:32-37 + \_embedded_ipv4s). Small, security.
- ADD bounded Accept-Encoding (identity,gzip) for verifier's own HTTP fetch (verify_worker.\_web_fetch L1088) — decompression-bomb guard.
- KEEP OCADE ask/confirm model (equivalent to deferred approval/question). Tool search NOT needed (48 operations); REJECT. MIT.

### A.20. huggingface/smolagents — Apache-2.0, Python, 96f33fa (2026-10-06); 30.6k py lines

**Read:** src/smolagents/agents.py 540-560 (run loop with planning_interval) + grep index (planning_interval 283-330, \_generate_planning_step 639, \_step_stream 772, ToolCallingAgent 1215); local_python_executor.py 360-395 + def index 42-552.

**Capabilities:** CodeAgent — model writes a Python snippet whose calls are tools, so several tool calls and control flow happen in one model step; ToolCallingAgent JSON variant; periodic planning step every N steps (agents.py:549-560); AST-walking "safe" Python interpreter with import allowlist tree and dunder-attribute ban (local_python_executor.py:360-393), op-count/timeout guards; remote executors (E2B, Docker, Modal, Wasm) in remote_executors.py; interrupt switch (agents.py:546).

**OCADE compare:** OCADE: one state-changing operation per model turn; reads batched ≤5 (planner.server.ts:49, SYSTEM L344-345); plan-first guarded lists designed (plan.md §13) but not found in src.

**Verdicts:**

- ADD (technique only): the "several actions per model step" idea in OCADE's safer typed form: guarded step list (≤5 typed ops with expect guards) — not Python code. Code-as-action REJECTED: an AST sandbox in the actor process is not a security boundary (OCADE invariant: typed ops + policy gate per step).
- ADD periodic re-plan only on milestone boundary (OCADE milestones) — KEEP existing.
- REJECT executor sandboxes (E2B/Modal paid/cloud; O3, O5 local execution). Apache-2.0.

### A.21. strands-agents/harness-sdk — Apache-2.0, Python + TS, 46cbb8c (2026-11-13); 277k py + 325k TS lines

**Read:** strands-py/src/strands/interventions/actions.py 1-137 (full: Proceed/Deny/Guide/Confirm/Transform); listings of strands-py/src/strands (agent, bidi, decisions, event_loop, hooks, interventions, multiagent graph/swarm/a2a, sandbox, session, vended_interventions cedar/hitl).

**Capabilities:** lifecycle hooks Before/After Invocation/ModelCall/ToolCall; typed intervention actions composed across handlers — Proceed, Deny (reason shown to model), Guide (feedback steering), Confirm (human approval, beforeToolCall only), Transform (modify event) (actions.py:19-118); Cedar policy authorization as vended intervention (vended_interventions/cedar/cedar_authorization.py); multiagent Graph and Swarm, agent-as-tool, A2A agent; bidi streaming (voice); session storage; decision models (llm/typesafe/http).

**OCADE compare:** OCADE policy decisions live in SQL functions + intent() validation (authority.server.ts, contracts.ts); outcome of a refusal is a code; no "Guide" (steer without refusing).

**Verdicts:** ADD "guide" outcome to the planner gate: when a proposal is refused for a fixable reason (e.g. stale selector, ungranted app), return a short steering hint in the next turn instead of a bare refusal — IMPROVE planner.server.ts. KEEP SQL-function authority (one owner, O9); REJECT Cedar engine (second policy owner) and swarms (plan.md §14). Apache-2.0 + NOTICE.

### A.22. strands-agents/box — Apache-2.0, Rust, d5278f2 (2026-11-13); 274k Rust lines

**Read:** README.md 1-140 (of 301); crate listing (box, containment linux namespace/macos seatbelt, egress-gateway, credentials, policy dogwood.rs, shell, telemetry, ingress).

**Capabilities:** sandbox engine for agent processes: OS isolation (Linux namespaces; macOS seatbelt profile seatbelt-agent.sb) + Dogwood semantic/temporal policy (permit/forbid, default deny) shared across Strands Shell, Monty Python, egress gateway and MCP broker with one event history (a file read can deny a later HTTP request) (README:28-71); egress gateway checks method/path and injects credentials/SigV4 so agent never holds secrets (README:66-71); policy decisions as OTLP JSON records (72-73); hot policy reload (103-114). Preview: Linux ARM64 + macOS Apple silicon only (49-52). No Windows.

**OCADE compare:** verifier re-runs are contained (verify_worker.py:791-806: bwrap / unshare / sandbox-exec; Windows "copy-only"); shell.run and job.\* are NOT filesystem/network-contained (command_worker.py:1-14 only job objects/process groups).

**Verdicts:** IMPROVE shell.run/job.\* on macOS with a seatbelt profile like OCADE's own verifier profile (verify_worker.py:778-789): writes only in workspace + temp, network per grant. Windows needs another mechanism (see openai/codex windows-sandbox). REJECT Box itself (no Windows, O1; preview). Credential-injecting egress gateway idea = KEEP OCADE rule "keys never reach device". Apache-2.0.

### A.23. vercel/ai (AI SDK) — Apache-2.0, TypeScript, 0e8e054 (2026-11-13); 10,208 files, 1.26M TS lines

**Read:** packages/google/src/google-prepare-tools.ts 260-330 + grep (parametersJsonSchema L17/325, functionCallingConfig modes L42-304); sanitize-response-json-schema.ts 1-60; google-model-capabilities.ts (full 11); generate-text.ts grep (stopWhen 294, prepareStep 306/460, repairToolCall 307-472); package listing (≈95 packages incl. harness-_ for claude-code/codex/cline/cursor/opencode/pi, policy-opa, code-mode, sandbox-_, workflow, mcp, otel).

**Capabilities:**

- Gemini tool declaration with `parametersJsonSchema` (full JSON Schema, keeps additionalProperties/anyOf/$defs) instead of OpenAPI-subset `parameters` (google-prepare-tools.ts:320-326); only `const` must become single-value enum (sanitize-response-json-schema.ts:3-21).
- Tool choice mapping: required → `functionCallingConfig.mode:'ANY'`; specific tool → ANY + allowedFunctionNames; strict tools → 'VALIDATED' (google-prepare-tools.ts:260-310).
- Agent loop controls: stopWhen conditions, prepareStep (change model/tools/settings per step), repairToolCall (fix malformed call once) (generate-text.ts:294-472); tool approvals (collect-tool-approvals.ts), active-tools filtering, tool-search package.
- Google provider details: stream continuation (continue-google-stream.ts), JSON accumulator, model catalog with capabilities (google-model-catalog.ts), batch API, realtime.
- policy-opa: wrap MCP tools with OPA policy decisions incl. shadow mode (packages/policy-opa/src/shadow.ts, wrap-mcp-tools.ts).

**OCADE compare (verified):** OCADE edge-handler.ts:508 sends `parameters: tool.inputSchema` after planner providerSchema() strips additionalProperties/propertyNames/exclusive bounds (planner.server.ts:383-404) and sets NO toolConfig (grep: no toolConfig/functionCallingConfig in edge-handler.ts). Every OCADE planning turn must end in a function call (operation, finish or ask), yet the provider is allowed to answer with text (review failure 5 "text-only finals", failure 6 "no_call").

**Verdicts:**

- IMPROVE (top priority, small): set `toolConfig.functionCallingConfig.mode = 'ANY'` on planner turns (and allowedFunctionNames = offered operations + finish/ask) in edge-handler.ts providerBody; for the goal turn use allowedFunctionNames ['set_goal']. Expected: removes text-only answers on generateContent models (not measured; Live models may differ — test).
- IMPROVE send `parametersJsonSchema` (full schema) instead of the lossy providerSchema() conversion where the model supports it — fewer schema-invalid proposals (unmeasured). Owner: planner.server.ts providerSchema, edge-handler.ts.
- ADD repairToolCall-style single repair: already partially in OCADE (b49a517 "corrected once") — KEEP.
- REJECT adopting AI SDK as dependency for the Edge function (OCADE hand-rolled adapter is small and audited). Apache-2.0.

### A.24. microsoft/semantic-kernel — MIT, C# + Python + Java, ff22ec3 (2026-11-13); 334k C# + 203k py lines

**Read:** python/semantic_kernel/agents/orchestration/magentic.py 1-80; prompts/\_magentic_prompts.py 1-120 (of 150); listings of python/semantic_kernel (agents/orchestration: concurrent, group_chat, handoffs, magentic, sequential; processes: process_builder, edges, dapr_runtime, local_runtime; filters; connectors/mcp.py; data/vector.py).

**Capabilities:** Magentic orchestration — task ledger (pre-survey facts: GIVEN/VERIFIED, TO LOOK UP + where, TO DERIVE, EDUCATED GUESSES; then plan) and per-turn progress ledger JSON (is_request_satisfied, is_in_loop, is_progress_being_made, next speaker, instruction) (\_magentic_prompts.py:3-100); orchestration patterns sequential/concurrent/handoff/group chat; Process framework (event-driven steps/edges, Dapr or local runtime); function invocation filters (pre/post hooks); vector store abstractions; MCP connector.

**OCADE compare:** OCADE SYSTEM prompt forbids facts from memory (planner.server.ts:358-359) and has deterministic stall detection (stalled() L298-309) — no structured facts ledger.

**Verdicts:** ADD "facts ledger" step into OCADE compileGoal (planner.server.ts:620): the goal turn lists GIVEN facts vs facts TO LOOK UP (with source) — feeds outcome checks and the "never from memory" rule; mechanism \_magentic_prompts.py:3-31. KEEP deterministic stall detection over LLM progress-ledger (cheaper, no model call). REJECT multi-agent orchestration, Dapr processes, vector stores (plan.md §14). MIT.

### A.25. QwenLM/qwen-code — Apache-2.0, TypeScript (+ vendored Rust cua-driver), c56f3da (2026-11-14); 14,976 files, 4.9M TS lines

**Read:** packages/cua-driver/README.md 1-90; docs/relative-coordinates-design.md 1-50 (of 83); package listing (acp-bridge, browser-use, chrome-extension, cli, core, cua-driver, desktop, live-host, mobile-mcp, node-repl, qwen-live, sdks, vscode, web-shell, zed); core/src listing (agents, code-mode, confirmation-bus, goals, hooks, lsp, memory, permissions, sandbox, skills, subagents).

**Capabilities:** Gemini-CLI-derived coding agent; vendors cross-platform Rust "Cua Driver" (from trycua cua-driver-rs v0.20.0; see trycua/cua note) with MCP/CLI/SDK interfaces; normalized 0-1000 coordinate contract converted to pixels only after authorization, inside the single ToolRegistry dispatch boundary shared by MCP/CLI/daemon/SDK, keyed by (runtime,pid,window_id) of the latest screenshot (relative-coordinates-design.md:5-39); `verify_state.expect` window-bounds checks; zoom-image actions; parallel_mouse_drag.

**OCADE compare:** OCADE ui.click_point takes window fractions (windows_worker.py:334-351) converted at device; equivalent design. One dispatch boundary = OCADE gateway.run (gateway.py:257).

**Verdicts:** KEEP OCADE fraction coordinates (already the same principle). ADD `expect` window-state verification after input (verify_state idea) to the guarded step list. Cua driver itself: see trycua/cua. Rest = coding-agent features MERGE with gemini-cli/codex analysis. Apache-2.0.

### A.26. google-gemini/gemini-cli — Apache-2.0, TypeScript, 4ed06ed (2026-11-13); 734k TS lines

**Read:** packages/core/src/routing/strategies/classifierStrategy.ts 1-120 (of 231); availability/errorClassification.ts 1-38 (full); services/loopDetectionService.ts constants+method index (29-66, 313, 362, 563); listings of core/src (routing strategies: approvalMode, classifier, composite, default, fallback, gemmaClassifier, numericalClassifier, override; availability: modelAvailabilityService, policyCatalog; policy: policy-engine, shell-safety, sandboxPolicyManager, toml-loader; services: loopDetection, chatRecording, sessionSummary, shellExecution, sandboxManager, environmentSanitization).

**Capabilities:**

- Model router: composite strategies; classifier sends last 4 turns to a fast model which picks flash (1-3 tool calls) vs pro (4+ steps, planning, ambiguity, deep debugging) with JSON reasoning (classifierStrategy.ts:27-84); a Gemma-based local classifier strategy exists (gemmaClassifierStrategy.ts).
- Error classification: terminal quota vs capacity (MODEL_CAPACITY_EXHAUSTED = transient) vs retryable vs not_found (errorClassification.ts:14-37) feeding model availability + fallback.
- Loop detection: identical tool call ×5, repeated content chunks ×10 (50-char chunks), plus periodic LLM loop check after 30 turns every 5-15 turns with 0.9 confidence and a double-check model (loopDetectionService.ts:29-66).
- Policy engine with TOML policies, shell-safety regression suite, sandbox policy manager, environment sanitization, folder trust.

**OCADE compare:** OCADE uses one configured model per route (online-models.ts), stall detection on repeated step signatures periods 1-3 (planner.server.ts:298-309), quota handling in edge-handler providerWait/providerQuota.

**Verdicts:**

- ADD deterministic complexity routing at compile time: simple tasks (≤3 ops) to the fast Gemini (Flash-Lite), complex to the stronger — decided by OCADE's compiled plan length, not an extra classifier call (saves a call). Within O2/O14 model allowlist; owner decision.
- IMPROVE edge-handler error classes: treat MODEL_CAPACITY_EXHAUSTED as transient (errorClassification.ts:14-30) — verify OCADE mapping (edge-handler.ts errorClassForStatus L921).
- KEEP OCADE stall detection; REJECT LLM loop checks (extra calls). Apache-2.0.

### A.27. openai/codex — Apache-2.0, Rust, b1573f1 (2026-11-14); 10,344 files, 2.37M Rust lines

**Read:** codex-rs/windows-sandbox-rs/src/lib.rs 1-70 (of 1,087); token.rs function index (CreateRestrictedToken 21/501, create_readonly_token_with_cap 372, create_workspace_write_token_with_caps 397-468, set_default_dacl 56); wfp.rs index (install_wfp_filters_for_account 84, FwpmFilterAdd0 332); app_package.rs 1-2; execpolicy/src/rule.rs 1-70; memories/README.md 1-60; crate listings (≈130 crates: bwrap, linux-sandbox, windows-sandbox-rs, execpolicy, guardian-context, memories, apply-patch, hooks, skills, mcp-server, rmcp-client, network-proxy, realtime-webrtc, code-mode, agent-roles, worktree); core/src listing (compact\*, command_canonicalization, codex_delegate).

**Capabilities:**

- Windows sandbox without admin per command: restricted tokens (read-only or workspace-write with capability SIDs) via CreateRestrictedToken, workspace ACLs, deny-read ACLs, private desktop, ConPTY, DPAPI, Windows Filtering Platform per-account network filters (wfp.rs:84-332), optional managed provisioning with loopback proxy ports (lib.rs:50-58); Linux bwrap/landlock (linux-sandbox, bwrap crates).
- Exec policy: prefix-pattern rules keyed by first token with alternatives and Unicode canonical caseless matching (rule.rs:16-65); policy amend, sandbox migration.
- Guardian context (guardian-context/src: authorization, budget, enforcement, trusted_tool, verified_answers) = reviewer subagent for approvals (Smart Approvals).
- Two-phase memory pipeline: Phase 1 per-rollout structured extraction of idle sessions, Phase 2 consolidation (memories/README.md:29-49).
- Context compaction incl. remote compaction, retained tool outputs, token budget (core/src/compact\*.rs); apply-patch format; hooks; skills; MCP client/server; realtime voice (WebRTC).

**OCADE compare:** OCADE shell.run/job.\* on Windows run with the companion user's full token (command_worker.py:1-14: job object only); verifier re-run on Windows is "copy-only" (verify_worker.py:806).

**Verdicts:**

- ADD Windows containment for shell.run/job.\* and verifier re-runs: restricted token (workspace-write) + per-process network block — mechanism windows-sandbox-rs token.rs:372-513 and wfp.rs:84-332. Python route: pywin32 CreateRestrictedToken + CreateProcessAsUser; WFP needs admin once → owner decision. Biggest Windows safety gap.
- ADD prefix-rule exec policy (rule.rs) as the deterministic backbone for the read-only command classifier (see magentic-ui note) with canonical caseless matching (Windows command names).
- REJECT memory pipeline, guardian LLM approvals (O9: person approves), Rust adoption. Apache-2.0 + NOTICE.

### A.28. langchain-ai/open-swe ("Robin") — MIT, Python + TS + vendored Rust MDA SDK, b2cc08b (2026-11-14); 362k py lines

**Read:** AGENTS.md 1-50 (of 163); openswe/agent_api/reviewer.py 1-50; shell_guards.py 1-40; tree listing (openswe/, mda/, vendor/managed-deepagents-sdk, ui, desktop, mobile, evals).

**Capabilities:** asynchronous cloud coding agent; three run kinds agent / reviewer / review-scout on one graph (AGENTS.md:26-28); stateless typed backend endpoints called by the managed runtime with a signed run token (AGENTS.md:17-24); per-run catalog of tools fixed at start; independent PR reviewer run with its own tools/sandbox (reviewer.py:39-50); shell guards that inspect a push/PR command and may require a person's approval (shell_guards.py:1-39); design rule "compose generic capabilities (plugins, skills, external MCP) instead of special-purpose features" (AGENTS.md:35-36).

**OCADE compare:** OCADE already has typed stateless server endpoints, signed device requests (authority.server.ts:800-896), per-task fixed checks, independent verifier process.

**Verdicts:** KEEP OCADE design (equivalent principles). The "review-scout" idea (cheap pre-check whether a review is needed) maps to OCADE verifier being called only when finish is proposed — already so. REJECT cloud sandbox model (O5 local execution; plan §14 rejects cloud desktop). MIT.

### A.29. langgenius/dify — "modified Apache-2.0" (multi-tenant SaaS use and logo removal restricted, LICENSE:1-12), Python + TS, e07c1f42 (2026-11-14); 1.33M py + 1.26M TS lines

**Read:** LICENSE head; api/core/workflow/human_input_policy.py 1-50; listings of api/core (agent, mcp, plugin, rag, workflow, human_input_v2, moderation, network_access, rbac) and api/core/workflow (graph_topology, node_execution, variable_pool, nodes: agent, human_input, knowledge_retrieval, trigger_schedule/webhook/plugin).

**Capabilities:** LLM app/workflow platform: visual graph workflows (graph_topology.py, node_factory.py), variable pool, human-in-the-loop pause forms with per-surface recipient admission rules (human_input_policy.py:19-49), agent nodes, RAG knowledge pipelines, plugin runtime, MCP, triggers (schedule/webhook), moderation, multi-tenant RBAC.

**OCADE compare:** OCADE is not a workflow builder; HITL = ask/confirm in authority.

**Verdicts:** REJECT (scope mismatch, licence restricts multi-tenant use — OCADE is a multi-account SaaS: legal risk). Technique: per-surface admission of human answers (who may answer a pause) — OCADE already binds confirmation to the account (functions.ts). KEEP.

### A.30. CopilotKit/CopilotKit — MIT, TypeScript (+py/go/ruby/.NET runtimes), 7b886084 (2026-11-13); 24,269 files, 2.30M TS lines

**Read:** package listing (≈45 packages: react-core, react-ui, runtime, runtime-python/go/ruby/dotnet, a2ui-renderer, mcp-apps-renderer, channels-slack/teams/whatsapp/discord, intelligence-langgraph/mastra/adk, voice, web-inspector, sqlite-runner); grep for human-in-the-loop helpers (runtime/src/agent/converters/aisdk.ts, tanstack.ts); react-core hooks listing.

**Capabilities:** in-app copilot UI framework speaking AG-UI (agent↔UI event protocol): streamed agent state into React, frontend tools, generative UI (A2UI renderer, MCP Apps renderer), human-in-the-loop UI that waits for a user response, shared agent state, converters for AI SDK / TanStack, multi-channel delivery, web inspector.

**OCADE compare:** OCADE web UI (src/jarvis/\*, React 19 + TanStack) shows progress, confirmations and STOP from authority state; no streamed agent-state protocol.

**Verdicts:** REJECT dependency (OCADE UI already owns task view through taskView(), authority.server.ts:599; adding a framework duplicates it). Technique KEEP: render confirmations as typed cards (already). MIT.

### A.31. ag2ai/ag2 — Apache-2.0, Python, 4356a5e (2026-11-14); 242k py lines

**Read:** ag2/ listing (a2a, a2ui, acp, ag_ui, compact, eval, hitl, knowledge, live, mcp, network hub/client, policies, \_replay, watch); ag2/agent.py class/def index (TaskConfig 140, AgentReply 171, AgentRun 550, Agent 778, \_execute_turn 2018, \_build_subtask_toolkit 2129, \_attach_policies 2205).

**Capabilities:** AutoGen-lineage multi-agent framework rewritten around Agent/AgentRun with plugins, middleware, policies, subtask toolkits (delegation), HITL, replay, compaction, eval, network hub for remote agents, AG-UI/A2A/ACP protocol adapters.

**OCADE compare/verdict:** overlaps OCADE planner loop; multi-agent delegation REJECTED (plan.md §14, O4 is about coding agents, but §14 rejects agent swarms in the product). No mechanism found that OCADE lacks and needs beyond those already noted (HITL, replay, compaction). REJECT. Apache-2.0.

### A.32. lastmile-ai/mcp-agent — Apache-2.0, Python, f62d849 (2026-01-25); 138k py lines

**Read:** workflows/evaluator_optimizer/evaluator_optimizer.py 1-80 (of 478); mcp/mcp_aggregator.py 1-60 (NamespacedTool); workflows listing (deep_orchestrator, evaluator_optimizer, intent_classifier, llm, orchestrator, parallel, router, swarm, embedding).

**Capabilities:** Anthropic "building effective agents" patterns over MCP: evaluator-optimizer loop with QualityRating POOR..EXCELLENT, feedback, focus_areas (evaluator_optimizer.py:25-68); router, intent classifier, parallel fan-out, orchestrator-workers, deep orchestrator, swarm; MCP aggregator namespacing tools across servers (mcp_aggregator.py:52); Temporal-backed durable execution; token counter tracing.

**OCADE compare:** OCADE's visual work loop already is generate→preview→judge→improve (planner SYSTEM planner.server.ts:362-364) but judged by the same planner turn; acceptance by independent verifier.

**Verdicts:** ADD structured critique fields (rating, needs_improvement, focus_areas) to the planner's look-at-preview step for creative deliverables — cheap structure, same model call (evaluator_optimizer.py:25-46). KEEP namespacing (OCADE `mcp:<id>` keys in gateway.py:92-95). REJECT the rest (multi-agent). Apache-2.0.

### A.33. mcp-use/mcp-use — MIT, TypeScript + Python, 546081e (2026-11-11); 250k TS + 30k py lines

**Read:** benchmark.md 1-30; libraries listing (typescript/packages agent, cli, client, create-mcp-use-app, inspector, server, tunnel; python mcp_use).

**Capabilities:** MCP SDK + agent + inspector + server framework; repo-measured v2 vs v1 (benchmark.md:12-19: 27% higher median throughput 8,615→10,982 ops/s, 55% lower cold launch 151.6→68.1 ms, 74.4 MiB install) — repo claims, not re-measured; MCP Apps (UI resources), tunnels, React useMcp hook.

**OCADE compare:** OCADE uses the official Python MCP SDK stdio client/server (gateway.py:31-32) — never on the critical path (review §2 "Not a cause").

**Verdicts:** KEEP official SDK (latency not a bottleneck; fewer dependencies). REJECT. MIT.

### A.34. langgenius/dify-sandbox — Apache-2.0, Go (+ vendored node modules), 78931c9 (2026-11-10); 5.8k Go lines of own code

**Read:** grep of internal/core/runner/python/python.go:73-75, nodejs.go:88-90, internal/static/python_lib_discovery.go:160-203; listing internal/core/lib (seccomp.go, seccomp_syscall_amd64/arm64.go, set_no_new_privs.go, syscalls.go).

**Capabilities:** Linux code-execution sandbox for untrusted Python/Node snippets: chroot with copied interpreter libs, setuid to unprivileged user, no_new_privs, seccomp syscall allowlist installed by a Go c-shared library loaded in the child before user code (python.go:73-75), per-arch syscall tables.

**OCADE compare:** OCADE runs commands on the person's own Windows/macOS; Linux optional (O1).

**Verdicts:** REJECT (Linux-only, server-side code sandbox; OCADE executes on customer desktops). Technique (seccomp allowlist) already covered better by bwrap path in verify_worker.py:791-801 for Linux. Apache-2.0.

### A.35. langgenius/mosoo-agent-driver — Apache-2.0, TypeScript, 6aeea44 (2026-11-10); 126k TS lines

**Read:** README.md 1-40 (of 362); src and src/runtimes listings (acp, claude, openai app-server, pi, mcp, native-checkpoint, skill-materialization, driver-event-admission).

**Capabilities:** runtime-neutral "Agent Driver" kernel inside a sandbox that drives one coding-agent session (Claude Agent SDK, Codex app-server, ACP, Pi RPC) through one command/event protocol; provider registry; skill packages materialised into the sandbox; checkpoints; experimental Managed-Agents-shaped adapter (README:26-32).

**OCADE compare/verdict:** OCADE does not host third-party coding agents. REJECT. Pattern "one command/event protocol across runtimes" = OCADE contracts.ts protocol — KEEP. Apache-2.0.

### A.36. mediar-ai/MacosUseSDK — MIT, Swift, a2d7866 (2026-04-25); 4.2k Swift lines (read ≈130 of them)

**Read:** Sources/MacosUseSDK/ActionCoordinator.swift 1-80 (of 469); AccessibilityTraversal.swift 1-50 (of 424); file list (InputController, CombinedActions, DrawVisuals, VisualInputTool).

**Capabilities:** action orchestration with traverse-before / traverse-after and computed AX tree diff per action, onlyVisibleElements filter, delayAfterAction 0.2 s (ActionCoordinator.swift:36-57); AX-driven input for Catalyst/sandboxed apps where synthetic CGEvents are filtered: axSetValue / axPress / axSetSelected by hit-testing a point inside pid (17-22); visual feedback overlay (DrawVisuals.swift).

**OCADE compare:** OCADE mac_worker reads back after actions (AXObserver change events, mac_worker.py:171) but returns no before/after diff; click_point uses pointer events.

**Verdicts:** IMPROVE mac_worker: return a compact AX diff (added/removed/changed elements) after each mutation as the observation delta (complements mcp-windows SnapshotDiffEngine); ADD AX hit-test press (AXUIElementCopyElementAtPosition + AXPress) as a rung between ui.invoke and ui.click_point for apps that ignore synthetic events. MIT.

### A.37. mediar-ai/skillhubz — no licence file, Markdown skills + small TS site, 338655e (2026-11-06); 45 SKILL.md, 472 .md files, 4.6k TS lines

**Read:** keyword scan over all .md (computer-use/desktop/accessibility hits: packages/skills/skills/gemini-computer-use/skill.md:2-6, screenshot-annotator/skill.md:22, mac-network-doctor/skill.md:41,75, playwright-mcp-setup/skill.md:91, writing-skills/skill.md:42,615); directory listings (processed/: context-compression, context-degradation, evaluation …).

**Capabilities:** curated skill catalogue/website; notable skills: gemini-computer-use (Gemini Computer Use + Playwright browser agent), screenshot-annotator (accessibility tree → annotated screenshot), writing-skills (TDD for skills: run scenarios with/without skill and verify agent complies, skill.md:42, 615), context-compression/degradation notes.

**Verdicts:** REJECT as dependency (no licence → all rights reserved; cannot copy text). Idea KEEP: "test a prompt change with/without it on scenarios" = OCADE §27 reversal triggers; already OCADE practice.

### A.38. caramaschiHG/awesome-ai-agents-2026 — CC0-1.0, Markdown list, 781b695 (2026-04-02); README 717 lines, 317 links

**Read:** README.md keyword scan (lines 175-177 computer-use entries: OpenAI Operator, Claude Computer Use) and section structure.

**Capabilities:** catalogue only (product names, pricing tags). No source code.

**Verdicts:** REJECT as implementation source; every computer-use project it names that matters is in this 246 list directly (trycua/cua, UI-TARS, browser-use, Agent-S …). CC0.

### A.39. 0xNyk/awesome-agent-cortex — CC0-1.0, Markdown (56 .md, 407 links), 37d3bde (2026-09-02)

**Read:** guides/agent-harnessing-playbook.md 95-130 (of 140); README keyword hits 178, 243, 257-258.

**Capabilities:** harness playbook: cap retries and log causes, separate planner vs executor quality in diagnostics, rollback tests, environment resets, validate state transitions not final text, record traces (95-105); failure taxonomy retrieval_failure / instruction_conflict / tool_call_error / tool_result_misinterpretation / memory_staleness / unsafe_action / budget_exceeded / unknown (107-117); release readiness ladder L1-L3 (121-127).

**OCADE compare:** OCADE benchmark reports per-task causes but no fixed taxonomy (review §2 table is ad hoc).

**Verdicts:** ADD the failure taxonomy as a required field in benchmark/eval reports (tests/jarvis/benchmark.py, live_eval.py) so planner vs executor failures are separated (review §6 step 1 diagnostics). CC0, free to reuse text.

### A.40. agentSkills/agentskills — Apache-2.0 (code), docs licence in docs/LICENSE; 83021e2 (2026-11-04); spec + reference Python lib (1.7k code lines)

**Read:** docs/specification.mdx 1-120 (of 247); skills-ref/README.md 1-60; layout listing (skills-ref/src/skills_ref parser/validator/prompt tests).

**Capabilities:** Agent Skills open format: directory with SKILL.md (YAML frontmatter name/description/license/metadata + Markdown), optional scripts/, references/, assets/ (specification.mdx:6-55); strict name rules (58-88); progressive disclosure (only name+description preloaded); reference parser/validator/prompt builder (skills-ref, demo only).

**OCADE compare:** OCADE's offered operations + SYSTEM prompt are fixed per release; no per-domain instruction packs.

**Verdicts:** ADD (owner decision vs O8) "capability notes" in Agent Skills format for app families (e.g. spreadsheet engines, image editors, CAD) loaded only when the discovered app matches — progressive disclosure keeps tokens low. Must contain capabilities and pitfalls, never fixed journeys or answers (O8). Apache-2.0.

### A.41. AI-Architect-Studio/awesome-agent-operating-systems — CC (licence text "Creative Commons Legal Code"), Markdown, 1912dba (2026-11-10); README ≈417 md lines, 47 links

**Read:** README.md keyword scan (line 118 OSWorld entry, "82.6% top score as of mid-2026, checked 2026-08-16" — third-party claim).

**Capabilities:** catalogue of agent OS / computer-use projects and benchmarks. No code.

**Verdicts:** REJECT as source; referenced projects analysed individually. Records an external OSWorld top-score claim (unverified here).

### A.42. AI-Architect-Studio/awesome-hermes-agent-skills — INACCESSIBLE

Clone failed 3× with "could not read Username for 'https://github.com'" (GitHub answers auth for a missing/private repo). GitHub search (search/repositories q=awesome-hermes-agent-skills) returned no repo under AI-Architect-Studio; same-name repo frankxai/awesome-hermes-agent-skills exists (MIT, 1f1ae5b, 27 .md, 3 SKILL.md, 223 links) and was scanned as a SUBSTITUTE only: keyword hit docs/EARNED-SKILLS.md:16 (garrytan/gstack listing). It is NOT verified to be the requested repository; no finding is attributed to the requested repo.

**Verdict:** UNRESOLVED. Substitute contains only links to Hermes skills (see NousResearch/hermes-agent note).

### A.43. anthropics/skills — Apache-2.0 per skill (skills/\*/LICENSE.txt; some skills "source-available" per their own LICENSE), Markdown + Python scripts, 2c5958e (2026-11-06); 20 SKILL.md, 19.6k code lines

**Read:** skills/skill-creator/SKILL.md 1-60 (of 485); skills/xlsx/SKILL.md grep 23-75 (recalc rules); listings xlsx/scripts (recalc.py, office/), docx/scripts (accept_changes, comment, merge_runs, templates), pptx/scripts (add_slide, clean, thumbnail); keyword scan of all .md.

**Capabilities:**

- xlsx discipline: formulas not hardcoded values; recalc.py recalculates via LibreOffice and reports status success|errors_found, total_formulas, total_errors, error_summary of error cells per type (#REF!, #DIV/0!, #NAME?…); exit 0 on errors_found so callers must read status; refuses on external links that LibreOffice would destroy; avoid XLOOKUP/XMATCH/SORT/FILTER/UNIQUE/SEQUENCE that LibreOffice cannot evaluate (SKILL.md:23-75).
- docx: tracked-change accept, comments, run merging; pptx: add slide, thumbnail rendering for visual check; pdf form filling.
- skill-creator: draft → test prompts → qualitative+quantitative eval → rewrite → description optimisation for triggering (SKILL.md:10-30).

**OCADE compare (verified by grep):** OCADE office/verify workers never scan recalculated workbooks for Excel error values (no "#REF"/"#DIV"/"#NAME" in ocade_agent/\*.py); engine.recalculate (engine.py:110-129) only recalculates.

**Verdicts:**

- ADD verify kind `workbook_no_errors` and report error cells in office.write_workbook / edit_workbook receipts after recalc (mechanism recalc.py contract SKILL.md:37-45). High value, small.
- ADD capability note: LibreOffice cannot evaluate XLOOKUP/XMATCH/dynamic arrays → planner should prefer INDEX/MATCH when the engine is LibreOffice (engine name already in evidence). Fits "capability notes" idea, not a hardcoded journey.
- ADD pptx thumbnail render as preview for presentation deliverables (office.write_presentation exists).
- License: Apache-2.0 skills reusable with notice; check each skill LICENSE.txt (docx/pptx/xlsx/pdf may differ).

### A.44. EverMind-AI/SkillCorpus — Apache-2.0 core (match/, evaluate/, lifecycle/ MIT; each skill keeps upstream licence, README:40), Python, f909964 (2026-11-09); 33.6k py lines

**Read:** README.md 1-50 (of 462); skillcorpus/curate/safety_gate.py 1-50 (of 93); package listing (aggregate clone/discover/registry; curate classify/dedup/license/license_audit/safety; match; evaluate; lifecycle; export).

**Capabilities:** pipeline turning public SKILL.md files into a curated corpus: aggregation, licence audit, malware regex at ingest, LLM quality/safety judgments with hard-gate (safety<3 excluded, soft-delete so a later licence activation cannot revive it, safety_gate.py:1-42), dedup, task-specific skill retrieval (match) with released retrieval models, agent benchmarks.

**OCADE compare/verdict:** OCADE has no skill corpus and rejects auto-installed third-party extensions (plan.md §14 "auto-installed registry MCP servers"). If OCADE adds owner-authored capability notes (see agentSkills note), use this pipeline's licence-audit + safety-gate ideas for any third-party note. Otherwise REJECT. Apache-2.0/MIT.

### A.45. gamedev-skills/awesome-gamedev-agent-skills — Apache-2.0, Markdown + Python helpers, c6ca6c4 (2026-11-12); 80 SKILL.md, 14k py lines

**Read:** keyword scan of all 213 .md (no computer-use/desktop/verification hits); stats.

**Capabilities:** game-engine skills (Unity/Godot/Unreal/Blender asset pipelines) with helper scripts.

**Verdicts:** REJECT for OCADE core (domain-specific). Possible future capability notes for Blender/Godot (CLI-Anything note covers). Apache-2.0.

### A.46. github/awesome-copilot — MIT, Markdown + JS, 8ecd5b1 (2026-11-13); 463 skills (481 SKILL.md), 2,391 .md, 300k code lines

**Read:** skills/verify-agent-action/SKILL.md 1-70 (of 229); keyword scan (azure-pricing computer-use rates, agent-owasp-compliance/SKILL.md:143 "capabilities bounded"); skills listing filtered (playwright-\*, webapp-testing, test-gap-audit, verify-agent-action).

**Capabilities:** community Copilot agents/instructions/skills/hooks/workflows; verify-agent-action = reviewer checklist: approval is a claim, bind action identity (tool, target, full params, fs/network scope, max execution count, not-before/expiry), approval record with approver, action digest, nonce, audience, use count; fail closed, INCONCLUSIVE when evidence missing, execution_authorized always false (SKILL.md:8-48).

**OCADE compare:** OCADE confirmation binds the exact effect (authority.server.ts exactEffect L775) with idempotency key, STOP epoch and deadline — already covers action identity, single use, expiry.

**Verdicts:** KEEP OCADE design (equivalent or stronger). ADD "max execution count = 1" and "not-before" explicitly to the confirmation record if absent (check contracts.ts confirmation schema during implementation). MIT.

### A.47. heilcheng/awesome-agent-skills — MIT, Markdown/JSON list, a92b1f3 (2026-11-02); 2,525 links, 3.9k code lines (site tooling)

**Read:** keyword scan of 12 .md (no computer-use hits); stats.

**Capabilities:** link catalogue of skills. Verdicts: REJECT (no implementation). MIT.

### A.48. junminhong/awesome-agent-skills — MIT, Markdown list, f8767e5 (2026-11-13); 459 md lines, 123 links

**Read:** keyword scan of 4 .md (no hits). Capabilities: catalogue only. Verdicts: REJECT. MIT.

### A.49. kaspasejo/AG-skills — MIT, Markdown skills (864 SKILL.md), 6f9d6c1 (2026-02-18); 57k code lines in helper scripts

**Read:** keyword scan (skills/prompt-engineering-patterns/SKILL.md:160 "self-verification step"; loki-mode/references/advanced-patterns.md:402 "Single Agent + Self-Verification Loop"; browser-automation/SKILL.md:70).

**Capabilities:** large mirror of Antigravity/Claude skills (overlaps sickn33/antigravity-awesome-skills). Verdicts: REJECT (generic coding-assistant skills; no desktop-control mechanism beyond those noted elsewhere). MIT.

### A.50. kmjnr/antigravity-agent-skills — MIT, Markdown skills (1,273 SKILL.md, many Portuguese), 8692fbc (2026-03-19)

**Read:** keyword scan (claude-code-expert/SKILL.md:86, context-guardian/references/extraction-protocol.md:3 session-extraction protocol, 007/SKILL.md:613 STRIDE threat-model guide).

**Capabilities:** skill mirror; context-guardian = protocol to extract critical facts from a session before compaction. Verdicts: REJECT (duplicate of other mirrors); idea of extraction-before-compaction covered by magentic-ui compaction note. MIT.

### A.51. langchain-ai/langchain-skills — MIT, Markdown + TS/Py, 32d6228 (2026-11-12); 22 SKILL.md, 6k code lines

**Read:** keyword scan (no hits), stats. Capabilities: skills teaching coding agents LangChain/LangGraph/LangSmith APIs. Verdicts: REJECT (framework-specific docs). MIT.

### A.52. libukai/awesome-agent-skills — no licence file, Markdown list, 3159af9 (2026-10-25); 191 links

**Read:** keyword scan (no hits). Capabilities: catalogue (Chinese/English). Verdicts: REJECT; no licence.

### A.53. linny006/awesome-agent-skills — no licence file, Markdown + 138 py lines (list generator), d99f158 (2026-11-02); 209 links

**Read:** keyword scan (README:122 alleneubank/agent-profile entry). Capabilities: auto-generated star-ranked list. Verdicts: REJECT.

### A.54. microsoft/SkillOpt — MIT, Python, 45f65ca (2026-11-10); 84k py lines, 5 SKILL.md

**Read:** README.md 1-60 (of 120); directory listing (skillopt, skillopt_sleep, skillopt_webui, configs, data).

**Capabilities:** trains a skill/prompt document as the trainable state of a frozen agent: optimizer model turns scored rollouts into bounded add/delete/replace edits; edit accepted only if it strictly improves a held-out validation score; textual learning-rate budget, rejected-edit buffer, epoch-wise slow/meta update; zero inference-time cost (README:31-45). SkillOpt-Sleep: nightly offline consolidation of past sessions (README:24-25).

**OCADE compare:** OCADE SYSTEM prompt (planner.server.ts:342-377) is hand-edited after benchmark rounds; plan.md §27 has reversal triggers but no systematic prompt optimisation.

**Verdicts:** ADD (developer-time, not runtime) prompt optimisation loop for the planner SYSTEM text and operation descriptions against the E1 hidden-answer suite with a held-out split and strict-improvement acceptance — mechanism README:38-45. Respects O10 (measured), O16 order (after the 12 runs). MIT.

### A.55. obra/superpowers — MIT, Markdown skills + shell/JS hooks, 22f0b46 (2026-11-03); 15 SKILL.md, 14k code lines

**Read:** skills/verification-before-completion/SKILL.md 1-60 (of 120); skills listing (brainstorming, dispatching-parallel-agents, executing-plans, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, writing-plans, writing-skills); keyword hits writing-skills/SKILL.md:42,368.

**Capabilities:** coding-agent methodology skills; "evidence before claims" gate IDENTIFY→RUN→READ→VERIFY→CLAIM with a table of claims vs required evidence, e.g. "Agent completed" requires VCS diff, not agent report (SKILL.md:10-47); TDD for skills (writing-skills).

**OCADE compare:** OCADE runtime already enforces this for the product (verifier settles; model claims never count, plan.md §12 invariants); CLAUDE.md/AGENTS.md apply it to coding.

**Verdicts:** KEEP (already embodied). No product change. MIT.

### A.56. philipbankier/awesome-agent-skills — CC0-1.0, Markdown + large JSON index (387k json lines), 699edaf (2026-10-24); 149 links

**Read:** keyword scan of 4 .md (no hits); stats. Capabilities: indexed catalogue. Verdicts: REJECT. CC0.

### A.57. Prat011/awesome-llm-skills — no licence file, Markdown skills (31 SKILL.md) + copies of document skills, 35e1ea2 (2026-07-14)

**Read:** keyword scan (no computer-use hits); stats (17k code lines are bundled office-skill scripts similar to anthropics/skills).

**Verdicts:** REJECT (duplicate of anthropics/skills content; no licence).

### A.58. RKiding/Awesome-finance-skills — Apache-2.0, Python finance data skills (10 SKILL.md, 26k py lines), 853f09b (2026-03-29)

**Read:** keyword scan; stats. Capabilities: market-data/financial-report skills (Chinese markets). Verdicts: REJECT (domain-specific, O8). Apache-2.0.

### A.59. seb1n/awesome-ai-agent-skills — MIT, 103 SKILL.md + 6.9k py helper lines, 75865a5 (2026-08-09)

**Read:** keyword scan (no hits); stats. Capabilities: generic agent skills. Verdicts: REJECT. MIT.

### A.60. sickn33/antigravity-awesome-skills — MIT, Markdown (9,454 SKILL.md, 4.66M md lines), 560b762c (2026-11-12)

**Read:** keyword scan (autonomous-agent-patterns/SKILL.md:40 "file edits need original-content conflict checks and atomic safe replacement; checkpoints require validated session IDs, private atomic files"; agent-tool-builder/references/detailed-guide.md:581). Not read: >99.9% of 4.66M lines.

**Capabilities:** largest skill mirror. The one desktop-relevant guidance (atomic, conflict-checked edits) is already OCADE practice (fs.edit_text with sha256, sandbox.write_atomically).

**Verdicts:** KEEP OCADE (already has it). REJECT corpus. MIT.

### A.61. TerminalSkills/skills — Apache-2.0, 1,146 SKILL.md (475k md lines), 4228905 (2026-11-07)

**Read:** keyword scan (skills/claude-computer-use/SKILL.md:2-15). Capabilities: skill catalogue incl. how-to for Claude computer-use API. Verdicts: REJECT (documentation of vendor APIs; O2 Gemini). Apache-2.0.

### A.62. vercel-labs/skills — MIT, TypeScript CLI (47k TS lines), b716f9d (2026-11-13)

**Read:** README.md 1-30 (of 150); src listing (add.ts, agents.ts, archive.ts, blob.ts, ci.ts, cli-args.ts).

**Capabilities:** `npx skills add` installer for Agent Skills across ~80 coding agents (README:3-10), registry skills.sh. Verdicts: REJECT (developer tooling; OCADE product does not install skills). MIT.

### A.63. VoltAgent/awesome-agent-skills — MIT, Markdown list (2,058 lines, 1,292 links), 6d483e2 (2026-11-05)

**Read:** keyword scan (no hits). Verdicts: REJECT (catalogue). MIT.

### A.64. WenyuChiou/ai-research-skills — MIT, Markdown + 4.6k py, b3b6157 (2026-11-12); 79 .md

**Read:** keyword scan (no hits). Capabilities: research-writing workflows. Verdicts: REJECT. MIT.

### A.65. agentscope-ai/agentscope — Apache-2.0, Python + TS, 27d8359 (2026-11-13); 314k py lines

**Read:** src/agentscope/sop/\_engine.py 1-50 (of 174); listings src/agentscope (agent, permission engine/rules, sop, realtime, rag, workspace, skill, tts/asr) and permission/.

**Capabilities:** SOP engine runs declared procedure steps in order with attempt budget; when a person is needed the event stream ends and nothing stays suspended; resumes from SOPRunState with UserConfirmResult/ExternalExecutionResult events (\_engine.py:1-37); permission engine with rules/decisions; realtime voice agent.

**OCADE compare:** identical principle to OCADE's request-driven authority (no in-memory loop holds a task, authority.server.ts:11-14).

**Verdicts:** KEEP OCADE (equivalent). REJECT framework. Apache-2.0.

### A.66. agno-agi/agno — Apache-2.0, Python, 1849efb (2026-11-14); 1.34M py lines

**Read:** libs/agno/agno/guardrails/prompt_injection.py 1-50 (of 52); package listing (agent, team, workflow, approval, compaction, compression, eval, guardrails pii/prompt_injection/openai, learn, memory, knowledge, vectordb, scheduler, sandbox, os).

**Capabilities:** agent/team/workflow framework with storage backends, memory, knowledge/vector DBs, approvals, evals, AgentOS runtime; guardrails: keyword-list prompt-injection detector ("ignore previous instructions", "developer mode", "jailbreak" …) (prompt_injection.py:9-34), PII guardrail.

**OCADE compare:** OCADE treats all observed content as untrusted data in the prompt (planner SYSTEM 360-361) and validates every proposal against grants — stronger than keyword detection; injection tests exist (tests/security/injection.test.ts, device-agent tests/test_injection.py).

**Verdicts:** REJECT keyword guardrail as a control (trivially bypassed). Optional: tag observations containing such phrases as "suspicious" in the planner history for the person-facing log only. REJECT framework. Apache-2.0.

### A.67. Aider-AI/aider — Apache-2.0, Python, 5dc9490 (2026-05-22); 38k py lines

**Read:** aider/coders/architect_coder.py 1-48 (full); repomap.py def index (get_repo_map 103, get_tags 233, get_ranked_tags 365 with networkx pagerank 382/525, render_tree 710); coders listing (edit formats: editblock, udiff, patch, wholefile, architect/editor).

**Capabilities:** architect/editor split — a strong model writes the plan in prose, then an editor model (cheaper, editor_edit_format) applies edits in a fresh context without repo map (architect_coder.py:11-48); repo map: tree-sitter tags + PageRank over a file reference graph, token-budgeted (repomap.py:365-629); many edit formats tuned per model; benchmark harness (benchmark/).

**OCADE compare:** review §4 proposes compile model ≠ repair model ("real C"); OCADE has one model per turn route.

**Verdicts:** ADD (technique only) architect/editor split for OCADE C: strong model compiles checks + plan once; fast model executes repair/delta turns with a fresh minimal context (mechanism architect_coder.py:22-44). REJECT repo map (code-specific). Apache-2.0.

### A.68. block/goose — Apache-2.0, Rust + TS desktop, 2365bc5 (2026-11-13); 308k Rust lines

**Read:** crates/goose/src/tool_monitor.rs 1-60 (RepetitionInspector); security/adversary_inspector.rs 1-50 (doc); security/patterns.rs 1-40 (of 588); crate list (goose, goose-agent, goose-mcp, goose-providers, goose-local-inference, goose-context-management …) and goose/src listing (recipe/, scheduler, security/, permission, tool_inspection.rs, context_mgmt, hints).

**Capabilities:** desktop/CLI agent over MCP "extensions"; RepetitionInspector blocks identical tool+params beyond max repetitions (tool_monitor.rs:10-47); security scanner with ThreatPattern catalogue (FileSystemDestruction, RemoteCodeExecution, DataExfiltration, SystemModification, NetworkAccess …, risk Low..Critical) (patterns.rs:5-30); optional adversary.md LLM reviewer of shell calls — fails open (adversary_inspector.rs:34-50); egress inspector; recipes = shareable parameterised task definitions with validation (recipe/); compaction thresholds below price tiers (provider-types model.rs:23-43).

**OCADE compare:** OCADE confirmation card shows the command for the person to read (command_worker.py:5-6) without a machine risk label.

**Verdicts:** ADD deterministic risk labels on shell.run/job.start confirmation cards (e.g. "deletes files", "network download", "changes system settings") from a regex threat catalogue like patterns.rs — informs the person, never auto-approves (O9). REJECT adversary LLM reviewer (fails open — unsafe). KEEP OCADE stall detection (equivalent to RepetitionInspector). "Recipes" ≈ verified plan cache (see midscene note). Apache-2.0.

### A.69. bytedance/deer-flow — MIT, Python + TS, 1804b7c (2026-11-14); 921k py + 218k TS lines

**Read:** backend/packages/harness/deerflow/agents/goal_state.py 1-47 (full); package listings (agents: lead_agent, goal_state, human_input, interaction_policy, task_continuity; approvals, authz, sandbox, scheduler, skills, subagents, reflection, guardrails, workspace_changes).

**Capabilities:** deep-research/"super agent" harness with lead agent + subagents, sandbox, skills, memory; goal state with typed evaluation {satisfied, blocker ∈ none|missing_evidence|needs_user_input|run_failed|external_wait|goal_not_met_yet, reason, evidence_summary, relied_on_assumption} and continuation/no-progress budgets (goal_state.py:5-33).

**OCADE compare:** OCADE blocks with free-text reasons (planStep returns {kind:"block"|"wait", reason}).

**Verdicts:** ADD typed blocker enum on OCADE wait/block decisions (missing_evidence, needs_user_input, permission_required, external_wait, run_failed, budget_exceeded) — makes UI and benchmark reports machine-readable (supervisor.ts Decision type; review §6 diagnostics). Also `relied_on_assumption` flag in finish proposals. REJECT framework (subagents, plan.md §14). MIT.

### A.70. continuedev/continue — Apache-2.0, TypeScript, 5522c6f (2026-07-20); 311k TS lines (incl. vendored transformers.js)

**Read:** core/ listing (autocomplete, nextEdit, indexing, llm, tools, protocol, rules.md) and autocomplete/ listing.

**Capabilities:** IDE assistant: autocomplete pipeline (prefiltering, context snippets, templating, postprocessing), next-edit prediction, codebase indexing, rules, MCP tools.

**Verdicts:** REJECT (IDE code completion; no desktop-control relevance). Apache-2.0.

### A.71. deepset-ai/haystack — Apache-2.0, Python, 4b4346b (2026-11-13); 158k py lines (docs 2.68M md lines)

**Read:** haystack/components/agents/agent.py grep 80-206 (exit reasons incl. max_agent_steps, state_schema outputs); listings.

**Capabilities:** pipeline graph framework (core/pipeline/base.py), Agent component with exit_conditions, typed state schema with merge handlers (replace_values), step budget; document stores, retrievers.

**Verdicts:** REJECT (RAG pipelines; plan.md §14 rejects vector DB). KEEP OCADE step budgets (equivalent). Apache-2.0.

### A.72. google/adk-js (Agent Development Kit, TypeScript) — Apache-2.0, a662b30 (2026-11-14); 317k TS lines

**Read:** core/src/planners/plan_re_act_planner.ts 1-60 (of 211); models listing (google_llm.ts, gemini_llm_connection.ts, routed_llm.ts RoutedLlm L27, apigee_llm.ts, chrome_prompt_llm.ts); grep cachedContentTokenCount (telemetry/api/internal/common/token_usage.ts:78); core/src listing (a2a, agents, code_executors, memory, planners, plugins, sessions, skills, workflow, cli eval).

**Capabilities:** Google's own agent SDK for Gemini: PlanReActPlanner forces /_PLANNING_/ /_REASONING_/ /_ACTION_/ /_REPLANNING_/ /_FINAL_ANSWER_/ sections for models without built-in thinking (plan_re_act_planner.ts:15-40); RoutedLlm across models; live (bidi) Gemini connection; plugins; eval CLI (cli/cli_eval.ts); token usage incl. cached tokens.

**OCADE compare:** Gemma 4 31B refuses thinkingLevel (review failure 3) — OCADE then sends no reasoning scaffold.

**Verdicts:** ADD for non-thinking models (capability record thinking=none): a short PLANNING/REPLANNING scaffold in the system text so the compile turn still reasons before calling (mechanism plan_re_act_planner.ts:15-40). Keep function-call-only output (toolConfig ANY, see vercel/ai note) — scaffold goes in the function's `reason` argument or thought text. ADD logging of cachedContentTokenCount per turn (implicit-cache hit rate) to OCADE health records. Apache-2.0.

### A.73. langchain-ai/deepagents — MIT, Python, a93aed4 (2026-11-14); 724k py lines

**Read:** libs/deepagents/deepagents/middleware/\_overflow_clip.py 1-40 (of 206); rubric.py 1-40 (of 1,439); middleware listing (\_blob_offload, \_message_eviction, \_prompt_caching, filesystem, memory, permissions, rubric, skills, subagents, summarization, patch_tool_calls).

**Capabilities:** large tool results offloaded to a virtual file `/large_tool_results/{tool_call_id}` and replaced by a stub; read_file results head-sliced with a pointer back (\_overflow_clip.py:1-14); clip threshold from token budget (36-40); Rubric middleware: when the agent would finish, a grader sub-agent checks the transcript against a declared rubric; needs_revision feedback re-enters the loop until satisfied/failed/max_iterations (rubric.py:2-10); prompt caching middleware; todo planning; subagents.

**OCADE compare:** OCADE gateway refuses evidence >16 KB (gateway.py:390) and history() clips older observations to 300 chars (planner.server.ts:310-312) — information is lost, not retrievable.

**Verdicts:** ADD observation handles: device keeps full evidence per step locally (journal folder); the planner receives a summary + handle and can request a slice (new pure-read op `observation.read`) — matches plan.md §14 "large payloads passed as file handles". ADD optional rubric grading only for subjective deliverable quality (images/video) BEFORE the deterministic verifier; never replaces it. REJECT subagents. MIT.

### A.74. langchain-ai/langchain — MIT, Python, ea17e48 (2026-11-14); 430k py lines

**Read:** libs/langchain_v1/langchain/agents/middleware/tool_emulator.py 1-40 (of 248); context_editing.py 1-40 (of 306); middleware listing (auto_mode, context_editing, human_in_the_loop, model_call_limit, model_fallback, model_refusal, model_retry, model_router, pii, provider_tool_search, shell_tool, summarization, todo, tool_call_limit, tool_emulator, tool_retry, tool_selection).

**Capabilities:** v1 agent middleware stack; LLMToolEmulator replaces real tools with an LLM that fabricates plausible results — for testing (tool_emulator.py:27-35); context editing clears older tool results to "[cleared]" beyond a token threshold (context_editing.py:1-35); model fallback/router/retry, tool/model call limits, HITL, PII redaction.

**OCADE compare:** OCADE tests use fake workers (device-agent tests/fake_worker.py) and real fixtures; history clipping ≈ context editing.

**Verdicts:** REJECT tool emulator for evaluation (fabricated observations conflict with O10; acceptable only for unit tests of planner control flow, already covered by fake_worker). KEEP OCADE clipping; improve with observation handles (deepagents note). REJECT framework. MIT.

### A.75. mastra-ai/mastra — Apache-2.0 except `ee/` directories under an enterprise licence (LICENSE.md:1-8), TypeScript, 7277766d (2026-11-14); 4.13M TS lines

**Read:** LICENSE.md 1-8; packages listing (agent-builder, core, evals, mcp, mcp-registry-registry, memory, rag, schema-compat, deployer, server, editor).

**Capabilities:** TS agent/workflow framework with memory, RAG, evals, MCP, schema-compat layer (provider-specific JSON-schema adaptation, packages/schema-compat), deployers.

**OCADE compare:** schema-compat solves the same problem as OCADE providerSchema() (planner.server.ts:383-404) — superseded by sending parametersJsonSchema to Gemini (vercel/ai note).

**Verdicts:** REJECT (framework, ee licence parts). Apache-2.0 / ee.

### A.76. microsoft/agent-framework-go — MIT, Go, 2970ef8 (2026-11-13); 262k Go lines (incl. 13k generated Azure models)

**Read:** agent/ listing (agent.go, compaction, continuation.go, harness, history.go, memory, messageinjection.go, middleware.go, session.go, skills, structuredoutput.go, textsearch); top-file sizes.

**Capabilities:** Go port of Microsoft Agent Framework: agents with sessions, compaction, continuation tokens, message injection, middleware, structured output, skills; providers (OpenAI responses, Azure AI projects).

**Verdicts:** REJECT (language/runtime mismatch, no unique mechanism beyond those already noted for microsoft/agent-framework). MIT.

### A.77. openclaw/openclaw — MIT, TypeScript (+Swift/Kotlin apps), 9425ed080 (2026-11-14); 64,987 files, 11.9M TS lines (largest repo here)

**Read:** VISION.md 1-40; src/node-host/computer-command.ts 1-49 (full); exec-policy.ts 1-40 (comments); src and src/node-host listings (gateway, pairing, node-host auto-update, desktop-stream-command, exec-policy, cron, memory, channels, skills, security). Not read: >99.99% of lines.

**Capabilities:** personal/team assistant across devices and chat channels; device "node hosts" paired to a gateway run commands and computer use; computer commands carry a provider generation and are refused with COMPUTER_CONTRACT_MISMATCH when the worker's computer provider changed mid-execution (computer-command.ts:13-33); one exec-policy owner for system.run and plugin execution (exec-policy.ts:12); auto-update with compatibility checks; Cloudflare Access gateway auth.

**OCADE compare:** OCADE leases window identity (pid/hwnd/start time) and pins worker tool lists — same idea at window level; worker version change mid-task → worker_rejected handled (planner.server.ts:924-930).

**Verdicts:** ADD companion "provider generation" stamp in every receipt (gateway worker start time + release id) so the server refuses to continue a guarded step list across a companion restart/update without re-observation. Small. REJECT rest (chat channels, cron O12). MIT.

### A.78. OpenHands/OpenHands — MIT, TypeScript, 830c045 (2026-11-14); 441k TS lines

**Read:** README.md 1-40 (repo is now "Agent Canvas": self-hosted control center running OpenHands, Claude Code, Codex, Gemini, Pi, OpenCode or any ACP agent); top-file list (.agents/skills/verify-openhands/scripts/control-openhands.mjs, automations setup).

**Note:** the Python agent core (CodeAct, runtime sandbox) is no longer in this repository at this commit (2,739 py lines only). Same commit as All-Hands-AI/OpenHands (#187: identical SHA 830c0459e2f6, GitHub redirect).

**Capabilities:** multi-agent-runtime UI over ACP, automations, local/remote/cloud backends.

**Verdicts:** REJECT (developer control centre). MIT.

### A.79. Significant-Gravitas/AutoGPT — MIT outside autogpt_platform/, Polyform Shield inside autogpt_platform/ (LICENSE:3-9), Python + TS, ac4e888 (2026-11-12); 1.22M py lines

**Read:** LICENSE 1-9; autogpt_platform/backend/backend listing (blocks, executor, scheduler, copilot, integrations, notifications); classic/ listing.

**Capabilities:** block-based agent workflow platform (graph of blocks executed by an executor with scheduler, credentials integrations e.g. Google Sheets block), copilot builder; "classic" autonomous agent.

**Verdicts:** REJECT (Polyform Shield prohibits competing use of the platform code; workflow-builder scope). MIT classic has no mechanism beyond those noted.

### A.80. alibaba/UI-TARS — RESOLVED to bytedance/UI-TARS (requested owner does not host it)

Clone of github.com/alibaba/UI-TARS failed 3× (auth prompt = repository not found); GitHub search q="UI-TARS user:alibaba" total_count 0. UI-TARS is published by ByteDance: cloned bytedance/UI-TARS (Apache-2.0, 582f3a7, 2025-09-05; 722 py lines + paper PDFs).

**Read:** codes/ui_tars/prompt.py 1-60 (full); README_coordinates.md 1-60 (of 105); file list (action_parser.py 526 lines, tests).

**Capabilities:** native GUI-agent model (UI-TARS-1.5/2) prompt contract "Thought / Action" with action space click/left_double/right_single/drag/hotkey(≤3 keys)/type/scroll/wait/finished and mobile variant (prompt.py:3-55); "write a small plan then summarise next action with its target element" (prompt.py:26); coordinate post-processing with smart_resize IMAGE_FACTOR 28, MIN/MAX_PIXELS (README_coordinates.md:33-41); action_parser.py converts to pyautogui code.

**OCADE compare/verdicts:** REJECT model hosting (plan.md §14, O2). KEEP OCADE window-fraction coordinates. Prompt idea "name the target element in one sentence before acting" — ADD to the click_point argument (`expectTitle` already exists; add `targetDescription`) so vision revalidation and logs know what was meant. Apache-2.0.

### A.81. browserbase/stagehand — MIT, TypeScript (+ Python SDK), 6f2686d (2026-11-13); 227k TS lines

**Read:** packages/extension/services/observeService.ts 1-60 (of 191); listings packages (cli, evals, extension/understudy: a11y snapshot, deepLocator, domainPolicy + domainPolicyDnr, frameRegistry, shadowRootEvaluation, lifecycleWatcher, networkManager; sdk-ts; protocol).

**Capabilities:** AI browser primitives act / observe / extract / agent; observe returns candidate Actions (selector + method + args) from an accessibility snapshot that can be cached and replayed without a model call (observeService.ts:21-41 with cache context); own CDP engine "understudy" with deep locators through iframes and shadow roots, domain policy enforced also via Chrome declarativeNetRequest (domainPolicyDnr.ts); evals with Braintrust reports.

**OCADE compare:** OCADE web_worker binds pages to one site and checks every request (web_worker.py:9-17, \_guard L334); controls via custom snapshot.

**Verdicts:** ADD "observe → cached action" replay for repeated web tasks (same plan-cache owner as midscene note). IMPROVE deep locators through shadow DOM / iframes if OCADE \_CONTROLS script misses them (verify during implementation; web_fill/click already accept `frame`). REJECT Browserbase cloud browsers (O3/O5). MIT.

### A.82. E2B-dev/desktop — Apache-2.0, Python/JS SDK + template, 91f23ac (2026-11-02); 359 code lines

**Read:** template/template.py 1-127 (full: ubuntu 22.04 + xserver/xvfb/xfce4 + packages); file list (examples basic-python/javascript).

**Capabilities:** E2B cloud sandbox template providing a Linux Xfce desktop controllable by SDK (screenshot, mouse, keyboard, stream).

**Verdicts:** REJECT for product (plan.md §14 rejects cloud desktop; O5 customer's own computer). Possible use only as a CI qualification desktop — but GitHub-hosted runners already serve that (plan.md §3). Apache-2.0.

### A.83. microsoft/OmniParser — code MIT (README badge), repo LICENSE file CC-BY-4.0, weights: icon_detect_v3 MIT (YOLOv9-based), earlier Ultralytics detectors AGPL (README:70-71); Python, 3540212 (2026-07-19); 5.2k py lines

**Read:** LICENSE head; README licence lines 9, 70-71; util/utils.py def index (get_yolo_model 72, get_parsed_content_icon 89, remove_overlap 188/241, get_som_labeled_img 417, check_ocr_box 514).

**Capabilities:** screenshot → set-of-marks elements: YOLO icon detection + OCR boxes (EasyOCR/PaddleOCR) merged with overlap removal, icon captions by Florence/BLIP/Phi-3V, numbered SoM overlay image (utils.py:89-499); OmniTool agent demo with Windows VM.

**OCADE compare:** OCADE visual fallback relies on Gemini looking at the preview + patch revalidation (vision.py).

**Verdicts:** REJECT bundling (GPU-heavy torch models, local model rule plan.md §14, mixed AGPL weights). Technique ADD (cheap, no model): numbered set-of-marks overlay drawn from UIA/AX element boxes OCADE already has, so the planner can answer "element 7" instead of coordinates on the preview — reduces click_point errors (mcp-windows AnnotatedScreenshotService does the same).

### A.84. microsoft/playwright — Apache-2.0, TypeScript, 0ca0119 (2026-11-13); 489k TS + 170k JS lines

**Read:** packages/injected/src/ariaSnapshot.ts 40-80 (of 553) + grep (refs map 28, generateAriaTree 81, ref assignment 149-161, refs none 225); playwright-core/src/client/page.ts:941-942 and locator.ts:388-389 (public ariaSnapshot API).

**Capabilities:** `page.ariaSnapshot({mode:'ai', depth, boxes})` / `locator.ariaSnapshot(...)`: YAML accessibility tree for AI with refs on interactable elements (visibility ariaOrVisible, cursor-pointer, active element, optional boxes) (ariaSnapshot.ts:40-71); refs resolve back to elements (aria-ref locator); 'autoexpect' mode generates assertions on visible elements (72-75); depth limit.

**OCADE compare:** web_worker.\_observe (web_worker.py:527-586) runs a custom \_CONTROLS script + inner_text + tables, capped at 16 KB by dropping controls.

**Verdicts:** REPLACE the custom \_CONTROLS extraction with `page.aria_snapshot(mode="ai", depth=…)` (same Playwright already bundled; verify the pinned Python SDK version exposes mode='ai' — if not, upgrade pin): stable refs, accessible names incl. shadow DOM, smaller output; keep OCADE site binding, newest-observation rule (refs belong to the observation token), redaction and evidence cap. Use 'autoexpect' visible-state as cheap `expect` guards for guarded web steps. Apache-2.0.

### A.85. skyvern-ai/skyvern — AGPL-3.0 (LICENSE:1-3), Python + TS, cc5ef72 (2026-11-14); 1.41M py lines

**Read:** LICENSE head; skyvern/webeye listing (≈70 modules: cdp*\*, browser*\*, persistent_sessions, profile_cookie_merge, dialog_handler, display_recorder, native_downloads, action_deadline).

**Capabilities:** LLM+vision browser workflow automation (tasks, workflows of blocks, credentials via Bitwarden CLI, persistent sessions, cookie/profile merging, downloads interception).

**Verdicts:** REJECT code reuse (AGPL-3.0 would force OCADE's network service source disclosure). Ideas already covered (profile isolation, downloads marking web_worker.mark_downloaded L852).

### A.86. SWE-agent/SWE-agent — MIT, Python, 3ea751c (2026-07-16); 14.9k py lines

**Read:** sweagent/agent/reviewer.py 1-40 (of 664); tools/ listing (windowed viewer, windowed_edit_linting/replace/rewrite, edit_anthropic, filemap, search, diff_state, review_on_submit_m, forfeit, web_browser, image_tools).

**Capabilities:** Agent-Computer Interface (ACI): windowed file viewer, edits that run a linter and reject syntax-breaking edits, compact search; reviewer retry loop that runs several attempts and selects the best submission (reviewer.py:1-38); review_on_submit.

**OCADE compare:** OCADE fs.edit_text requires sha256 of the read and exact passages; no syntax check of edited scripts before saving (verify_worker has \_script_runnable/\_shell_parses as checks L395-407).

**Verdicts:** ADD "lint before accept" to fs.edit_text/fs.replace_text for code-like files the person's programs use (parse check via the verifier's existing parsers) — refuse an edit that breaks parsing unless the task is about breaking it. REJECT multi-attempt best-of-N (doubles model calls on a free quota, O2/O3). MIT.

### A.87. beam-cloud/beta9 — AGPL-3.0, Go + Python, fc2aea3 (2026-11-12); 432k Go lines (much generated protobuf)

**Read:** LICENSE head; top-level listing (pkg, proto, deploy, manifests, sdk).

**Capabilities:** serverless GPU container platform (autoscaling functions/endpoints, fast cold start, volumes).

**Verdicts:** REJECT (cloud infra, O3/O5, AGPL).

### A.88. ggerganov/llama.cpp (ggml-org) — MIT, C/C++, 32bdc3a (2026-11-14); 604k C++ + 293k C lines

**Read:** common/json-schema-to-grammar.h 1-24 (full); listings common/ (chat parsers, json-schema, speculative.cpp) and tools/ (server, quantize, llama-bench, mtmd multimodal, rpc).

**Capabilities:** CPU/GPU inference of GGUF models; JSON-schema → GBNF grammar-constrained decoding (json-schema-to-grammar.h:9-19) for guaranteed-valid tool JSON; speculative decoding; multimodal (mtmd); OpenAI-compatible server; quantisation tools; RPC distributed backend.

**OCADE compare:** OCADE Offline Chat uses wllama (llama.cpp → WASM) in the browser (src/lib/brain/adapters/browser-wasm.ts:1-8, n_ctx L358). The planner is Gemini only (plan.md §12 invariants).

**Verdicts:** KEEP wllama for Offline Chat. ADD (offline chat only) grammar-constrained JSON output where Offline Chat produces structured answers (wllama exposes llama.cpp sampling incl. grammar — verify version). REJECT local planner (plan.md §14). MIT.

### A.89. Haidra-Org/AI-Horde — AGPL-3.0, Python, 7411b0d (2026-11-13); 166k py lines

**Read:** LICENSE head; horde/ module listing (apis, oai OpenAI-compatible app, request_scheduling, kudos, countermeasures, suspicions, sandbox, limiter).

**Capabilities:** crowdsourced volunteer GPU cluster for image/text generation with kudos economy, OpenAI-compatible endpoint, abuse countermeasures.

**Verdicts:** REJECT (AGPL; prompts would go to unknown volunteer workers — conflicts with privacy/consent model, online-consent.functions.ts).

### A.90. ollama/ollama — MIT, Go (+ vendored llama.cpp, MLX), a5864fc (2026-11-13); 388k Go lines

**Read:** top-level listing (anthropic, api, openai, harmony, thinking, tools, parser, template, mlxrunner, discover); api/types.go:1167 `format` field and FormatParams (1429).

**Capabilities:** local model runner with OpenAI/Anthropic-compatible APIs, structured output via `format` JSON schema, thinking parsers, tool-call parsers per model family, GPU discovery, model registry.

**OCADE compare/verdict:** OCADE previously removed an Ollama bridge (contract.ts comment: "It listed six while there were … an Ollama bridge"). REJECT (plan.md §14 local LLM; O2). MIT.

### A.91. QwenLM/Qwen3 — licence file absent in clone root (model weights Apache-2.0 per model cards; not verified here), docs + examples, 7a2f61f (2026-01-09); 1.5k py lines

**Read:** stats and file list (examples/speed-benchmark/speed_benchmark_vllm.py, demo/cli_demo.py, docs, eval).

**Capabilities:** model documentation, deployment examples (vLLM/SGLang/llama.cpp), speed benchmark scripts, technical report PDF.

**Verdicts:** REJECT (model hosting excluded, plan.md §14, O2). Candidate list for O16 research only.

### A.92. QwenLM/Qwen3.5 — Apache-2.0, README only (239 lines) + 3 yaml, 2ea10dc (2026-08-17)

**Read:** README.md 1-80 (Qwen3.5 / 3.6 / 3.8 descriptions: reasoning_effort control and preserve_thinking across history (README:25-32); hybrid Gated Delta Network + sparse MoE (41)).

**Capabilities:** model release notes only (no code).

**Verdicts:** REJECT for implementation; record for O16 model research: open models with tunable reasoning effort and preserved thinking context. Repo claims unverified.

### A.93. a2aproject/A2A — Apache-2.0, spec (proto + docs), 4d7cda4 (2026-11-13); 812 proto lines

**Read:** specification proto service/message index (A2AService: SendMessage, SendStreamingMessage, GetTask, ListTasks, CancelTask, SubscribeToTask, push-notification configs, GetExtendedAgentCard; messages Task, TaskStatus, Part, Message, Artifact, TaskStatusUpdateEvent, TaskArtifactUpdateEvent) (proto lines 19-308); docs listing.

**Capabilities:** agent-to-agent protocol: agent cards (capability discovery), long-running tasks with status/artifact streaming, cancel, push notifications.

**OCADE compare:** OCADE is one product with one authority; no third-party agents call it.

**Verdicts:** REJECT now (no consumer; O9 one authority). Possible future: expose OCADE task API as A2A so other assistants can delegate desktop tasks — would need full consent/authority mapping; owner decision. Apache-2.0.

### A.94. composiohq/composio — MIT, TypeScript + Python SDKs, fdee759 (2026-11-14); 311k TS + 74k py lines

**Read:** python/composio and core listings; top-file list (python/composio/utils/schema_converter.py 2,920 lines, core/models/triggers.py).

**Capabilities:** hosted catalogue of SaaS tool integrations (OAuth-managed auth, triggers/webhooks), provider adapters converting tool schemas per LLM (schema_converter.py).

**Verdicts:** REJECT (hosted third-party credential broker; conflicts with "secrets isolation"/O3; OCADE operates the person's own apps locally). MIT.

### A.95. modelcontextprotocol/inspector — MIT→Apache-2.0 transition (LICENSE:1), TypeScript, 488c30d (2026-11-11); 420k TS lines

**Read:** LICENSE head; top-file list (core/mcp/inspectorClient.ts, remote server, clients/tui).

**Capabilities:** developer UI/TUI/CLI to connect to MCP servers, list/call tools, view notifications.

**Verdicts:** KEEP as developer tool only (ToRemove.md "Developer MCP/test tools may remain useful"); not product.

### A.96. modelcontextprotocol/python-sdk — MIT, Python, 77001c9 (2026-11-05); 150k py lines

**Read:** mcp-types/mcp_types/\_v2026_07_28/**init**.py grep (progress token 569, structuredContent/outputSchema 973, progress notification params 1538-1551); package listing (client, server, shared, os, mcp-types per spec version 2025-11-25 and 2026-07-28); OCADE pin device-agent/windows/requirements.txt:2 `mcp==2.3.0`.

**Capabilities:** official SDK; spec 2026-07-28 types incl. progress notifications with progressToken, tool outputSchema + structuredContent (JSON Schema 2020-12), tasks types (in \_v2025_11_25), elicitation, cancellation.

**OCADE compare:** OCADE gateway uses ClientSession/stdio_client and MCPServer (gateway.py:31-32; workers `from mcp.server.mcpserver import MCPServer`); long operations poll job.status; no progress notifications consumed.

**Verdicts:** KEEP SDK. ADD MCP progress notifications from long worker calls (media.render_timeline 3600 s, scene.render) forwarded as content-free progress receipts so the UI shows progress and the planner is not called (gateway.run). ADD declare outputSchema for worker tools so structuredContent is validated by the SDK (gateway already prefers structured_content L352). MIT.

### A.97. modelcontextprotocol/registry — MIT→Apache-2.0 transition, Go, 115f852 (2026-11-13); 49k Go lines

**Read:** LICENSE head; top-file list (internal/validators/validators.go, database/postgres.go, deploy k8s).

**Capabilities:** official MCP server registry service (server.json metadata, namespace verification, validators).

**OCADE compare:** plan.md §14 REJECT "auto-installed registry MCP servers"; catalog.py accepts only owner-placed pinned manifests.

**Verdicts:** KEEP OCADE rule. Optional: read registry metadata to prefill a manifest the owner then pins (never auto-install).

### A.98. modelcontextprotocol/typescript-sdk — MIT→Apache-2.0 transition, TypeScript, 919bb8e (2026-11-10); 205k TS lines

**Read:** top-file list (packages/client/src/client/auth.ts, client.ts, core-internal spec.types.2026-07-28.ts).

**Capabilities:** official TS SDK (client/server, OAuth for remote servers, streamable HTTP).

**OCADE compare:** OCADE server side does not speak MCP (device-side only).

**Verdicts:** REJECT (no TS MCP need).

### A.99. n8n-io/n8n — Sustainable Use License (fair-code; LICENSE.md) + LICENSE_EE.md for .ee files, TypeScript/Vue, 251c44bc (2026-11-14); 34,833 files, 5.03M TS lines

**Read:** LICENSE.md first lines; top-file list; repository root listing (agent-harness.l…, packages).

**Capabilities:** workflow automation platform with ~400 integration nodes, AI agent nodes, queue mode, credentials store.

**Verdicts:** REJECT (licence restricts commercial redistribution/hosting as a service; scope mismatch).

### A.100. AgentOps-AI/agentops — MIT, Python + TS dashboard, f8e907b (2026-06-25); 89k py lines

**Read:** top-file list (agentops/instrumentation/agentic/agno/instrumentor.py, app/api opsboard); package listing.

**Capabilities:** agent observability SDK: auto-instrumentation of LLM/agent frameworks into sessions/spans (OpenTelemetry), cost tracking, replay dashboard (hosted).

**OCADE compare:** OCADE logs identifiers-only health records (`ocade.health`, `ocade.provider_issue`) and per-step timing in receipts (gateway.py:262-277).

**Verdicts:** REJECT hosted SaaS (privacy). ADD (technique only) span model (task → milestone → turn → step with durations, tokens, model) for the task report — partly exists; complete per review §6 step 1. MIT.

### A.101. cloudflare/agents — MIT, TypeScript, 9b73399 (2026-11-13); 631k TS lines

**Read:** packages/agents/src/index.ts 1133-1160 + grep (keepAlive alarms 699-947, hibernating WebSocket hooks 1198-1218, class Agent extends DurableObject 1133-1137); package listing (agents, ai-chat, codemode, think, voice, shell, worker-bundler); OCADE wrangler.json (Workers app `ocade-web`, cron `* * * * *`, R2 models bucket).

**Capabilities:** Agents = Durable Objects with persisted state + SQLite, scheduled alarms (schedule/scheduleEvery), keepAlive heartbeats, hibernating WebSockets (connections survive without billing CPU), workflows integration, MCP server/client hosting, chat agents.

**OCADE compare (verified):** OCADE web runs on Cloudflare Workers (wrangler.json) with a per-minute cron trigger; the planner calls a Supabase Edge Function limited to 150 s wall clock on the free plan (review failure 2); device nudge is a websocket (agent.py Nudge L64-130).

**Verdicts:** ADD (owner decision; check free-plan limits before relying): run the long Gemini planner turn from the Cloudflare Worker/Durable Object that already hosts OCADE instead of the 150 s Supabase Edge Function — removes the wall-clock kill (Workers bill CPU time, not I/O wait); one DO per active task can hold the device WebSocket with hibernation and use an alarm instead of the global per-minute cron. Supabase stays the authority/DB (O9). Biggest structural latency/reliability lever after plan-first. MIT.

### A.102. confident-ai/deepeval — Apache-2.0, Python, 34db63d (2026-11-12); 209k py lines

**Read:** deepeval/metrics listing (≈60 metrics incl. task_completion, tool_correctness, argument_correctness, plan_adherence, plan_quality, step_efficiency, goal_accuracy, agent_loop_detection, tool_permission, mcp_use_metric, g_eval, dag, json_correctness).

**Capabilities:** LLM-eval framework with agentic metrics (tool correctness, plan adherence/quality, step efficiency) and synthetic dataset generation (synthesizer).

**OCADE compare:** OCADE success is decided by independent verifier checks, not LLM judges (plan.md §12).

**Verdicts:** ADD deterministic equivalents to OCADE eval reports: step_efficiency (steps per task vs oracle minimum), tool/argument correctness rate (refused intents / invalid_intent rate) — computed from receipts, no LLM judge. REJECT LLM-judge metrics for pass/fail (O10). Apache-2.0.

### A.103. e2b-dev/E2B — Apache-2.0, Python + JS SDKs, 6dc8d5a (2026-11-13); 85k py + 63k TS lines

**Read:** top-file list (packages/python-sdk/e2b/sandbox/mcp.py 2,538 lines, js-sdk schema.gen.ts); package listing.

**Capabilities:** SDK for E2B cloud micro-VM sandboxes (Firecracker): commands, filesystem, MCP gateway inside sandbox, templates.

**Verdicts:** REJECT (cloud execution; O3, O5, plan.md §14 "cloud desktop"). Apache-2.0.

### A.104. EleutherAI/lm-evaluation-harness — MIT, Python + YAML tasks, d6de8164 (2026-09-14); 107k py lines, 158k yaml lines

**Read:** top-file list; package listing (lm_eval/tasks …).

**Capabilities:** standard academic LLM benchmark runner (thousands of YAML tasks).

**Verdicts:** REJECT (measures base model knowledge, not agent task completion; OCADE's question is task success on the desktop). MIT.

### A.105. getzep/graphiti — Apache-2.0, Python, ed23196 (2026-11-14); 78k py lines

**Read:** top-file list (graphiti_core/graphiti.py 2,251, search/search_utils.py 2,075); package listing.

**Capabilities:** temporal knowledge graph memory for agents (episodes → entities/edges with validity intervals) on Neo4j/FalkorDB, hybrid search.

**Verdicts:** REJECT (graph DB + LLM extraction; plan.md §14 rejects vector/graph memory; privacy). Apache-2.0.

### A.106. harbor-framework/harbor — Apache-2.0, Python, ec6aeab (2026-11-13); 582k py lines

**Read:** README.md 1-40 (of 85); src/harbor listing (agents, environments, job_plan, job_diff, trial, verifier, metrics, registry, viewer).

**Capabilities:** Terminal-Bench successor: evaluate any agent (Claude Code, Codex, OpenHands …) on containerised tasks with verifiers, run thousands in parallel on sandbox providers, job diffs between runs, trial viewer, RL rollouts (README:10-15).

**OCADE compare:** OCADE benchmark.py + GitHub-hosted Windows/macOS runners (plan.md §19.4).

**Verdicts:** ADD (technique only) ideas only: job_diff (compare two benchmark rounds per task with cause deltas) and a trial viewer for OCADE evidence folders. REJECT providers (Linux containers, paid). Apache-2.0.

### A.107. kubernetes-sigs/agent-sandbox — Apache-2.0, Go + Python clients, 454d335 (2026-11-13); 141k Go lines

**Read:** top-file list (extensions/controllers/sandboxclaim_controller.go); listing (api, clients, extensions).

**Capabilities:** Kubernetes CRDs Sandbox/SandboxClaim/SandboxTemplate with warm pools for isolated agent runtimes (gVisor/Kata).

**Verdicts:** REJECT (cluster infrastructure; O3, O5). Apache-2.0.

### A.108. langfuse/langfuse — MIT except `ee/` and other listed directories (LICENSE first lines), TypeScript, 48a3181 (2026-11-13); 1.40M TS lines

**Read:** LICENSE head; top-file list (packages/shared/src/server/repositories/events.ts; OTLP proto ingestion).

**Capabilities:** LLM observability (traces, sessions, prompt management/versioning, evals, datasets), OTLP ingestion, ai-gateway.

**Verdicts:** REJECT self-host (ClickHouse/Postgres/Redis stack; O3). ADD (technique only) prompt versioning idea: stamp a prompt/schema version id on every planner turn record (supports SkillOpt-style prompt optimisation and regression attribution).

### A.109. livekit/agents — Apache-2.0 (MODEL_LICENSE for turn-detector model), Python, cbb5770 (2026-11-13); 364k py lines

**Read:** top-file list (livekit-agents/livekit/agents/voice/agent_activity.py 5,518 lines; plugins realtime models); listing.

**Capabilities:** realtime voice agents over WebRTC: VAD, turn detection model, STT/LLM/TTS pipelines, interruption handling, realtime model plugins (Gemini Live, OpenAI Realtime).

**OCADE compare:** OCADE voice is in src/jarvis/use-voice.ts (189 lines); review recommends Live only for spoken interaction, not planning.

**Verdicts:** ADD (technique only) pattern if OCADE builds spoken interaction: voice layer separate from planner (agent_activity.py split). REJECT LiveKit server dependency (O3). Apache-2.0.

### A.110. mem0ai/mem0 — Apache-2.0, Python + TS, f1791da (2026-11-06); 126k py lines

**Read:** top-file list (mem0/memory/main.py 3,916 lines); listing.

**Capabilities:** LLM-extracted long-term user memory (add/update/delete facts) over vector stores, graph memory option.

**Verdicts:** REJECT (vector DB rejected plan.md §14; privacy/data-rights scope src/lib/account/data-classes.ts would need a new data class). Apache-2.0.

### A.111. NVIDIA/SkillSpector — Apache-2.0, Python, c816150 (2026-11-13); 287k py lines (14.6k-line tool-misuse pattern file)

**Read:** README.md 1-50 (of 1,192); top-file list (nodes/analyzers/static_runner.py, static_patterns_tool_misuse.py).

**Capabilities:** security scanner for agent skills: 71 patterns in 17 categories (prompt injection, exfiltration, privilege escalation, supply chain, excessive agency …), static + optional LLM stage, OSV.dev CVE lookup, SARIF output, risk score 0-100, baseline suppression; fail-closed resource bounds (README:10-33). Repo claim: 26.1% of 31,132 analysed skills had a vulnerability (README:10).

**OCADE compare:** catalog.py trusts an external MCP only after owner places a SHA-256-pinned manifest; no content scan.

**Verdicts:** ADD optional pre-approval scan of an external MCP server package/skill with SkillSpector (developer/owner tooling, offline mode) before the owner pins it — informs the owner, never auto-trusts. Apache-2.0.

### A.112. openai/evals — MIT, Python, 8eac7a7 (2026-04-14); 46k py lines

**Read:** top-file list (evals/elsuite/bugged_tools/tools.py, multistep_web_tasks/webarena/browser_env/actions.py); listing.

**Capabilities:** eval registry/runner; elsuite includes bugged_tools (detect faulty tool outputs) and multistep web tasks (WebArena env).

**Verdicts:** ADD (technique only) "bugged tools" idea as an OCADE adversarial test: a worker returns subtly wrong evidence; the verifier must still catch it (plan.md §12 independent verifier) — fits tests/security. REJECT framework. MIT.

### A.113. opensandbox-group/OpenSandbox — Apache-2.0, Go + Python + Kotlin/JS SDKs, 89a2138 (2026-11-14); 285k Go + 262k py lines

**Read:** top-file list (SDK lifecycle/execd APIs, Kotlin SandboxPool); listing (components, console, cli, sdks).

**Capabilities:** sandbox platform (Docker/Kubernetes) with lifecycle API, exec daemon, file API, pools, desktop/browser sandboxes.

**Verdicts:** REJECT (server-side sandbox infra; O3/O5). Apache-2.0.

### A.114. topoteretes/cognee — Apache-2.0, Python, 4053f6c (2026-11-13); 701k py lines

**Read:** top-file list (graph DB adapters neo4j/ladybug, retrieval/code_retriever.py); listing.

**Capabilities:** knowledge-graph + vector memory engine (ECL pipelines) for agents.

**Verdicts:** REJECT (plan.md §14 vector/graph memory; privacy). Apache-2.0.

### A.115. truera/trulens — MIT, Python, 32f5710 (2026-11-14); 160k py lines

**Read:** top-file list (core/app.py, core/database/sqlalchemy.py, feedback/llm_provider.py); listing.

**Capabilities:** LLM app tracing + feedback functions (groundedness, relevance via LLM judges), OTel.

**Verdicts:** REJECT (LLM-judge evaluation conflicts with OCADE's independent deterministic verification, O10). MIT.

### A.116. browser-use/browser-use — MIT, Python, e717df1 (2026-11-14); 33.5k py lines (rewritten around Pydantic AI + "browser-harness")

**Read:** browser_use/agent/loop.py 1-60 (of 1,353); ax.py 1-60 (of 868); agent/judge.py 1-40 (of 180); package listing.

**Capabilities:**

- Agent = Pydantic AI loop + one persistent Python REPL driving a CDP "browser-harness" daemon; learnings: deliver existing values, keep only last two native screenshots, compaction, one delivery turn near budget, partial results survive timeouts, killable worker so a hung cell never kills the run (loop.py:1-5).
- "Ultrafast" AX mode: bu.state() lists interactive AX roles (button, link, textbox, combobox … CONTROLS set) with ids; bu.click(id)/bu.type(id); detects execution-context loss errors; whitespace normalisation that keeps NBSP for exact answers (ax.py:1-47).
- Judge after each run with no partial credit plus ≤5 "gotchas": short, general, non-personal lessons about a website (field formats, page order avoiding blocks, widget driving, waits) for the next agent on the same site; never emails/names/credentials/task values (judge.py:1-40).

**OCADE compare:** OCADE keeps the last two previews (planner.server.ts previewAttachments L795-809) — same; no per-site lessons; no partial-result delivery near budget.

**Verdicts:**

- ADD per-site/per-app "gotchas" store: verified, non-personal lessons extracted from failed/blocked steps (field format, needs wait, widget pattern) offered to the planner when the same origin/app appears — owner decision (memory; privacy rules exactly as judge.py:38-40; data-rights class needed). Not a hardcoded journey (learned, site-scoped, generic).
- ADD "deliver partial result near budget" behaviour: when step budget nearly spent, planner gets one turn to save what exists and report honestly (planner.server.ts stepBudget).
- KEEP OCADE verifier instead of LLM judge for pass/fail. MIT.

### A.117. browser-use/browser-use-pi — MIT, TypeScript, 4cbc951 (2026-11-13); 6.8k TS + 7k JS lines

**Read:** src/ax.ts 1-50 (of 646); file list (agent.ts, index.ts, eval/).

**Capabilities:** original TS "ultrafast" browser agent for the Pi harness: CDP Accessibility.getFullAXTree → compact list of interactive roles with ids (CONTROLS set), block-level text joining, native date/time inputs, context-loss detection (ax.ts:6-24); source of browser-use's Python ax.py.

**Verdicts:** MERGE with browser-use note (same mechanism). OCADE: prefer Playwright ariaSnapshot (playwright note) — same idea, already bundled. MIT.

### A.118. browser-use/vibetest-use — no licence file, Python, fe0b90a (2025-09-03); 562 py lines

**Read:** vibetest/agents.py 1-40 (of 473); file list (mcp_server.py 87 lines).

**Capabilities:** MCP server that launches several browser-use agents in parallel to QA-test a website (Gemini key), aggregates findings.

**Verdicts:** REJECT (QA tool; parallel agents; no licence). OCADE's own web surface audit exists (tests/web/surface_audit.py).

### A.119. iFurySt/open-browser-use — MIT, JS (extension) + Go host + SDKs, 97ca258 (2026-11-03); 27.7k JS + 9k Go lines

**Read:** README.md 1-40 (of 150); apps/chrome-extension/manifest.json 1-40; grep background.js (connectNative 118, chrome.debugger attach/sendCommand 550-587, onDetach 315).

**Capabilities:** drive the person's REAL Chrome (their signed-in profile) through an MV3 extension: chrome.debugger CDP per tab + nativeMessaging to a local host (Go) that SDKs/CLI talk to; permissions debugger, downloads, history, nativeMessaging, <all_urls>; Electron embedded browser variant with multi-tab task scopes, named profiles, authenticated local sockets (README:16-27).

**OCADE compare:** OCADE docs say Chrome 136+ ignores remote-debugging switches on the default profile and OCADE must not hijack profiles; OCADE uses its own isolated profile (web_worker.py:1-8) and "no hidden extension installation" (docs/ARCHITECTURE.md browser table). Result: tasks needing the person's existing sign-ins require them to sign in again in the OCADE window.

**Verdicts:** ADD (owner decision; visible, person-installed, store-published extension — not hidden): an OCADE Chrome/Edge extension bridge using chrome.debugger + nativeMessaging to the companion, scoped to tabs the person shares, with the same site binding/STOP/confirmation rules. Unlocks the person's real signed-in browser without cookie extraction. Risks: broad permissions (debugger, <all_urls>), Chrome shows "is debugging this browser" banner, store review. MIT.

### A.120. jackwener/OpenCLI — Apache-2.0, JS/TS, 9bc5f5c (2026-11-08); 232k JS + 63k TS lines

**Read:** README.md 1-50 (of 350); clis/ listing (≈200 site adapters: arxiv, bbc, github, booking, chatgpt …).

**Capabilities:** turn websites into deterministic CLI commands (site adapters, often calling the site's own JSON endpoints discovered from network capture) and generic Browser Use on the person's logged-in Chrome via extension; strict JSON contract {ok,data} / {ok:false,error:{code,message,hint}} with non-zero exit (README:22-27); adapter-author skill for recon → field decoding → test.

**OCADE compare:** OCADE refusals carry codes but no hint (see hermes note); O8 forbids per-site hardcoding.

**Verdicts:** ADD `hint` field to every OCADE refusal/receipt error (one sentence, generic) — same as hermes recommendation. REJECT per-site adapters (O8, ToS). Network-API shortcut idea REJECTED for product (site terms, fragility). Apache-2.0.

### A.121. Jeomon/Web-Use — MIT, Python, 36fe04e (2026-08-06); 36k py lines (incl. generated CDP protocol types)

**Read:** src/agent/{watchdog,dom,browser} listings (watchdog: crash, dialog, dom, download, popup, state).

**Capabilities:** CDP-native browser agent with separate watchdogs for crashes, dialogs, popups, downloads, DOM changes.

**OCADE compare:** OCADE web_worker handles dialogs (auto-dismiss recorded "dialogsDismissed"), popups (\_collect_popups), downloads (web_download) inside one worker.

**Verdicts:** KEEP OCADE (equivalent). ADD crash watchdog: if the OCADE browser page crashes, report `page_crashed` (not unknown) when no effect was in flight. MIT.

### A.122. m1guelpf/browser-agent — MIT, Rust, 9922453 (2023-04-25); 443 Rust lines

**Read:** src/main.rs 1-60 (of 115); file list (interpreter.rs, openai.rs).

**Capabilities:** minimal GPT-4 browser agent (2023): goal → simplified page → command interpreter; flag notes visual mode makes it less reliable (main.rs:19-21).

**Verdicts:** REJECT (obsolete, superseded by everything above). MIT.

### A.123. microsoft/CUAWright (ex-Webwright) — MIT, Python, 35dbcf3 (2026-10-26); 17.8k py lines

**Read:** README.md 1-60 (of 583); extensions/skill-factory/.../skill_factory/gate.py 1-60 (of 73); route.py 1-40 (of 217); skill_factory listing (build, decide, execute, fill, gate, learn, library, retrieve, route, update).

**Capabilities:**

- "A terminal is all you need": coding model drives browser (Playwright scripts) and Ubuntu desktop (OSWorld-V2) via run_command; repo-reported 88.1% Online-Mind2Web, 77.5% Odysseys (README:38) — repo claims.
- Skill Factory: every solve leaves a script distilled into a reusable, verified, parameterised code skill that reruns with no model (~40 s, zero tokens) (README:39); route(): search library → run (all slots filled; fall back to agent on crash/timeout/empty/wrong shape) / adapt (skill as prior) / skip (route.py:1-16); admission gate is an INDEPENDENT second eye: gold comparison, else self_verify invariants; prevents correct-but-narrow pollution (gate.py:1-23).

**OCADE compare:** OCADE re-plans every task; its independent verifier is exactly the admission gate CUAWright lacks for real sites.

**Verdicts:** ADD "verified plan library" (combine with midscene/stagehand caches): after a task PASSES the OCADE verifier, store its guarded step list parameterised (paths, values as slots) keyed by objective shape + app/site + platform; route next similar task run/adapt/skip; on any guard failure fall back to planner. Admission only via OCADE verifier PASS. This is the strongest speed lever for repeat tasks (repo-reported zero tokens on reuse). Owner decision re O8: stored plans are learned from the person's own verified runs, not developer-hardcoded journeys. MIT.

### A.124. nanobrowser/nanobrowser — Apache-2.0, TypeScript Chrome extension, 6c4c080 (2026-11-10); 56.8k TS lines

**Read:** src/agent listing (loop, compaction, elision, guards, completion, restore, records, save-file); top files (browser-control/probe/source.ts, extension/run-manager.ts).

**Capabilities:** in-browser multi-step web agent running entirely as an extension with the user's own LLM key; guards, compaction, run restore.

**Verdicts:** REJECT (overlaps open-browser-use/BrowserSkill extension approach; OCADE planner is server-side). Apache-2.0.

### A.125. SawyerHood/dev-browser — MIT, TypeScript, 520ba5c (2026-11-03); 15k TS lines

**Read:** README.md 1-40 (of 243); top files (src/page/snapshot/inpage.ts, daemon/run.ts, page/extend.ts).

**Capabilities:** persistent named Chrome pages controlled by short Puppeteer scripts from a coding agent; compact accessibility snapshots with stable refs; launch isolated profile or attach to an open browser (README:7-15).

**Verdicts:** MERGE with playwright ariaSnapshot recommendation. MIT.

### A.126. Tencent/BrowserSkill — MIT, TypeScript extension + Rust CLI/daemon, cfe1f84 (2026-11-14); 198k TS + 102k Rust lines

**Read:** README.md 1-130 (of 429); crates listing (bsk-cli, bsk-protocol).

**Capabilities:** person's own Chrome/Edge (Chromium ≥125) via extension + `bsk` daemon (Windows x64, macOS, Linux) for any shell/MCP agent: work in signed-in sessions; shared control — pause while the person edits, then reconcile their changes before continuing; structured table/list export with coverage metadata; action↔network/console evidence; silent MP4 task-tab recording; element waits with timeouts; save full observation then search/read it later without a new capture (`step`/`view`); named browser instances bound to tasks; operation audit (README:68-81, 87-91).

**OCADE compare:** same gap as open-browser-use note (OCADE cannot use the person's signed-in browser); OCADE has Take Over/Resume but no "reconcile person's edits" step; no observation re-read.

**Verdicts:** ADD (owner decision) extension bridge — BrowserSkill is the most complete reference (Windows x64 support, shared control, audit, recording). ADD "reconcile after Take Over": on Resume, re-observe and diff against last observation before continuing (OCADE observedSinceTakeOver exists in planner.server.ts:198 — extend with a diff). ADD saved-observation search (`view`) = observation handles (deepagents note). MIT.

### A.127. the-open-agent/openagent — Apache-2.0, Go + JS/TS web, f233832 (2026-11-06); 80.5k Go lines

**Read:** README.md 1-30 (of 202); top-file list (tool/browser_use.go 1,716 lines; web provider settings); root listing (audit, auth, authz, bpmn, carrier, chain).

**Capabilities:** single-binary personal assistant (Casdoor-style Go server) with RAG, agent loops, computer-use/browser-use/coding tools, BPMN workflows, multi-provider settings.

**Verdicts:** REJECT (general assistant platform; nothing beyond mechanisms already noted). Apache-2.0.

### A.128. 12britz/awesome-computer-use — CC0-1.0, Markdown list, 63161b0 (2026-08-11); README 343 lines, 149 links (137 GitHub repos)

**Read:** README.md section headers + full GitHub-link extraction (137 repos) compared against the 246 list.

**Capabilities:** catalogue of CUA frameworks, desktop automation libraries, grounding models, datasets, benchmarks. Notable entries NOT in the 246 list (not analysed; out of scope): askui/python-sdk, huggingface/screensuite (GUI benchmark suite), macpaw/screen2ax (screenshot→AX tree), likaixin2000/screenspot-pro-gui-grounding, lavague-ai/lavague, iflytek/astron-rpa, ghostwright/ghost-os, inclusionai/ui-venus, agentsea/osuniverse, mario-andreschak/mcp-windows-desktop-automation, asweigart/pyautogui, intra2net/guibot.

**Verdicts:** REJECT as implementation; record out-of-scope candidates (macpaw/screen2ax and screensuite relevant to OCADE visual fallback/benchmarks) for a later research round (O16). CC0.

### A.129. Arindam200/awesome-ai-apps — MIT, Python example apps (99k py lines), 0e1550f (2026-11-14); 419 .md, 3,492 links

**Read:** keyword scan (advance_ai_agents/web_intelligence_agent/README.md:126 "Verification Agent"); listing.

**Capabilities:** tutorial/demo apps on many frameworks (RAG, agents, MCP). Verdicts: REJECT (examples). MIT.

### A.130. Awesome-llms-labs/awesome-AI-agent-orchestration — MIT, Markdown + JSON index, c783bb2 (2026-09-30); 248 links

**Read:** keyword scan (no computer-use hits); stats. Verdicts: REJECT (catalogue; orchestration rejected plan.md §14). MIT.

### A.131. Awesome-llms-labs/awesome-ai-agents — MIT, Markdown + JSON, 90685bd (2026-09-30); 131 links

**Read:** keyword scan (README:3-17 scope incl. "Computer-Use / GUI Agents" section). Verdicts: REJECT (catalogue). MIT.

### A.132. awesome-llms-labs/awesome-multi-agents-workflow — MIT, Markdown + JSON, c692310 (2026-09-30); 107 links

**Read:** keyword scan (no hits). Verdicts: REJECT (multi-agent catalogue). MIT.

### A.133. bradAGI/awesome-cli-coding-agents — no licence file, Markdown (1,036 lines, 487 links) + list tooling, 15f0c89 (2026-11-09)

**Read:** keyword scan (README:252 Mercury CLI multi-session entry). Verdicts: REJECT (coding-agent catalogue).

### A.134. bradAGI/awesome-free-inference — MIT, Markdown (546 lines, 18 links), b7547c3 (2026-03-23)

**Read:** README.md keyword scan; stats. Capabilities: list of free inference providers/tiers (provider claims, dated). Verdicts: REJECT for implementation; input for O16 research only (verify each provider's ToS/data use before any use; online-consent covers only Gemini). MIT.

### A.135. dipakkr/awesome-ai-engineering — MIT, Markdown (41 .md, 6,673 links), abf786d (2026-10-21)

**Read:** keyword scan (hits only in translated general programming resources). Verdicts: REJECT (learning resources). MIT.

### A.136. ianwieds/awesome-ai-agents — CC licence, Markdown + 1.2k JS (site), fe1ccc5 (2026-10-04); 731 links

**Read:** keyword scan (README:31-34, 312 "Browser and computer-use agents / Desktop and computer use" sections). Verdicts: REJECT (catalogue; listed projects analysed individually where in scope).

### A.137. kaushikb11\_\_awesome-llm-agents — CC licence, Markdown + yaml data + 523 py (generator), a3eb18b (2026-11-08); 113 links

**Read:** keyword scan (no hits). Verdicts: REJECT (framework catalogue).

### A.138. kyrolabs/awesome-agents — no licence file, Markdown (331 lines, 492 links), f8683ff (2026-11-11)

**Read:** keyword scan (README:217 OpenAgent entry). Verdicts: REJECT (catalogue).

### A.139. reacher-z/Awesome-CUA — MIT, Markdown + JSON catalogue + site builder (3.7k py), 34206d2 (2026-11-14); 95 .md, 59,855 links (largest CUA catalogue)

**Read:** keyword scan (SECURITY.md:9-12 site/catalog policy); stats; structure (JSON catalogue of papers, repos, models, datasets, benchmarks).

**Capabilities:** structured catalogue of computer-use agent research (papers/models/datasets/benchmarks) with a generated site.

**Verdicts:** REJECT as implementation; use as index for O16 research. MIT.

### A.140. Shubhamsaboo/awesome-llm-apps — Apache-2.0, Python demo apps (≈110k py lines), ff2016e (2026-11-10); 291 .md

**Read:** advanced_ai_agents/single_agent_apps/windows_use_autonomous_agent/windows_use/tree/**init**.py 1-184 (full; vendored copy of Windows-Use); file sizes of that app (agent/service.py, tools/service.py, desktop/**init**.py); keyword scan.

**Capabilities:** Windows-Use agent: desktop state = interactive / informative (text) / scrollable nodes collected per visible app (foreground app + Taskbar + Desktop) in parallel threads via `uiautomation` (tree/**init**.py:18-46); interactive = control type in allowlist AND visible (non-empty box, !IsOffscreen) AND enabled AND not image (52-77).

**OCADE compare (verified by grep):** OCADE has NO scroll operation in windows_worker.py, mac_worker.py or web_worker.py; ui.inspect lists only named elements of the leased window (first 150 descendants).

**Verdicts:** ADD `ui.scroll` (UIA ScrollPattern / ScrollItemPattern.ScrollIntoView; AX AXScrollToVisible / scroll-area increment; web: element.scrollIntoView / mouse.wheel) as a reversible_write op — without it, controls below the fold or long lists are unreachable except via send_keys. ADD scrollable-container list to ui.inspect evidence. Apache-2.0.

### A.141. sihyeong/Awesome-LLM-Inference-Engine — MIT, Markdown (869 lines, 187 links), 6193d0d (2026-11-12)

**Read:** keyword scan; stats. Capabilities: survey list of inference engines. Verdicts: REJECT (local inference out of scope). MIT.

### A.142. slavakurilyak/awesome-ai-agents — MIT, Markdown/HTML catalogue + JSON, a32e86f (2026-10-04)

**Read:** keyword scan (README:946 agent identity registry entry; 1968 macOS natural-language control entry). Verdicts: REJECT (catalogue). MIT.

### A.143. Supersynergy/awesome-ai-agents-2026 — MIT, Markdown (18 .md, 432 links), 0dcdf4a (2026-11-13)

**Read:** keyword scan (docs/UPDATE-2026-07-14.md:90-94 note on separating synthesis from sources). Verdicts: REJECT (catalogue). MIT.

### A.144. xlite-dev/Awesome-LLM-Inference — GPL-3.0 licence file, Markdown (592 lines, 819 paper links), 6f142fe (2026-10-20)

**Read:** keyword scan; stats. Capabilities: inference-optimisation paper list (KV cache, speculative decoding, quantisation). Verdicts: REJECT (out of scope).

### A.145. zenrran4nlp/Awesome-LLM-Inference-Serving — no licence file, Markdown (365 lines, 216 links), 06159e4 (2025-04-29)

**Read:** keyword scan; stats. Verdicts: REJECT (serving paper list).

### A.146. 12britz/awesome-free-models — CC0-1.0, Markdown + small site, ad5161f (2026-10-29); 382 links

**Read:** keyword scan (README:59 MiniMax M3 "native multimodal + computer use"; 366 mediar-ai/fazm macOS AX agent). Verdicts: REJECT; O16 research input only (claims unverified). CC0.

### A.147. AILookup/free-llm-resources — no licence file, Markdown (519 lines, 33 links), 4164eb6 (2026-03-29)

**Read:** keyword scan; stats. Verdicts: REJECT; O16 input only.

### A.148. arc53/DocsGPT — MIT, Python + TS, ed108fb (2026-11-13); 585k py lines

**Read:** top-file list (docsgpt/worker.py 6,652 lines, react widget); listing (application, extensions, deployment).

**Capabilities:** RAG assistant over private documentation (ingestion workers, vector stores, widgets, agents/tools).

**Verdicts:** REJECT (RAG/vector DB rejected plan.md §14; OCADE Library already handles documents). MIT.

### A.149. BerriAI/litellm — MIT outside enterprise/ (LICENSE:1-6), Python, d81c55f4 (2026-11-14); 3.93M py lines

**Read:** LICENSE head; model_prices_and_context_window.json parsed (5,988 model entries) — e.g. gemini-3.5-flash-lite: max_input_tokens 1,048,576, supports_function_calling true, supports_reasoning true, supports_vision true, supports_tool_choice true; tpm/rpm null.

**Capabilities:** universal LLM SDK + proxy (100+ providers), router with fallbacks/cooldowns, budgets, caching, guardrails; maintained capability/price catalogue JSON.

**OCADE compare:** review §4 step 2 wants a per-model capability record; OCADE hardcodes Gemini specifics in edge-handler.ts.

**Verdicts:** ADD (technique only): the catalogue JSON (MIT) only as SEED values for OCADE's capability record (function calling, reasoning, vision, tool_choice, context) — then overwrite with measured values (freellmapi learn-from-errors). REJECT proxy (Python service; O3).

### A.150. ClawLabsAI/free-ai-models — MIT, JS scoring + JSON data, aaa600b (2026-11-14); 1.2k JS lines

**Read:** scoring/sources.js 1-40 (of 291); listing (data/ 195 JSON snapshots, scripts/fetch-models.js).

**Capabilities:** daily scored list of free models from public sources (OpenRouter models + endpoints, LM Arena dataset, Hugging Face params); source failures degrade gracefully with stated basis (sources.js:2-13).

**Verdicts:** REJECT for product; O16 research input. MIT.

### A.151. devanasolver/awesome-free-llm-apis — no licence file, README only (87 lines), f6722aa (2026-10-18)

**Read:** README.md 1-87 (full, via stats + scan). Capabilities: list of free LLM API providers. Verdicts: REJECT; O16 input only.

### A.152. golapkamal/Free-LLM-API — MIT, TypeScript, 90c84da (2026-07-11); 54k TS lines

**Read:** top-file list (server/src/routes/proxy.ts 1,950; db/migrations/legacy_baseline.ts) — structure matches tashfeenahmed/freellmapi (same baseline migration name 20260101_000000_legacy_baseline.ts), i.e. a fork/derivative.

**Verdicts:** MERGE into tashfeenahmed/freellmapi note; REJECT. MIT.

### A.153. kaiser-data/free-llm-proxy-router — MIT, Go, 18c9c70 (2026-11-10); 10.4k Go lines

**Read:** pkg/proxy/fallback.go 1-50 comments (fallback order; HuggingFace 503 loading wait; Cerebras pre-emptive slowdown when remaining-requests < 2); grep ratelimit/headers.go:26-186 (RPD exhaustion detection when reset >60 min ⇒ wait until midnight PT), tracker.go:45-88 (per-provider RPM/RPD/RPS counters).

**Capabilities:** Go free-LLM router with header-driven rate-limit learning and pre-dispatch counters.

**OCADE compare:** OCADE edge-handler providerQuota/untilPacificMidnight (edge-handler.ts:553-590) handles daily quota; pacing exists per plan.md §12.

**Verdicts:** ADD pre-emptive slowdown from rate-limit headers (remaining-requests/tokens) when the provider sends them. Otherwise KEEP. REJECT multi-provider routing (O2). MIT.

### A.154. khushaljethava/freellm-apis — MIT, docs site (3.8k code lines, 13 README translations), f193281 (2026-11-13)

**Read:** stats, README listing. Verdicts: REJECT (provider list). MIT.

### A.155. malda231125/free-llm-gateway — no licence file, NestJS TypeScript (2.9k lines), 5d86d4a (2026-10-28)

**Read:** file list (src/generate/chat-completions.service.ts, model-catalog.service.ts). Verdicts: REJECT (small proxy; no licence).

### A.156. msmarkgu/RelayFreeLLM — MIT, Python, 9a1aabe (2026-08-30); 8.5k py lines

**Read:** src/model_dispatcher.py 1-60 (of 669). Capabilities: "meta model" dispatcher over free providers with capability check (image content → vision-capable provider, L38-45), retry/fallback, AllProvidersExhausted.

**Verdicts:** REJECT (O2). Idea KEEP: route by request capability (images) — OCADE must check the model accepts images before attaching previews (capability record). MIT.

### A.157. Portkey-AI/gateway — MIT, TypeScript (runs on Cloudflare Workers/Node), 669825c (2026-05-25); 79k TS lines

**Read:** src and src/handlers listings (chatCompletions, batches, files, embeddings, middlewares, providers, guardrails in plugins).

**Capabilities:** edge AI gateway: retries, fallbacks, load balancing, conditional routing, request timeouts, semantic/simple caching, guardrail plugins, 250+ providers, config-as-JSON.

**OCADE compare:** OCADE edge-handler.ts implements its own Gemini boundary (1,364 lines) with consent/permit/settlement integration.

**Verdicts:** REJECT dependency (OCADE needs consent + commercial permit coupling the gateway lacks; one provider). Pattern ADOPT: declarative per-route retry/timeout config instead of constants (edge-handler.ts:91-106). MIT.

### A.158. reqsgjh/free-coding-agent-models — no licence file, JSON data (80 files) + 138-line fetch script, 3bccb67 (2026-11-14)

**Read:** scripts/fetch_providers.py (via stats/listing), README. Capabilities: daily snapshot of free coding-model endpoints. Verdicts: REJECT; O16 input only.

### A.159. richbrianx/free-llm-listing — MIT, Markdown + build scripts (542 py lines), fa20d35 (2026-05-22)

**Read:** listing (scripts/build_matrix.py, build_readme.py, data/). Capabilities: generated provider matrix. Verdicts: REJECT; O16 input. MIT.

### A.160. shooter2062424/FreeLlmApiBenchmark — MIT, JS, dd2dec8 (2026-07-05); 803 JS lines

**Read:** benchmark.js 1-40 (of 475). Capabilities: measured benchmark of every model an NVIDIA NIM key can reach: endpoint type, context (declared+probed), reasoning presence (observed in stream), prompt-cache hit (same long prompt twice → cached_tokens>0), TTFT and steady-state token rate as warm medians, cold start separately; same prompt, temperature 0 (benchmark.js:3-19).

**OCADE compare:** review §6 asks for measured per-model first-byte/total; capability record should be measured, not assumed.

**Verdicts:** ADD (technique only): the measurement protocol (cold vs warm medians, TTFT vs steady rate, cache-hit probe) for OCADE's capability record probes of the allowed Gemini models (scripts/model-availability.ts is the owner). MIT.

### A.161. SidSharma010/free-llm-api-hub — MIT, providers.json + validation scripts (329 py lines), ae104f2 (2026-09-25)

**Read:** listing (scripts/validate_providers.py, render_table.py). Verdicts: REJECT; O16 input. MIT.

### A.162. spacepirate15/quantum-free-router — MIT, config templates + shell installer (389 code lines), 08ccded (2026-06-11)

**Read:** listing (install.sh, configs, scripts/validate-config.py). Capabilities: installer/config for an existing router (LiteLLM-style) over free models. Verdicts: REJECT. MIT.

### A.163. velo4705/awesome-free-byok-models — CC licence, Markdown + verify.py (809 lines), 7e49910 (2026-11-14)

**Read:** listing; scripts/verify.py size. Capabilities: list of free bring-your-own-key models with a verification script that probes endpoints. Verdicts: REJECT; O16 input.

### A.164. XuexGao/free-llm-router — no licence file, TypeScript on Cloudflare Workers, 916242d (2026-10-31); 49.6k TS lines

**Read:** README.md 1-30 (of 287); src/providers listing (trae.ts, qoder.ts + qoder-auth-wasm.wasm, cline.ts, codearts.ts, raccoon.ts, aes-cfb.ts, md5.ts …).

**Capabilities:** pools accounts of IDE vendors' free tiers into one OpenAI-compatible API, plus automated "check-in / growth task / reward claiming" (README:3-17), using re-implemented vendor auth (AES, MD5, WASM).

**Verdicts:** REJECT — account pooling and reverse-engineered vendor auth very likely breach provider terms; security and legal risk; no licence. Not usable.

### A.165. zebbern/no-cost-ai — MIT, README (215 lines) + yaml, a1e4464 (2026-09-22)

**Read:** README + yaml via stats. Capabilities: list of free AI services. Verdicts: REJECT; O16 input. MIT.

### A.166. b4rtaz/distributed-llama — MIT, C++, ad662c9 (2026-11-10); 40k C++ lines

**Read:** README.md 1-20 (of 145); top files (src/nn/nn-cpu-ops.cpp, nn-vulkan.cpp).

**Capabilities:** tensor-parallel LLM inference across home devices over Ethernet (Linux/macOS/Windows; ARM/AVX2; Vulkan).

**Verdicts:** REJECT (local inference out of scope, plan.md §14). MIT.

### A.167. deepseek-ai/DeepSeek-V3 — code MIT (LICENSE-CODE), weights LICENSE-MODEL, Python, 9b4e978 (2025-08-28); 1.4k py lines

**Read:** listing (inference/model.py 808, kernel.py 196, README_WEIGHTS.md). Capabilities: reference inference for 671B MoE (MLA, FP8 kernels).

**Verdicts:** REJECT (model hosting). OCADE retired its DeepSeek harness intake (ToRemove.md:39).

### A.168. JustVugg/colibri — Apache-2.0, C + Python, 0a5504a (2026-10-31); 269k C lines

**Read:** README.md 1-70 (of 893). Capabilities: streaming CPU/Vulkan/CUDA inference engine for very large MoE models from GGUF with low resident memory (example: 744B MoE int4, resident 9.9 GB, README:33-38 — repo demo claim).

**Verdicts:** REJECT (local inference out of scope). Apache-2.0.

### A.169. Niko1221/Strata — MIT, C++/CUDA/SYCL + Python + host app, 13eedf5 (2026-11-12); 391k C++ lines

**Read:** README.md 1-30 (of 213). Capabilities: local desktop AI runtime (chat, code, images) with own inference engine (CUDA/SYCL backends).

**Verdicts:** REJECT (local LLM out of scope; O2). MIT.

### A.170. sgl-project/sglang — Apache-2.0, Python + Rust router, b77d7b8 (2026-11-14); 3.04M py lines

**Read:** python/sglang/srt/constrained listing (xgrammar, llguidance, outlines backends, reasoner_grammar_backend, json_schema_validation); top files (managers/scheduler.py).

**Capabilities:** high-throughput serving with RadixAttention prefix caching, constrained decoding backends, model gateway/router.

**Verdicts:** REJECT (server GPU inference; O3). Apache-2.0.

### A.171. vllm-project/llm-compressor — Apache-2.0, Python, f8a3abb (2026-11-13); 82k py lines

**Read:** top files; listing. Capabilities: quantisation/sparsity recipes (GPTQ, AWQ, FP8) producing vLLM-ready checkpoints.

**Verdicts:** REJECT (no OCADE model training/serving). Apache-2.0.

### A.172. vllm-project/vllm — Apache-2.0, Python + CUDA, 2ab8e2f (2026-11-14); 2.37M py lines

**Read:** vllm/v1/structured_output listing (backend_guidance, lm_format_enforcer, outlines, xgrammar); top files.

**Capabilities:** PagedAttention serving, prefix caching, speculative decoding, structured output backends, OpenAI-compatible server.

**Verdicts:** REJECT (GPU serving; O3). Apache-2.0.

### A.173. AIAnytime/Awesome-MCP-Servers — MIT, Markdown/JSON + small example servers (2.5k py lines), f21432d (2026-11-12)

**Read:** listing (data/, servers/, pubmed-mcp-server, linkedin-profile-mcp, scripts/build.py). Verdicts: REJECT (catalogue + demos). MIT.

### A.174. appcypher/awesome-mcp-servers — no licence file, Markdown (595 lines), 280218b (2026-05-06)

**Read:** README via stats/scan. Verdicts: REJECT (catalogue).

### A.175. archestra-ai/archestra — AGPL-3.0-only by default + enterprise licence (LICENSE.md table), TypeScript + Rust, df8a21b (2026-11-14); 2.54M TS lines (10.5M JSON lines of MCP catalogue)

**Read:** README.md 1-60 (of 137); platform listing (backend, frontend, archestra-rs, helm); grep for "trifecta" implementation (see stats).

**Capabilities:** enterprise AI platform: chat, LLM/MCP proxy portal with one token, SSO/RBAC, sandboxed code execution, "Lethal-Trifecta" guardrails (private data + untrusted content + external communication), OTel/Prometheus (README:5-42); large MCP catalogue.

**OCADE compare:** OCADE already blocks the trifecta by design: untrusted observations never grant authority, external effects need confirmation, web origins are granted and bound per page (web_worker.py:9-17).

**Verdicts:** KEEP OCADE. ADD explicit trifecta flag in the task log: when a task has both read untrusted content and private workspace data, show this on every following external-effect confirmation ("this task has read web content; check the data being sent"). REJECT code (AGPL).

### A.176. awslabs/mcp — Apache-2.0, Python, 5d58a6a (2026-11-13); 968k py lines (≈70 AWS MCP servers)

**Read:** top-file list; DESIGN_GUIDELINES.md presence; listing of src/ servers.

**Capabilities:** official AWS MCP servers (docs, CDK, cost, SAP, transform with HITL output schemas …).

**Verdicts:** REJECT (cloud-service tools; not desktop). Note design-guideline pattern of HITL output schemas (aws-transform hitl_output_schemas.py) matches OCADE ask/confirm. Apache-2.0.

### A.177. BrowserMCP/mcp — Apache-2.0, TypeScript (extension + MCP server + daemon), a51ddc4 (2026-11-12); 25.7k TS lines

**Read:** README.md 1-30 (of 80); top files (packages/mcp/src/commands/commands.ts, apps/extension smoke-browser-control.ts).

**Capabilities:** AI apps use the person's own Chrome profile (signed-in sites) in tabs of their own via a Web Store extension; one daemon per user forwards MCP browser tool calls; everything local (README:3-11).

**Verdicts:** MERGE into extension-bridge recommendation (open-browser-use / BrowserSkill notes). Apache-2.0.

### A.178. github/github-mcp-server — MIT, Go, 0663b83 (2026-11-13); 147k Go lines

**Read:** top files (pkg/github/issues.go, repositories.go); listing (toolsets, e2e, agent-plugin).

**Capabilities:** GitHub API as MCP tools with toolsets, read-only mode, dynamic toolset discovery, lockdown mode.

**Verdicts:** REJECT for product (OCADE customers act on their desktop; GitHub could be an owner-approved external MCP via catalog.py). Pattern KEEP: read-only mode flag per server = OCADE risk per tool in manifest. MIT.

### A.179. jaw9c/awesome-remote-mcp-servers — MIT, Markdown (582 lines), 66ad715 (2026-11-09)

**Read:** README via stats/scan. Verdicts: REJECT (catalogue; OCADE runs only local pinned stdio MCP). MIT.

### A.180. microsoft/mcp — MIT, C#, d97c4ee (2026-11-13); 487k C# lines

**Read:** top files (Azure.Mcp.Tools.\* services); listing.

**Capabilities:** Microsoft/Azure MCP servers in .NET (Azure resources, backup, resilience …).

**Verdicts:** REJECT (cloud admin tools). MIT.

### A.181. microsoft/playwright-mcp — Apache-2.0, JS wrapper (1.6k code lines) over playwright-core MCP, 78eca85 (2026-11-11)

**Read:** README.md grep (16 "no vision models needed, structured data"; 415 --caps vision,pdf,devtools; 454 --snapshot-mode full|none; 1155 screenshot vs snapshot guidance; opt-in capability groups config/network/storage/devtools/vision 1214-1564).

**Capabilities:** browser MCP built on accessibility snapshots (refs) by default; coordinate-based actions only with --caps=vision; snapshot mode none to skip responses; capability groups opt-in.

**OCADE compare:** OCADE web ops already structured-first; screenshots via web.screenshot + media.preview.

**Verdicts:** KEEP — confirms the playwright ariaSnapshot REPLACE recommendation; ADD "snapshot-mode none" equivalent: web.fill/web.click inside a guarded list skip returning the full page until the last step (fewer tokens). Apache-2.0.

### A.182. modelcontextprotocol/modelcontextprotocol (spec) — MIT→Apache-2.0 transition, Markdown/TS schema, 0175d20 (2026-11-13); 97 .md

**Read:** blog/content/posts/2026-07-28-spec-ga/index.md 20-100 (of 172); keyword scan (SECURITY.md:149).

**Capabilities (spec 2026-07-28 GA):** stateless core — no initialize/initialized handshake, no Mcp-Session-Id (SEP-2575); self-describing requests with optional discovery; Mcp-Method/Mcp-Name headers for routing/authorisation (SEP-2243); Multi Round-Trip Requests replace server-initiated elicitation/sampling/roots (SEP-2322); list results carry ttlMs/cacheScope and deterministic order (SEP-2549) so tool catalogues and prompt caches stay stable; Tasks as an extension; auth hardening (RFC 9207 iss validation, CIMD over DCR); 12-month deprecation window (index.md:22-79).

**OCADE compare:** gateway.py:173-176 calls session.initialize() then tools/list and pins exact names+schema fingerprints; pinned SDK mcp==2.3.0 (device-agent/windows/requirements.txt:2).

**Verdicts:** IMPROVE (compatibility risk, not urgent inside the 12-month window): verify mcp 2.3.0 negotiates with 2026-07-28 external servers; when upgrading, keep exact tools/list pinning (deterministic order helps fingerprinting) and use MRTR for in-call confirmation of external tools instead of failing. Stateless-handle advice ("mint an explicit handle from a tool", index.md:58) = OCADE page/window leases — KEEP.

### A.183. punkpeye/awesome-mcp-servers — MIT, Markdown (10.4k lines, 15,228 links, several translations), f431a5c (2026-11-06)

**Read:** keyword scan (Windows/macOS markers 🪟/🍎 legend README-ko.md:58-59; macOS keychain server 307). Capabilities: largest MCP server catalogue. Verdicts: REJECT (catalogue; OCADE only runs owner-pinned servers). MIT.

### A.184. punkpeye/awesome-remote-mcp-servers — MIT, Markdown (5.4k lines, 4,916 links), 37c0470 (2026-11-06)

**Read:** keyword scan (README:1080 remote connector "authorized Windows or macOS computers for files, commands, device management"; 1215 accessibility MCP). Verdicts: REJECT (remote servers conflict with local-only rule). MIT.

### A.185. TensorBlock/awesome-mcp-servers — MIT, JSON catalogue (603k lines) + docs + small API, fdbfcbf (2026-11-14)

**Read:** keyword scan (README:82-156 install-config generator API; docs/operating-system--command-line.md:12). Verdicts: REJECT (catalogue). MIT.

### A.186. wong2/awesome-mcp-servers — MIT, Markdown (584 lines, 660 links), 39eb1d7 (2026-07-13)

**Read:** keyword scan (README:99 trycua/cua MCP server entry). Verdicts: REJECT (catalogue). MIT.

### A.187. All-Hands-AI/OpenHands — DUPLICATE of OpenHands/OpenHands (#78)

Clone resolved through GitHub redirect to the same commit 830c0459e2f6056ab81e020c22970e782ae1be75 (2026-11-14). See OpenHands\_\_OpenHands note; no separate findings.

### A.188. aws-samples/sample-autonomous-cloud-coding-agents — MIT-0-style licence text, TypeScript CDK + Python, c8fcdb0 (2026-11-09); 216k TS lines

**Read:** LICENSE first line; top files (cli/src/commands/linear.ts, cdk/src/handlers/linear-webhook-processor.ts); listing (agent, cdk, contracts, integrations).

**Capabilities:** reference architecture for autonomous coding agents on AWS triggered from Linear issues (webhooks, isolated compute, PR output).

**Verdicts:** REJECT (AWS cloud infra; O3/O5).

### A.189. camel-ai/camel — Apache-2.0, Python, 0366b64 (2026-11-09); 273k py lines

**Read:** camel/societies/workforce/workforce.py grep (WorkforceState 133, WorkforceMode 142, WorkforceSnapshot 149, Workforce 176, failure_handling_config with max_retries and recovery strategies 245-300).

**Capabilities:** role-playing multi-agent "societies"; Workforce decomposes tasks to workers with configurable failure recovery strategies (retry, replan, decompose), snapshots.

**Verdicts:** REJECT multi-agent (plan.md §14). Pattern KEEP: named recovery strategies per failure class — OCADE's fallbackRoute/observedSinceFailure (planner.server.ts:245-296) already does this deterministically. Apache-2.0.

### A.190. camunda/camunda — Camunda licence mix (licenses/ directory; parts source-available), Java + TS, 955faebf (2026-11-13); 2.39M Java lines

**Read:** listing (zeebe engine, clients, authentication, licenses/); top files.

**Capabilities:** BPMN process orchestration (Zeebe event-sourced engine), user tasks, connectors, agentic orchestration (AI agent connector inside BPMN).

**Verdicts:** REJECT (JVM cluster infra; licence complexity; OCADE has one task authority).

### A.191. cline/cline — Apache-2.0, TypeScript, 72b3d71 (2026-11-13); 1.07M TS lines

**Read:** sdk/packages listing (agents, core, llms, sdk, shared, ui); grep core/src/extensions/tools (PLAN_MODE_COMMAND_GUARD_EXTENSION_NAME in index.ts:11; plan vs act mode routing tests; command-guard).

**Capabilities:** coding agent with Plan mode (read-only, command guard blocks mutations) vs Act mode; workspace checkpoints/restore; model-tool routing per mode; huge generated model catalogue.

**OCADE compare:** OCADE "observe before act" is per step; no explicit read-only planning phase guard.

**Verdicts:** ADD (technique only) plan/act separation for OCADE compile phase: during the compile turn only pure reads may be dispatched (already effectively true via offered ops? verify: goal turn offers set_goal + reads); enforce with a gate like PLAN_MODE_COMMAND_GUARD. Apache-2.0.

### A.192. coleam00/Linear-Coding-Agent-Harness — MIT, Python, c37dc09 (2026-01-28); 1.3k py lines

**Read:** security.py 1-60 (of 359); file list (agent.py, progress.py, prompts/).

**Capabilities:** long-running Claude Agent SDK harness with Linear issues as the progress ledger across sessions; pre-tool-use bash allowlist (ls, cat, head, tail, wc, grep, cp, mkdir, chmod validated, pwd, npm, node, git, ps …) (security.py:13-35).

**Verdicts:** allowlist pattern feeds the read-only command classifier recommendation (magentic-ui/codex notes); REJECT rest. MIT.

### A.193. crewAIInc/crewAI — MIT, Python, d7dfa0e (2026-11-13); 476k py lines (+9.5M md lines of translated docs)

**Read:** top files (lib/crewai/src/crewai/flow/runtime/**init**.py 4,073; crewai-core platform_catalog.py 134k generated); listing.

**Capabilities:** role-based crews + event-driven Flows with state, guardrails on task outputs, memory, knowledge.

**Verdicts:** REJECT (multi-agent; plan.md §14). MIT.

### A.194. daveshap/OpenAI_Agent_Swarm — MIT, Python, 020b44e (2023-12-07); 2.7k py lines

**Read:** listing (agents/tool_maker/chat_manager.py, shared/github_communication). Capabilities: 2023 hierarchical swarm experiment on OpenAI Assistants API (HAAS). Verdicts: REJECT (obsolete, abandoned). MIT.

### A.195. elder-plinius/T3MP3ST — AGPL-3.0, TypeScript, 29824d5 (2026-09-07); 55k TS lines

**Read:** README.md 1-60 (of 342) only.

**Capabilities:** multi-agent OFFENSIVE-security framework (recon → exploit → report) for authorised testing (README:19-43); reproducibility practice: every README number recomputed by `npm run verify-claims` (README:33).

**Verdicts:** REJECT (offensive tooling out of OCADE scope; AGPL). No exploit techniques extracted. Only the "verify-claims" practice is adopted: OCADE status numbers (plan.md §3) should be recomputable by a script from committed evidence (scripts/launch-readiness.mjs partly does this).

### A.196. FoundationAgents/MetaGPT — MIT, Python, 11cdf46 (2026-01-21); 89k py lines

**Read:** top files (metagpt/strategy/experience_retriever.py, utils/common.py); listing.

**Capabilities:** SOP-driven software-company multi-agent roles (PM, architect, engineer) producing PRD/design/code; experience retrieval.

**Verdicts:** REJECT (multi-agent code generation; plan.md §14). MIT.

### A.197. google/adk-python — Apache-2.0, Python, 287c0b0 (2026-11-13); 836k py lines

**Read:** src/google/adk/tools/computer_use/computer_use_toolset.py 1-120 (of 916) + grep (types.ComputerUse(environment, excluded_predefined_functions) 893-903); computer_use_tool.py grep 35-57 (virtual 1000×1000 coordinate normalisation).

**Capabilities:** Gemini Computer Use tool integration: predefined actions click_at, hover_at, type_text_at, scroll_at, scroll_document, key_combination, wait_5_seconds, current_state (and newer click/move/type/scroll/press_key/hotkey names) with exclusion lists per model generation (computer_use_toolset.py:53-108, 163); model emits normalised 1000×1000 coordinates mapped to the real screen (computer_use_tool.py:35-57); BaseComputer interface (base_computer.py).

**OCADE compare:** review §5 #36 names the Gemini Computer Use tool as the visual-fallback candidate; OCADE's own click_point uses window fractions with vision.py revalidation.

**Verdicts:** ADD Gemini Computer Use as OCADE's visual-fallback model (O2-compatible: same Gemini API/keys): send the leased-window preview, accept only click_at/type_text_at/scroll_at (exclude navigation/open-app predefined functions), map 1000×1000 → window fractions → existing ui.click_point path (lease + vision patch check + foreground rule). Mechanism computer_use_toolset.py:893-903 + computer_use_tool.py:35-57. Measure on the visual benchmark before default. Apache-2.0.

### A.198. google/ax — Apache-2.0, Go, eac8313 (2026-11-13); 27.8k Go lines

**Read:** README.md 1-40 (of 228). Capabilities: declarative orchestrator (YAML Workspace/Task specs) to sandbox and run millions of agent workloads on a cluster (Agent Substrate) — heavy development warning (README:6-13).

**Verdicts:** REJECT (cluster orchestration; O3). Apache-2.0.

### A.199. HKUDS/DeepCode — MIT, Python + TS desktop, aa6ed16 (2026-11-02); 211k py lines

**Read:** top files (core/application/turn_service.py 2,476; desktop generated app-server.ts); listing.

**Capabilities:** multi-agent "paper2code"/text2web/text2backend code generation with planning, reference mining, code indexing.

**Verdicts:** REJECT (code generation; out of scope). MIT.

### A.200. Kocoro-lab/Shannon — MIT, Go + Python + Rust, 391b619 (2026-09-05); 122k Go lines

**Read:** README.md 1-60 (of 496). Capabilities: production agent platform on Temporal workflows (time-travel replay), hard token budgets per task/agent with automatic model fallback, human approval workflows, WASI sandbox for code execution, OPA policies, multi-tenant isolation, Prometheus/OTel (README:28-35).

**OCADE compare:** OCADE has per-task budgets via commercial permits and stepBudget; no hard token budget per task.

**Verdicts:** ADD hard per-task input-token budget (review target ≤3k input tokens per step turn; total budget per task) enforced before each planner call (planner.server.ts) with honest block when exceeded. REJECT Temporal/WASI stack (O3). MIT.

### A.201. kyegomez/swarms — Apache-2.0, Python, 3b64d0b (2026-11-13); 202k py lines

**Read:** top files (swarms/structs/agent.py 3,526; graph_workflow.py 3,870); listing.

**Capabilities:** many multi-agent topologies (sequential, concurrent, hierarchical, graph, mixture-of-agents, majority voting).

**Verdicts:** REJECT (plan.md §14 "agent swarms"). Apache-2.0.

### A.202. langchain-ai/langgraph — MIT, Python, 08a2016 (2026-11-13); 209k py lines

**Read:** top files (libs/langgraph/langgraph/pregel/main.py 4,585; libs/cli deploy.py); listing (checkpoint libs, prebuilt, sdk).

**Capabilities:** Pregel-style stateful graphs, checkpointers (Postgres/SQLite), interrupts for human-in-the-loop, time travel, durable execution.

**OCADE compare:** OCADE state machine in SQL + request-driven advance is equivalent for a single-agent loop.

**Verdicts:** KEEP OCADE. REJECT dependency. MIT.

### A.203. microsoft/agent-framework — MIT, Python + .NET, 92838b6 (2026-11-13); 681k py + 434k C# lines

**Read:** python/packages/core/agent_framework/security.py 1-60, 343-400, 725-760 (of 6,815) + class/def index 163-1546.

Capabilities (FIDES, experimental): information-flow control against prompt injection — every content item carries IntegrityLabel (trusted/untrusted) and ConfidentialityLabel (public/private/user_identity) (security.py:343-400); labels combine through tool calls (combine_labels 467); per-tool security policy and check_confidentiality_allowed (546-652); ContentVariableStore keeps untrusted content OUT of the LLM context behind variable ids; quarantined_llm processes untrusted values and returns only results; inspect_variable for explicit reveal (725-760, 105-132); approval replay proofs bound to call body signature (163-231, 1342).

**OCADE compare:** OCADE quotes untrusted observations into the prompt as data and relies on grant checks + confirmations (planner SYSTEM L360-361) — no taint tracking from observation to action arguments.

**Verdicts:** ADD lightweight IFC taint: mark every argument value that was copied from an untrusted observation (web text, file content, external MCP) and require explicit confirmation when a tainted value flows into an external_effect argument (web.fill to another origin, shell command text, email-like fields). Optional variable indirection for large untrusted text (pairs with observation handles). Highest-value prompt-injection defence found. MIT.

### A.204. microsoft/autogen — code MIT (LICENSE-CODE), docs CC-BY-4.0 (LICENSE), Python + .NET, 8390985 (2026-11-12); 112k py + 46k C# lines

**Read:** README head + maintenance grep; packages listing (agbench, autogen-agentchat, autogen-core, autogen-ext, autogen-magentic-one, autogen-studio, magentic-one-cli); autogen-ext agents listing.

**Capabilities:** actor-model multi-agent framework (core), AgentChat teams (round-robin, selector, swarm, Magentic-One orchestrator with task/progress ledgers), extensions (web surfer, file surfer, code executors), AgBench benchmarking; the project points new work to Microsoft Agent Framework (see microsoft/agent-framework note).

**Verdicts:** MERGE with semantic-kernel (Magentic ledgers) and agent-framework (FIDES) notes; REJECT multi-agent framework (plan.md §14). MIT/CC-BY.

### A.205. multica-ai/multica — Apache-2.0 with additional terms (LICENSE first line), Go + TS, f337d4d (2026-11-14); 952k Go + 650k TS lines

**Read:** top files (server/internal/daemon/daemon.go 11,375; generated agent.sql.go); listing (CLI_AND_DAEMON.md, SELF_HOSTING).

**Capabilities:** platform to manage teams of coding agents as "teammates" (assign issues, local daemon runs agents on your machine, progress reporting).

**Verdicts:** REJECT (coding-agent team management; O4 one coding agent).

### A.206. openai/openai-agents-js — MIT, TypeScript, 8aeac0e (2026-11-12); 446k TS lines

**Read:** top files (packages/agents-core/src/runState.ts 7,838; sandbox/sandboxes/docker.ts 5,729); listing.

**Capabilities:** JS Agents SDK: handoffs, guardrails, tool approval interruptions with serialisable RunState for later resumption, sandboxes (Docker), realtime voice agents, tracing.

**Verdicts:** MERGE with openai-agents-python note. REJECT dependency. MIT.

### A.207. openai/openai-agents-python — MIT, Python, 64fbde5 (2026-11-11); 486k py lines

**Read:** src/agents/guardrail.py 1-60 (tripwire_triggered halts execution, input/output guardrail results); strict_schema.py 1-40 (\_MAX_SCHEMA_NODES 100,000 and \_MAX_SCHEMA_DEPTH 100 to stop `$ref` fan-out DoS from untrusted MCP schemas, L18-26); module listing (computer.py, handoffs, run_state.py, sandbox, realtime, repl, apply_diff).

**Capabilities:** Agents SDK: handoffs, guardrails (tripwires), strict JSON schema conversion with DoS bounds, RunState persistence for HITL, computer-use tool interface, sandboxes, tracing.

**OCADE compare:** catalog.py validates external manifest schemas with jsonschema without node/depth bounds (catalog.py:28-136; gateway.validator compiles every external inputSchema).

**Verdicts:** IMPROVE catalog.load / gateway.validator: reject external tool schemas over a node/depth bound (mechanism strict_schema.py:18-26) — cheap hardening. REJECT SDK. MIT.

### A.208. openai/swarm — MIT, Python, 6af0b4c (2026-04-15); 3.7k py lines

**Read:** listing (swarm/, examples customer_service_streaming). Capabilities: educational lightweight handoff framework (superseded by Agents SDK per its README). Verdicts: REJECT (obsolete/educational). MIT.

### A.209. openai/symphony — Apache-2.0, spec (SPEC.md 2,312 lines) + Elixir reference implementation, be10a1b (2026-09-15)

**Read:** SPEC.md 1-50. Capabilities: language-agnostic spec for a daemon that reads issues from a tracker, creates an isolated workspace per issue and runs a coding-agent session there; workflow policy in-repo (WORKFLOW.md) versioned with code; observability for concurrent runs; RFC 2119 normative style with "implementation-defined" behaviours documented (SPEC.md:7-31).

**Verdicts:** REJECT (coding-agent ops). Practice ADOPT: OCADE contracts written with RFC 2119 MUST/SHOULD and explicit "implementation-defined" sections — plan.md already near this. Apache-2.0.

### A.210. PrimeIntellect-ai/prime-agent — MIT, Rust + Python runtime, ad16133 (2026-11-13); 640k Rust lines

**Read:** top files (crates/pa-ai/src/models_generated.rs; prime-agent-runtime/src/rlm/factory.py); listing.

**Capabilities:** terminal coding agent + "RLM" (recursive language model) runtime for RL environments.

**Verdicts:** REJECT (coding agent/RL research). MIT.

### A.211. TauricResearch/TradingAgents — Apache-2.0, Python, 9fa1196 (2026-11-04); 28.8k py lines

**Read:** listing (tradingagents/, cli prompts/display). Capabilities: multi-agent trading research firm simulation (analysts, bull/bear debate, trader, risk manager).

**Verdicts:** REJECT (domain-specific; financial actions excluded from OCADE registry — irreversible/payments not allowed, contracts.ts header). Apache-2.0.

### A.212. VRSEN/agency-swarm — MIT, Python, 1bec92f (2026-11-02); 98k py lines

**Read:** top files (src/agency_swarm/agent/core.py 994; integrations/openclaw.py 1,320); listing.

**Capabilities:** "agency" org-chart multi-agent framework on OpenAI Agents SDK with directed communication flows; OpenClaw integration.

**Verdicts:** REJECT (multi-agent; plan.md §14). MIT.

### A.213. win4r/ClawTeam-OpenClaw — MIT, Python, 1468be4 (2026-11-07); 31k py lines

**Read:** top files (clawteam/cli/commands.py 4,915; spawn/tmux_backend.py 926). Capabilities: spawn teams of OpenClaw/coding agents in tmux panes with task board and messaging.

**Verdicts:** REJECT (O4 one coding agent; product rejects swarms). MIT.

### A.214. Yeachan-Heo/oh-my-claudecode — MIT, TypeScript, dec7e41 (2026-11-11); 518k TS lines

**Read:** top files (src/team/runtime-v2.ts 9,655; team/tmux-session.ts 6,061); listing.

**Capabilities:** Claude Code plugin for multi-agent "team" orchestration in tmux, autopilot/ultrawork modes, hooks, skills.

**Verdicts:** REJECT (developer tooling for parallel coding agents; O4). MIT.

### A.215. agent-sh/computer-use-linux — MIT, Rust, 32e20aa (2026-11-13); 65k Rust lines

**Read:** README.md 1-40 (of 686); src/atspi_tree.rs 138-160 (of 4,584) + fn index (list_accessible_apps 305, snapshot_tree 342, perform_action 873, set_element_value 930, normalize_bounds 2078, state_labels 2224).

**Capabilities:** Linux desktop control over MCP/CLI: AT-SPI semantic trees with breadth-first bounded traversal (requested max nodes/depth clamped to hard limits, child-read budgets) (atspi_tree.rs:138-160), compositor-aware window targeting, Wayland/X11 input, bounded screenshots, GNOME shell extension, remote-desktop portal (README:19).

**OCADE compare:** OCADE Linux is optional (O1); windows_worker truncates at the first 150 descendants depth-first (windows_worker.py:225); mac \_walk depth 12 recursive (mac_worker.py:211-215).

**Verdicts:** IMPROVE both bridges with breadth-first traversal and explicit node/depth budgets returned in evidence ("truncated: N more") so the planner knows the list is partial (mechanism atspi_tree.rs:142-160). Linux bridge optional later. MIT.

### A.216. bytebot-ai/bytebot — Apache-2.0, TypeScript (NestJS) + Docker desktop, 3d37894 (2025-09-11); 17.5k TS lines

**Read:** packages/bytebotd/src/input-tracking/input-tracking.helpers.ts 1-50 (of 646); top files (agent.computer-use.ts, bytebotd mcp computer-use.tools.ts).

**Capabilities:** self-hosted AI desktop agent in a Linux container (XFCE) with task UI; daemon exposes computer-use tools over MCP; uiohook global input tracking turns the person's takeover keystrokes/clicks into recorded actions (key map with printable/shift strings) so the agent learns what the human did.

**OCADE compare:** OCADE Take Over stops the agent; after Resume the planner only sees fresh observations (observedSinceTakeOver planner.server.ts:198).

**Verdicts:** ADD (pairs with deploymenttheory journey recorder) "what you did during Take Over" summary: record UIA/AX-resolved person actions while in Take Over (opt-in, passwords redacted) and give them to the planner on Resume. REJECT container desktop (plan.md §14). Apache-2.0.

### A.217. callstack/agent-device — MIT, TypeScript + Swift, d78be6c (2026-11-14); 942k TS lines

**Read:** README.md 1-40 (of 232); top files (packages/daemon request-execution-scope.ts, host-kit exec.ts).

**Capabilities:** device layer for coding agents to inspect/control/debug/verify apps on iOS, Android, HarmonyOS simulators/devices (and TV, web, desktop) through CLI/MCP/AI SDK.

**Verdicts:** REJECT now (O1: Windows/macOS desktop scope; mobile excluded since Android runtime removal, ToRemove.md:46). Record for a future mobile scope. MIT.

### A.218. ChinaYiqun/Desktop-Tiny-Agent-Framework — MIT, Python, 6cd8563 (2025-08-26); 8.2k py lines

**Read:** top files (core/advanced_scheduler.py 736, plugins/marketplace.py 677, file_manager.py 563, core/task.py 538).

**Capabilities:** small desktop agent framework with plugin marketplace and task scheduler.

**Verdicts:** REJECT (no mechanism beyond OCADE's own; scheduler conflicts with O12). MIT.

### A.219. Clevrr-AI/Clevrr-Computer — no licence file, Python, 62925bc (2024-10-30); 329 py lines

**Read:** main.py (79), utils/tools.py (96), utils/agent.py (18) via file list and sizes; contants.py prompt.

**Capabilities:** minimal LangChain + PyAutoGUI screenshot agent. Verdicts: REJECT (obsolete, no licence).

### A.220. dddabtc/winremote-mcp — MIT, Python, a3a18df (2026-09-30); 6.2k py lines

**Read:** src/winremote/**main**.py 628-700 (of 2,054) + tool index (≈30 @mcp.tool); file list (desktop.py, taskmanager.py, oauth.py).

**Capabilities:** Windows remote-control MCP over streamable HTTP with OAuth: screenshots, input, process/task manager, files, fetch with validated URL; \_ensure_session_connected parses `query session` and reconnects a disconnected RDP session to the console so GUI automation keeps working (L628-664, localised state names incl. Chinese).

**OCADE compare:** OCADE refuses other sessions/secure desktops (windows_worker.py:11-12) and is outbound-only (no listening server, agent.py:8).

**Verdicts:** REJECT remote HTTP control server (inbound attack surface; OCADE outbound-only is safer). ADD diagnostic only: detect "session disconnected/locked" and report a clear blocker (no auto tscon). MIT.

### A.221. e2b-dev/open-computer-use — Apache-2.0, Python, ee10259 (2026-10-23); 1.1k py lines

**Read:** file list and sizes (os_computer_use/sandbox_agent.py 215, llm_provider.py 246, providers.py 89, main.py 107).

**Capabilities:** open-model computer-use agent on E2B cloud desktop: separate vision/grounding model (e.g. OS-Atlas/ShowUI) and action model, live stream.

**Verdicts:** REJECT (cloud desktop). Idea already noted: split planner vs grounding model (midscene, Agent-S). Apache-2.0.

### A.222. e2b-dev/surf — Apache-2.0, TypeScript (Next.js), d66db29 (2026-10-13); 5k TS lines

**Read:** file list (lib/streaming/openai.ts 612, resolution.ts 321, app/page.tsx).

**Capabilities:** web UI that streams an OpenAI computer-use agent controlling an E2B desktop; resolution scaling helper.

**Verdicts:** REJECT (cloud desktop demo). Apache-2.0.

### A.223. firerpa/lamda (FIRERPA Android) — MIT-style licence text, Python client + proto, a980a38 (2026-09-27); 4k py lines (server is a binary distribution)

**Read:** README.md 1-30; file list (lamda/client.py 2,690, tools/startmitm.py, tools/globalmitm/DNS2SOCKS.c).

**Capabilities:** Android device automation framework (root agent, gRPC client, UI automation, MITM traffic interception tools).

**Verdicts:** REJECT (Android out of scope O1; MITM tooling is a security/privacy risk).

### A.224. kortix-ai/agent-computer-use — MIT, Rust CLI, d67eca2 (2026-10-02); 11.8k Rust lines — UNMAINTAINED (README:3-4 recommends trycua Cua Driver)

**Read:** README.md 1-50 (of 344); crate list (agent-computer-use-macos ax.rs/platform.rs, -windows platform.rs, -cdp dom.rs).

**Capabilities:** one CLI using accessibility primitives on macOS/Linux/Windows/Electron (CDP for Electron) — deterministic, zero vision tokens per click (README:12-30, repo comparison table).

**Verdicts:** REJECT (unmaintained). Confirms "accessibility first, CDP for Electron" — supports the AXManualAccessibility recommendation and Electron CDP route. MIT.

### A.225. mediar-ai/mcp-server-macos-use — Business Source License 1.1 (LICENSE:1), Swift, 205c888 (2026-09-30); 2.8k Swift lines

**Read:** Sources/MCPServer/InputGuard.swift 1-60 (of 355); file list (main.swift 2,056, ScreenshotHelper, scripts/ax_inspect.swift).

**Capabilities:** macOS MCP built on MacosUseSDK; InputGuard blocks the person's keyboard/mouse during an automation burst via a CGEvent tap with a floating overlay, Esc cancels and releases immediately, watchdog auto-release after 30 s (InputGuard.swift:5-24).

**OCADE compare:** OCADE pauses mutations while the person is active (\_person_quiet, mac_worker.py:261) — avoids conflict but a person's keystroke can still land between focus and type.

**Verdicts:** ADD (owner decision; consent + accessibility) a very short input guard (≤2-3 s, only for a send_keys/click burst, Esc = local STOP, watchdog) on macOS and Windows (BlockInput needs elevation — Windows variant may be impossible without admin; then keep the quiet-check). Code not reusable (BSL 1.1).

### A.226. mediar-ai/terminator — MIT, Rust (+ TS/Python bindings, MCP agent), 73a381c (2026-06-01); 99k Rust lines

**Read:** README.md 1-60 (of 170); crates/terminator/src/platforms/windows/engine.rs 1012-1060 (of 4,136) + fn/grep index (TreeScope find_first/find_all 874-2398, ocr_screenshot_with_bounds 720, calculate_similarity 407, virtual display/headless 305-371); crate list (terminator, -cli, -computer-use, -mcp-agent scripting_engine.rs, -workflow-recorder recorder/windows/mod.rs).

**Capabilities:** "Playwright for the desktop" on Windows UIA: chained selector language `process:chrome >> role:Button && name:Submit` with mandatory process scoping for desktop-wide search (engine.rs:1019-1029), locators with timeouts (auto-wait), OCR fallback with bounds, headless/virtual display sessions, workflow recorder (Windows), MCP agent with a scripting engine that runs recorded/AI-written workflows deterministically.

**OCADE compare:** OCADE \_element (windows_worker.py:129-144) matches automationId/name/controlType inside the leased window and refuses ambiguity — no ancestry or ordinal in the selector, so repeated labels block.

**Verdicts:** IMPROVE OCADE element descriptors with an ancestry path (parent role+name chain) and same-identity ordinal (like mcp-windows SnapshotDiffEngine keys) so guarded steps re-resolve targets deterministically; KEEP process/window scoping (OCADE lease is stricter). ADD auto-wait (bounded) before refusing element_not_found right after an action. REJECT Rust engine adoption (Python pywinauto stack). MIT.

### A.227. meituan/EvoCUA — Apache-2.0, Python (OSWorld-style harness), 4a0ad5f (2026-03-31); 20.9k py lines

**Read:** README.md 1-40 (of 238); file list (desktop_env evaluators/getters, server/main.py, mm_agents).

**Capabilities:** open CUA model (EvoCUA-32B) with evolving data synthesis; repo reports 56.48% on WindowsAgentArena vs Qwen3-VL-32B-Thinking 42.9% and UI-TARS-2 50.6% (README:23) — repo claim; includes OSWorld evaluators fork.

**Verdicts:** REJECT model hosting. Note WindowsAgentArena as a Windows benchmark candidate for OCADE qualification (O1 Windows mandatory). Apache-2.0.

### A.228. microsoft/fara — MIT, Python, a675d6d (2026-07-22); 29k py lines

**Read:** README.md 1-50 (of 351); webeval/src/webeval/rubric_agent/verifier_agent.py 1-50 (of 1,571).

**Capabilities:** Fara1.5 4B/9B/27B native CUA models (Qwen3.5-based; repo reports 63.4%/72.3% Online-Mind2Web for 9B/27B, README:25-32); webeval rubric pipeline with first-point-of-failure analysis classifying tool-interaction, visual-grounding and harness failures (verifier_agent.py:1-23).

**OCADE compare:** OCADE reports failures per task but not "first point of failure" class.

**Verdicts:** ADD first-point-of-failure classification to OCADE eval reports (deterministic from receipts: first refused/unknown/failed step and its class: planning, grounding/target, tool, environment, harness) — pairs with failure taxonomy (0xNyk note). REJECT model hosting. MIT.

### A.229. netease-youdao/LobsterAI — MIT, TypeScript (Electron), ae244db 2026-11-14; 551k TS lines

**Read:** top files (src/main/main.ts 16,997; main/libs/agentEngine/openclawRuntimeAdapter.ts 13,326); listing (SKILLs, companion-\*).

**Capabilities:** desktop personal assistant app wrapping the OpenClaw runtime (agent engine adapter, skills, companion UI).

**Verdicts:** REJECT (assistant shell over OpenClaw; mechanisms covered by openclaw note). MIT.

### A.230. openai/openai-cua-sample-app — MIT, TypeScript + Python, 6dd34b4 (2026-10-18); 9.6k TS + 4.5k py lines

**Read:** README.md 1-40 (of 119); top files (javascript-app/src/runner-manager.ts, console useRunStream.ts, labs paint-lab-template).

**Capabilities:** two reference CUAs: Playwright JS (browser) and PyAutoGUI Python (desktop); persistent runtime lets the model write a loop that fills several fields, checks each change took effect, and returns only the text it needs (README:5-7); "labs" test apps.

**OCADE compare:** same idea as guarded step lists (several actions + checks per model turn).

**Verdicts:** KEEP — confirms plan-first batching; ADD (technique only) "labs" idea: small local fixture apps per capability for CI (OCADE has web_fixture.py; add a desktop fixture app for UIA/AX tests on Windows/macOS runners). MIT.

### A.231. OthersideAI/self-operating-computer — MIT, Python, eb8165a (2026-10-19); 2.5k py lines

**Read:** file list (operate/models/apis.py 1,139, prompts.py 267, operate.py 187).

**Capabilities:** early screenshot-only framework (GPT-4V/Gemini/Claude) with SoM/OCR modes, click by percentage coordinates.

**Verdicts:** REJECT (superseded; vision-only). MIT.

### A.232. remorses/usecomputer — MIT, Zig native + TS CLI, 711a429 (2026-09-08); 6k Zig lines

**Read:** README.md 1-40 (of 611). Capabilities: fast native desktop input/screenshot CLI on macOS/Linux/Windows with `--coord-map` so clicks from a resized screenshot land correctly (README:5-16).

**Verdicts:** REJECT (OCADE window-fraction coordinates already solve mapping; PyAutoGUI/pywin32 adequate). MIT.

### A.233. showlab/computer_use_ootb — Apache-2.0, Python, 21b05ae (2025-05-21); 5.2k py lines

**Read:** file list (app.py 631, computer_use_demo/tools/computer.py 706, remote_inference.py 452).

**Capabilities:** out-of-the-box Windows/macOS computer use: planner API model (Claude/GPT) + local ShowUI/UI-TARS actor for grounding, Gradio UI.

**Verdicts:** REJECT (local model actor; plan.md §14). Planner/actor split idea noted (Agent-S). Apache-2.0.

### A.234. showlab/ShowUI — Apache-2.0, Python, 21ed7cb (2026-04-24); 15.4k py lines

**Read:** file list (model/showui/modeling_showui.py 2,031; qwen2/2.5 VL modelling; TRAIN.md, inference_vllm.ipynb).

**Capabilities:** 2B vision-language-action GUI grounding model with UI-guided visual token selection (drops redundant patches), training code.

**Verdicts:** REJECT (model training/hosting). Apache-2.0.

### A.235. stablyai/orca — MIT, TypeScript (Electron) + Swift native, a14a19ba (2026-11-14); 4.18M TS lines

**Read:** native/computer-use-macos/Sources/OrcaComputerUseMacOS/main.swift 372-388 (of 5,327) + fn index (showsSameState 179, actionResult 320, observeLateChange 372, recoverRequestedWindow 388, windowInventory 414, otherSpaceWindows 453, snapshot cache prune 578).

**Capabilities:** agent IDE/workbench with native macOS computer-use helper; after an action, polls a cheap no-screenshot observation every 0.2 s for up to 1 s until state differs ("late change"), then takes the full observation (main.swift:372-384); window recovery pins the window id after raising (386-388); other-Spaces window detection.

**OCADE compare:** OCADE mac uses AXObserver notifications (mac_worker.py:171-209, 0.15 s run loop); Windows readback is immediate after the pattern call.

**Verdicts:** ADD bounded "settle" wait on Windows (and as AXObserver fallback on macOS): poll cheap UIA state until changed or 1 s, then observe — fewer false "no effect" readbacks (mechanism main.swift:372-384). MIT.

### A.236. trycua/acu — no licence file, README list (582 lines), 2a9b3fb (2025-09-26)

**Read:** README.md 1-30 + scan. Capabilities: "Awesome agents for computer use" list. Verdicts: REJECT (catalogue).

### A.237. trycua/cua — MIT (LICENSE.md), Rust + Swift + Python + TS monorepo, fb2b0df (2026-11-14); 11,755 files, 1.61M Rust lines

**Read:** libs/cua/skills/cua-driver/SKILL.md 1-88 (full); WINDOWS.md 1-80 (of 827) incl. full delivery_mode table rows 35-36; WORKFLOW.md 103-128 (of 173); libs listing (cua-driver, cua-driver-bench, cua-bench, lume, lumier, qemu-docker, spaces\*, xfce-cua, kasm). Not read: the Rust driver sources themselves (≈1.6M lines).

**Capabilities:**

- cua-driver (macOS/Windows/Linux, CLI + MCP): snapshot-before-action invariant; act via snapshot-bound `element_token`; each fresh snapshot lists `invalidated_snapshot_ids`; `verify_state({pid, window_id, expect:[{element:{selector, exists}}]})` → satisfied/unsatisfied/unknown (SKILL.md:36-66; WORKFLOW.md:103-109).
- Background delivery on Windows (default): never fronts/raises/restacks; pixel click first does a UIA hit-test and Invoke through the accessibility channel (works for UWP/WinUI3/packaged apps), else coordinate pen/touch only when the target is the visible window at that point, PostMessage for plain Win32; returns `background_unavailable` when occluded or the event kind is known to be dropped (Chromium DOM mouse+key combos, GTK, LibreOffice VCL accelerators, terminals/WPF text); foreground mode = SendInput with brief SetForegroundWindow then restore, only when the agent explicitly opts in (WINDOWS.md:14-57).
- Action facts: effect confirmed / partial / unverifiable / suspected_noop / refused; route accessibility / synthetic_events / global_input / dom / trusted_input; escalation suggestion (target pixel/foreground/page, reason) that is never authorisation (WORKFLOW.md:111-127).
- Rules match OCADE invariants: exact target per action, never replay partial/unknown, one controller per desktop, permission prompts belong to the user (SKILL.md:57-65).
- Also: Lume/Lumier macOS VMs, cua-bench, agent SDK, recording.

**OCADE compare:** OCADE refuses all mutations while the person is active (\_person_quiet windows_worker.py:112, mac_worker.py:261) even for pattern-based UIA actions that need no focus; receipts carry status/maybeChanged only; no `suspected_noop`.

**Verdicts:**

- IMPROVE (high value, UX + speed): allow accessibility-channel actions (UIA Invoke/Value/Toggle, AXPress/AXValue) on a leased BACKGROUND window while the person keeps working elsewhere — they do not take input focus; keep the quiet rule for synthetic keyboard/pointer input. Mechanism WINDOWS.md:35. Owner decision (changes the "mutations pause while the person is active" rule, plan.md §13).
- ADD receipt fields `effect` (confirmed|partial|unverifiable|suspected_noop) and `route` to ui.\* receipts; planner uses them for repair (mechanism WORKFLOW.md:111-121).
- ADD `ui.verify` (expect predicates on a leased window) as a pure read used as guard of guarded steps and by verify.checks (`window_element_exists`).
- ADD `background_unavailable`-style explicit refusal codes for known-dropped event kinds (LibreOffice accelerators, Chromium DOM) to steer the planner to the right route (file op or web op).
- Consider (owner decision) bundling cua-driver as a pinned external MCP for the UI bridge on Windows/macOS instead of maintaining pywinauto/pyobjc bridges — MIT, actively maintained, cross-platform; risk: large native dependency, protocol drift (pin via catalog.py), loses OCADE lease semantics unless wrapped. Recommendation: keep OCADE bridges now; benchmark cua-driver as alternative on the 24-task suite.

### A.238. TurixAI/TuriX-CUA — MIT, Python, 88c777b (2026-09-14); 7.1k py lines

**Read:** src/agent/planner_service.py 1-50 (of 577); listing (src/mac/tree.py 599, controller/service.py 466, agent/service.py 1,694; skills/github-web-actions.md).

**Capabilities:** macOS (and Windows) CUA with a planner pre-step deciding PreplanDecision{use_search, queries, selected_skills} — optional web search (DuckDuckGo) and skill selection before acting (planner_service.py:39-47); mac AX tree; OpenClaw skill integration.

**OCADE compare:** OCADE SYSTEM forbids facts from memory; research mode exists (edge-handler `body.research` google_search tool, L500).

**Verdicts:** ADD pre-plan "needs lookup?" decision inside compileGoal (one field) so facts the request needs are fetched with OCADE web ops or Gemini grounding before planning — overlaps SK facts ledger note. REJECT DuckDuckGo scraping. MIT.

### A.239. vercel-labs/agent-desktop — Apache-2.0, Rust (+ PowerShell/C# probes, Swift VM host), 46d2adf (2026-11-13); 379k Rust lines — the project named in OCADE's own review (docs/research/OCADE_ARCHITECTURE_REVIEW_2026-11-08.md:80)

**Read:** CONCEPTS.md 1-70 (of 359); benchmarks/locator-resolution/README.md 1-30 (full); probes/windows/02-cache-timing.ps1 1-30 (of 270); probes/windows listing (00-27: tree-dump, cache-timing, pattern census, automationid census, input synthesis, hittest, UIA3 COM, elevation/UIPI, session/DPI, Electron activation, clipboard capture, signals/menus, shell surfaces, contract decisions).

**Capabilities:**

- Observation vocabulary: Snapshot with element refs allocated from that observation; Surface = scoped layer (open menu, sheet, popover, alert) observable separately; Drill-down from a ref to its subtree instead of re-reading the window; Partial Observation reports completeness on the whole and on each cut node (clamped depth says how many children skipped); Web Wrapper — anonymous UIA Group/Custom/Pane / AX group / AT-SPI panel chains from Chromium/Electron/WebView consume raw depth but no logical depth (CONCEPTS.md:5-46).
- Evidence tri-state Known / Absent / Unknown never collapsed (53-56); closed platform-neutral Role and State vocabularies mapped from AXRole+subrole, UIA ControlType refined by pattern availability, AT-SPI roles (57-63).
- macOS Electron/Chromium activation: AXManualAccessibility else AXEnhancedUserInterface (locator README:28-30).
- Deterministic locator benchmark: p50/p95 over 31 runs, candidate nodes, cardinality/correctness, A/B vs merge-base, HTML report (locator README:3-26); Windows probe suite measuring cache timing, UIPI/elevation, DPI/session, Electron activation (probes/windows).

**OCADE compare:** OCADE ui.inspect: depth-first first-150 descendants, no surfaces, no drill-down, wrappers count as depth, truncation silent, values either present or omitted (unknown vs absent collapsed) (windows_worker.py:213-246; mac_worker.py:211-245).

**Verdicts:**

- IMPROVE ui.inspect (both bridges): (1) collapse web wrappers (no logical depth), (2) `ui.inspect(scope=element|surface)` drill-down and open-menu/dialog surface capture, (3) partial-observation counts, (4) tri-state evidence (absent vs unknown) so the planner/verifier never treats a failed read as "no value". Mechanisms CONCEPTS.md:16-56.
- ADD a Windows/macOS probe suite like probes/windows (cache timing, UIPI, DPI, Electron activation) to OCADE CI qualification (device-agent tests) — measures, not assumes.
- KEEP OCADE Python bridges; agent-desktop's Rust core is a reference, not a dependency. Apache-2.0.

### A.240. vercel-labs/ai-sdk-computer-use — no licence file, TypeScript (Next.js), ed103da (2026-03-03); 1.9k TS lines

**Read:** lib/sandbox/tool.ts 1-50 (of 272). Capabilities: demo of AI SDK computer-use tool on a Vercel sandbox (Xvfb DISPLAY :99, 1024×768, xdotool key mapping).

**Verdicts:** REJECT (cloud sandbox demo; no licence).

### A.241. xlang-ai/OpenCUA — MIT, Python, dfc91ba (2026-05-25); 7.6k py lines

**Read:** README.md 1-40 (of 359); listing (data/cot-generate, data-process raw_to_standardized.py, evaluation/agentnetbench agents).

**Capabilities:** open CUA foundation: AgentNet tool to record human demonstrations across Windows/macOS/Ubuntu, reflective chain-of-thought data generation, AgentNetBench offline evaluation, OpenCUA models.

**Verdicts:** REJECT model training. AgentNetBench offline step-level evaluation idea ADD (technique only) for OCADE planner unit tests: replay recorded observation→expected-action pairs offline (no live model cost) to catch regressions in prompt/operation changes. MIT.

### A.242. zhoushoujianwork/easyeda-agent — MIT, Go + TS extension, af76cd7 (2026-11-14); 255k Go lines

**Read:** README.en.md 1-30 (of 195); top files (internal/app/pcb_check.go, cmd_pcb.go, extension/src/actions.ts 16.5k).

**Capabilities:** AI automation for EasyEDA Pro (datasheets → schematics → PCB layout → design-rule verification) through the app's extension API.

**Verdicts:** REJECT (single-app integration, O8). Pattern confirms "app's own extension API beats GUI" (same as CLI-Anything, UNO/COM notes). MIT.

### A.243. simular-ai/Agent-S — Apache-2.0, Python, 0fff0e6 (2026-10-21); 55k py lines

**Read:** agent_s4/orchestrator.py 1-70 (of 863); agent_s4/README.md 1-40 (of 188); gui_agents/s3/agents/grounding.py 91-130 (of 667) + def index (ACI 19, OSWorldACI 180, generate_coords 230, get_ocr_elements 249); listings (gui_agents s1/s2/s2_5/s3 with bbon behavior_narrator/comparative_judge; agent_s4 builder/tournament/islands).

**Capabilities:**

- Agent S3: planner (worker) + separate grounding model for coordinates + code agent; app-native shortcut `set_cell_values` writes cells into the OPEN LibreOffice document through UNO (`soffice --accept=socket,…;urp;StarOffice.Service`) instead of typing cell by cell (grounding.py:91-118); behavior best-of-N: narrate each rollout's behaviour and a comparative judge picks the best (s3/bbon).
- Agent S4 "Evolving Agent Interfaces": a Builder agent evolves a small Python tool library (shadow interface) from unlabeled trajectories on synthetic tasks; population/islands evolution keeps variants that score best on a held-out validation set the Builder never sees; repo reports OSWorld-V2 21.3% binary with Qwen3.8-27B, 3.8× the same model with fixed interfaces (README:3-25) — repo claim.

**OCADE compare:** OCADE edits workbooks as FILES (office_worker) and the review (§10) says an open document must be changed through the open app, which today means UI typing via UIA.

**Verdicts:**

- ADD live-document ops for open office files: LibreOffice via UNO socket bridge (Calc/Writer/Impress) and Excel/Word via COM GetActiveObject — `office.live_set_cells`, `office.live_read_range` on a leased document; far fewer UI steps for the benchmark's Calc task. Mechanism grounding.py:91-118. Must respect lease, macro-disabled profile and confirmation rules (engine.py:25-35).
- ADD (technique only) S4's validation discipline for OCADE's developer-time prompt/operation evolution (pairs with SkillOpt): changes accepted only by a held-out score. Runtime best-of-N REJECTED (quota, O2/O3). Apache-2.0.

### A.244. agentscope-ai/AgentTeams — Apache-2.0, Go + Python, 3575b47 (2026-11-14); 179k Go + 124k py lines

**Read:** README.md 1-40 (of 502); top files (controller project_handler.go, matrix channel adapters, qwen-code-bridge dispatch.py).

**Capabilities:** Manager-Workers multi-agent runtime: a Manager agent orchestrates worker agent containers (OpenClaw, QwenPaw, Hermes, DeepSeek Harness) in an auditable IM room with human visibility/intervention; MinIO shared file system to cut inter-agent tokens (README:13-25).

**Verdicts:** REJECT (plan.md §14 swarms; containers; O4). Idea noted: shared-file exchange instead of passing content through prompts = OCADE observation handles. Apache-2.0.

### A.245. modelcontextprotocol/servers — MIT→Apache-2.0 transition, TypeScript + Python reference servers, e1dc4b1 (2026-11-11); 42.6k TS + 16k py lines

**Read:** src/filesystem/lib.ts 45-70 (of 1,358) + grep (realpathWithTimeout 118-123, allowed-directory symlink checks 391-439); src listing (everything, fetch, filesystem, git, memory, sequentialthinking, time).

**Capabilities:** reference MCP servers; filesystem server bounds every fs call with FS_CALL_TIMEOUT_MS 15 s and walks with MAX_WALK_ENTRIES 100,000 because cloud-backed folders (iCloud Drive, macOS CloudStorage, slow network mounts) can block realpath/readdir for minutes (lib.ts:50-70); re-validates symlinked allowed directories at use time (391-402).

**OCADE compare (verified):** sandbox.resolve calls os.path.realpath on workspace and target with no timeout (sandbox.py:139-149); a JARVIS workspace inside OneDrive/iCloud Documents (the default suggested path is %USERPROFILE%\Documents\JARVIS, agent.py:3, often OneDrive-redirected) can hang a worker call until the gateway timeout.

**Verdicts:** IMPROVE sandbox.py/office_worker fs.list: bounded realpath/listdir (thread + timeout, report `cloud_placeholder_slow`), cap walk entries, never hydrate online-only placeholder files during fs.list (check FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS on Windows). KEEP OCADE's use-time realpath containment (already equivalent to 391-402).

### A.246. QwenLM/open-computer-use — Apache-2.0, Rust + TS + Python, 9b38187 (2026-11-09); 261k Rust lines

**Read:** README.md 1-40 (of 101); top files (packages/cua-driver platform-windows/linux impl\_.rs, SDK bindings).

**Capabilities:** standalone extraction (0.28 development snapshot) of Qwen Code's Computer Use + Browser Use runtimes: native desktop driver (vendored cua-driver), TS/Python SDKs, persistent JS MCP server, Chrome extension (README:5-13).

**Verdicts:** MERGE with trycua/cua and QwenLM/qwen-code notes (same driver lineage). Apache-2.0.

## Appendix B — Reading coverage per repository (measured)

Columns: status; total files; code lines; total lines (size script); files and lines read through the logging reader (line-logged). Every repository also had unlogged evidence reads (targeted searches with context, sed slices, licence/README/manifest heads, directory listings); they are named in each Appendix A "Read:" line and are not counted here. The last column lists the verdict types used in the entry.

|   # | Repository                                          | Status                                                  |       Files |      Code lines |     Total lines | Files line-logged | Lines line-logged | Verdict types           |
| --: | --------------------------------------------------- | ------------------------------------------------------- | ----------: | --------------: | --------------: | ----------------: | ----------------: | ----------------------- |
|   1 | microsoft/UFO                                       | cloned                                                  |         932 |         139,324 |         426,429 |                 4 |               318 | ADD/IMPROVE/REJECT      |
|   2 | sbroenne/mcp-windows                                | cloned                                                  |         632 |          89,304 |         138,457 |                 3 |               646 | ADD/IMPROVE/REJECT      |
|   3 | deploymenttheory/windows-mcp-server                 | cloned                                                  |         207 |          19,448 |          43,164 |                 2 |               141 | ADD/IMPROVE/KEEP/REJECT |
|   4 | iFurySt/open-computer-use                           | cloned                                                  |         842 |          69,032 |         100,164 |                 6 |               270 | IMPROVE/REJECT          |
|   5 | OpenAdaptAI/OpenAdapt                               | cloned                                                  |      11,709 |       1,334,422 |       3,767,958 |                 4 |               321 | ADD/IMPROVE/REJECT      |
|   6 | HKUDS/CLI-Anything                                  | cloned                                                  |       1,872 |         320,425 |         679,879 |                 2 |               140 | ADD/IMPROVE/REJECT      |
|   7 | openinterpreter/openinterpreter                     | cloned                                                  |       8,721 |       2,031,541 |       2,445,083 |                 2 |                80 | KEEP/MERGE/REJECT       |
|   8 | openinterpreter/interpreter-workstation             | cloned                                                  |       2,563 |         555,685 |         835,342 |                 1 |                50 | ADD/IMPROVE/REJECT      |
|   9 | QwenLM/Qwen3-VL                                     | cloned                                                  |         154 |           9,761 |         212,914 |                 1 |                82 | ADD/KEEP/REJECT         |
|  10 | QwenLM/Qwen-Agent                                   | cloned                                                  |         345 |          34,839 |         262,669 |                 2 |               160 | ADD/IMPROVE/REJECT      |
|  11 | microsoft/playwright-cli                            | cloned                                                  |          36 |             575 |           4,317 |                 1 |               156 | IMPROVE/REJECT          |
|  12 | web-infra-dev/midscene                              | cloned                                                  |       3,156 |         420,366 |         796,197 |                 2 |               185 | ADD/REJECT              |
|  13 | microsoft/magentic-ui                               | cloned                                                  |         387 |          64,180 |          77,649 |                 4 |               256 | ADD/IMPROVE             |
|  14 | temporalio/sdk-typescript                           | cloned                                                  |         988 |         134,618 |         179,354 |                 2 |               110 | ADD/IMPROVE/REJECT      |
|  15 | NousResearch/hermes-agent                           | cloned                                                  |      25,791 |       4,139,436 |       5,132,391 |                 4 |               220 | ADD/IMPROVE/REJECT      |
|  16 | xlang-ai/OSWorld-V2                                 | cloned                                                  |       1,266 |         185,670 |         334,742 |                 2 |               118 | ADD/REJECT              |
|  17 | microsoft/markitdown                                | cloned                                                  |         197 |          22,800 |          58,408 |                 1 |                80 | ADD                     |
|  18 | tashfeenahmed/freellmapi                            | cloned                                                  |       1,387 |         193,577 |         335,166 |                 1 |                90 | ADD/REJECT              |
|  19 | pydantic/pydantic-ai                                | cloned                                                  |       5,996 |       1,278,380 |       2,885,592 |                 4 |               190 | ADD/IMPROVE/KEEP/REJECT |
|  20 | huggingface/smolagents                              | cloned                                                  |         185 |          30,608 |          50,398 |                 2 |                58 | ADD/KEEP/REJECT         |
|  21 | strands-agents/harness-sdk                          | cloned                                                  |       3,724 |         607,530 |         858,265 |                 1 |               137 | ADD/IMPROVE/KEEP/REJECT |
|  22 | strands-agents/box                                  | cloned                                                  |       1,132 |         295,649 |         357,094 |                 1 |               140 | IMPROVE/KEEP/REJECT     |
|  23 | vercel/ai                                           | cloned                                                  |      10,208 |       1,273,282 |       1,925,182 |                 2 |                71 | ADD/IMPROVE/KEEP/REJECT |
|  24 | microsoft/semantic-kernel                           | cloned                                                  |       4,850 |         539,757 |         899,096 |                 2 |               200 | ADD/KEEP/REJECT         |
|  25 | QwenLM/qwen-code                                    | cloned                                                  |      14,976 |       6,081,716 |       7,158,686 |                 2 |               140 | ADD/KEEP/MERGE          |
|  26 | google-gemini/gemini-cli                            | cloned                                                  |       3,057 |         751,883 |         953,915 |                 2 |               158 | ADD/IMPROVE/KEEP/REJECT |
|  27 | openai/codex                                        | cloned                                                  |      10,344 |       2,465,528 |       2,796,023 |                 9 |               326 | ADD/REJECT              |
|  28 | langchain-ai/open-swe                               | cloned                                                  |       3,435 |         635,315 |         761,928 |                 3 |               140 | KEEP/REJECT             |
|  29 | langgenius/dify                                     | cloned                                                  |      16,109 |       2,635,171 |       3,098,628 |                 1 |                50 | KEEP/REJECT             |
|  30 | CopilotKit/CopilotKit                               | cloned                                                  |      24,269 |       2,619,492 |       4,995,809 |                 0 |                 0 | KEEP/REJECT             |
|  31 | ag2ai/ag2                                           | cloned                                                  |       1,692 |         242,847 |         306,569 |                 0 |                 0 | REJECT                  |
|  32 | lastmile-ai/mcp-agent                               | cloned                                                  |       1,176 |         139,223 |         314,192 |                 2 |               140 | ADD/KEEP/REJECT         |
|  33 | mcp-use/mcp-use                                     | cloned                                                  |       2,395 |         289,324 |         643,368 |                 0 |                 0 | KEEP/REJECT             |
|  34 | langgenius/dify-sandbox                             | cloned                                                  |         201 |          40,784 |         380,442 |                 0 |                 0 | REJECT                  |
|  35 | langgenius/mosoo-agent-driver                       | cloned                                                  |         453 |         126,429 |         145,791 |                 1 |                40 | KEEP/REJECT             |
|  36 | mediar-ai/MacosUseSDK                               | cloned                                                  |          22 |           4,185 |          18,989 |                 2 |               130 | ADD/IMPROVE             |
|  37 | mediar-ai/skillhubz                                 | cloned                                                  |         595 |           4,634 |         136,615 |                 0 |                 0 | KEEP/REJECT             |
|  38 | caramaschiHG/awesome-ai-agents-2026                 | cloned                                                  |           5 |               0 |             832 |                 0 |                 0 | REJECT                  |
|  39 | 0xNyk/awesome-agent-cortex                          | cloned                                                  |          86 |             434 |          12,059 |                 1 |                36 | ADD                     |
|  40 | agentSkills/agentskills                             | cloned                                                  |         142 |           1,672 |           9,067 |                 2 |               180 | ADD                     |
|  41 | AI-Architect-Studio/awesome-agent-operating-systems | cloned                                                  |          17 |              23 |           4,901 |                 0 |                 0 | REJECT                  |
|  42 | AI-Architect-Studio/awesome-hermes-agent-skills     | inaccessible (substitute scanned; excluded from totals) |          37 |             195 |           3,047 |                 0 |                 0 |                         |
|  43 | anthropics/skills                                   | cloned                                                  |         446 |          19,647 |         153,718 |                 1 |                60 | ADD                     |
|  44 | EverMind-AI/SkillCorpus                             | cloned                                                  |         380 |          50,886 |          64,185 |                 2 |               100 | REJECT                  |
|  45 | gamedev-skills/awesome-gamedev-agent-skills         | cloned                                                  |         295 |          14,930 |          58,923 |                 0 |                 0 | REJECT                  |
|  46 | github/awesome-copilot                              | cloned                                                  |       4,175 |         299,826 |       1,357,761 |                 1 |                70 | ADD/KEEP                |
|  47 | heilcheng/awesome-agent-skills                      | cloned                                                  |          76 |           3,925 |          27,601 |                 0 |                 0 | REJECT                  |
|  48 | junminhong/awesome-agent-skills                     | cloned                                                  |           6 |               0 |           4,174 |                 0 |                 0 | REJECT                  |
|  49 | kaspasejo/AG-skills                                 | cloned                                                  |       3,003 |          56,971 |         666,928 |                 0 |                 0 | REJECT                  |
|  50 | kmjnr/antigravity-agent-skills                      | cloned                                                  |       4,121 |         106,703 |         973,945 |                 0 |                 0 | REJECT                  |
|  51 | langchain-ai/langchain-skills                       | cloned                                                  |          77 |           6,015 |          16,658 |                 0 |                 0 | REJECT                  |
|  52 | libukai/awesome-agent-skills                        | cloned                                                  |          32 |               0 |          30,637 |                 0 |                 0 | REJECT                  |
|  53 | linny006/awesome-agent-skills                       | cloned                                                  |          10 |             138 |           1,573 |                 0 |                 0 | REJECT                  |
|  54 | microsoft/SkillOpt                                  | cloned                                                  |         496 |          86,539 |         129,268 |                 1 |                60 | ADD                     |
|  55 | obra/superpowers                                    | cloned                                                  |         236 |          14,151 |          37,291 |                 1 |                60 | KEEP                    |
|  56 | philipbankier/awesome-agent-skills                  | cloned                                                  |          51 |           1,673 |         390,030 |                 0 |                 0 | REJECT                  |
|  57 | Prat011/awesome-llm-skills                          | cloned                                                  |         372 |          17,450 |         118,133 |                 0 |                 0 | REJECT                  |
|  58 | RKiding/Awesome-finance-skills                      | cloned                                                  |         163 |          26,361 |          34,419 |                 0 |                 0 | REJECT                  |
|  59 | seb1n/awesome-ai-agent-skills                       | cloned                                                  |         171 |           6,941 |          25,362 |                 0 |                 0 | REJECT                  |
|  60 | sickn33/antigravity-awesome-skills                  | cloned                                                  |      31,044 |         726,260 |       6,777,676 |                 0 |                 0 | KEEP/REJECT             |
|  61 | TerminalSkills/skills                               | cloned                                                  |       3,277 |             125 |         552,841 |                 0 |                 0 | REJECT                  |
|  62 | vercel-labs/skills                                  | cloned                                                  |         217 |          47,190 |          52,892 |                 1 |                30 | REJECT                  |
|  63 | VoltAgent/awesome-agent-skills                      | cloned                                                  |           4 |               0 |           2,085 |                 0 |                 0 | REJECT                  |
|  64 | WenyuChiou/ai-research-skills                       | cloned                                                  |         162 |           4,637 |          52,113 |                 0 |                 0 | REJECT                  |
|  65 | agentscope-ai/agentscope                            | cloned                                                  |       1,314 |         349,852 |         402,499 |                 1 |                50 | KEEP/REJECT             |
|  66 | agno-agi/agno                                       | cloned                                                  |       6,566 |       1,343,413 |       1,483,078 |                 1 |                50 | REJECT                  |
|  67 | Aider-AI/aider                                      | cloned                                                  |         691 |          43,190 |         380,877 |                 1 |                48 | ADD/REJECT              |
|  68 | block/goose                                         | cloned                                                  |       2,585 |         438,783 |       2,014,542 |                 4 |               210 | ADD/KEEP/REJECT         |
|  69 | bytedance/deer-flow                                 | cloned                                                  |       4,833 |       1,153,953 |       1,443,242 |                 1 |                47 | ADD/REJECT              |
|  70 | continuedev/continue                                | cloned                                                  |       3,058 |         361,616 |       1,399,864 |                 0 |                 0 | REJECT                  |
|  71 | deepset-ai/haystack                                 | cloned                                                  |      13,601 |         162,283 |       2,928,276 |                 0 |                 0 | KEEP/REJECT             |
|  72 | google/adk-js                                       | cloned                                                  |       1,391 |         319,677 |         374,490 |                 1 |                60 | ADD                     |
|  73 | langchain-ai/deepagents                             | cloned                                                  |       1,911 |         743,214 |       1,063,429 |                 2 |                80 | ADD/REJECT              |
|  74 | langchain-ai/langchain                              | cloned                                                  |       3,300 |         431,125 |         655,675 |                 2 |                80 | KEEP/REJECT             |
|  75 | mastra-ai/mastra                                    | cloned                                                  |      23,625 |       4,156,222 |       5,935,714 |                 0 |                 0 | REJECT                  |
|  76 | microsoft/agent-framework-go                        | cloned                                                  |         718 |         261,922 |         311,047 |                 0 |                 0 | REJECT                  |
|  77 | openclaw/openclaw                                   | cloned                                                  |      64,987 |      13,286,140 |      15,162,603 |                 3 |               129 | ADD/REJECT              |
|  78 | OpenHands/OpenHands                                 | cloned                                                  |       2,916 |         476,131 |         623,850 |                 0 |                 0 | REJECT                  |
|  79 | Significant-Gravitas/AutoGPT                        | cloned                                                  |      11,130 |       1,856,942 |       2,827,937 |                 0 |                 0 | REJECT                  |
|  80 | alibaba/UI-TARS                                     | resolved → bytedance/UI-TARS                            |          28 |             722 |          35,669 |                 2 |               120 | ADD/KEEP/REJECT         |
|  81 | browserbase/stagehand                               | cloned                                                  |       1,742 |         255,629 |         537,056 |                 2 |                90 | ADD/IMPROVE/REJECT      |
|  82 | E2B-dev/desktop                                     | cloned                                                  |          42 |             359 |          20,769 |                 1 |               127 | REJECT                  |
|  83 | microsoft/OmniParser                                | cloned                                                  |          78 |           7,541 |          65,290 |                 0 |                 0 | ADD/REJECT              |
|  84 | microsoft/playwright                                | cloned                                                  |       3,149 |         666,634 |       1,005,910 |                 1 |                41 | REPLACE                 |
|  85 | skyvern-ai/skyvern                                  | cloned                                                  |       5,797 |       1,895,557 |       2,313,557 |                 0 |                 0 | REJECT                  |
|  86 | SWE-agent/SWE-agent                                 | cloned                                                  |         408 |          15,720 |          89,728 |                 1 |                40 | ADD/REJECT              |
|  87 | beam-cloud/beta9                                    | cloned                                                  |       1,579 |         513,850 |         615,243 |                 0 |                 0 | REJECT                  |
|  88 | ggerganov/llama.cpp                                 | cloned                                                  |       4,170 |       1,194,620 |       1,909,866 |                 1 |                24 | ADD/KEEP/REJECT         |
|  89 | Haidra-Org/AI-Horde                                 | cloned                                                  |         643 |         167,121 |         215,131 |                 0 |                 0 | REJECT                  |
|  90 | ollama/ollama                                       | cloned                                                  |       1,657 |         499,344 |       1,110,934 |                 0 |                 0 | REJECT                  |
|  91 | QwenLM/Qwen3                                        | cloned                                                  |         104 |           1,745 |          22,186 |                 0 |                 0 | REJECT                  |
|  92 | QwenLM/Qwen3.5                                      | cloned                                                  |           5 |               0 |             573 |                 1 |                80 | REJECT                  |
|  93 | a2aproject/A2A                                      | cloned                                                  |         149 |           2,516 |          30,644 |                 0 |                 0 | REJECT                  |
|  94 | composiohq/composio                                 | cloned                                                  |       4,030 |         397,099 |       1,033,917 |                 0 |                 0 | REJECT                  |
|  95 | modelcontextprotocol/inspector                      | cloned                                                  |       1,852 |         464,994 |         526,330 |                 0 |                 0 | KEEP                    |
|  96 | modelcontextprotocol/python-sdk                     | cloned                                                  |       1,726 |         151,580 |         274,273 |                 0 |                 0 | ADD/KEEP                |
|  97 | modelcontextprotocol/registry                       | cloned                                                  |         557 |          56,075 |         177,749 |                 0 |                 0 | KEEP/REJECT             |
|  98 | modelcontextprotocol/typescript-sdk                 | cloned                                                  |       1,253 |         206,373 |         250,558 |                 0 |                 0 | REJECT                  |
|  99 | n8n-io/n8n                                          | cloned                                                  |      34,833 |       5,474,061 |       6,508,055 |                 0 |                 0 | REJECT                  |
| 100 | AgentOps-AI/agentops                                | cloned                                                  |       1,530 |         142,538 |         592,149 |                 0 |                 0 | ADD/REJECT              |
| 101 | cloudflare/agents                                   | cloned                                                  |       3,150 |         633,954 |         785,457 |                 1 |                28 | ADD                     |
| 102 | confident-ai/deepeval                               | cloned                                                  |       3,200 |         292,215 |         623,848 |                 0 |                 0 | ADD/REJECT              |
| 103 | e2b-dev/E2B                                         | cloned                                                  |       1,238 |         149,372 |         206,167 |                 0 |                 0 | REJECT                  |
| 104 | eleutherai/lm-evaluation-harness                    | cloned                                                  |      16,415 |         107,983 |         305,282 |                 0 |                 0 | REJECT                  |
| 105 | getzep/graphiti                                     | cloned                                                  |         424 |          77,924 |         136,908 |                 0 |                 0 | REJECT                  |
| 106 | harbor-framework/harbor                             | cloned                                                  |       3,770 |         622,017 |         995,939 |                 1 |                40 | ADD/REJECT              |
| 107 | kubernetes-sigs/agent-sandbox                       | cloned                                                  |       1,976 |         278,465 |         418,962 |                 0 |                 0 | REJECT                  |
| 108 | langfuse/langfuse                                   | cloned                                                  |       8,031 |       1,469,058 |       1,695,747 |                 0 |                 0 | ADD/REJECT              |
| 109 | livekit/agents                                      | cloned                                                  |       1,689 |         364,908 |         410,691 |                 0 |                 0 | ADD/REJECT              |
| 110 | mem0ai/mem0                                         | cloned                                                  |       1,843 |         239,040 |         433,781 |                 0 |                 0 | REJECT                  |
| 111 | NVIDIA/SkillSpector                                 | cloned                                                  |         582 |         288,833 |         305,766 |                 1 |                50 | ADD                     |
| 112 | openai/evals                                        | cloned                                                  |       1,728 |          47,243 |          83,167 |                 0 |                 0 | ADD/REJECT              |
| 113 | opensandbox-group/OpenSandbox                       | cloned                                                  |       3,371 |         701,093 |         940,187 |                 0 |                 0 | REJECT                  |
| 114 | topoteretes/cognee                                  | cloned                                                  |       5,306 |         807,768 |       1,224,064 |                 0 |                 0 | REJECT                  |
| 115 | truera/trulens                                      | cloned                                                  |       1,574 |         168,203 |         455,120 |                 0 |                 0 | REJECT                  |
| 116 | browser-use/browser-use                             | cloned                                                  |         144 |          33,778 |          44,765 |                 3 |               160 | ADD/KEEP                |
| 117 | browser-use/browser-use-pi                          | cloned                                                  |          90 |          15,079 |          25,625 |                 1 |                50 | MERGE                   |
| 118 | browser-use/vibetest-use                            | cloned                                                  |          12 |             562 |             736 |                 1 |                40 | REJECT                  |
| 119 | iFurySt/open-browser-use                            | cloned                                                  |         308 |          40,138 |          57,770 |                 1 |                40 | ADD                     |
| 120 | jackwener/OpenCLI                                   | cloned                                                  |       2,363 |         294,987 |         387,110 |                 1 |                50 | ADD/REJECT              |
| 121 | Jeomon/Web-Use                                      | cloned                                                  |         594 |          36,298 |          55,163 |                 0 |                 0 | ADD/KEEP                |
| 122 | m1guelpf/browser-agent                              | cloned                                                  |          14 |             443 |           2,665 |                 1 |                60 | REJECT                  |
| 123 | microsoft/CUAWright                                 | cloned                                                  |         199 |          19,884 |          68,224 |                 3 |               160 | ADD                     |
| 124 | nanobrowser/nanobrowser                             | cloned                                                  |         490 |          57,816 |         136,173 |                 0 |                 0 | REJECT                  |
| 125 | SawyerHood/dev-browser                              | cloned                                                  |          99 |          15,260 |          17,196 |                 1 |                40 | MERGE                   |
| 126 | Tencent/BrowserSkill                                | cloned                                                  |       1,223 |         318,070 |         409,011 |                 1 |               130 | ADD                     |
| 127 | the-open-agent/openagent                            | cloned                                                  |       1,031 |         170,360 |         300,323 |                 1 |                30 | REJECT                  |
| 128 | 12britz/awesome-computer-use                        | cloned                                                  |           4 |               0 |             386 |                 0 |                 0 | REJECT                  |
| 129 | Arindam200/awesome-ai-apps                          | cloned                                                  |       2,192 |         131,557 |       1,103,323 |                 0 |                 0 | REJECT                  |
| 130 | Awesome-llms-labs/awesome-AI-agent-orchestration    | cloned                                                  |          12 |               0 |           2,500 |                 0 |                 0 | REJECT                  |
| 131 | Awesome-llms-labs/awesome-ai-agents                 | cloned                                                  |          11 |               0 |           1,899 |                 0 |                 0 | REJECT                  |
| 132 | awesome-llms-labs/awesome-multi-agents-workflow     | cloned                                                  |           9 |               0 |           1,805 |                 0 |                 0 | REJECT                  |
| 133 | bradAGI/awesome-cli-coding-agents                   | cloned                                                  |           4 |             192 |           6,610 |                 0 |                 0 | REJECT                  |
| 134 | bradAGI/awesome-free-inference                      | cloned                                                  |           4 |               0 |           1,826 |                 0 |                 0 | REJECT                  |
| 135 | dipakkr/awesome-ai-engineering                      | cloned                                                  |          82 |               0 |          22,245 |                 0 |                 0 | REJECT                  |
| 136 | ianwieds/awesome-ai-agents                          | cloned                                                  |          42 |           1,214 |          10,102 |                 0 |                 0 | REJECT                  |
| 137 | kaushikb11/awesome-llm-agents                       | cloned                                                  |         121 |             523 |           1,552 |                 0 |                 0 | REJECT                  |
| 138 | kyrolabs/awesome-agents                             | cloned                                                  |           2 |               0 |             331 |                 0 |                 0 | REJECT                  |
| 139 | reacher-z/Awesome-CUA                               | cloned                                                  |         444 |          39,355 |         502,957 |                 0 |                 0 | REJECT                  |
| 140 | Shubhamsaboo/awesome-llm-apps                       | cloned                                                  |       1,992 |         153,983 |         507,356 |                 1 |               184 | ADD                     |
| 141 | sihyeong/Awesome-LLM-Inference-Engine               | cloned                                                  |           8 |               0 |          12,046 |                 0 |                 0 | REJECT                  |
| 142 | slavakurilyak/awesome-ai-agents                     | cloned                                                  |          32 |           2,802 |          25,816 |                 0 |                 0 | REJECT                  |
| 143 | Supersynergy/awesome-ai-agents-2026                 | cloned                                                  |          34 |               0 |          19,144 |                 0 |                 0 | REJECT                  |
| 144 | xlite-dev/Awesome-LLM-Inference                     | cloned                                                  |           5 |              90 |           1,380 |                 0 |                 0 | REJECT                  |
| 145 | zenrran4nlp/Awesome-LLM-Inference-Serving           | cloned                                                  |           4 |               0 |           6,485 |                 0 |                 0 | REJECT                  |
| 146 | 12britz/awesome-free-models                         | cloned                                                  |           8 |             158 |           1,612 |                 0 |                 0 | REJECT                  |
| 147 | AILookup/free-llm-resources                         | cloned                                                  |           2 |               0 |             523 |                 0 |                 0 | REJECT                  |
| 148 | arc53/DocsGPT                                       | cloned                                                  |       3,478 |         881,377 |       1,250,024 |                 0 |                 0 | REJECT                  |
| 149 | BerriAI/litellm                                     | cloned                                                  |      15,988 |       4,816,420 |       5,855,352 |                 0 |                 0 | ADD/REJECT              |
| 150 | ClawLabsAI/free-ai-models                           | cloned                                                  |         212 |           1,223 |          99,842 |                 1 |                40 | REJECT                  |
| 151 | devanasolver/awesome-free-llm-apis                  | cloned                                                  |           1 |               0 |              87 |                 0 |                 0 | REJECT                  |
| 152 | golapkamal/Free-LLM-API                             | cloned                                                  |         345 |          54,116 |          86,986 |                 0 |                 0 | MERGE/REJECT            |
| 153 | kaiser-data/free-llm-proxy-router                   | cloned                                                  |         111 |          10,469 |          16,418 |                 1 |                50 | ADD/KEEP/REJECT         |
| 154 | khushaljethava/freellm-apis                         | cloned                                                  |         125 |           3,752 |          35,035 |                 0 |                 0 | REJECT                  |
| 155 | malda231125/free-llm-gateway                        | cloned                                                  |          46 |           2,939 |          12,271 |                 0 |                 0 | REJECT                  |
| 156 | msmarkgu/RelayFreeLLM                               | cloned                                                  |          88 |          10,082 |          12,522 |                 1 |                60 | KEEP/REJECT             |
| 157 | Portkey-AI/gateway                                  | cloned                                                  |         766 |          78,769 |         180,140 |                 0 |                 0 | REJECT                  |
| 158 | reqsgjh/free-coding-agent-models                    | cloned                                                  |          83 |             138 |          15,339 |                 0 |                 0 | REJECT                  |
| 159 | richbrianx/free-llm-listing                         | cloned                                                  |          12 |             542 |           3,528 |                 0 |                 0 | REJECT                  |
| 160 | shooter2062424/FreeLlmApiBenchmark                  | cloned                                                  |          10 |             803 |           3,941 |                 1 |                40 | ADD                     |
| 161 | SidSharma010/free-llm-api-hub                       | cloned                                                  |          18 |             329 |           1,096 |                 0 |                 0 | REJECT                  |
| 162 | spacepirate15/quantum-free-router                   | cloned                                                  |          26 |             389 |           1,972 |                 0 |                 0 | REJECT                  |
| 163 | velo4705/awesome-free-byok-models                   | cloned                                                  |           7 |             809 |           2,591 |                 0 |                 0 | REJECT                  |
| 164 | XuexGao/free-llm-router                             | cloned                                                  |         100 |          49,679 |          65,138 |                 1 |                30 | REJECT                  |
| 165 | zebbern/no-cost-ai                                  | cloned                                                  |           3 |               0 |             620 |                 0 |                 0 | REJECT                  |
| 166 | b4rtaz/distributed-llama                            | cloned                                                  |          93 |          41,796 |          49,369 |                 1 |                20 | REJECT                  |
| 167 | deepseek-ai/DeepSeek-V3                             | cloned                                                  |          20 |           1,397 |           2,971 |                 0 |                 0 | REJECT                  |
| 168 | JustVugg/colibri                                    | cloned                                                  |       1,697 |         462,251 |         675,498 |                 1 |                70 | REJECT                  |
| 169 | Niko1221/Strata                                     | cloned                                                  |       6,186 |         938,714 |       1,663,845 |                 1 |                30 | REJECT                  |
| 170 | sgl-project/sglang                                  | cloned                                                  |      12,523 |       3,614,252 |       4,193,795 |                 0 |                 0 | REJECT                  |
| 171 | vllm-project/llm-compressor                         | cloned                                                  |         836 |          82,316 |         106,577 |                 0 |                 0 | REJECT                  |
| 172 | vllm-project/vllm                                   | cloned                                                  |       9,320 |       2,706,466 |       3,214,028 |                 0 |                 0 | REJECT                  |
| 173 | AIAnytime/Awesome-MCP-Servers                       | cloned                                                  |         388 |           2,544 |          11,393 |                 0 |                 0 | REJECT                  |
| 174 | appcypher/awesome-mcp-servers                       | cloned                                                  |           3 |               0 |             595 |                 0 |                 0 | REJECT                  |
| 175 | archestra-ai/archestra                              | cloned                                                  |      11,436 |       2,704,736 |      13,603,803 |                 1 |                60 | ADD/KEEP/REJECT         |
| 176 | awslabs/mcp                                         | cloned                                                  |       3,915 |         975,368 |       1,391,338 |                 0 |                 0 | REJECT                  |
| 177 | BrowserMCP/mcp                                      | cloned                                                  |         146 |          25,719 |          32,107 |                 1 |                30 | MERGE                   |
| 178 | github/github-mcp-server                            | cloned                                                  |         716 |         152,175 |         200,155 |                 0 |                 0 | KEEP/REJECT             |
| 179 | jaw9c/awesome-remote-mcp-servers                    | cloned                                                  |           4 |               0 |             602 |                 0 |                 0 | REJECT                  |
| 180 | microsoft/mcp                                       | cloned                                                  |       6,773 |         545,280 |         903,503 |                 0 |                 0 | REJECT                  |
| 181 | microsoft/playwright-mcp                            | cloned                                                  |          44 |           1,580 |           5,977 |                 0 |                 0 | ADD/KEEP/REPLACE        |
| 182 | modelcontextprotocol/modelcontextprotocol           | cloned                                                  |       1,017 |          17,973 |         371,935 |                 1 |                81 | IMPROVE/KEEP            |
| 183 | punkpeye/awesome-mcp-servers                        | cloned                                                  |          12 |               0 |          10,826 |                 0 |                 0 | REJECT                  |
| 184 | punkpeye/awesome-remote-mcp-servers                 | cloned                                                  |           6 |               0 |           5,661 |                 0 |                 0 | REJECT                  |
| 185 | TensorBlock/awesome-mcp-servers                     | cloned                                                  |       8,300 |          12,154 |         626,929 |                 0 |                 0 | REJECT                  |
| 186 | wong2/awesome-mcp-servers                           | cloned                                                  |           6 |               0 |             679 |                 0 |                 0 | REJECT                  |
| 187 | All-Hands-AI/OpenHands                              | duplicate of #78 (excluded from totals)                 |       2,916 |         476,131 |         623,850 |                 0 |                 0 |                         |
| 188 | aws-samples/sample-autonomous-cloud-coding-agents   | cloned                                                  |       1,233 |         269,456 |         376,317 |                 0 |                 0 | REJECT                  |
| 189 | camel-ai/camel                                      | cloned                                                  |       2,243 |         280,301 |         771,375 |                 1 |                60 | KEEP/REJECT             |
| 190 | camunda/camunda                                     | cloned                                                  |      28,504 |       3,101,320 |       4,076,177 |                 0 |                 0 | REJECT                  |
| 191 | cline/cline                                         | cloned                                                  |       4,458 |       1,089,064 |       1,321,628 |                 0 |                 0 | ADD                     |
| 192 | coleam00/Linear-Coding-Agent-Harness                | cloned                                                  |          15 |           1,306 |           2,761 |                 1 |                60 | REJECT                  |
| 193 | crewAIInc/crewAI                                    | cloned                                                  |      45,943 |         478,462 |      10,914,905 |                 0 |                 0 | REJECT                  |
| 194 | daveshap/OpenAI_Agent_Swarm                         | cloned                                                  |          90 |           2,679 |           9,000 |                 0 |                 0 | REJECT                  |
| 195 | elder-plinius/T3MP3ST                               | cloned                                                  |       1,836 |          80,121 |         137,914 |                 1 |                60 | REJECT                  |
| 196 | FoundationAgents/MetaGPT                            | cloned                                                  |       1,255 |          91,473 |         182,267 |                 0 |                 0 | REJECT                  |
| 197 | google/adk-python                                   | cloned                                                  |       3,098 |         855,452 |       1,009,623 |                 1 |               120 | ADD                     |
| 198 | google/ax                                           | cloned                                                  |         165 |          29,538 |          35,778 |                 1 |                40 | REJECT                  |
| 199 | HKUDS/DeepCode                                      | cloned                                                  |       1,141 |         254,536 |         343,046 |                 0 |                 0 | REJECT                  |
| 200 | Kocoro-lab/Shannon                                  | cloned                                                  |         979 |         239,321 |         321,442 |                 1 |                60 | ADD/REJECT              |
| 201 | kyegomez/swarms                                     | cloned                                                  |       1,274 |         202,451 |         424,980 |                 0 |                 0 | REJECT                  |
| 202 | langchain-ai/langgraph                              | cloned                                                  |         707 |         209,031 |         261,924 |                 0 |                 0 | KEEP/REJECT             |
| 203 | microsoft/agent-framework                           | cloned                                                  |       5,683 |       1,145,480 |       1,343,315 |                 1 |               154 | ADD                     |
| 204 | microsoft/autogen                                   | cloned                                                  |       1,837 |         189,393 |         349,570 |                 0 |                 0 | MERGE/REJECT            |
| 205 | multica-ai/multica                                  | cloned                                                  |       8,357 |       1,655,146 |       1,862,828 |                 0 |                 0 | REJECT                  |
| 206 | openai/openai-agents-js                             | cloned                                                  |       1,644 |         468,741 |         543,001 |                 0 |                 0 | MERGE/REJECT            |
| 207 | openai/openai-agents-python                         | cloned                                                  |       1,702 |         487,770 |         618,847 |                 2 |               100 | IMPROVE/REJECT          |
| 208 | openai/swarm                                        | cloned                                                  |         288 |           3,724 |           6,785 |                 0 |                 0 | REJECT                  |
| 209 | openai/symphony                                     | cloned                                                  |         132 |             650 |          51,061 |                 1 |                50 | REJECT                  |
| 210 | PrimeIntellect-ai/prime-agent                       | cloned                                                  |       1,651 |         702,831 |         769,668 |                 0 |                 0 | REJECT                  |
| 211 | TauricResearch/TradingAgents                        | cloned                                                  |         213 |          28,791 |          41,934 |                 0 |                 0 | REJECT                  |
| 212 | VRSEN/agency-swarm                                  | cloned                                                  |         664 |         100,162 |         231,855 |                 0 |                 0 | REJECT                  |
| 213 | win4r/ClawTeam-OpenClaw                             | cloned                                                  |         232 |          32,128 |          87,097 |                 0 |                 0 | REJECT                  |
| 214 | Yeachan-Heo/oh-my-claudecode                        | cloned                                                  |       2,586 |         586,035 |         836,229 |                 0 |                 0 | REJECT                  |
| 215 | agent-sh/computer-use-linux                         | cloned                                                  |         155 |          77,598 |          99,765 |                 2 |                63 | IMPROVE                 |
| 216 | bytebot-ai/bytebot                                  | cloned                                                  |         345 |          18,213 |         108,433 |                 1 |                50 | ADD/REJECT              |
| 217 | callstack/agent-device                              | cloned                                                  |       6,067 |       1,015,648 |       1,148,624 |                 1 |                40 | REJECT                  |
| 218 | ChinaYiqun/Desktop-Tiny-Agent-Framework             | cloned                                                  |          31 |           8,210 |          10,864 |                 0 |                 0 | REJECT                  |
| 219 | Clevrr-AI/Clevrr-Computer                           | cloned                                                  |          21 |             329 |          49,043 |                 0 |                 0 | REJECT                  |
| 220 | dddabtc/winremote-mcp                               | cloned                                                  |          63 |           6,166 |          14,044 |                 1 |                73 | ADD/REJECT              |
| 221 | e2b-dev/open-computer-use                           | cloned                                                  |          24 |           1,124 |           4,124 |                 0 |                 0 | REJECT                  |
| 222 | e2b-dev/surf                                        | cloned                                                  |          68 |           5,035 |          22,138 |                 0 |                 0 | REJECT                  |
| 223 | firerpa/lamda                                       | cloned                                                  |         107 |          10,633 |          14,930 |                 0 |                 0 | REJECT                  |
| 224 | kortix-ai/agent-computer-use                        | cloned                                                  |         189 |          15,909 |          67,307 |                 1 |                50 | REJECT                  |
| 225 | mediar-ai/mcp-server-macos-use                      | cloned                                                  |          18 |           3,504 |           4,077 |                 1 |                60 | ADD                     |
| 226 | mediar-ai/terminator                                | cloned                                                  |         435 |         124,279 |         161,078 |                 2 |               109 | ADD/IMPROVE/KEEP/REJECT |
| 227 | meituan/EvoCUA                                      | cloned                                                  |         524 |          20,885 |          93,557 |                 1 |                40 | REJECT                  |
| 228 | microsoft/fara                                      | cloned                                                  |         174 |          30,623 |         139,832 |                 2 |               100 | ADD/REJECT              |
| 229 | netease-youdao/LobsterAI                            | cloned                                                  |       3,690 |         580,725 |       1,112,702 |                 0 |                 0 | REJECT                  |
| 230 | openai/openai-cua-sample-app                        | cloned                                                  |         161 |          17,572 |          28,405 |                 1 |                40 | ADD/KEEP                |
| 231 | OthersideAI/self-operating-computer                 | cloned                                                  |          33 |           2,501 |          16,089 |                 0 |                 0 | REJECT                  |
| 232 | remorses/usecomputer                                | cloned                                                  |          47 |           8,304 |          17,584 |                 1 |                40 | REJECT                  |
| 233 | showlab/computer_use_ootb                           | cloned                                                  |          47 |           5,153 |          67,817 |                 0 |                 0 | REJECT                  |
| 234 | showlab/ShowUI                                      | cloned                                                  |          84 |          15,474 |          95,671 |                 0 |                 0 | REJECT                  |
| 235 | stablyai/orca                                       | cloned                                                  |      37,139 |       4,355,939 |       5,128,339 |                 1 |                17 | ADD                     |
| 236 | trycua/acu                                          | cloned                                                  |           3 |               0 |             747 |                 1 |                30 | REJECT                  |
| 237 | trycua/cua                                          | cloned                                                  |      11,755 |       3,134,260 |       4,972,674 |                 3 |               194 | ADD/IMPROVE             |
| 238 | TurixAI/TuriX-CUA                                   | cloned                                                  |          47 |           7,315 |         121,620 |                 1 |                50 | ADD/REJECT              |
| 239 | vercel-labs/agent-desktop                           | cloned                                                  |       3,799 |         470,584 |         606,356 |                 3 |               140 | ADD/IMPROVE/KEEP        |
| 240 | vercel-labs/ai-sdk-computer-use                     | cloned                                                  |          38 |           1,961 |           9,063 |                 1 |                50 | REJECT                  |
| 241 | xlang-ai/OpenCUA                                    | cloned                                                  |         153 |           7,614 |         161,828 |                 1 |                40 | ADD/REJECT              |
| 242 | zhoushoujianwork/easyeda-agent                      | cloned                                                  |       1,624 |         305,405 |         640,820 |                 1 |                30 | REJECT                  |
| 243 | simular-ai/Agent-S                                  | cloned                                                  |         357 |          56,833 |          81,553 |                 3 |               150 | ADD                     |
| 244 | agentscope-ai/AgentTeams                            | cloned                                                  |       1,565 |         366,043 |         472,723 |                 1 |                40 | REJECT                  |
| 245 | modelcontextprotocol/servers                        | cloned                                                  |         414 |          89,230 |         117,291 |                 1 |                26 | IMPROVE/KEEP            |
| 246 | QwenLM/open-computer-use                            | cloned                                                  |         912 |         362,023 |         424,929 |                 1 |                40 | MERGE                   |
|     | **Totals (244 unique repositories)**                |                                                         | **761,781** | **118,305,414** | **200,830,234** |           **184** |        **10,964** |                         |

OCADE itself: 23 files / 1,732 lines line-logged, plus ≈930 lines read through slices and the full 8 November review (≈2.4 % of ≈113,058 tracked source lines).

## Appendix C — Capability → OCADE status → best source (cross-reference)

| Capability                               | OCADE status          | Best source(s)                                                    | Recommendation                       |
| ---------------------------------------- | --------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Forced function calling                  | Lacks                 | vercel/ai                                                         | R18                                  |
| Full JSON-schema tool parameters         | Lossy                 | vercel/ai                                                         | R19                                  |
| Model capability record                  | Lacks (per instance)  | freellmapi, litellm, gemini-cli, FreeLlmApiBenchmark              | R20                                  |
| Plan-first guarded step list             | Lacks (claimed)       | mcp-windows, OpenAdapt, cua-driver, openai-cua-sample-app         | R1–R5                                |
| Delta observations / handles             | Lacks                 | mcp-windows, MacosUseSDK, agent-desktop, deepagents, BrowserSkill | R21, R22, R9                         |
| UIA fast filtered tree                   | Weak                  | UFO, agent-desktop, computer-use-linux                            | R6                                   |
| AX for Electron/Chromium                 | Lacks                 | open-computer-use, agent-desktop                                  | R7                                   |
| Scroll                                   | Lacks                 | Windows-Use, cua-driver                                           | R8                                   |
| Background accessibility delivery        | Blocked by quiet rule | cua-driver                                                        | R10                                  |
| Live open-document edits (UNO/COM)       | Lacks (file only)     | Agent-S, UFO                                                      | R12                                  |
| Visual fallback model                    | Designed, not built   | adk-python (Gemini Computer Use)                                  | R13                                  |
| Set-of-marks / zoom preview              | Lacks                 | OmniParser, mcp-windows, Qwen-Agent                               | R14                                  |
| Web aria snapshot refs                   | Custom                | Playwright, playwright-mcp, dev-browser                           | R15                                  |
| Real signed-in browser                   | Lacks (own profile)   | BrowserSkill, open-browser-use, BrowserMCP                        | R16                                  |
| Take Over reconciliation                 | Partial               | BrowserSkill, bytebot, deploymenttheory                           | R17                                  |
| Runtime without 150 s kill               | Lacks                 | cloudflare/agents                                                 | R30                                  |
| Taint / IFC                              | Lacks                 | microsoft/agent-framework (FIDES)                                 | R31                                  |
| Windows command containment              | Lacks                 | openai/codex                                                      | R32                                  |
| macOS command containment                | Verifier only         | OCADE verifier, strands box                                       | R33                                  |
| Command classifier / risk labels         | Lacks                 | magentic-ui, codex, goose                                         | R34                                  |
| Post-hoc command fs diff                 | Lacks                 | magentic-ui                                                       | R35                                  |
| SSRF embedded IPv4                       | Partial               | pydantic-ai                                                       | R36                                  |
| External schema DoS bounds               | Lacks                 | openai-agents-python                                              | R37                                  |
| Cloud-placeholder fs timeouts            | Lacks                 | modelcontextprotocol/servers                                      | R38                                  |
| Inspect vs control grants                | Single grant          | interpreter-workstation                                           | R39                                  |
| Heartbeat-gap fence, provider generation | Partial               | deploymenttheory, openclaw                                        | R40                                  |
| Workbook error scan                      | Lacks                 | anthropics/skills                                                 | R43                                  |
| Image/table verify kinds                 | Lacks                 | OSWorld-V2                                                        | R44                                  |
| Verification tiers                       | Implicit              | OpenAdapt                                                         | R45                                  |
| Hidden-answer suite                      | Owner tasks only      | OSWorld-V2, EvoCUA/WAA                                            | R46                                  |
| Failure taxonomy / first failure         | Ad hoc                | 0xNyk, fara, deepeval                                             | R47                                  |
| Verified plan library                    | Lacks                 | CUAWright, midscene, stagehand, OpenAdapt                         | R50                                  |
| Demonstration recorder                   | Lacks                 | deploymenttheory, OpenAdapt, bytebot                              | R51                                  |
| Site/app gotchas                         | Lacks                 | browser-use                                                       | R52                                  |
| Capability notes                         | Lacks                 | agentskills spec, CLI-Anything, anthropics/skills                 | R53                                  |
| Prompt optimisation (dev-time)           | Manual                | SkillOpt, Agent-S4                                                | R54                                  |
| Any-document reader                      | Partial               | markitdown                                                        | R55                                  |
| Independent verifier                     | **Has (strong)**      | — (OCADE ahead of most repos)                                     | KEEP                                 |
| Journal / unknown-effect reconciliation  | **Has**               | cua-driver rules confirm                                          | KEEP                                 |
| Tool pinning / rug-pull defence          | **Has at start**      | deploymenttheory (runtime re-check)                               | KEEP + R40                           |
| Site binding per page                    | **Has**               | stagehand domain policy confirms                                  | KEEP                                 |
| Atomic, conflict-checked file edits      | **Has**               | sickn33 skill confirms                                            | KEEP                                 |
| Multi-agent swarm                        | Rejected by plan      | camel, crewAI, swarms, AgentTeams …                               | REJECT (team of roles instead, §4.3) |
| Local LLM / vector memory                | Rejected by plan      | llama.cpp, vllm, mem0, graphiti, cognee …                         | REJECT                               |
