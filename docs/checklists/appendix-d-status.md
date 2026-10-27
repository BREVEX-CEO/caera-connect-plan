# Appendix D checklist status (D1.1–D13.20)

Appendix C Supplements A–J are the same lists: A = D1, B = D2, C = D3, D = D5, E = D6, F = D7, G = D9, H = D10, I = D11, J = D12; their status is the D row.

Every entry of plan.md Appendix D with its status and evidence, as of 27 October 2026 on `ocade/p00-p22-implementation`. Lists 4 and 13 repeat lists 3 and 7 and point to them, so shared work is counted once. Statuses follow plan.md: `VERIFIED PASS` was checked this cycle with the evidence named; `ALREADY VERIFIED` holds from existing code and gates; `EXTERNAL BLOCKED` needs the owner (a setting, content, credential or device); `NOT APPLICABLE` and `PAYMENTS DEFERRED` say why.

Unique entries (lists 4 and 13 excluded): ALREADY VERIFIED 108, EXTERNAL BLOCKED 17, NOT APPLICABLE 22, PAYMENTS DEFERRED 5, VERIFIED PASS 64 — 216 in all; 266 source lines.

## D1. 16 API Key Leaks to Fix on Your Vibe-Coded AI Chatbot

| ID    | Entry                     | Status           | Evidence                                                                                                                                                                           |
| ----- | ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1.1  | Keys in env variables     | ALREADY VERIFIED | Server keys are Supabase/Cloudflare secrets (`.env.example` lists names only); `audit:secrets` gate in verify:full                                                                 |
| D1.2  | .env in gitignore         | ALREADY VERIFIED | `.gitignore` ignores `.env` and `.env.*` (keeps `.env.example`); no env file tracked                                                                                               |
| D1.3  | Secret keys off frontend  | ALREADY VERIFIED | Only `VITE_SUPABASE_URL`, publishable key, VAPID public key and feature flags are public (grep of `VITE_*`); model keys live in the Edge Function                                  |
| D1.4  | Check public env vars     | ALREADY VERIFIED | Same review: no secret among `VITE_*`                                                                                                                                              |
| D1.5  | Hide service role key     | ALREADY VERIFIED | Service role is server-only (`supabaseAdmin` in `*.server.ts`); browser uses the publishable key                                                                                   |
| D1.6  | Scan your git history     | VERIFIED PASS    | Git history scanned 27 Oct for Google, OpenAI, Supabase secret/service-role, GitHub, AWS and private-key patterns: only the test placeholder `sb_secret_test_key_for_signing_only` |
| D1.7  | Rotate leaked keys        | EXTERNAL BLOCKED | A historical staging server key exposure is recorded in TOFIX; rotation is an owner action on the provider dashboards                                                              |
| D1.8  | Secret scanning on        | EXTERNAL BLOCKED | GitHub secret scanning/push protection is a repository setting (owner); Dependabot alerts are on                                                                                   |
| D1.9  | Secrets in host dashboard | ALREADY VERIFIED | Secrets are configured by name in Supabase and Cloudflare (plan §T1); never in the repo                                                                                            |
| D1.10 | Restrict key permissions  | EXTERNAL BLOCKED | Provider key scopes (Gemini, Cloudflare token) are set in provider consoles by the owner                                                                                           |
| D1.11 | Proxy calls via server    | ALREADY VERIFIED | Every model call goes through the `ocade-intelligence` Edge Function with a server-issued permit (`src/lib/intelligence/edge-handler.ts`)                                          |
| D1.12 | Check screenshots, demos  | ALREADY VERIFIED | Benchmark evidence redacts signed download tokens (`REDACTED`); no screenshot contains keys                                                                                        |
| D1.13 | Don't log secrets         | ALREADY VERIFIED | No `console.log` in server modules; edge logging carries enumerated values only (`edge-handler.ts` operation health)                                                               |
| D1.14 | Separate dev, prod keys   | ALREADY VERIFIED | Separate staging (`auyapercxxptziyngycx`) and production (`sazhgaisyhkdbrooycdv`) projects and keys                                                                                |
| D1.15 | Spending limits on keys   | EXTERNAL BLOCKED | Spending caps are set in Google/Cloudflare billing by the owner; OCADE enforces per-account allowances itself                                                                      |
| D1.16 | Never paste keys in chat  | ALREADY VERIFIED | Process rule: keys are never pasted into chats or commits; benchmarks use a disposable staging account                                                                             |

## D2. 19 Security Holes to Close on Your Vibe-Coded SaaS App

