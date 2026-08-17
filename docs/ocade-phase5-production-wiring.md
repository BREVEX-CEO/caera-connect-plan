# OCADE Phase 5 — Production Wiring Evidence

This file records the historical Phase-5 debt that originally produced the **77 SOURCE COMPLETE / not production-wired requirements**. The completion rule is stricter than “the file exists” or “a unit test imports it”: a live module must be transitively reachable from a production entry point, or the capability must have an explicit production-owned replacement/retirement that remains fail-closed.

Run:

```bash
npm run ocade:phase5-check
```

The checker excludes test/spec files from its import graph and verifies the dispositions below.

| Historical module | Disposition | Production owner / chain |
|---|---|---|
| `src/lib/research/research-run.ts` | production-wired | authenticated OCADE Lab → `ResearchPanel` → `runResearchQuery` server function → research pipeline |
| `src/lib/research/http-source.ts` | production-wired | authenticated OCADE Lab → `ResearchPanel` → `runResearchQuery` → HTTP source fetcher |
| `src/lib/research/research-cache.ts` | production-wired | authenticated OCADE Lab → `ResearchPanel` → `runResearchQuery` → research cache |
| `src/lib/research/source-fallback.ts` | production-wired | authenticated OCADE Lab → `ResearchPanel` → `runResearchQuery` → `runResearch` → fallback planner |
| `src/lib/mobile/secure-channel.ts` | production-wired | authenticated Mobile settings → mobile transport factory → secure channel |
| `src/lib/mobile/transport-adapters.ts` | production-wired | authenticated Mobile settings → mobile transport factory → transport adapters |
| `src/lib/mobile/reconnect-protocol.ts` | production-wired | authenticated Mobile settings → mobile transport factory → reconnect protocol |
| `src/lib/providers/free-tool-adapters.ts` | production-wired | authenticated OCADE Lab → `AppCoveragePanel` → tool prober → free-tool adapters. Browser execution correctly reports BLOCKED when no process runner exists. |
| `src/lib/code/generated-sandbox-node.ts` | production-wired | authenticated generated-sandbox server function → dynamically imported Node sandbox host with network/resource ceilings |
| `src/lib/packaging/update-signature.ts` | replaced / release-retired | production desktop owner is Tauri `tauri-plugin-updater`, which verifies signed updates against the configured public key. Public desktop release and download remain disabled during free launch, so the older TypeScript verifier is not misrepresented as a live updater path. |

## CI ownership

The source gate also requires these workflows to remain tracked:

- `.github/workflows/ci.yml`
- `.github/workflows/platforms.yml`
- `.github/workflows/ocade-77-readiness.yml`

## What this proves

A passing Phase-5 gate proves that the historical test-only wiring debt has a current source-level production disposition: **9 live production chains + 1 explicit native replacement/retirement = 10/10 materially resolved**.

It does **not** prove that GitHub hosted jobs ran successfully on the current head, that a production Supabase deployment matches source, that physical-device behavior passed, or that a signed/notarized desktop package exists. Those remain separate evidence layers and must never be inferred from source reachability.
