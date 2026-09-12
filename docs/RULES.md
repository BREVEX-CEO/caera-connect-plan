# OCADE Non-Negotiable Rules

## Product scope

1. `PLAN.md` is the only active implementation plan.
2. `PLAN2.md` is deleted.
3. Cowork/Jarvis implementation is forbidden until the owner explicitly starts a future mission after `PLAN.md` is fully complete.
4. Cowork may remain only as a clean unavailable placeholder.

## Identity and provider privacy

5. Normal customer-facing identity is always **OCADE**.
6. Do not expose raw provider/model/runtime names in ordinary UI, assistant answers, progress, customer errors or exports.
7. Sanitize provider errors before they reach the browser.
8. Offline model vendor/model identity should not be persisted in new public tracked catalogues/customer-visible metadata where avoidable. Use opaque OCADE artifact ids.
9. Do not claim that local model bytes are impossible for a determined device owner to discover; minimise disclosure instead.

## Gemini

10. Online OCADE uses one server-side Edge Function boundary.
11. Exactly three Gemini secrets are allowed:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

12. At the Gemini deployment phase, ask the owner for exactly three keys as secrets.
13. Never commit, log, return or store those secret values in normal tables/client code.
14. Never rotate keys to evade a shared 429 quota.
15. Never fail over after provider output starts.

## Authentication

16. Supabase Auth is the only identity authority.
17. Required methods: Google, email OTP, phone OTP.
18. No custom password database.
19. Supabase cleanup must not delete existing users, identities, sessions, refresh tokens or active MFA/auth state.

## Usage

20. One successful logical user request = one use.
21. Failed generations cost zero.
22. Internal retries/fallback attempts do not add extra uses.
23. Edit→successful regenerate and Regenerate→successful answer each cost one use.
24. Free = 28 / 6h28m, no weekly cap.
25. Pro = 140 / 6h28m and 700/week.
26. Max = 1,400 / 6h28m and 7,000/week.
27. Max is exactly 10× Pro.
28. Usage is account-wide across all supported devices and online/offline paths.
29. Exhaustion blocks all generation but not history, Library, Pricing, Billing or Settings.
30. Offline use requires a signed/tamper-resistant lease; no unlimited offline bypass.

## Pricing and payment

31. Public `/pricing` must exist.
32. Approved prices remain the catalogue defined in `PLAN.md`/`PRD.md`.
33. Payment never succeeds or queues offline.
34. Manual Admin access grants never modify `auth.users` and remain separate from payment evidence.

## Offline Intelligence

35. Use the owner-approved private OCADE 0.6B runtime.
36. WebGPU-first where proven; WASM fallback.
37. Customer UI never exposes WebGPU/WASM/vendor/model terminology.
38. Customer browser does not fetch model bytes from Hugging Face/public model hosts.
39. Model distribution uses private OCADE-controlled Cloudflare R2 with opaque authorised artifact/shard delivery.
40. Persist model data through OPFS/persistent browser storage where supported.
41. Every completed model shard is checkpointed and verified; interruption must resume rather than restart from zero.
42. Ordinary site updates, deploys, commits, browser restarts and sign-in cycles do not redownload a verified compatible model.
43. If the user intentionally uninstalls Offline Intelligence, record that choice and NEVER auto-reinstall until the user explicitly requests Install.
44. If it was never installed and the user is offline, explain the connect-once requirement and retain install intent.

## Routing

45. Internet + healthy online OCADE → online OCADE.
46. Provider failure before output + Offline ready → local fallback.
47. No Internet + Offline ready → Offline Intelligence.
48. Offline mode sends zero provider traffic.
49. A successful fallback costs exactly one use total.
50. Images require online OCADE; do not pretend the local text runtime can understand images offline.

## Chat

51. `/` is Chat.
52. New Chat does not create an empty DB conversation before first Send.
53. Required controls/features are those listed in `PRD.md` and `PLAN.md`.
54. Up to 100 MB per intentionally supported attachment, with bounded total message size.

## Supabase

55. Retired schema/data/logs may be removed only after caller/evidence tracing.
56. Never delete financial, legal, auth, security or real customer evidence as “old logs”.
57. Use migrations for DDL and regenerate types after schema changes.
58. Keep RLS/least privilege correct.

## UI

59. Near-black/charcoal foundation.
60. Medium glassmorphism on high-value surfaces, not every pixel.
61. Restrained motion only; respect reduced-motion.
62. No heavy cinematic/GPU decorative scene.
63. Desktop/tablet/mobile layouts must each be intentional.

## Release

64. Every phase requires real tests and browser proof.
65. No partial merge to `main`.
66. The exact final merged tree must be the exact tree that passed final verification.