| ID    | Entry                      | Status           | Evidence                                                                                                                                                                                    |
| ----- | -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2.1  | Row level security         | ALREADY VERIFIED | RLS on every user table (owner policies, e.g. `jarvis_tasks_own`); `jarvis-schema-against-postgres` and `carry-on` tests run on PostgreSQL                                                  |
| D2.2  | Auth on every API route    | ALREADY VERIFIED | Server functions use `requireSession`; device routes verify device keys; edge function verifies JWT or server key                                                                           |
| D2.3  | Never trust the frontend   | ALREADY VERIFIED | Completion, permits, usage and permissions are decided server-side (`changeTask` evidence gate, `queueTaskAction`)                                                                          |
| D2.4  | Rate limiting              | ALREADY VERIFIED | AI use is rate-limited by server permits and allowances; Supabase Auth limits sign-in/OTP; edge WAF rules are a Cloudflare setting (owner)                                                  |
| D2.5  | Sanitize user input        | ALREADY VERIFIED | Zod validation at every server boundary; model output is rendered as untrusted data                                                                                                         |
| D2.6  | Parameterized queries      | ALREADY VERIFIED | Supabase client and RPCs only; no string-built SQL in app code                                                                                                                              |
| D2.7  | Lock down CORS             | ALREADY VERIFIED | Edge function answers CORS only for an allow-list of origins (`allowedOrigins`)                                                                                                             |
| D2.8  | HTTPS everywhere           | ALREADY VERIFIED | HSTS header on every response (site audit); production is HTTPS-only on Cloudflare                                                                                                          |
| D2.9  | Stop IDOR bugs             | ALREADY VERIFIED | Ownership checks by `user_id` in RLS and server functions; cross-account journeys (admin, carry-on "only the task's own computer, in the task's own account")                               |
| D2.10 | Debug mode off in prod     | ALREADY VERIFIED | Production build has no debug routes; source maps and dev tools not served                                                                                                                  |
| D2.11 | CAPTCHA on public forms    | EXTERNAL BLOCKED | The only public form is sign-in (Supabase Auth, rate-limited). CAPTCHA needs an owner-created Turnstile/hCaptcha site key                                                                   |
| D2.12 | Log admin actions          | ALREADY VERIFIED | Staff actions recorded in the admin audit tables; Admin journey checks the audit module                                                                                                     |
| D2.13 | Private storage buckets    | ALREADY VERIFIED | `library` bucket is private (`public = false`); downloads use short signed URLs; `content-storage:check` gate                                                                               |
| D2.14 | Hide admin pages properly  | ALREADY VERIFIED | `/admin` is guarded server-side (`requireStaff` in `beforeLoad`, staff predicates in the database), not by hiding links                                                                     |
| D2.15 | Update vulnerable packages | VERIFIED PASS    | `npm audit --omit=dev`: 0 (27 Oct); DEP-25-02 dev-only undici has no upstream fix yet                                                                                                       |
| D2.16 | Check file upload types    | ALREADY VERIFIED | Library uploads validate media type and size (`library.functions.ts`, bucket size limit 100 MB)                                                                                             |
| D2.17 | Claude security review     | ALREADY VERIFIED | Security reviews recorded in TOFIX/BLOCKED_TESTS audits A–I; independent adversarial review remains T1                                                                                      |
| D2.18 | Security headers           | VERIFIED PASS    | CSP, HSTS, COOP/COEP/CORP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, X-Frame-Options on every page (site audit 27 Oct (`b1482db`): every public page at 1440 and 360 px) |
| D2.19 | Verify webhook signatures  | NOT APPLICABLE   | No inbound webhook integrations exist (payment webhooks are deferred)                                                                                                                       |

## D3. 30 Reasons Your Site Looks Vibecoded (Part 1)

