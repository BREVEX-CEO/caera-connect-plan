# OCADE Claude Mission Kickoff

Paste the instruction below into Claude after placing `PLAN.md`, `CLAUDE.md`, and the mission documents in the repository.

```text
Execute the OCADE mission in this repository.

Read completely before substantial work:
1. CLAUDE.md
2. PLAN.md
3. docs/mission/OCADE_EXECUTION_STATE.md
4. docs/mission/OCADE_PAYMENT_SUPPORT_REFUNDS_AND_ADMIN_GRANTS.md

Do not rewrite PLAN.md into a weaker replacement plan.

Start by fetching and inspecting the latest repository state, preserving unknown work, and creating the one clearly named isolated mission branch required by PLAN.md.

This is a continuous implementation mission, not an audit.

Do not voluntarily stop while any reachable PLAN.md requirement remains. Continue READ → TRACE → CLASSIFY → IMPLEMENT → RUN → TEST → BREAK → DIAGNOSE → FIX → RETEST → INTEGRATE → BROWSER-PROVE → VERIFY, then move directly to the next unfinished requirement.

Use real browser control/automation to debug the actual site. Investigate and fix console errors, network errors, runtime failures, broken flows, responsive problems, accessibility failures, and incorrect postconditions. Rerun the exact failed journey after each fix.

Use already-authorized Supabase and Cloudflare access for inspection/debugging without repeatedly asking for permission. Obey PLAN.md side-effect rules: inspection is allowed, but do not deploy to Cloudflare while PLAN.md forbids deployment.

Do not finish with “not proven”, “not verified”, or “not done” when another repository-controlled engineering route, focused test, fixture, harness, simulator, or diagnostic can solve or prove it. Genuine external blockers must fail closed, name the exact dependency and evidence required, and must not stop unrelated reachable work.

Do not create duplicate authorities. Preserve, repair, consolidate, and extend the existing canonical implementation.

Keep docs/mission/OCADE_EXECUTION_STATE.md current so Auto Continue/context/usage resets resume from the exact unfinished action instead of restarting.

Use clean, descriptive file, branch, migration, test, evidence, and final commit names. Never use gibberish or random source names.

Treat payments, refunds, fraud controls, entitlements, usage, MFA, admin grants, RLS, and destructive actions as safety-critical. A redirect never grants a paid plan. Only authoritative server verification may activate provider-paid access. Manual Pro/Max/custom access without payment must use a separate audited admin-grant authority, never a fake transaction or arbitrary client-editable profile field.

Do not make implementation commits. Do not make the sole final product commit, integrate main, push, or conclude until the COMPLETE PLAN.md has been reread against the final tree and every reachable final gate passes together.

Then create the one final verified commit, reconcile with the latest origin/main, fast-forward main safely, push without force, and verify the remote SHA and tested tree.

Begin from the current repository state and continue until the whole reachable PLAN.md mission is complete.
```