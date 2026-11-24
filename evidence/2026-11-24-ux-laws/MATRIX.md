# UX-01..UX-34 evidence matrix — 24 November 2026

Branch `ocade/p00-p22-implementation`. Plan 14B.4 / 14B.4A, master checklist §9.

**What ran (this machine, not staging):** a disposable local Supabase stack (`supabase@2.122.0`,
every migration applied), the site built against it and served by `wrangler dev` on
`http://127.0.0.1:8787`, synthetic accounts, Chromium desktop (1366×900) and Android emulation
(Pixel 5). Hosted CI runs the same audit signed out in Chromium, Firefox and WebKit
(`jarvis-cloud-validation.yml`, "Audit the built loopback site").

| Run | Result |
|---|---|
| `tests/web/ux_laws_audit.py`, signed out (10 pages × 2 profiles) | PASS, `ux-laws-chromium-signed-out.json` |
| `tests/web/ux_laws_audit.py`, signed in (3 routes × 2 profiles, plus every dialog, menu and disclosure they open and all six Settings categories) | PASS, `ux-laws-chromium-signed-in.json` |
| `tests/web/accessibility_audit.py`, signed in and out (axe WCAG 2.2 AA, 200% reflow, keyboard) | PASS, 0 pages with problems |
| `tests/web/surface_audit.py`, signed in (every control pressed) | PASS, 4 pages, 51 controls |

**Found and fixed by this run:**

- UX-10 Hick's Law: the JARVIS rail's navigation landmark offered 10 choices at once (destinations
  mixed with the Collapse toggle and Sign in). The landmark now holds the 8 destinations; view
  controls sit outside it.
- UX-07 Fitts's Law: the eight outcome products, "Open Devices", the Apps & Websites filter tabs
  (22 px tall), task approval buttons (Approve / Deny and stop / step resolutions), the saved-file
  actions, Chat's "Try again" / "Try with High", the Offline Mode offer, two-step "Copy key" / "Start again", the schedule "Try again", skill "Restore this text" and the staff permission chips were
  under the 24 × 24 px minimum. All now meet it (28–32 px).
- UX-30 Zeigarnik Effect: unfinished JARVIS work was visible only inside its own conversation.
  The Conversations list now marks each conversation with open work as "Needs you", "You have
  control" or "Working", from the task's own status (`src/lib/jarvis/unfinished.ts`,
  `tests/security/unfinished.test.ts`, screenshot `zeigarnik-conversations.png`).

- UX-09 Goal-Gradient: a running task now shows "N of M verified" with a progress bar that
  counts only milestones the verifier confirmed. Checked on a seeded running task (desktop and
  phone): UX-law checks and axe pass, STOP is distinct from Take over (`task-progress-stop.png`).

- Long content (plan 14B.4A item 4): an 80-character account email, a 186-character conversation
  title and a BYOK key with a 100-character gateway address and a 70-character model name cause no
  sideways scroll on Chat, JARVIS, Library, Settings > Account and Settings > BYOK, desktop or
  phone (`long-content-phone-byok.png`). On a phone, a Settings category opened by address now
  scrolls its chip into view (UX-33).

## Matrix

"Automated" names a check that fails the build when the principle regresses. "Applied in" names
the code that carries the design choice. "Human review" is what no automated check can decide;
plan 14B.4A user studies with real people remain an owner action and are not claimed here.