| ID    | Entry                     | Status            | Evidence                                                                                                                           |
| ----- | ------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D3.1  | Harsh gradients           | VERIFIED PASS     | `monochrome:check` gate: graphite/white palette, no gradients                                                                      |
| D3.2  | Lucide icons              | ALREADY VERIFIED  | Lucide is the one icon set (D9.10); a warning sign, not a ban                                                                      |
| D3.3  | Pure white background     | ALREADY VERIFIED  | Light theme uses the near-white token, dark theme near-black; cohesive                                                             |
| D3.4  | Rainbow coloring          | VERIFIED PASS     | `monochrome:check`                                                                                                                 |
| D3.5  | Drop shadows              | ALREADY VERIFIED  | Shadows only on floating banners/dialogs (`shadow-lg`), restrained                                                                 |
| D3.6  | 3 feature cards in a row  | ALREADY VERIFIED  | Pricing shows plan cards (owner pricing); no generic feature-card row on the landing page                                          |
| D3.7  | Emojis                    | VERIFIED PASS     | No emoji in any `.tsx` source (scan 27 Oct)                                                                                        |
| D3.8  | Liquid glass              | ALREADY VERIFIED  | `glass` utility on a few floating controls only; consistent                                                                        |
| D3.9  | Em dashes                 | ALREADY VERIFIED  | Em dashes in page titles ("Page — OCADE"); not a ban                                                                               |
| D3.10 | Inter/geist/space grotesk | ALREADY VERIFIED  | Inter (self-hosted, OFL) as one consistent typeface                                                                                |
| D3.11 | Colored left stripe       | VERIFIED PASS     | No coloured left-stripe cards (`monochrome:check`)                                                                                 |
| D3.12 | Fake testimonials         | VERIFIED PASS     | No testimonials anywhere (scan 27 Oct)                                                                                             |
| D3.13 | Bento grids               | ALREADY VERIFIED  | No bento grid                                                                                                                      |
| D3.14 | Terminal window           | ALREADY VERIFIED  | No decorative terminal window                                                                                                      |
| D3.15 | "It's not x, it's y"      | ALREADY VERIFIED  | Copy is plain and specific (owner-reviewed copy)                                                                                   |
| D3.16 | Checkmark bullets         | ALREADY VERIFIED  | Pricing feature list uses a muted check icon, functional                                                                           |
| D3.17 | 3 pricing tiers           | PAYMENTS DEFERRED | Plan cards exist; paid checkout is deferred                                                                                        |
| D3.18 | No real product demos     | EXTERNAL BLOCKED  | Real product demo media (screenshots/video of real tasks) needs the owner's approval of what to publish; no invented demo is shown |
| D3.19 | Soft corner radius        | ALREADY VERIFIED  | One radius scale from theme tokens                                                                                                 |
| D3.20 | Purple and black          | VERIFIED PASS     | No purple (`monochrome:check`)                                                                                                     |
| D3.21 | No skeleton loaders       | ALREADY VERIFIED  | Loading uses honest states and a skeleton where content loads                                                                      |
| D3.22 | Radial orbs               | ALREADY VERIFIED  | The JARVIS orb is a product control (state of JARVIS), not decoration                                                              |
| D3.23 | Dot grids                 | ALREADY VERIFIED  | No dot-grid backgrounds                                                                                                            |
| D3.24 | Sparkle icons             | ALREADY VERIFIED  | No sparkle icons                                                                                                                   |
| D3.25 | Animated arrows           | ALREADY VERIFIED  | No animated arrows                                                                                                                 |
| D3.26 | No TOS                    | VERIFIED PASS     | `/terms` with effective and last-updated date on the page (site audit 27 Oct (`b1482db`): every public page at 1440 and 360 px)    |
| D3.27 | No privacy policy         | VERIFIED PASS     | `/privacy` with effective and last-updated date on the page                                                                        |
| D3.28 | Hover animations          | ALREADY VERIFIED  | Hover changes colour only; `prefers-reduced-motion` respected                                                                      |
| D3.29 | Neon colors               | VERIFIED PASS     | No neon colours (`monochrome:check`)                                                                                               |
| D3.30 | Basic pastel colors       | VERIFIED PASS     | No pastel palette (`monochrome:check`)                                                                                             |

## D4. 30 Reasons Your Site Looks Vibecoded (Part 2)

| ID    | Entry                     | Status            | Evidence      |
| ----- | ------------------------- | ----------------- | ------------- |
| D4.1  | Harsh gradients           | VERIFIED PASS     | Same as D3.1  |
| D4.2  | Lucide icons              | ALREADY VERIFIED  | Same as D3.2  |
| D4.3  | Pure white background     | ALREADY VERIFIED  | Same as D3.3  |
| D4.4  | Rainbow coloring          | VERIFIED PASS     | Same as D3.4  |
| D4.5  | Drop shadows              | ALREADY VERIFIED  | Same as D3.5  |
| D4.6  | 3 feature cards in a row  | ALREADY VERIFIED  | Same as D3.6  |
| D4.7  | Emojis                    | VERIFIED PASS     | Same as D3.7  |
| D4.8  | Liquid glass              | ALREADY VERIFIED  | Same as D3.8  |
| D4.9  | Em dashes                 | ALREADY VERIFIED  | Same as D3.9  |
| D4.10 | Inter/geist/space grotesk | ALREADY VERIFIED  | Same as D3.10 |
| D4.11 | Colored left stripe       | VERIFIED PASS     | Same as D3.11 |
| D4.12 | Fake testimonials         | VERIFIED PASS     | Same as D3.12 |
| D4.13 | Bento grids               | ALREADY VERIFIED  | Same as D3.13 |
| D4.14 | Terminal window           | ALREADY VERIFIED  | Same as D3.14 |
| D4.15 | "It's not x, it's y"      | ALREADY VERIFIED  | Same as D3.15 |
| D4.16 | Checkmark bullets         | ALREADY VERIFIED  | Same as D3.16 |
| D4.17 | 3 pricing tiers           | PAYMENTS DEFERRED | Same as D3.17 |
| D4.18 | No real product demos     | EXTERNAL BLOCKED  | Same as D3.18 |
| D4.19 | Soft corner radius        | ALREADY VERIFIED  | Same as D3.19 |
| D4.20 | Purple and black          | VERIFIED PASS     | Same as D3.20 |
| D4.21 | No skeleton loaders       | ALREADY VERIFIED  | Same as D3.21 |
| D4.22 | Radial orbs               | ALREADY VERIFIED  | Same as D3.22 |
| D4.23 | Dot grids                 | ALREADY VERIFIED  | Same as D3.23 |
| D4.24 | Sparkle icons             | ALREADY VERIFIED  | Same as D3.24 |
| D4.25 | Animated arrows           | ALREADY VERIFIED  | Same as D3.25 |
| D4.26 | No TOS                    | VERIFIED PASS     | Same as D3.26 |
| D4.27 | No privacy policy         | VERIFIED PASS     | Same as D3.27 |
| D4.28 | Hover animations          | ALREADY VERIFIED  | Same as D3.28 |
| D4.29 | Neon colors               | VERIFIED PASS     | Same as D3.29 |
| D4.30 | Basic pastel colors       | VERIFIED PASS     | Same as D3.30 |

