# OCADE Testing

## Principle

Test the final product like a real customer, not only as isolated modules.

Every release candidate must pass static/unit/database checks and real-browser journeys on the exact production build.

## Core commands

Use the repository's current npm scripts where still relevant. As cleanup removes retired systems, simplify the script matrix instead of preserving obsolete gates.

Minimum core gates:

- install/build;
- typecheck;
- lint;
- format check;
- unit tests;
- database/migration/RLS tests;
- secret scan;
- dependency/security audit appropriate to the project;
- generated route/type stability;
- final reachability/dead-code check.

## Chat/browser matrix

Test signed-out and signed-in:

- `/` Chat;
- new conversation;
- Send triggers auth when signed out;
- Google-ready state;
- Email OTP;
- Phone country picker/OTP;
- history/search/archive/trash/restore/delete-all;
- attachments;
- mobile/desktop widths;
- back/forward/deep-link/session recovery;
- usage remaining/reset and exhaustion;
- online response;
- Offline response;
- Auto routing/fallback;
- one-line error states;
- no fake Export/Save controls when no answer exists.

Press every reachable customer control at least once in the browser audit.

## Offline Intelligence proof

Must prove with real transfer/storage behavior:

1. first preparation/download;
2. bounded parallel chunking;
3. interrupted download resumes;
4. corruption repairs only affected chunks;
5. verified model starts;
6. refresh reuses it;
7. browser restart/revisit reuses it;
8. sign-out/sign-in reuses it;
9. account deletion does not silently erase model bytes unless policy explicitly requires removal;
10. a new OCADE build/service worker/commit/merged-main deployment reuses the same compatible model;
11. explicit Remove deletes model bytes;
12. deliberate removal prevents immediate automatic reinstall until explicit Install;
13. browser eviction is detected/reported honestly;
14. `Offline` produces zero provider traffic.

Scan customer DOM/bundle/copy for forbidden raw internal model/provider identifiers.

## Usage proof

Use real/concurrent account scenarios:

- Free starts with 28 successful uses in one 388-minute window;
- PC usage is immediately reflected on another online device;
- offline reconciliation cannot exceed authoritative capacity;
- two concurrent devices cannot double-spend remaining uses;
- one user request counts once despite internal retry/tool/substeps;
- exhausted usage blocks both online and offline AI generation;
- history/Library/Settings/Billing remain available.

## Library proof

- upload image/file;
- generated output appears;
- All/Images/Files filters;
- search;
- private authorization;
- cross-device visibility;
- preview/download/delete;
- delete-all through Data Controls;
- account data export.

## Settings proof

- compact desktop modal and mobile sheet;
- appearance/preferences persist correctly;
- notification preferences sync;
- Offline Intelligence state truthful;
- Advanced hides technical detail from normal surfaces;
- Billing reflects server-authoritative state.

## UI/accessibility/performance

Cover at least 320, 375, 768, 1024, 1440 and 1920 widths where practical.

Verify:

- keyboard navigation/focus;
- skip-to-content;
- semantic labels/headings;
- reduced motion;
- 200% zoom usability;
- virtual keyboard/safe-area;
- no major layout shift;
- no continuous heavy GPU use outside explicit Jarvis visuals;
- skeleton/empty/error/toast behavior;
- OpenGraph/public metadata.

NVDA/VoiceOver/native proofs require actual supported hardware/software and are never faked.

## PLAN2 Cowork/Jarvis proof

After core is green, test:

- normal Cowork and Jarvis reach the same runtime;
- browser actions;
- computer/native actions on supported hardware;
- files;
- permissions/approvals;
- pre-observation and postcondition verification;
- Pause/Take over/Stop;
- voice STT/TTS;
- wake-word/hands-free enable/disable;
- microphone state/revocation;
- Gemini-only Jarvis offline refusal;
- donor action registry/features;
- Library output flow;
- one request = one usage unit.

## LOC measurement

Run at three checkpoints: baseline, PLAN complete, PLAN2 complete.

Prefer `cloc` over the Git-tracked source tree. Exclude:

- `node_modules` and dependency/vendor directories;
- generated build output/cache;
- binary/model archives;
- design/reference images;
- generated route/types only if excluded consistently at every checkpoint.

If `cloc` is unavailable, use a checked deterministic script that counts newline-delimited source files by approved extensions. Record exact command, included extensions, exclusions, total files and total LOC in `docs/MEMORY.md`.

Never invent a LOC number.
