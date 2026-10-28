# Route and control qualification matrix — 28 October 2026

Starting source `71e8b637a5f723a33593a39f73d6cccd3573e945`; `src/routeTree.gen.ts` exposes **21 full paths from 23 route source files**, including root/layout modules. Generated route content was read, not edited. The auth route's navigation target is `/auth`, with `/auth/` as its full-path entry. Settings and Devices are panels, not invented route families.

This is the discovered **route** census. Per-button/menu/dialog/input/shortcut census, runtime route discovery, state coverage and authored-test bijection are **INCOMPLETE/BLOCKED**, not PASS. Owner: OCADE principal engineering team. Historical stub journeys are not current browser qualification. Every row needs positive/negative/auth/permission/loading/empty/error/cancel tests as applicable, keyboard/screen-reader review, responsive widths 320/375/768/1024/1440 and zoom 200/400 before R6 can pass.

| Generated full path | Source | Control census | Current exact-candidate qualification |
| --- | --- | --- | --- |
| `/` | [source](../../src/routes/index.tsx) | INCOMPLETE | BLOCKED |
| `/about` | [source](../../src/routes/about.tsx) | INCOMPLETE | BLOCKED |
| `/help` | [source](../../src/routes/help.tsx) | INCOMPLETE | BLOCKED |
| `/ocade-jarvis` | [source](../../src/routes/ocade-jarvis.tsx) | INCOMPLETE | BLOCKED |
| `/pricing` | [source](../../src/routes/pricing.tsx) | INCOMPLETE | BLOCKED |
| `/privacy` | [source](../../src/routes/privacy.tsx) | INCOMPLETE | BLOCKED |
| `/reset-password` | [source](../../src/routes/reset-password.tsx) | INCOMPLETE | BLOCKED |
| `/robots.txt` | [source](../../src/routes/robots[.]txt.ts) | API/distribution contract pending | BLOCKED |
| `/sitemap.xml` | [source](../../src/routes/sitemap[.]xml.ts) | API/distribution contract pending | BLOCKED |
| `/terms` | [source](../../src/routes/terms.tsx) | INCOMPLETE | BLOCKED |
| `/admin` | [source](../../src/routes/_authenticated/admin.tsx) | INCOMPLETE | BLOCKED |
| `/library` | [source](../../src/routes/_authenticated/library.tsx) | INCOMPLETE | BLOCKED |
| `/agent/$file` | [source](../../src/routes/agent.$file.ts) | API/distribution contract pending | BLOCKED |
| `/auth/callback` | [source](../../src/routes/auth.callback.tsx) | INCOMPLETE | BLOCKED |
| `/auth/challenge` | [source](../../src/routes/auth.challenge.tsx) | INCOMPLETE | BLOCKED |
| `/auth/verify` | [source](../../src/routes/auth.verify.tsx) | INCOMPLETE | BLOCKED |
| `/auth/` | [source](../../src/routes/auth.index.tsx) | INCOMPLETE | BLOCKED |
| `/api/jarvis/continue` | [source](../../src/routes/api/jarvis/continue.ts) | API/distribution contract pending | BLOCKED |
| `/api/jarvis/device` | [source](../../src/routes/api/jarvis/device.ts) | API/distribution contract pending | BLOCKED |
| `/api/jarvis/enroll` | [source](../../src/routes/api/jarvis/enroll.ts) | API/distribution contract pending | BLOCKED |
| `/api/offline/bytes/$release` | [source](../../src/routes/api/offline/bytes.$release.ts) | API/distribution contract pending | BLOCKED |

| Additional surface | Source owner | Current disposition |
| --- | --- | --- |
| Account/Settings panel | `src/components/settings/settings-panel.tsx` and section components | BLOCKED; full control/state census pending |
| Devices, Websites, Apps & Access panels | `src/jarvis/JarvisPanels.tsx` | BLOCKED; pairing/revoke/STOP/permission/native effects pending |
| Global shell / errors / navigation | `src/components/shell/AppShell.tsx`, `src/routes/__root.tsx` | BLOCKED; keyboard/mobile/error states pending |
| Exact/auth no-cache handling | `public/sw.js` | 20 exact-source mocked cloud cases PASS; real-browser lifecycle BLOCKED |

No statement here certifies that every UI control was inspected or that undiscovered dynamic surfaces cannot exist. See [test evidence](TEST_EVIDENCE.md) and [source dispositions](SOURCE_CROSSWALK.md).