## D5. 20 Reasons Why Your App Looks Vibecoded

| ID    | Entry                                 | Status           | Evidence                                                                                |
| ----- | ------------------------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| D5.1  | Purple to blue gradient               | VERIFIED PASS    | `monochrome:check`                                                                      |
| D5.2  | Gradient hero text                    | VERIFIED PASS    | No gradient text                                                                        |
| D5.3  | A badge above the headline            | ALREADY VERIFIED | No badge above headlines                                                                |
| D5.4  | Three icon boxes in a row             | ALREADY VERIFIED | No three-icon-box row                                                                   |
| D5.5  | Emojis in your headings               | VERIFIED PASS    | No emoji (scan)                                                                         |
| D5.6  | Color left border cards               | VERIFIED PASS    | See D3.11                                                                               |
| D5.7  | Glassmorphism cards                   | ALREADY VERIFIED | See D3.8                                                                                |
| D5.8  | Untouched shadcn components           | ALREADY VERIFIED | Components are OCADE's own, styled to its tokens                                        |
| D5.9  | Lucide icons everywhere               | ALREADY VERIFIED | See D3.2                                                                                |
| D5.10 | Inter font everywhere                 | ALREADY VERIFIED | See D3.10                                                                               |
| D5.11 | Space Grotesk plus Instrumental Serif | ALREADY VERIFIED | Neither font is used                                                                    |
| D5.12 | Serif italics for accent words        | ALREADY VERIFIED | No serif italic accents                                                                 |
| D5.13 | Em dashes everywhere                  | ALREADY VERIFIED | See D3.9                                                                                |
| D5.14 | Generic buzzwords                     | ALREADY VERIFIED | Copy names concrete features (Online/Offline, Library, JARVIS)                          |
| D5.15 | Sections fading in as you scroll      | VERIFIED PASS    | No scroll-triggered fades (no IntersectionObserver/whileInView)                         |
| D5.16 | Cursor following line                 | ALREADY VERIFIED | No cursor-following effects                                                             |
| D5.17 | Buttons fade on hover                 | ALREADY VERIFIED | Buttons change colour on hover; no fades of content                                     |
| D5.18 | Low contrast dark mode                | VERIFIED PASS    | Rendered contrast probe, dark and light, all public pages: no text below 4.5:1 (27 Oct) |
| D5.19 | Inconsistent spacing                  | ALREADY VERIFIED | Spacing from one scale; visual journey                                                  |
| D5.20 | Grain texture                         | ALREADY VERIFIED | No grain texture                                                                        |

## D6. 20 Things You Can Tell Claude to Add to Your Website Right Now Pt.3

