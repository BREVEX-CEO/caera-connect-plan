# Problem Radar and Outcome Autopilot — local-stack browser evidence, 23 November 2026

**What ran (this machine, not staging, not hosted CI):** a disposable local Supabase stack
(`supabase@2.122.0 start`, Postgres 17 image; every migration in `supabase/migrations` applied,
including `20261123090000_a_schedule_can_end_by_date_or_run_count.sql`), the site built against
it and served by `wrangler dev` on `http://127.0.0.1:8787`, synthetic accounts only, Chromium.

| Check | Result |
|---|---|
| `tests/web/radar_autopilot_flow.py` (add obligations, Radar findings and dismissal, schedule with run count then end date; desktop 1366×900 and phone 390×844) | PASS, no console errors |
| axe WCAG 2.2 AA serious/critical on the LifeOS panel with Radar open, and on the schedule form | none |
| Sideways scroll, desktop and phone | none |
| `tests/web/accessibility_audit.py`, signed in (3 routes) and signed out | PASS, 0 pages with problems (JSON here) |
| `tests/web/surface_audit.py`, signed in, desktop and Android emulation | PASS, 4 pages, 51 controls |

**Account erasure and stored files (PRIVACY-01):** `tests/web/account_erasure_storage.mjs` ran
the real `eraseAccount` on the same stack for a synthetic account holding one Library object:
`{"before":1,"pendingFiles":0,"objectsAfter":0,"rowsAfter":0,"identityGone":true}`.

**Found and changed during the run:** the Radar listed every low-severity finding in full, so
four cards pushed the LifeOS list below the fold for three obligations. Low findings now sit
behind one "N more worth a look" disclosure (Selective Attention, Progressive Disclosure).

**Limits:** not staging; Edge Functions were not running; Chromium only for the new flow; no
person using assistive technology took part.
