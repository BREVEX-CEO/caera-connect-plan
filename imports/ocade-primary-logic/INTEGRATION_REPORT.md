# OCADE donor integration — current report

> Generated from `imports/ocade-primary-logic/OCADE_PRIMARY_LOGIC_DISPOSITION.jsonl` by `scripts/generate-integration-report.mjs`.
> The JSONL ledger is authoritative; do not edit this report by hand.

## Evidence boundary

The raw archive is not shipped or executed. It was reconstructed from historical Git blob
`453f36dcd2a7a65c7101c071d64161e311d2f87a` only in disposable external storage,
integrity-tested, and matched SHA-256
`FD831F6C817AF1DBADCD6CBC67EC17CD11D0A8EDB7E01343FA60766FF11B17CD`. Its physical extraction contains 2126 files,
346 directories and 33,940,440 bytes.

This is repository-side provenance-risk reduction, not a claim of legal certification.

## Totals

| Archive files | Dispositioned | Source graph | Donor reachable | Donor unreachable | Broken occurrences | Broken pairs | Adapted modules | Production reached |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2126 | 2126 | 2104 | 1830 | 274 | 623 | 498 | 37 | 37 |

The only byte-identical match with current tracked source is an empty file; there are zero
substantive exact donor copies.

## Final disposition

| Disposition | Files |
| --- | ---: |
| `KEEP` | 10 |
| `MERGE` | 305 |
| `REMOVE` | 1391 |
| `REPLACE` | 420 |

Every record names its exact source hash, dependencies, broken imports, runtime assumptions,
platform class, donor and OCADE reachability, useful behavior, repair needs, canonical
destination, migration action, required callers, verification tests, final disposition and
reason in the JSONL ledger.

## Families and canonical authorities

| Donor family | Files | OCADE authority | Dispositions |
| --- | ---: | --- | --- |
| Abort composition and cancellation | 5 | `src/lib/runtime/execute.ts` | MERGE 5 |
| Agents, subagents, teams, coordinator | 20 | `src/lib/agent/planner.ts` | REPLACE 20 |
| Analytics and telemetry sinks | 21 | `src/lib/telemetry` | REMOVE 21 |
| Argument coercion at the tool boundary | 3 | `src/lib/runtime/tool-runner.ts` | MERGE 3 |
| Bash parser, heredocs, quoting, destructive-command warnings | 18 | `src/lib/runtime/permissions.ts` | MERGE 18 |
| Bridge, remote sessions, websocket transport | 42 | `src/lib/native/extension-bridge.ts` | REPLACE 42 |
| Buddy: the status and approval companion | 6 | `src/components/ocade/OcadeCompanion.tsx` | REPLACE 6 |
| Build scripts, Docker, packaging and repository config | 21 | `package.json` | REMOVE 21 |
| Constants, shims and platform detection | 29 | `src/primary-logic/shims/featureFlags.ts` | MERGE 29 |
| Context analysis: where the room went | 4 | `src/primary-logic/query/microCompact.ts` | MERGE 4 |
| Conversation recovery and resume repair | 6 | `src/lib/runtime/use-ocade-runtime.ts` | MERGE 6 |
| Cron and scheduled tasks | 5 | `src/lib/ocade-scheduler.ts` | REPLACE 5 |
| Everything else under utils | 357 | `src/lib` | KEEP 2, MERGE 4, REMOVE 351 |
| Git, worktrees, LSP, IDE | 19 | `src/lib/code/workspace.ts` | REPLACE 19 |
| Hosted inference, provider table, OAuth to the model vendor | 52 | `src/lib/runtime/call-model.ts` | REMOVE 52 |
| Licences, notices and provenance | 8 | `src/primary-logic/LICENSE.md` | KEEP 3, REMOVE 5 |
| Memory record shapes and the age/relevance model | 11 | `src/lib/memory/quality.ts` | MERGE 11 |
| Message protocol: content blocks, tool use, tool results | 29 | `src/lib/runtime/call-model.ts` | MERGE 29 |
| Micro-compaction of old tool output | 11 | `src/lib/runtime/compact.ts` | MERGE 11 |
| PTY, terminal emulator, Ink renderer | 463 | `src/lib/runtime/execute.ts` | KEEP 5, REMOVE 458 |
| Path safety and sandbox rules | 4 | `src/lib/runtime/permissions.ts` | MERGE 4 |
| Payments and webhooks | 9 | `src/lib/payments` | MERGE 9 |
| Permission rule review: validation and shadow detection | 54 | `src/components/settings/PermissionRules.tsx` | MERGE 54 |
| Permissions, shell rule matching, dangerous patterns, denial tracking | 34 | `src/lib/runtime/permissions.ts` | MERGE 34 |
| Plugins, skills, tool servers | 92 | `src/lib/skills/pack-registry.ts` | REPLACE 92 |
| PowerShell code-execution cmdlets | 3 | `src/lib/runtime/permissions.ts` | MERGE 3 |
| Query engine, deps, transitions, token budget, stop hooks | 15 | `src/lib/runtime/use-ocade-runtime.ts` | MERGE 15 |
| React hooks for the terminal UI | 104 | `src/lib/runtime/use-ocade-runtime.ts` | REMOVE 104 |
| Run re-entrancy: one query at a time | 7 | `src/lib/runtime/use-ocade-runtime.ts` | MERGE 7 |
| SSRF guard: IPv4 addresses written as IPv6 | 1 | `src/primary-logic/net/mappedAddress.ts` | MERGE 1 |
| Server-only entry points and local HTTP host | 23 | `src/server.ts` | REPLACE 23 |
| Session memory extraction thresholds | 5 | `src/lib/memory/session-memory.ts` | MERGE 5 |
| Sessions, history, resume, rewind | 49 | `src/lib/session.ts` | REPLACE 49 |
| Task lifecycle, stop, background tasks, status labels | 49 | `src/lib/tasks/runs.ts` | MERGE 49 |
| The CLI itself: commands, slash commands, entry points | 228 | `src/routes/_authenticated/ocade.index.tsx` | REMOVE 228 |
| The donor's own web client | 151 | `src/routes` | REMOVE 151 |
| Tool implementations, tool contracts and tool search | 161 | `src/lib/agent/tool-registry.ts` | MERGE 1, REPLACE 160 |
| Unicode sanitisation and hidden-character handling | 3 | `src/lib/ocade-injection-guard.ts` | MERGE 3 |
| Voice | 4 | `src/lib/ocade-voice.ts` | REPLACE 4 |

