# OCADE Durable Decisions

These decisions supersede older product-shape decisions unless a later explicit owner decision replaces them.

## Product shape

1. OCADE primary customer navigation is Chat, Library and Cowork.
2. Jarvis is a mode inside Cowork, not a separate primary destination.
3. Settings lives under Account.
4. `/` opens Chat directly. Signed-out users may inspect it; Send requires authentication.
5. Public retained pages are About, Help, Terms and Privacy.
6. Pricing and the old marketing landing page are removed.
7. Standalone Code, Projects, Tasks, Artifacts, Customize, Devices and Search-dashboard products are removed.
8. High-quality obsolete code is deleted rather than preserved for its own sake.

## UI

9. Supplied Grok-style screenshots under `docs/design-references/grok/` are the sole visual structural/density reference; the Stitch/Jarvis 3D reference is removed and must not return. OCADE remains independently branded and implemented.
10. Ordinary UI uses near-black/grey/white, light glassmorphism, small/medium radii, minimal borders/cards and short copy.
11. Old giant Jarvis moon/solar-system UI is deleted.
12. Advanced diagnostics/runtime plumbing is hidden under Advanced, not normal customer surfaces.

## Intelligence

13. Online customer label is `OCADE`; Offline customer label is `Offline`/`Offline Intelligence`.
14. Internal offline model is Qwen 2.5 1.5B but its real name/runtime/file/hash details are never normal customer UI.
15. Offline model is stored in browser OPFS with a model-specific manifest independent of app/build SHA.
16. A verified compatible model is reused across refresh, sign-in/out, account deletion, service-worker/app deployment, commits and merges; no redownload merely because OCADE updated.
17. Offline download uses bounded adaptive parallel chunks, resume and targeted repair.
18. Explicit Remove deletes model bytes and suppresses immediate auto reinstall until explicit Install.

## Gemini

19. Online intelligence uses one server boundary and exactly three server secret slots: primary, secondary, tertiary.
20. Keys are Supabase server/Edge secrets, never ordinary DB rows or client values.
21. Failover is primary-first and pre-output only; 429 is not rotated to evade shared quota; no failover after output begins.

## Usage

22. Free allowance remains 28 successful user requests per 388 minutes, account-wide and shared online/offline/devices.
23. One successful user request counts once; internal Cowork/Jarvis tool/model steps do not multiply the user's usage charge.
24. When allowance is exhausted, all AI generation locks; history/Library/Settings/Billing remain usable.

## Data and auth

25. Supabase Auth is the only identity authority.
26. Primary auth is Google, plus email OTP and phone OTP with international country picker; optional password may be managed under Account.
27. Supabase/PostgreSQL/private Storage is canonical persistent account content authority.
28. OPFS stores Offline Intelligence model data only.
29. Retired product-specific database objects are removed after safe dependency/data migration and RLS verification.

## Cowork/Jarvis

30. `PLAN.md` must complete before OCADE JARVIS integration.
31. There is no donor tree. The `.incoming/` archive is deleted and will not return; Cowork is written for OCADE.
32. One Cowork runtime, written in OCADE's own architecture, with capabilities built in order: browser actions, files, voice, then computer actions.
33. Normal Cowork and Jarvis share runtime, permissions, usage, tools and persistence.
34. Jarvis is voice-first/hands-free and online Gemini only for this release.
35. Coding capabilities may exist inside Cowork; no standalone Code product returns.
36. Old Cowork/Jarvis/desktop-Copilot/control runtimes are deleted, and nothing restores them.

## Process

37. Default agent modes are `/ponytail full` and `/caveman full` across fresh sessions, Auto Continue, compaction and usage resets.
38. Ponytail governs engineering work; Caveman governs only response compression. Safety/correctness and plan authority outrank both.
39. Implementation order is read → trace/scan → aggressive clean → read again → build → test → browser-prove.
40. Only `CLAUDE.md`, `PLAN.md`, `PLAN2.md`, the canonical docs listed in `CLAUDE.md`, and `docs/UI_REFERENCE_CHECKLIST.md` may remain as Markdown authorities.
41. Source LOC is measured at baseline, PLAN completion and PLAN2 completion using one consistent deterministic method; LOC is evidence, not a correctness target.