| ID    | Entry                      | Status           | Evidence                                                                                                                                  |
| ----- | -------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D6.1  | Dark mode toggle           | ALREADY VERIFIED | Appearance (light/dark/system) in Settings → Preferences                                                                                  |
| D6.2  | Simple cookie banner       | NOT APPLICABLE   | OCADE sets no analytics or advertising cookies; only strictly necessary storage (session, preferences). Owner/legal to confirm per market |
| D6.3  | Site search                | ALREADY VERIFIED | Help has a search over every answer (`help.tsx`); the site has seven public pages                                                         |
| D6.4  | Back to top button         | ALREADY VERIFIED | Back to top on long public pages (`PublicPage` `backToTop`)                                                                               |
| D6.5  | Mobile menu                | VERIFIED PASS    | Phone navigation drawer and wrapping public header; shell journey "the drawer opens", no overflow at 360/375                              |
| D6.6  | Loading animations         | ALREADY VERIFIED | Streaming answers, progress states and skeletons                                                                                          |
| D6.7  | Hover states               | ALREADY VERIFIED | Hover and focus-visible states on every control (`controls:check`, a11y gate)                                                             |
| D6.8  | Scroll progress bar        | NOT APPLICABLE   | Not useful on short pages                                                                                                                 |
| D6.9  | Copy button                | ALREADY VERIFIED | Copy on answers (Chat and JARVIS)                                                                                                         |
| D6.10 | Print stylesheet           | VERIFIED PASS    | Print stylesheet (`a9e0f99`): chrome hidden, black text in either theme (PDF check)                                                       |
| D6.11 | Sticky headers             | ALREADY VERIFIED | Public header is sticky                                                                                                                   |
| D6.12 | Skip to content            | VERIFIED PASS    | Skip link on public pages and JARVIS ("Skip to the message box")                                                                          |
| D6.13 | Password visibility toggle | ALREADY VERIFIED | Show/Hide password on sign-in and reset                                                                                                   |
| D6.14 | UTM tracking               | NOT APPLICABLE   | No analytics by privacy design                                                                                                            |
| D6.15 | Form success state         | ALREADY VERIFIED | Success messages (toasts, inline) on forms; auth/settings journeys                                                                        |
| D6.16 | Form error state           | ALREADY VERIFIED | Inline `role="alert"` errors on forms                                                                                                     |
| D6.17 | Confirmation modals        | ALREADY VERIFIED | Destructive actions confirm first (remove device, delete, Remove offline model); journeys                                                 |
| D6.18 | Last updated date          | VERIFIED PASS    | Last-updated dates on Privacy and Terms pages (`b1482db`)                                                                                 |
| D6.19 | Expandable FAQ             | ALREADY VERIFIED | Help answers expand/collapse (`aria-expanded`)                                                                                            |
| D6.20 | Floating contact button    | NOT APPLICABLE   | No floating contact widget (owner rule: no irrelevant widgets)                                                                            |

## D7. 20 Things to Tell Claude to Fix on Your Vibecoded Website (Image 1)

| ID    | Entry                            | Status           | Evidence                                                                                                                 |
| ----- | -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| D7.1  | Remove horizontal scrolling      | VERIFIED PASS    | Overflow 0 px at 360 and 1440 on every public page (site audit 27 Oct (`b1482db`): every public page at 1440 and 360 px) |
| D7.2  | Find broken links                | VERIFIED PASS    | All internal links resolve (crawl: 0 broken)                                                                             |
| D7.3  | Add a mobile menu                | VERIFIED PASS    | See D6.5                                                                                                                 |
| D7.4  | Add a favicon                    | VERIFIED PASS    | Favicon link and `/favicon.ico` 200                                                                                      |
| D7.5  | Fix page titles                  | VERIFIED PASS    | Every page has its own title; 404 tab says "Page not found" (`b1482db`)                                                  |
| D7.6  | Add meta descriptions            | VERIFIED PASS    | Every page has a meta description                                                                                        |
| D7.7  | Fix footer links                 | VERIFIED PASS    | Footer links resolve (crawl)                                                                                             |
| D7.8  | Add a custom 404 page            | VERIFIED PASS    | 404 status with its own page and a way back                                                                              |
| D7.9  | Fix the copyright year           | NOT APPLICABLE   | No copyright year is shown (footer says "OCADE by CARCC")                                                                |
| D7.10 | Compress images                  | ALREADY VERIFIED | Brand images 20–87 KB; lossless recompression saves ≤3 KB                                                                |
| D7.11 | Fix broken buttons               | VERIFIED PASS    | `controls:check`: no dead controls                                                                                       |
| D7.12 | Add success messages             | ALREADY VERIFIED | See D6.15                                                                                                                |
| D7.13 | Add error messages               | ALREADY VERIFIED | See D6.16                                                                                                                |
| D7.14 | Remove placeholder text          | VERIFIED PASS    | No placeholder/lorem/TODO text on public pages (crawl)                                                                   |
| D7.15 | Remove unused navigation         | ALREADY VERIFIED | Five public links, all live                                                                                              |
| D7.16 | Fix mobile overflow              | VERIFIED PASS    | See D7.1                                                                                                                 |
| D7.17 | Make the logo clickable          | VERIFIED PASS    | Wordmark links home (`aria-label="OCADE home"`)                                                                          |
| D7.18 | Make the phone number clickable  | NOT APPLICABLE   | No phone number is published                                                                                             |
| D7.19 | Make the email clickable         | EXTERNAL BLOCKED | No contact email is published until the owner activates a verified domain address (Help says so)                         |
| D7.20 | Make every page mobile optimized | VERIFIED PASS    | Mobile layouts at 360/375 across public and app journeys                                                                 |

