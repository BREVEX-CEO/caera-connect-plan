# Local-stack signed-in surface and accessibility audit — 21 November 2026

**What ran (this machine, not staging, not hosted CI):**

- A disposable local Supabase stack (`supabase@2.122.0 start`, Postgres 17.11 image, Auth,
  REST, Realtime, Storage; Edge Functions, Studio and analytics not started). Every migration in
  `supabase/migrations` applied in order on the real Supabase Postgres 17 image.
- The site built against that stack and served by `wrangler dev` on `http://127.0.0.1:8787`.
- Synthetic accounts only (`audit-a@example.test`, `audit-webkit@example.test`), signed in with
  `tests/web/session.mjs` and injected into the browser as `surface_audit.py` does.

**Results:**

| Audit | Chromium | Firefox | WebKit |
|---|---|---|---|
| `surface_audit.py`, signed in (desktop + phone emulation; every control pressed) | PASS, 4 pages, 47 controls | PASS, 4 pages, 45 controls | PASS, 4 pages, 45 controls (own account; see note) |
| `accessibility_audit.py`, signed out (10 pages) | PASS | PASS | PASS |
| `accessibility_audit.py`, signed in (3 routes and the views their dialogs, menus and disclosures open) | PASS | PASS | PASS |

**Found and fixed in this run:** the light theme's destructive colour (Delete buttons in Settings)
was 4.35:1 against the muted rows, under WCAG 1.4.3's 4.5:1 (axe `color-contrast`, found only
after opening Settings). `--destructive` is now `oklch(0.52 0.2 25)`: 4.9:1 on the rows, 6.1:1
on white. Re-audited in all three engines afterwards.

**Note:** a third browser signed in to one account meets the two-desktop device cap, and the
refused registration logs a 400 in the console (the product shows the device-limit message).
Each engine therefore used an account within the cap; this is the cap working, not a defect.

**Limits (not claimed):** a local stack is not staging; Edge Functions (Chat, BYOK, JARVIS
planner) were not running, so no model answer, BYOK test or JARVIS task was exercised; axe and
the keyboard/reflow checks are automated facts, not WCAG conformance, and not a substitute for
people using assistive technology (plan 14B.4A user studies remain an owner action).