## Adapted modules and production callers

| Module | Reached by |
| --- | --- |
| `src/primary-logic/commands/bashParser.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/commands/destructiveCommandWarning.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/commands/powershellCodeExecution.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/commands/powershellDestructiveWarning.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/commands/treeSitterAnalysis.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/memory/memoryAge.ts` | `src/lib/local-memory.ts` |
| `src/primary-logic/memory/memoryTypes.ts` | `src/lib/memory/quality.ts` |
| `src/primary-logic/memory/sessionMemoryPolicy.ts` | `src/lib/memory/session-memory.ts` |
| `src/primary-logic/net/mappedAddress.ts` | `src/lib/research/public-network.server.ts` |
| `src/primary-logic/permissions/PermissionMode.ts` | via another adapted module |
| `src/primary-logic/permissions/PermissionRule.ts` | via another adapted module |
| `src/primary-logic/permissions/PermissionUpdateSchema.ts` | via another adapted module |
| `src/primary-logic/permissions/dangerousPatterns.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/permissions/denialTracking.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/permissions/pathSafety.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/permissions/permissionRuleParser.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/permissions/ruleReview.ts` | `src/components/settings/PermissionRules.tsx` |
| `src/primary-logic/permissions/shellRuleMatching.ts` | `src/lib/runtime/permissions.ts` |
| `src/primary-logic/permissions/types.ts` | `src/components/settings/PermissionRules.tsx`, `src/lib/runtime/permission-settings.ts`, `src/lib/runtime/permissions.ts` |
| `src/primary-logic/protocol/modelProtocol.ts` | via another adapted module |
| `src/primary-logic/query/abortSignals.ts` | `src/lib/runtime/execute.ts` |
| `src/primary-logic/query/budgetText.ts` | `src/lib/runtime/use-ocade-runtime.ts` |
| `src/primary-logic/query/contextAnalysis.ts` | via another adapted module |
| `src/primary-logic/query/deps.ts` | `src/lib/agent/loop.ts`, `src/lib/runtime/call-model.ts`, `src/lib/runtime/compact.ts`, `src/lib/runtime/tool-runner.ts`, `src/lib/runtime/use-ocade-runtime.ts` |
| `src/primary-logic/query/microCompact.ts` | `src/lib/runtime/compact.ts` |
| `src/primary-logic/query/query.ts` | `src/lib/agent/loop.ts`, `src/lib/runtime/compact.ts`, `src/lib/runtime/use-ocade-runtime.ts` |
| `src/primary-logic/query/queryGuard.ts` | `src/lib/runtime/use-ocade-runtime.ts` |
| `src/primary-logic/query/resume.ts` | `src/lib/runtime/use-ocade-runtime.ts` |
| `src/primary-logic/query/tokenBudget.ts` | via another adapted module |
| `src/primary-logic/query/transitions.ts` | via another adapted module |
| `src/primary-logic/shims/featureFlags.ts` | via another adapted module |
| `src/primary-logic/tasks/lifecycle.ts` | `src/lib/tasks/runs.ts` |
| `src/primary-logic/tasks/pillLabel.ts` | `src/lib/tasks/runs.ts` |
| `src/primary-logic/tasks/stopTask.ts` | `src/lib/tasks/runs.ts` |
| `src/primary-logic/text/lazySchema.ts` | via another adapted module |
| `src/primary-logic/text/sanitization.ts` | `src/lib/ocade-injection-guard.ts` |
| `src/primary-logic/text/semanticValues.ts` | `src/lib/runtime/tool-runner.ts` |