## D8. 20 Reasons Your Website Isn't Getting You Clients

| ID    | Entry                      | Status            | Evidence                                                                               |
| ----- | -------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| D8.1  | Vague headline             | ALREADY VERIFIED  | Headline names the product and its two modes                                           |
| D8.2  | No clear audience          | ALREADY VERIFIED  | Audience: people who want AI chat and a computer agent                                 |
| D8.3  | About you, not them        | ALREADY VERIFIED  | Copy is about what the person can do                                                   |
| D8.4  | Generic service pages      | NOT APPLICABLE    | A product, not service pages                                                           |
| D8.5  | Five competing buttons     | ALREADY VERIFIED  | One primary action per screen (Ask / Sign in)                                          |
| D8.6  | Button says "Submit"       | VERIFIED PASS     | No "Submit" buttons (scan)                                                             |
| D8.7  | Long contact form          | NOT APPLICABLE    | No contact form                                                                        |
| D8.8  | No proof up top            | EXTERNAL BLOCKED  | Proof needs real, owner-approved results to publish                                    |
| D8.9  | Testimonials without names | NOT APPLICABLE    | No testimonials                                                                        |
| D8.10 | No case studies            | EXTERNAL BLOCKED  | Case studies need real customers (pilot, T1)                                           |
| D8.11 | No reviews visible         | NOT APPLICABLE    | No reviews shown; none invented                                                        |
| D8.12 | No real photos             | EXTERNAL BLOCKED  | Real photos are owner content                                                          |
| D8.13 | Hidden contact details     | EXTERNAL BLOCKED  | See D7.19                                                                              |
| D8.14 | No guarantee               | NOT APPLICABLE    | No guarantees (owner rule: no unsupported claims)                                      |
| D8.15 | Fake urgency timers        | VERIFIED PASS     | No urgency timers                                                                      |
| D8.16 | No price range             | PAYMENTS DEFERRED | Prices shown by the owner; checkout deferred                                           |
| D8.17 | Objections never answered  | ALREADY VERIFIED  | Help answers common questions (privacy, offline, devices, billing)                     |
| D8.18 | No free first step         | ALREADY VERIFIED  | Free plan and Chat without an account                                                  |
| D8.19 | Tiny buttons on mobile     | VERIFIED PASS     | Footer/auth targets now ≥24 px (`b1482db`); remaining small ones are inline text links |
| D8.20 | Slow replies to leads      | NOT APPLICABLE    | No lead pipeline                                                                       |

## D9. Website Redesign Checklist (Feels Expensive)

| ID    | Entry               | Status           | Evidence                               |
| ----- | ------------------- | ---------------- | -------------------------------------- |
| D9.1  | One font pair       | ALREADY VERIFIED | One typeface (Inter) with weights      |
| D9.2  | Two brand colours   | ALREADY VERIFIED | Graphite/white plus one accent         |
| D9.3  | More white space    | ALREADY VERIFIED | Generous spacing (visual journey)      |
| D9.4  | Bigger headlines    | ALREADY VERIFIED | Clear headline scale                   |
| D9.5  | Real photos         | EXTERNAL BLOCKED | Owner content                          |
| D9.6  | Consistent spacing  | ALREADY VERIFIED | See D5.19                              |
| D9.7  | Grid alignment      | ALREADY VERIFIED | Centered column grid                   |
| D9.8  | One CTA per section | ALREADY VERIFIED | See D8.5                               |
| D9.9  | Consistent buttons  | ALREADY VERIFIED | Button variants from one component     |
| D9.10 | One icon set        | ALREADY VERIFIED | Lucide only                            |
| D9.11 | Real testimonials   | NOT APPLICABLE   | None invented                          |
| D9.12 | Shorter paragraphs  | ALREADY VERIFIED | Short paragraphs on public pages       |
| D9.13 | 5-link menu         | VERIFIED PASS    | Exactly five public links              |
| D9.14 | Darker text         | VERIFIED PASS    | Contrast probe: body text ≥4.5:1       |
| D9.15 | Mobile layout fixed | VERIFIED PASS    | See D7.20                              |
| D9.16 | Feels expensive     | ALREADY VERIFIED | Restrained monochrome identity (owner) |

## D10. Systems Check / Launch Poll (03/15 Systems Check)

