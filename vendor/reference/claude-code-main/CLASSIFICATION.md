# Authorized donor archive classification

This directory records the supplied `claude-code-main.zip` without redistributing it. The archive was inspected locally and bound to the SHA-256 digest in `manifest.json`.

## Licence and provenance boundary

The archive's root `package.json` identifies it as unofficial leaked source and declares `UNLICENSED`. That conflicts with the master directive's condition that source be retained only when licence terms permit. The binary and extracted source are therefore excluded from Git. OCADE may implement the requested behavior independently, but this repository does not copy or publish the archive's proprietary source.

## Functional classification

The useful behavioral areas identified for independent OCADE implementation are:

- task lifecycle and local agent-loop state;
- deterministic cancellation and child-process termination;
- permission requests, scoped approval, and protected-field refusal;
- terminal viewport, history, keyboard, and persistent-session behavior;
- local file read/write/edit and command execution receipts;
- streaming tool execution, retry, recovery, and abort propagation;
- task planning, observation/action/verification sequencing, and resume;
- session history and local memory compaction;
- Docker/build isolation patterns and local server ergonomics.

Representative archive locations inspected included `src/tasks`, `src/tools`, `src/services/tools`, `src/ink`, `src/utils/abortController.ts`, `src/utils/combinedAbortSignal.ts`, `src/utils/commandLifecycle.ts`, and `src/assistant/sessionHistory.ts`.

## Explicitly excluded

No code or configuration is imported from `mcp-server`, `src/bridge`, `src/remote`, provider API/auth services, telemetry/analytics, feedback upload, provider update/install logic, hosted model routing, original provider prompts, original GitHub coupling, Vercel/Railway deployment, or provider-branded Chrome/MCP paths.

## OCADE integration rule

Any resulting implementation must use OCADE's local inference boundary, OCADE permission model, local native/browser executors, and OCADE identity. A feature is credited only after its OCADE implementation is executed and tested; this classification is not runtime proof.
