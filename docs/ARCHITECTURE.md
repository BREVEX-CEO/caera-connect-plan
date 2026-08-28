# OCADE — Current Production Architecture

Version: 2026-08-23
Brand authority: src/config/company-facts.ts
Machine-checked boundaries: docs/boundaries.json

This document describes the reachable production design. Passing source tests
does not prove that an external service, signed installer, store release, model
mirror, or physical device is live.

## Product boundary

OCADE BY CARCC CADANE is a browser-first, local-first AI workspace. Normal Chat
does not require Python, Ollama, or a public-cloud model API. The browser selects
WebGPU when supported and keeps WASM as its compatibility path. Optional desktop
runtimes may improve capability, but are not a website prerequisite.

No OpenAI, Anthropic, Gemini, Lovable AI Gateway, OpenRouter, Groq, Mistral,
Together, DeepSeek API, or other hosted model is a fallback for ordinary Chat.
Supabase identity/private sync, Cloudflare delivery, OAuth, public information
retrieval, and static model hosting are network services, not AI inference.

## Runtime map

User requests enter the browser workspace and its canonical prompt compiler. The
compiler routes inference to WebGPU, WASM, or an optional loopback-only local
runtime through the OCADE Native Companion. It never routes inference to a
public-cloud model.

The browser can separately reach encrypted local storage, the safe offline
shell, optional Supabase Auth/Private Sync, public current-information
retrieval, and the permissioned Cowork extension. Retrieved files and pages are
wrapped as untrusted evidence before local reasoning. Cowork and native actions
remain outside the inference path and have their own confirmation boundaries.

## Browser Chat

The browser owns the conversation UI, projects, files, search, outputs,
attachments, citations, draft state, model preparation, and streaming controls.
Documents are extracted and reduced locally before selected passages enter the
prompt. File/page/project text is wrapped as untrusted content and cannot replace
the canonical system prompt.

The engine router prefers a compatible WebGPU model. If WebGPU is unavailable,
the browser may select the packaged WASM tier. A missing or corrupt model produces
a named preparation/error state; it must not silently send the prompt to a cloud
model.

Production model redistribution remains a separate release gate. A source
manifest or test is not evidence that immutable model files, Range requests,
licence approval, and CDN digests are live.

## Current-information retrieval

Current-information search sends only the user's bounded search query to the
declared retrieval service. Selected public pages are fetched as evidence, marked
untrusted, and passed to the local inference engine. Citations point to retrieved
sources; the system must not fabricate a source when retrieval fails.

Retrieval is therefore networked data acquisition, not remote AI inference.
Credentials from authenticated sites are outside this generic path and require a
separately authorized connector or user-controlled browser session.

## Cowork browser control

Cowork is separate from Chat. The MV3 extension can observe or act only on a site
the user approved and only after the OCADE origin establishes its bridge. The
production externally-connectable origins are https://ocade.in/* and
https://www.ocade.in/*; local and approved preview origins exist for testing.

Every proposed action is previewed and risk-classified. Pause, STOP, take-over,
fresh-state observation, planted-failure handling, and independent readback are
part of the proof boundary. Passwords, OTPs, CAPTCHAs, CVV/PIN values, and
recovery codes are protected inputs: automation stops and hands control to the
user rather than reading, storing, inferring, or typing them.

Mobile browsers do not pretend to provide the desktop MV3 extension. Unsupported
mobile Cowork actions must say that desktop/native support is required.

## Optional native computer control

The OCADE Native Companion is the only runtime with operating-system authority.
Its Tauri shell and Rust safety crate enforce allowlists, protected-input refusal,
confirmation tiers, STOP latching, and audit redaction. The browser communicates
with it through the explicit companion bridge; absence of the process is a named
unavailable state.

Web readiness, Windows runtime proof, signed Windows distribution, macOS
signing/notarization, Android hardware, iOS/TestFlight, and extension-store review
are separate claims. One does not imply another.

