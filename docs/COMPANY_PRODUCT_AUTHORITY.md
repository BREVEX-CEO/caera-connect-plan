# OCADE Company and Product Authority

## Company and product

CARCC is the company. OCADE is the product.

OCADE is a global AI operating product, not only a chatbot. Its core experiences are Chat and OCADE JARVIS, supported by Library, shared Settings/Account, Help/Support and secure company operations.

## OCADE JARVIS

JARVIS is the primary execution differentiator.

It must:

- converse naturally;
- answer ordinary questions without manufacturing a task;
- perform explicit work through secure tasks;
- continue talking while working;
- use browsers, files, Office, IDEs, professional software and supported devices;
- verify results before claiming completion;
- expose simple Stop/Take Over/Continue controls;
- recover safely from interruption.

JARVIS is Online-only. Chat Offline Intelligence is a separate product authority and is never a silent fallback for JARVIS.

## Donor ownership and reuse

The preserved JARVIS source supplied by the owner is first-party donor source for OCADE. Preserve the immutable snapshot, but reuse its useful implementation aggressively in the active runtime.

The target is approximately 98% donor capability/logic reuse where safe, with deliberate replacement of obsolete GUI, direct/provider-key configuration, generic customer plugin product behavior and insecure/duplicate authorities.

Copy/adapt donor logic into active runtime files; do not cut/move or mutate the immutable donor.

## Existing-browser philosophy

OCADE does not depend on a separate customer browser add-on.

JARVIS prefers the user's existing authorized browser/profile for user-requested browser work. It may use CDP/DevTools/Playwright, semantic accessibility, OS UI Automation, vision and PyAutoGUI as a layered control stack.

The user's saved passwords/cookie databases are not extracted.

## Device philosophy

Desktop deep control uses a small trusted OCADE Device Agent. Windows normal presence is one tray icon; Android uses the floating JARVIS bubble.

The product is website/JARVIS-first. Device runtimes execute work locally under account/device/task permissions while OCADE coordinates intelligence, state and policy.

## Mobile

Android installation starts from OCADE and should feel like one OCADE product. It may use a small native companion implementation where required for real Android overlay/accessibility/background capability; customer UI avoids unnecessary implementation jargon.

iPhone/iPad remain PWA/Home Screen first and use Apple-supported Shortcuts/Siri/share/notification/Remote PC paths. Do not fake unsupported local control.

## Voice

“OCADE” and “Hey OCADE” are the wake phrases where supported. Pre-wake detection is local. OCADE's own wake model for “OCADE” and “Hey OCADE” is bundled with the Device Agent and the Android app (owner direction 2026-10-02): no download after installation, one signed manifest for install, health, update and rollback, and pre-wake audio stays on the device.

JARVIS is a partner during work: users can speak, ask status, redirect, pause, continue or stop.

## Company operations

The Owner/Staff Console inside `ocade.in` is the operations surface (owner authority 2026-10-03; `admin.ocade.in` retired).

Primary Owner, Backup Owner, Admin, Support, Billing, Developer/Operations and Read-only are distinct roles with server-side enforcement and granular permission overrides.

Normal customers never see privileged controls. Staff sees only granted modules. Owner sees Owner Console.

Privileged mutations use strong auth, reasoned audit and immediate revocation semantics.

## Deferred business integrations

Current coding mission does not wait on:

- Sentry project creation;
- payment-provider integration;
- paid leaked-password protection setting;
- public browser-store work.

These must be reported honestly as deferred/non-blocking rather than silently treated as complete.

## Product quality

Commercial readiness is measured by:

- real task success;
- security;
- account isolation;
- reliability;
- recovery;
- speed/resource use;
- clean responsive UI;
- accessibility;
- real browser/device/physical evidence;
- production/source identity.

Each implementation phase reports an evidence-based commercial-launch readiness percentage.

Never use unsupported absolute claims such as “zero bugs” or “unhackable”.

## Master execution roadmap

The canonical implementation roadmap is `PLAN.md` Phase 1–49. On a fresh clone start at Phase 1, prove current behavior, repair gaps, and continue sequentially. Product claims must follow the evidence accumulated by those phase gates.
