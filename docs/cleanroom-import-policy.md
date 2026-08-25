# OCADE clean-room import policy

OCADE may study third-party codebases for externally observable product ideas and general software patterns, but source identified as leaked, unlicensed, proprietary, or otherwise not suitable for redistribution must not be copied, mass-renamed, or committed into this repository.

For the 2026-08-25 `OCADE USEBALE` archive review, the supplied archive identifies itself as leaked and unlicensed. Therefore:

- Do not commit the archive or extracted tree.
- Do not replace third-party authorship/brand names with CARCC CADANE.
- Do not copy proprietary system prompts, SDK wiring, vendor auth, telemetry, MCP, Bedrock, Vertex, or API client code.
- Reimplement useful product behaviors independently using OCADE-native architecture.
- Allowed clean-room targets include task orchestration patterns, permission checkpoints, human handoff, retry/backoff UX, usage/rate-limit state machines, subscription presentation logic, local helper/Buddy-style UX, session summaries, memory UX, and tool-execution lifecycle concepts.
- OCADE must keep browser-first/local-first inference boundaries and avoid public-cloud AI inference fallbacks.

This file records the provenance boundary so future contributors do not accidentally reintroduce unsuitable source code.