Compatibility identifiers such as Rust crate names, mobile bundle identifiers,
database values, and storage keys may retain legacy strings when changing them
would break installed data or protocols. They are not current public branding.

## Storage, Private Sync, and authentication

Local browser storage is the default workspace path. Sensitive vault material is
encrypted before IndexedDB persistence. The service worker never caches API,
authentication, or server-function responses.

Supabase provides ordinary account authentication and optional user-scoped
Private Sync. Row-level security and account-linked consent/deletion receipts
must be proven against the real production project before launch. This checkout
contains migrations and tests, but no accessible Supabase project was returned in
the current session, so live migration/RLS/auth is externally blocked.

## Offline behavior

The PWA caches only the application shell and explicitly safe static assets.
After a successful first load and model preparation, local conversations and
eligible queued work can continue offline. Authentication transitions, API
responses, privileged data, and arbitrary cross-origin responses are never
replayed from cache. Network-only retrieval and Private Sync report that they are
unavailable rather than simulating success.

## Edge delivery and launch gate

Cloudflare Worker time owns the release decision. Production opens only when:

1. server time is at or after 2026-08-28T02:58:00Z; and
2. OCADE_LAUNCH_READY is exactly true after the real preflight.

The clock alone cannot launch an unhealthy build. Before release, /, /auth,
and product routes remain 503 with noindex. Three factual pages
(/company, /founder/haans-antoni, /products/ocade) plus their exact brand
assets, restrictive robots file, and sitemap may remain crawlable. These pages do
not expose authenticated application data or claim incorporation that has not
occurred.

## Security boundaries

| Boundary                         | Enforced outcome                                              |
| -------------------------------- | ------------------------------------------------------------- |
| Service-role database credential | Constructed server-side only; never in the browser graph      |
| Untrusted file/page content      | Wrapped as evidence; cannot override the system prompt        |
| Local runtime                    | Loopback only                                                 |
| Browser action                   | Approved origin, site permission, preview, confirmation, STOP |
| Protected input                  | Never read, stored, inferred, or typed                        |
| Offline cache                    | No auth/API/server-function response caching                  |
| Private Sync                     | User-scoped access under real RLS                             |
| Hosted-model dependencies        | Source gate rejects public-cloud inference paths              |

## Platform truth table

| Surface    | Source path                      | What source can establish                       | What still needs separate live evidence                 |
| ---------- | -------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Web Chat   | React/TanStack plus WebGPU/WASM  | Local inference routing, UI, offline rules      | Real model CDN/licence/digest and production generation |
| Web Cowork | MV3 extension bridge             | Permission and safety contracts                 | Built-extension run and store publication               |
| Windows    | Tauri plus Rust plus Python host | Safety code, build configuration, Windows tests | Signing, installer lifecycle, final physical-PC proof   |
| macOS      | Tauri source                     | Config and compile-target intent                | macOS build, signing, notarization, physical Mac        |
| Android    | Capacitor source                 | Mobile UI/package configuration                 | Signed AAB and real Android hardware                    |
| iOS        | Capacitor/Xcode source           | iOS project and assets                          | Mac toolchain, signing, TestFlight, real iPhone/iPad    |
| Supabase   | migrations/types/tests           | Intended schema, RLS, auth flows                | Real project apply and adversarial live RLS             |
| Cloudflare | Worker config/build              | Gate and deploy configuration                   | Authorized deployment ID/hash and production smoke      |

## Ownership and compatibility

docs/boundaries.json maps every src/lib area to an owner, declares external
hosts, and records browser/Worker/native runtime restrictions. Its assertions run
in src/lib/**tests**/governance-artefacts.test.ts.

Shared schema and protocol surfaces are versioned and fail closed on mismatch.
Stable storage keys and compatibility identifiers are changed only with an
explicit migration, never as a cosmetic brand replacement.
