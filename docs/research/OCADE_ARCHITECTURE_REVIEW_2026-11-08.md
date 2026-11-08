# OCADE architecture review and redesign plan (8 November 2026)

> Research and planning only: no code was changed for this document. It is supporting research for
> `plan.md` (the single authority); the decisions it recommends enter `plan.md` only through §10.
> Every claim below is marked **[V] verified** (code, logs, artifacts, official documentation),
> **[H] hypothesis** (consistent with evidence, not yet proven) or **[U] unverified** (third-party
> or no primary source).

## 0. Answer first

- **Why all 24 benchmark tasks failed** [V]: not desktop control. Real windows opened, OCADE
  discovered the applications and took first actions. Every task died in the **model loop**. Three
  things killed it:
  1. A planning turn's identity is reused as its billing idempotency key across retries.
  2. One full-context model round trip is needed per action, against a 16,000-input-token-per-minute
     free quota and a 150 s Edge wall clock.
  3. Gemini 3.8 Live Extended Thinking returned no function call for the goal turn.
- **The single biggest architectural bottleneck** [V]: _the model is in the loop for every action,
  and every turn re-sends the whole context through a stateless remote hop._ Round 4 shows the cost:
  - Turns took 10–140 s. Gemma used 2,000–28,000 input tokens per task.
  - The best task reached 7 model calls in 8 minutes.
  - 37 quota refusals hit one project's 16k-TPM limit.

  Nothing on the device side came close to these costs.

- **What to change, in order:**
  1. Fix turn identity (a new key per attempt, plus a replay of an already-settled answer).
  2. Make model capability explicit: function calling, thinking support, latency class.
  3. Collapse simple tasks into one compiled plan executed deterministically on the device, with the
     model called only on surprises.
  4. Shrink each turn to a small delta instead of the full history.
  5. Then measure again.

  Keep every security invariant. Do not loosen the goal validator.

- **The 84 concepts** should be consolidated into **12 mechanisms** (§5). About 60 concepts are
  properties of those mechanisms, not separate deliverables. None is deleted as a requirement.

## 1. Evidence base

| Source                                                                                                                                                                                                                                                                                                                                                                                             | What it shows                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Benchmark rounds 1–4 (runs [42421618278](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42421618278), [42422302152](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42422302152), [42425648457](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42425648457), [42427996732](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/42427996732)) | 0/72 task attempts passed; GitHub-hosted Windows and macOS desktops                                                                                                                                                     |
| Screenshots (macOS round 1)                                                                                                                                                                                                                                                                                                                                                                        | Calc opened `budget_215.xlsx`, GIMP 3.2.6 opened the four-layer `.xcf`, a macOS "find devices on local networks" prompt appeared [V]                                                                                    |
| `apps.list` receipts                                                                                                                                                                                                                                                                                                                                                                               | Blender, FreeCAD, GIMP 3.2, Kdenlive and LibreOffice discovered dynamically on macOS; Windows reports `*.exe` names [V]                                                                                                 |
| Staging `ocade.provider_issue` (23:30–01:00 UTC)                                                                                                                                                                                                                                                                                                                                                   | Gemma: 51× `thinking_level is not supported`, 37× HTTP 429, 10× HTTP 500 `internal error`, 1× 503 `high demand`, 6× stream_error; Live: 2× stream_error, 1× stream_aborted [V]                                          |
| Staging `ocade.provider_limit`                                                                                                                                                                                                                                                                                                                                                                     | 38× `GenerateContentInputTokensPerModelPerMinute-FreeTier = 16000` for `gemma-4-31b-it`, primary project [V]                                                                                                            |
| Staging `ocade.health` (round 4)                                                                                                                                                                                                                                                                                                                                                                   | 38 failed generations in <500 ms with error class `internal`: the HTTP 409 `permit_refused` path; 21+19 successful generations in 3–30 s and >30 s [V]                                                                  |
| Round-4 reports                                                                                                                                                                                                                                                                                                                                                                                    | Furthest progress: Windows A car `fs.list → apps.list → apps.launch`; macOS A GIMP `fs.list → apps.list → ui.inspect`; B: all 8 tasks `invalid_goal` after two goal turns of ≈8k input / ≈60–180 output tokens each [V] |

## 2. Failure investigation

Trace order used for each: RTAA (planner/supervisor) → model/provider (Edge function) → supervisor →
capability registry → MCP gateway → RTVC → device workers → journal → verifier.