| ID     | Entry                 | Status            | Evidence                                                                                                                                                                              |
| ------ | --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D10.1  | Mobile tested         | VERIFIED PASS     | Mobile journeys at 360/375; Android device BLOCKED                                                                                                                                    |
| D10.2  | All links             | VERIFIED PASS     | See D7.2                                                                                                                                                                              |
| D10.3  | Contact form          | NOT APPLICABLE    | No contact form                                                                                                                                                                       |
| D10.4  | Loads < 3s            | VERIFIED PASS     | Local build: LCP ≤0.43 s desktop, ≤1.6 s on throttled 4G + 4× CPU (27 Oct); production CDN timing is T1                                                                               |
| D10.5  | Images                | ALREADY VERIFIED  | See D7.10                                                                                                                                                                             |
| D10.6  | HTTPS                 | ALREADY VERIFIED  | See D2.8                                                                                                                                                                              |
| D10.7  | Chrome + Safari check | EXTERNAL BLOCKED  | Chrome PASS; Safari/WebKit not installable in this environment                                                                                                                        |
| D10.8  | No typos              | VERIFIED PASS     | codespell 2.4.3, 27 Oct, over src/components, src/routes, src/jarvis UI, src/lib, jarvis-runtime and public: 0 typos (16 hits, all code names, regexes or the MLT "shotcut" property) |
| D10.9  | WhatsApp button       | NOT APPLICABLE    | No WhatsApp button                                                                                                                                                                    |
| D10.10 | Domain email          | EXTERNAL BLOCKED  | See D7.19                                                                                                                                                                             |
| D10.11 | Analytics             | NOT APPLICABLE    | No analytics by privacy design                                                                                                                                                        |
| D10.12 | Google index          | ALREADY VERIFIED  | `robots.txt` and `sitemap.xml` served; indexing is external                                                                                                                           |
| D10.13 | Link preview          | VERIFIED PASS     | Open Graph and Twitter card on every page with a 1200×630 image                                                                                                                       |
| D10.14 | Backups               | EXTERNAL BLOCKED  | Database backups/PITR are a Supabase project setting (owner)                                                                                                                          |
| D10.15 | Payments              | PAYMENTS DEFERRED | Payments deferred                                                                                                                                                                     |

## D11. 20 Things to Have Claude Do So Your App Doesn't Get Sued

| ID     | Entry                                     | Status            | Evidence                                                                                                  |
| ------ | ----------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| D11.1  | Add a privacy policy                      | VERIFIED PASS     | See D3.27                                                                                                 |
| D11.2  | Add terms of service                      | VERIFIED PASS     | See D3.26                                                                                                 |
| D11.3  | Add a refund policy                       | PAYMENTS DEFERRED | Refund policy belongs with payments                                                                       |
| D11.4  | Add a cookie policy                       | NOT APPLICABLE    | No non-essential cookies (see D6.2); storage is described in the Privacy notice                           |
| D11.5  | Add a cookie consent banner               | NOT APPLICABLE    | See D6.2                                                                                                  |
| D11.6  | Check your form consents                  | ALREADY VERIFIED  | Sign-up requires accepting Terms and Privacy (legal-consent gate)                                         |
| D11.7  | Don't collect unnecessary data            | ALREADY VERIFIED  | Data classes documented and minimised (`src/lib/account/data-classes.ts`)                                 |
| D11.8  | Audit your third-party SDKs               | ALREADY VERIFIED  | Third parties: Supabase, Google sign-in, Google Gemini, Cloudflare (named in the Privacy notice)          |
| D11.9  | Remove dark patterns                      | ALREADY VERIFIED  | No dark patterns; owner rule                                                                              |
| D11.10 | Remove hidden fees                        | PAYMENTS DEFERRED | No fees until payments                                                                                    |
| D11.11 | Remove fake reviews                       | VERIFIED PASS     | No reviews                                                                                                |
| D11.12 | Remove unsupported claims                 | ALREADY VERIFIED  | Owner rule: no unsupported claims; legal copy pending owner/legal review                                  |
| D11.13 | Add accessibility alt text                | VERIFIED PASS     | No image without alt on public pages (crawl)                                                              |
| D11.14 | Fix your color contrast ratio             | VERIFIED PASS     | See D5.18                                                                                                 |
| D11.15 | Add keyboard navigation                   | ALREADY VERIFIED  | a11y gate and keyboard journeys (skip links, focus-visible, dialogs)                                      |
| D11.16 | Add your business details                 | EXTERNAL BLOCKED  | Registered address/registration details are owner/legal content (Privacy says they are not yet published) |
| D11.17 | Get age consent if you collect kids' data | ALREADY VERIFIED  | Terms §3: 16+; 16–17 conditions                                                                           |
| D11.18 | Add an unsubscribe link to your emails    | NOT APPLICABLE    | No marketing email; notification emails are transactional with Settings controls                          |
| D11.19 | License any fonts and images you use      | ALREADY VERIFIED  | Inter (SIL OFL), own brand images, MIT notices for DeepSeek                                               |
| D11.20 | Add a data deletion request option        | ALREADY VERIFIED  | Settings: download data, delete files/conversations/account                                               |

