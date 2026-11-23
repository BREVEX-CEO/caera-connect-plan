# Signed-out website audits in Chromium, 23 November 2026 (source `b27d225b`)

Built and served exactly as the CI audit job does: `VITE_SUPABASE_URL=http://127.0.0.1:54321`,
`VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder`, `npm run build`, then
`npx wrangler dev --ip 127.0.0.1 --port 8787 --local`; Chromium 1243 from `/opt/pw-browsers`.

| Audit | File | Result |
| --- | --- | --- |
| `tests/web/surface_audit.py --pwa` | `surface-chromium.txt` | PASS: 12 pages desktop and Android emulation, 134 controls on 9 routes, first-visit script 902,739 of 950,000 bytes |
| `tests/web/objective_handoff.py` | `handoff-chromium.txt` | PASS: 4 of 4 cases |
| `tests/web/accessibility_audit.py` (axe WCAG 2.0–2.2 A/AA, 200% reflow, keyboard focus) | `a11y-chromium.txt` | PASS: 10 pages, 0 with problems |

Limits: signed out only, Chromium only (Firefox and WebKit run in the hosted job), no assistive
technology user. Signed-in routes need the local Supabase stack audit.