| #   | Failure                                                            | Root cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Status                                                             | Where                                                                                                                 | Smallest correct fix                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Regression test                                                                                                                                                                                              | Missing diagnostic                                                                                          |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | `duplicate_completed`, and the 38 fast 409 `permit_refused` stalls | A planning turn's key is `jarvis-plan:<task>:<controller>:<steps.length>` (`authority.server.ts:351`). Every retry of the same turn (busy wait, stream failure, resume) re-acquires the **same** key. If the earlier attempt was settled (charged when the stream completed at the service, even though the planner never accepted the turn), the gate answers `duplicate_completed` (`generation-gate.ts:227`). If its transport was already claimed, `ocade_claim_generation_transport` refuses (`… transport_claimed_at IS NULL`). The handler answers 409, and `plannerWait` returns **without scheduling anything** for `permit_refused` (`authority.server.ts` ≈466), so the task waits forever. | **[V]** code path; counts from logs                                | `authority.server.ts` (turn key, `plannerWait`), `planner.server.ts` (`callPlanner`), `generation-gate.ts`, claim RPC | Split **turn identity** (dedupes concurrent resends; keep) from **attempt identity** (one per provider attempt): key = `turnKey:attempt`, with the attempt number persisted on the task and incremented on every planner failure. Additionally keep the delivered `final` (tool calls only) on the permit, so a retry of a _settled_ attempt replays it instead of failing. Never re-run an effect: replay returns the same _proposal_, which still passes the authority. | Planner fails once after the service settled → second advance gets a new key and proceeds, charged once per provider answer; concurrent resend of the same turn still gets `permit_refused` and does nothing | Report the permit key, attempt number and gate outcome per turn in the task report                          |
| 2   | `planner_stream_incomplete`                                        | The service stream ends without `final` and without a refusal. Consistent with the Edge Function's **150 s wall clock** (free plan) killing the function while slow Gemma turns ran 100–200 s (goalMs 100,835 and 77,748 on macOS C)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **[H]** strong: timings match; platform kill not logged            | Edge runtime limit; `PROVIDER_TIMEOUT_MS` 140 s                                                                       | Bound a turn by **output size and context**, not by waiting longer: the delta prompt (fix 5) and a smaller offered-operation list. Keep the 140 s cap and give a clear refusal before the platform kill (125 s budget for slow models). Never raise beyond the platform limit                                                                                                                                                                                             | A synthetic slow provider at 145 s → explicit `provider_timeout` refusal, permit released, new attempt key                                                                                                   | Log turn duration and bytes streamed at the service end                                                     |
| 3   | `provider_failed`                                                  | (a) Gemma HTTP 500 `internal error` ×10 and 503 `high demand` [V]; (b) `stream_error` ×8 [V]; (c) the turn deadline. Gemma also refuses `thinkingLevel` on every cold instance (51×): one wasted round trip per instance [V]                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **[V]** for (a), (b); cause of (b) [H]: malformed or partial chunk | Edge handler, boundary                                                                                                | Retry a 5xx **on the same attempt** before output (already done). Cache "no thinking setting" per model durably (a capability record, fix 4), not per instance                                                                                                                                                                                                                                                                                                            | Contract test: a model that rejects thinking is asked once in its lifetime per deployment, not per cold start                                                                                                | Log the parse error class for `stream_error`                                                                |
| 4   | "Planner busy"                                                     | The free-tier **16k input tokens per minute** per model and project [V]. A Gemma turn carries 2k–12k input tokens, so 2–3 turns a minute is the ceiling, shared by the 2 jobs per configuration running in parallel. HTTP 429 ×37 with a named per-minute quota; the handler waits correctly and never moves to another project                                                                                                                                                                                                                                                                                                                                                                        | **[V]**                                                            | Quota policy (correct); prompt size (the cause)                                                                       | Reduce input tokens per turn (fix 5) and calls per task (fix 3); schedule benchmark jobs so one model's runs do not overlap on one project                                                                                                                                                                                                                                                                                                                                | Token budget per turn asserted in the planner test (≤ 3k input tokens for a step turn)                                                                                                                       | None: `ocade.provider_limit` already names it                                                               |
| 5   | Gemma 30–140 s turns, text-only answers                            | Measured `goalMs` 10–100 s, `decisionMs` up to 136 s [V]; text-only finals occurred, and the planner treated them as broken streams before `b49a517` [V]. Cause of the slowness [H]: 31B dense model on a free shared tier, plus long prompts                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **[V]** behaviour, **[H]** cause                                   | Model choice                                                                                                          | Treat Gemma 4 31B as a **slow-class** model: compile a whole plan in one turn (fix 3), never one call per step; text-only answers are corrected once (done)                                                                                                                                                                                                                                                                                                               | Latency class recorded per model and used by the router                                                                                                                                                      | Per-turn first-byte and total time per model (have: health record buckets; need exact values in the report) |
| 6   | `invalid_goal` (all 8 B tasks)                                     | Both goal attempts were rejected by `compileGoal` with reason `invalid_goal` (not `_scope`), which means **no single `set_goal` call**, a schema failure, or milestone coverage (`planner.server.ts` ≈682–710). B's turns produced ≈60–180 output tokens: consistent with a spoken transcript and **no function call**, matching Google's unanswered developer-forum report that Extended Thinking emits no `toolCall` for `NON_BLOCKING` functions on some keys                                                                                                                                                                                                                                       | **[H]** strong; which branch is not yet logged                     | `live-session.ts`, `compileGoal`                                                                                      | Log the rejection branch (`no_call` / `schema` / `milestones`) per attempt first. If `no_call` is confirmed, B cannot plan with functions on these keys: route B's planning turns to a function-reliable model and use Live only where its strengths matter (spoken interaction). **Never loosen the validator**                                                                                                                                                          | Fake Live session that speaks without a call → planner reports `no_call`, asks once, then blocks honestly                                                                                                    | The rejection branch and the call count per goal attempt                                                    |
| 7   | Gemini Live integration                                            | Fixed in sequence [V]: key in URL refused → header unsupported by the Edge runtime → single-use ephemeral token over REST (works); turn closed at `turnComplete` before asynchronous calls → settle at `IDLE`/after the last call. Remaining: AUDIO modality is required, so every turn synthesises speech nobody hears (latency and cost) [V, docs]                                                                                                                                                                                                                                                                                                                                                   | Fixed; remaining [V]                                               | `live-session.ts`                                                                                                     | Prefer a non-Live model for planning; keep Live for real-time voice                                                                                                                                                                                                                                                                                                                                                                                                       | Already: 10 unit tests                                                                                                                                                                                       | Live first-call latency in the report                                                                       |
| 8   | Hybrid C                                                           | C is "Gemma first, Live only before output" (`modelRoute`). Gemma's failures happen **after** output starts (stream errors, deadline), so Live almost never ran: **C behaved as A** [V by design and logs]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **[V]**                                                            | `edge-handler.ts` route loop                                                                                          | Make C a real division of labour: one model compiles the plan, the other decides only on surprises, chosen by the measured capability record (fix 4). Escalate on verifier failure, not only on transport failure                                                                                                                                                                                                                                                         | Route test: post-output failure of model 1 is retried on model 2 under a new attempt key                                                                                                                     | Which model served each turn (have `slot`; add `model` to the health record)                                |
| 9   | Application permissions and discovery                              | The first application step was refused: the person had not allowed `app:<exe>` (`authority.server.ts` "permission_required"). Correct by design; the harness now grants the benchmark apps [V]. Discovery works (`apps.list`) [V]                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Fixed in harness                                                   | `benchmark.py`                                                                                                        | Product UX: when a plan needs an app the person has not allowed, ask once with the exact app name (an `ask` block), not a generic refusal                                                                                                                                                                                                                                                                                                                                 | E2E: a task needing an ungranted app produces one specific ask                                                                                                                                               | The missing grant name in the blocker text                                                                  |
| 10  | Environment                                                        | Harness defects, all fixed [V]: app bundle `python3` shadowing the job's Python on macOS; Windows version step started a GUI; Chocolatey 2 removed `--local-only`; GIMP per-user install path; Python startup env on Windows (`SYSTEMROOT`)                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Fixed                                                              | workflow, `benchmark.py`, `jarvis-live.mjs`                                                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The workflow itself                                                                                                                                                                                          | —                                                                                                           |