## D12. 20 Things to Have Claude Do Before Launching Your Website

| ID     | Entry                              | Status           | Evidence                                      |
| ------ | ---------------------------------- | ---------------- | --------------------------------------------- |
| D12.1  | Add a privacy policy page          | VERIFIED PASS    | See D3.27                                     |
| D12.2  | Add a terms and conditions page    | VERIFIED PASS    | See D3.26                                     |
| D12.3  | Get your secrets off the front end | ALREADY VERIFIED | See D1.3                                      |
| D12.4  | Force HTTPS                        | ALREADY VERIFIED | See D2.8                                      |
| D12.5  | Add a cookie consent banner        | NOT APPLICABLE   | See D6.2                                      |
| D12.6  | Add meta titles and descriptions   | VERIFIED PASS    | See D7.5–7.6                                  |
| D12.7  | Add a social preview image         | VERIFIED PASS    | See D10.13                                    |
| D12.8  | Add a favicon                      | VERIFIED PASS    | See D7.4                                      |
| D12.9  | Generate a sitemap and robots.txt  | VERIFIED PASS    | Both served (crawl)                           |
| D12.10 | Add alt text to your images        | VERIFIED PASS    | See D11.13                                    |
| D12.11 | Compress your images               | ALREADY VERIFIED | See D7.10                                     |
| D12.12 | Check your page load speed         | VERIFIED PASS    | See D10.4                                     |
| D12.13 | Fix your color contrast            | VERIFIED PASS    | See D5.18                                     |
| D12.14 | Make it mobile friendly            | VERIFIED PASS    | See D7.20                                     |
| D12.15 | Add a custom 404 page              | VERIFIED PASS    | See D7.8                                      |
| D12.16 | Fix any broken links               | VERIFIED PASS    | See D7.2                                      |
| D12.17 | Add form validation                | ALREADY VERIFIED | Inline validation on sign-in, reset, settings |
| D12.18 | Add spam/bot protection            | EXTERNAL BLOCKED | See D2.11                                     |
| D12.19 | Set up analytics                   | NOT APPLICABLE   | See D10.11                                    |
| D12.20 | Add one clear call to action       | ALREADY VERIFIED | See D8.5                                      |

## D13. 20 Things to Tell Claude to Fix on Your Vibecoded Website (Image 2)

| ID     | Entry                            | Status           | Evidence      |
| ------ | -------------------------------- | ---------------- | ------------- |
| D13.1  | Remove horizontal scrolling      | VERIFIED PASS    | Same as D7.1  |
| D13.2  | Find broken links                | VERIFIED PASS    | Same as D7.2  |
| D13.3  | Add a mobile menu                | VERIFIED PASS    | Same as D7.3  |
| D13.4  | Add a favicon                    | VERIFIED PASS    | Same as D7.4  |
| D13.5  | Fix page titles                  | VERIFIED PASS    | Same as D7.5  |
| D13.6  | Add meta descriptions            | VERIFIED PASS    | Same as D7.6  |
| D13.7  | Fix footer links                 | VERIFIED PASS    | Same as D7.7  |
| D13.8  | Add a custom 404 page            | VERIFIED PASS    | Same as D7.8  |
| D13.9  | Fix the copyright year           | NOT APPLICABLE   | Same as D7.9  |
| D13.10 | Compress images                  | ALREADY VERIFIED | Same as D7.10 |
| D13.11 | Fix broken buttons               | VERIFIED PASS    | Same as D7.11 |
| D13.12 | Add success messages             | ALREADY VERIFIED | Same as D7.12 |
| D13.13 | Add error messages               | ALREADY VERIFIED | Same as D7.13 |
| D13.14 | Remove placeholder text          | VERIFIED PASS    | Same as D7.14 |
| D13.15 | Remove unused navigation         | ALREADY VERIFIED | Same as D7.15 |
| D13.16 | Fix mobile overflow              | VERIFIED PASS    | Same as D7.16 |
| D13.17 | Make the logo clickable          | VERIFIED PASS    | Same as D7.17 |
| D13.18 | Make the phone number clickable  | NOT APPLICABLE   | Same as D7.18 |
| D13.19 | Make the email clickable         | EXTERNAL BLOCKED | Same as D7.19 |
| D13.20 | Make every page mobile optimized | VERIFIED PASS    | Same as D7.20 |