| ID | Principle | Applied in | Automated | Human review / N/A |
|---|---|---|---|---|
| UX-01 | Aesthetic-Usability | one token set in `src/styles.css` (light/dark, contrast-checked `--destructive`) | axe `color-contrast` in `accessibility_audit.py` | visual polish judgement |
| UX-02 | Choice Overload | outcome packages behind one "Start from a ready-made outcome" button; Settings six categories | UX-10 choice count (`ux_laws_audit.py`) | — |
| UX-03 | Chunking | Settings categories; Library filters; Help grouped answers | — | grouping quality |
| UX-04 | Cognitive Bias | neutral defaults: memory, habits and background control off until chosen; truthful model source label (`ModelSource`) | DB tests on defaults (`tests/jarvis/db`) | wording review |
| UX-05 | Cognitive Load | one composer per surface; generated forms ask only missing facts (`tests/jarvis/db/forms.test.sql`) | — | task-time study |
| UX-06 | Doherty Threshold | streamed Chat replies; optimistic toasts only after server success | document ready ≤ 1 s (`ux_laws_audit.py`); cold-load baseline (`evidence/2026-11-23-web-performance`) | perceived speed on customer hardware |
| UX-07 | Fitts's Law | 24 px minimum targets; full-row buttons in lists | target size on every page and opened view (`ux_laws_audit.py`) | — |
| UX-08 | Flow | background mode never takes focus; reduced-motion CSS (`styles.css` `prefers-reduced-motion`) | no animation > 10 ms under reduced motion (`ux_laws_audit.py`) | interruption count in real tasks |
| UX-09 | Goal-Gradient | task panel shows verified/current/pending milestones and a progress bar counted only from verified milestones (`MilestoneProgress` in `JarvisPanels.tsx`; screenshot `task-progress-stop.png`) | progress comes from `jarvis_tasks.current_step` (DB tests) | — |
| UX-10 | Hick's Law | ≤ 9 choices per navigation landmark | `ux_laws_audit.py` | — |
| UX-11 | Jakob's Law | familiar chat layout, skip link, brand links home, Escape closes dialogs | language, title, way home (`ux_laws_audit.py`); keyboard (`accessibility_audit.py`) | — |
| UX-12 | Common Region | bordered sections for each package, Settings rows, task panel | — | visual review |
| UX-13 | Proximity | delete next to its conversation; status next to the composer that it blocks | — | visual review |
| UX-14 | Prägnanz | one-column empty states; one heading per page | one h1 (`ux_laws_audit.py`) | — |
| UX-15 | Similarity | shared row and button classes (`settings/rows.tsx`) | — | visual review |
| UX-16 | Uniform Connectedness | task steps listed as one connected plan; schedule shows its runs | — | visual review |
| UX-17 | Mental Model | "Live" vs "Background" control mode spelled out under the picker; STOP / Take over named as in Help | — | first-use comprehension study |
| UX-18 | Miller's Law | ≤ 9 visible navigation choices; search in conversations, Help, Library, command palette | `ux_laws_audit.py` | — |
| UX-19 | Occam's Razor | debloat pass (`docs/DEBLOAT_REPORT.md`) | — | — |
| UX-20 | Paradox of the Active User | Chat usable at once signed out; no mandatory tutorial | `surface_audit.py` (first visit) | — |
| UX-21 | Pareto | fixes ordered by failing checks first (this run) | — | — |
| UX-22 | Parkinson's Law | schedules end by date or run count; step budgets per task | `schedules.test.sql` | — |
| UX-23 | Peak-End | verified result with Proof Passport at task end (`proof-passport.ts`) | `proof-passport.test.ts` | satisfaction study |
| UX-24 | Postel's Law | names NFC-normalised (UPLOAD-08); emails typed `email` | email/password field types (`ux_laws_audit.py`); `library-intake.test.ts` | — |
| UX-25 | Selective Attention | low Radar findings behind one disclosure; alerts use `role=alert` | — | — |
| UX-26 | Serial Position | primary action last in the composer row; New conversation first in the rail | — | — |
| UX-27 | Tesler's Law | model routing, quotas and recovery handled server-side | `model-route.test.ts`, `recovery.test.ts` | — |
| UX-28 | Von Restorff | STOP drawn in the destructive colour, unlike every other button | STOP distinct from every other button whenever visible (`ux_laws_audit.py`) | — |
| UX-29 | Working Memory | Chat keeps words typed during load; drafts kept while setup panels show | `chat_first_draft` (`accessibility_audit.py`) | — |
| UX-30 | Zeigarnik | unfinished-work labels in Conversations; unsent offline turns kept per account | `unfinished.test.ts`, `offline-journal.test.ts` | — |
| UX-31 | Visual Hierarchy | one h1; headings never skip | `ux_laws_audit.py` | — |
| UX-32 | Progressive Disclosure | outcome packages, Business-in-a-Box `<details>`, advanced BYOK fields | `opened_views` in both audits | — |
| UX-33 | Recognition over Recall | `@` mention list, command palette, "Do again" habits, recent conversations | `mentions.test.ts`, `habits.test.ts` | — |
| UX-34 | Feedback Loops | `role=status` / `role=alert` on every async control; toasts on server results | `surface_audit.py` presses every control and fails on console errors | — |

## Limits

Chromium only on this machine; Firefox and WebKit run in hosted CI. Edge Functions were not
running, so no live model task, STOP during a real task, or BYOK test was exercised here. The
automated checks are measured facts, not proof that a person finds the product easy to use.