**Not a cause** [V]: device workers, MCP gateway, journal and verifier were never the limiting step
in any of the 72 attempts. Their first actions returned in milliseconds (`fs.list` 5–8 ms,
`apps.list` ≈0.5 s).

## 3. External comparison (what is known, what is not)

| Agent                                                                    | Verified (primary source)                                                                                                                                                                              | Unverified / not assumed                                                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI (ChatGPT Work, Agents API)                                        | DevDay 2026 recap: the Agents API supports computer use; available in Codex and ChatGPT Work ([OpenAI](https://openai.com/index/devday-2026-recap/))                                                   | Model names and "own cloud computer per agent" details come from secondary coverage ([Decrypt](https://decrypt.co/379584/openai-ai-agents-computers-devday-2026-everything-announced)) |
| Google Gemini                                                            | Live 3.8 models: AUDIO-only output, asynchronous `NON_BLOCKING` calls, `IDLE` status (Gemini API docs, read 7 Nov 2026); Computer Use tool GA 30 Oct 2026 per release notes cited by secondary sources | Free-tier numbers are shown only in AI Studio                                                                                                                                          |
| Claude Cowork, Manus "My Computer", Nous Hermes Agent, Grok-based agents | No primary architecture source was found in this session                                                                                                                                               | Not compared on internals; any claim about them would be speculation                                                                                                                   |
| Open source                                                              | Vercel Labs `agent-desktop` (31 Oct 2026, secondary source)                                                                                                                                            | —                                                                                                                                                                                      |

**Transferable patterns** (public, architecture-level, consistent across the verified sources):

1. Plan once, then act in a fast local loop.
2. Use structured actions (DOM/accessibility) before pixels.
3. Use a cloud sandbox _or_ local execution, never both for one task.
4. Use a dedicated computer-use model only as the visual fallback.

OCADE already has 2 and 3. It lacks 1. Its 4 is designed but unmeasured.

## 4. Proposed architecture (simplest that meets the goals)

```text
Request ─▶ Authority (one task authority: grants, STOP epoch, journal, budgets)   [unchanged]
            │
            ▼
 Compile  : one model turn → checks + milestones + a PLAN of guarded steps        [new default]
            (the capability record picks the model: function-reliable, latency class)
            │
            ▼
 Execute  : device runs the guarded steps locally, revalidating every target,     [existing ops]
            batching reads, one effect at a time, no model call while guards hold
            │  (surprise: a failed guard, an unknown effect, a new window, a verifier failure)
            ▼
 Repair   : one small DELTA turn (objective, plan, last observation, failure) ──┐  [≤ 2 per milestone]
            │                                                                   │
            ▼                                                                   │
 Verify   : independent verifier on the request-bound checks ◀──────────────────┘  [unchanged]
            ▼
 Deliver  : editable artifacts + receipt; honest BLOCKED/FAIL otherwise
```

What changes, exactly:

1. **Attempt identity** (fix 1): `turnKey:attempt`, plus a settled-answer replay. Owner: `authority.server.ts`, `planner.server.ts`, `generation-gate.ts`. No new component.
2. **Capability record per model** (fix 4): `{functionCalls: reliable|unreliable, thinking: levels|none, latencyClass, contextLimit, tpm}`. It is learned from provider responses (thinking refusals, `no_call`, timings, QuotaFailure) and persisted in one table. Owner: `edge-handler.ts` plus one migration. This replaces per-instance `withoutThinking` and the static route order. No hardcoded model behaviour: the record is measured.
3. **Plan-first execution** (the existing "guarded step lists", §13, today behind a flag): make them the default for tasks whose milestones are reversible workspace work. Each step keeps its policy gate, target revalidation and `expect` guard. The model is called again only on a guard failure. Owner: `planner.server.ts`, `supervisor.ts`. This is the biggest speed lever: 5–30 model calls per task become 1–4.
4. **Delta prompts**: a step turn carries the objective, the remaining plan, the last observation and the failure, not the full step history. Measured target ≤ 3k input tokens. Owner: `planner.server.ts` `history()`.
5. **Real C**: the compile model and the repair model are chosen from the capability record. Escalate on verifier failure. Owner: `edge-handler.ts` route plus the planner's escalation.
6. **Ask for missing app grants** by name (fix 9). Owner: `authority.server.ts`.
7. **Diagnostics** in the task report: attempt key, gate outcome, model served, rejection branch, first-byte and total per turn. No content, no keys.

What is **not** added: no second planner, no local LLM, no vector database, no agent swarm, no new
service. §9 holds.

## 5. The 84 concepts: decisions

Legend:

- **KEEP**: works and is needed.
- **IMPROVE**: needed but not yet effective.
- **MERGE**: becomes a property of a named mechanism, and its requirement stays.
- **REPLACE**: a different mechanism meets the same need.
- **REMOVE**: no longer pursued as a separate item; its requirement survives elsewhere.

Mechanisms (M1–M12):

- M1 Task authority
- M2 Compile and plan
- M3 Capability record and routing
- M4 Guarded executor
- M5 Device workers (native, file, script)
- M6 UI bridge (UIA/AX)
- M7 Browser
- M8 Verifier
- M9 Journal and recovery
- M10 Security and consent
- M11 Install and runtime
- M12 Measurement and qualification

|   # | Concept                                  | Decision             | Into  | Why (contribution · works? · speed/accuracy/reliability effect)                         | Verify by                                       |
| --: | ---------------------------------------- | -------------------- | ----- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
|   1 | OD-AVGHHC                                | MERGE                | M1–M8 | It is the whole design's name, not a component; tracking it separately duplicates 2–8   | Removed from the board; covered by M-gates      |
|   2 | Architecture C                           | MERGE                | M1    | Same as 1                                                                               | —                                               |
|   3 | Five components                          | KEEP                 | M1    | Clear ownership; works                                                                  | Ownership audit                                 |
|   4 | Single dispatcher                        | KEEP                 | M4    | Prevents conflicting mutations; works                                                   | Concurrency test                                |
|   5 | Supervisor–pilot separation              | KEEP                 | M1/M2 | The model proposes, the authority decides; works (runs proved refusals)                 | Policy suite                                    |
|   6 | Hierarchical control, context isolation  | IMPROVE              | M2    | Milestones exist; context is not isolated (full history each turn)                      | Input tokens per step turn ≤ 3k                 |
|   7 | Separation of state                      | KEEP                 | M1    | Works                                                                                   | Suite                                           |
|   8 | Outcome definition                       | IMPROVE              | M2    | Validator correct; models fail it silently (B)                                          | Rejection branch logged; goal success per model |
|   9 | No hardcoded journeys                    | KEEP                 | all   | Works; `jarvis:no-hardcoded`                                                            | Guard in CI                                     |
|  10 | Capability-first tool selection          | MERGE                | M3    | Same job as 13, 14, 23                                                                  | Recall test                                     |
|  11 | Environment discovery                    | KEEP                 | M5    | `system.inspect` works                                                                  | Runner receipts                                 |
|  12 | Dynamic app discovery                    | KEEP                 | M5    | `apps.list` found every benchmark app on macOS and Windows [V]                          | Benchmark receipts                              |
|  13 | Capability registry, typed schemas       | KEEP                 | M3    | One generated protocol; works                                                           | Protocol check                                  |
|  14 | MCP toolbox router                       | MERGE                | M3    | Duplicates 10/23                                                                        | —                                               |
|  15 | Semantic token gatekeeper                | MERGE                | M2    | Becomes the delta-prompt budget                                                         | Token budget test                               |
|  16 | Vectorized domain blueprints             | REMOVE               | —     | Embeddings rejected (§27); TF-IDF reversal already fired; no measured gain              | Recall stays ≥ 98% with the deterministic list  |
|  17 | Receding-horizon vector selector         | REPLACE              | M3    | Replaced by the grant-filtered deterministic operation list (§27)                       | Same                                            |
|  18 | Macroscopic planning                     | MERGE                | M2    | = milestones + compiled plan                                                            | Plan-first tests                                |
|  19 | Bounded receding-horizon planning        | MERGE                | M2    | = repair turns ≤ 2 per milestone                                                        | Budget test                                     |
|  20 | Observe–act–verify loop                  | IMPROVE              | M4    | Today one model call per act; becomes a local guard loop                                | Calls per task ↓                                |
|  21 | State pivot, self-correction             | MERGE                | M2    | = repair turn on a guard failure                                                        | —                                               |
|  22 | Tool namespace isolation                 | KEEP                 | M3    | Works                                                                                   | Suite                                           |
|  23 | Large catalog filtering                  | MERGE                | M3    | = 10                                                                                    | —                                               |
|  24 | Capability and dependency preflight      | KEEP                 | M11   | Works                                                                                   | Diagnose suite                                  |
|  25 | Native-first hierarchy                   | KEEP                 | M4    | Correct order; Gemma chose `office.inspect_workbook` first [V]                          | Route mix in reports                            |
|  26 | Native OS and file-format ops            | KEEP                 | M5    | Fastest path (ms)                                                                       | Latency tests                                   |
|  27 | Scoped scripts and commands              | KEEP                 | M5    | Needed for CAD/Blender/ffmpeg jobs                                                      | Job tests                                       |
|  28 | Windows UIA / Win32                      | IMPROVE              | M6    | Implemented; unproven on a live app task                                                | Calc/GIMP UI task on Windows                    |
|  29 | macOS AX                                 | IMPROVE              | M6    | Implemented; `ui.inspect` reached on GIMP [V]; actions unproven                         | Same on macOS                                   |
|  30 | Browser DOM/CDP                          | KEEP                 | M7    | Works (E3 history)                                                                      | Web suite                                       |
|  31 | Browser profile and session binding      | IMPROVE              | M7    | Partial on consumer machines                                                            | RPC                                             |
|  32 | Accessibility-tree interaction           | MERGE                | M6    | = 28/29                                                                                 | —                                               |
|  33 | Exact PID/HWND/doc/tab targeting         | KEEP                 | M6/M7 | Leases implemented; required for safety                                                 | Wrong-target suite                              |
|  34 | Resize, DPI, multi-monitor               | IMPROVE              | M6    | Fractions plus fresh observation designed; multi-monitor unproven                       | Resize-between-inspect-and-click test           |
|  35 | Foreground/background/minimized          | IMPROVE              | M6    | Rules exist; unproven live                                                              | Minimized-window test                           |
|  36 | Visual fallback                          | IMPROVE              | M6    | Last resort; candidate: Gemini Computer Use tool (GA per release notes [U]) as provider | Only after a semantic-route failure             |
|  37 | Universal fallback hierarchy             | MERGE                | M4    | = 25                                                                                    | —                                               |
|  38 | Filesystem sandbox                       | KEEP                 | M10   | Security invariant                                                                      | Scope-escape test                               |
|  39 | Trusted MCP gateway                      | KEEP                 | M5    | Works                                                                                   | Gateway suite                                   |
|  40 | MCP lifecycle                            | KEEP                 | M5    | Works                                                                                   | —                                               |
|  41 | Core tool roles                          | MERGE                | M5    | Documentation of 39/40                                                                  | —                                               |
|  42 | Async STDIO                              | KEEP                 | M5    | Works                                                                                   | —                                               |
|  43 | STDIO multiplexing                       | KEEP                 | M5    | Works                                                                                   | —                                               |
|  44 | Schema pinning                           | KEEP                 | M3    | Security                                                                                | —                                               |
|  45 | Tool discovery, versioning, health       | IMPROVE              | M11   | Partial                                                                                 | Health check per worker                         |
|  46 | External MCP provenance                  | KEEP                 | M10   | Security; partial                                                                       | W11                                             |
|  47 | Lazy worker activation                   | KEEP                 | M5    | Speed                                                                                   | Worker-ready ms                                 |
|  48 | IPC latency measurement                  | MERGE                | M12   | —                                                                                       | —                                               |
|  49 | Deterministic multi-action batching      | IMPROVE              | M4    | **Key speed lever** (plan-first); behind a flag today                                   | Calls per task, accuracy unchanged              |
|  50 | Resource locks                           | KEEP                 | M4    | Needed for parallel steps                                                               | Lock test                                       |
|  51 | Resource-aware scheduling                | MERGE                | M4    | = 50 + job scheduling                                                                   | —                                               |
|  52 | Task UUIDs and idempotency keys          | **IMPROVE (urgent)** | M1    | **Root cause of failure 1**: the turn key doubles as the attempt key                    | Fix-1 regression test                           |
|  53 | Side-effect journal                      | KEEP                 | M9    | Works                                                                                   | —                                               |
|  54 | Execution/effect/verification separation | KEEP                 | M9    | Works                                                                                   | —                                               |
|  55 | Unknown-effect reconciliation            | KEEP                 | M9    | Works                                                                                   | —                                               |
|  56 | Checkpoints and crash recovery           | KEEP                 | M9    | Works for jobs; advert crash test unreached                                             | Task-4 crash injection                          |
|  57 | STOP / Take Over / Resume                | KEEP                 | M1    | Invariant; D22 fixed on runners                                                         | Warm-worker STOP test                           |
|  58 | User-interference detection              | IMPROVE              | M6    | Partial                                                                                 | Input-newer-than-action test                    |
|  59 | Target revalidation                      | KEEP                 | M6    | Invariant: no stale coordinates                                                         | Resize test (34)                                |
|  60 | Bounded retry, cycle detection           | KEEP                 | M2    | Works                                                                                   | —                                               |
|  61 | Honest blocked states                    | KEEP                 | M1    | Works (all 72 failures were reported honestly) [V]                                      | —                                               |
|  62 | Least-privilege sandboxing               | IMPROVE              | M10   | Partial                                                                                 | W11                                             |
|  63 | Scoped auth, consent, MFA                | KEEP                 | M10   | Works; app consent worked as designed [V]                                               | —                                               |
|  64 | Secrets isolation                        | KEEP                 | M10   | Works; keys never reached the runner [V]                                                | Credential scan                                 |
|  65 | Signed device agent                      | KEEP                 | M11   | COM (paid signing)                                                                      | —                                               |
|  66 | Pairing and revocation                   | KEEP                 | M10   | Works                                                                                   | —                                               |
|  67 | Persistent capability scopes             | IMPROVE              | M10   | Add "ask for the missing app by name" (fix 9)                                           | E2E                                             |
|  68 | One installer                            | KEEP                 | M11   | Partial                                                                                 | RPC                                             |
|  69 | Workspace provenance                     | KEEP                 | M5    | Works                                                                                   | —                                               |
|  70 | Task telemetry                           | IMPROVE              | M12   | Add attempt/model/rejection fields (§4.7)                                               | Report schema                                   |
|  71 | Editable artifacts                       | KEEP                 | M5    | —                                                                                       | Oracles                                         |
|  72 | Outcome-first UX                         | KEEP                 | —     | W10                                                                                     | —                                               |
|  73 | Hide MCP complexity                      | MERGE                | 72    | —                                                                                       | —                                               |
|  74 | Closed-loop telemetry verification       | MERGE                | M8    | —                                                                                       | —                                               |
|  75 | Professional deliverable verification    | IMPROVE              | M8    | Geometry, media and quality checks for tasks 3–4                                        | Oracles in `benchmark.py`                       |
|  76 | Postcondition checks                     | KEEP                 | M8    | Works                                                                                   | —                                               |
|  77 | Evidence-based recovery                  | MERGE                | M2    | = repair turn                                                                           | —                                               |
|  78 | Latency benchmarks                       | KEEP                 | M12   | —                                                                                       | §7 targets                                      |
|  79 | Real unprepared tasks                    | KEEP                 | M12   | The benchmark                                                                           | —                                               |
|  80 | Adversarial tests                        | KEEP                 | M12   | —                                                                                       | —                                               |
|  81 | Proof-driven debloat                     | KEEP                 | M12   | W12                                                                                     | —                                               |
|  82 | Evidence states                          | KEEP                 | M12   | —                                                                                       | —                                               |
|  83 | Success and intervention metrics         | KEEP                 | M12   | —                                                                                       | —                                               |
|  84 | Zero-critical release gate               | KEEP                 | M12   | Gate, not a mechanism                                                                   | —                                               |

**Tally:** KEEP 48, IMPROVE 17, MERGE 17, REPLACE 1, REMOVE 1 (84). **Consolidation:** finish the
12 mechanisms; the concepts become their acceptance properties. `npm run jarvis:traceability` keeps
all 84 rows, with the mechanism as the destination.

## 6. Prioritised implementation sequence (smallest changes first)

| Step | Change                                                                                                            | Owner (code)                                                                             | Depends on | Removes failure                           |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| 1    | Per-turn diagnostics in the task report (attempt key, gate outcome, model, rejection branch, first-byte/total ms) | `planner.server.ts`, `authority.server.ts`, `jarvis-live.mjs` report                     | —          | Makes 2–8 provable                        |
| 2    | Attempt identity + settled-answer replay                                                                          | `authority.server.ts:351`, `plannerWait`, `generation-gate.ts`, permit table (migration) | 1          | 1 (all 409 stalls, `duplicate_completed`) |
| 3    | Capability record (thinking, function reliability, latency class, TPM), durable                                   | `edge-handler.ts`, one migration                                                         | 1          | 3 (51 wasted turns), 6, 8                 |
| 4    | Delta prompts (≤ 3k input tokens per step turn)                                                                   | `planner.server.ts` `history()`, prompt builders                                         | —          | 4, 5                                      |
| 5    | Plan-first guarded execution as the default for reversible workspace milestones                                   | `planner.server.ts`, `supervisor.ts` (existing step lists)                               | 2, 4       | Speed; 2                                  |
| 6    | Real hybrid C (compile model ≠ repair model, escalate on verifier failure)                                        | `edge-handler.ts`, planner escalation                                                    | 3          | 8                                         |
| 7    | Ask for missing app grants by name                                                                                | `authority.server.ts`                                                                    | —          | 9                                         |
| 8    | Rerun 24; then Linux 12 if quota remains                                                                          | `benchmark.py`, workflow                                                                 | 1–7        | Measurement                               |

## 7. Measurable targets (benchmark tasks; measured, not promised)

| Measure                                            | Now (round 4)                                     | Target                                      |
| -------------------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| Tasks passing (24 desktop)                         | 0                                                 | ≥ 12 after steps 1–7; ≥ 20 before RPC       |
| Model calls, simple task (Calc, GIMP)              | 2–7, none finished                                | ≤ 3                                         |
| Input tokens per step turn                         | 2k–12k                                            | ≤ 3k                                        |
| First action after acceptance                      | 0.5–1.4 s pickup, then 10–100 s for the goal turn | ≤ 15 s total (one compile turn)             |
| Local action execution (file/UIA/AX op)            | 5–500 ms observed                                 | ≤ 300 ms p50 / ≤ 1 s p95 (§18)              |
| Simple task end to end                             | never completed                                   | ≤ 30 s with a fast model, ≤ 90 s with Gemma |
| 409/duplicate stalls                               | 38 + several                                      | 0                                           |
| Silent waits (task waiting with nothing scheduled) | ≥ 1 per run                                       | 0                                           |

## 8. Tests that could falsify these recommendations

1. If tasks still stall with the attempt key fixed, failure 1 was not the main blocker. Measure the
   remaining stalls by cause.
2. If plan-first execution lowers first-attempt success on E1 (48 tasks) by more than 2 points,
   reverse it (§27 trigger, already registered).
3. If delta prompts lower decision accuracy (wrong target or invalid proposal rate up) on the same
   tasks, keep more history.
4. If B's rejection branch is `schema` or `milestones`, not `no_call`, the Live hypothesis is wrong;
   fix the prompt or schema instead.
5. If `planner_stream_incomplete` persists with turns under 120 s, the wall-clock hypothesis is
   wrong; look at Edge CPU and memory.

## 9. What can be milliseconds, seconds, minutes

| Class                          | Realistic                                                                                                                                                                                | Why                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Milliseconds                   | A single local operation once decided: file and format edits, UIA/AX pattern actions with readback, a cell write plus recalculation in a file, a layer visibility flag in a project file | Measured 5–500 ms device-side; no model call                                                                            |
| Seconds                        | A simple task end to end with one compile turn and a fast, function-reliable model                                                                                                       | One model round trip (3–15 s) dominates                                                                                 |
| Minutes                        | Multi-application creative work (CAD → Blender → video)                                                                                                                                  | Renders and encodes are compute-bound on CPU runners; orchestration ≤ 10% is the target (§18)                           |
| Not achievable in milliseconds | Anything that needs a model decision                                                                                                                                                     | Network plus inference; the benchmark sub-second targets apply to local execution only, which is how §19.4 defines them |

## 10. PC-control details: how they fit the same execution path

- **MCP/STDIO**: trusted, pinned manifests; persistent workers; JSON-RPC over asynchronous stdio;
  lazy start; one gateway multiplexes the workers (concepts 39–47). Unchanged; never on the critical
  path in the evidence.
- **Windows**: UIA patterns first (Invoke, Value, Toggle, Text, Grid), Win32 only for window state,
  `pywinauto` behind the bridge. Every action needs a fresh `ui.inspect`. The target is identified
  by role + name + ancestry + box in _that_ observation, under a lease of pid, hwnd and process
  start time. Before input, the lease and the element are revalidated; after input, a readback.
  Minimized or hung windows are refused or restored with consent.
- **macOS**: AXUIElement actions and attributes, AXObserver for changes, `AXIsProcessTrusted`
  onboarding, ScreenCaptureKit only when a preview is needed; input only to the frontmost app.
- **Browser**: DOM/CDP via Playwright, accessibility snapshot, the page id bound to the tab;
  navigation only to granted origins.
- **Files and object models first**: `.xlsx` via openpyxl plus engine recalculation, `.xcf`/`.ora`
  layer flags, FreeCAD and Blender through their own Python as `job.*`, ffmpeg/OTIO for video.
  Task 1 needs no UI at all if the file is not held open; when the person has it open, the UI route
  through the open window is the correct one, so the open document is not overwritten.
- **Resize, DPI, multi-monitor**: no coordinates survive an observation. A click takes the element
  from the newest observation, converts window-relative fractions with the current DPI and monitor,
  and refuses when the image the model saw is older than the window's last change (implemented as
  stale-image refusal).
- **Visual matching**: only after the semantic route fails, with a confidence threshold, and only
  for reversible steps.
- **Jobs, STOP, recovery**: long work runs as `job.*` with checkpoints and progress receipts; STOP is
  local and fences the next mutation; an unknown effect is reconciled from target state, never
  re-run.
- **Parallelism**: independent reads batch; effects run one at a time per resource (locks);
  independent milestones on different resources may run in parallel under the same authority.
- **Verification**: the independent verifier checks the request-bound postconditions from real
  files and windows. A model's claim never counts.

## 11. Sources

- Benchmark runs and artifacts: links in §1.
- Staging logs: `ocade.provider_issue`, `ocade.provider_limit`, `ocade.health` (Supabase project `auyapercxxptziyngycx`).
- Gemini API documentation (Live API capabilities, Live thinking, models, rate limits), read 7 Nov 2026.
- Google AI developer forum: "Gemini 3.8 Live Extended Thinking emits no toolCall for a NON_BLOCKING function" (28 Sep 2026, unanswered).
- [OpenAI DevDay 2026 recap](https://openai.com/index/devday-2026-recap/); [Decrypt coverage](https://decrypt.co/379584/openai-ai-agents-computers-devday-2026-everything-announced) (secondary).
