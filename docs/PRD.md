# OCADE Product Requirements

## Product

OCADE combines:

- Chat;
- OCADE JARVIS;
- Library;
- shared Settings/Account;
- Help/Support;
- privileged Owner/Staff operations.

## Chat

Chat remains the protected conversational product with its approved Online/Auto/Offline behavior.

Offline Chat model installations must survive deployments/merges and avoid unnecessary redownload.

## JARVIS

JARVIS is Online-only.

It answers ordinary questions conversationally and turns explicit work requests into secure tasks.

It remains conversational while working. Users can ask status, redirect, pause, continue or stop.

## Browser work

JARVIS uses the user's existing authorized browser/profile where appropriate.

No customer browser add-on is required.

It can navigate, use tabs, download/upload scoped files, use existing sessions, hand auth challenges to the user and stop before final payment.

## PC work

With Device Agent, JARVIS can use:

- browsers;
- Office;
- files;
- IDEs;
- terminal/Git;
- installed apps;
- professional software;
- screen/system controls.

Windows normal desktop presence is tray-only.

## Excel

Excel is a first-class work target. JARVIS should solve workbook tasks intelligently using formulas/structured operations instead of repetitive manual entry, preserve existing workbook quality and verify important results.

## Voice

Hey OCADE is supported where platform permits.

Wake is local before activation. JARVIS can converse while executing.

## Android

OCADE install starts from `ocade.in`.

Mobile can provide full JARVIS UI, floating bubble, voice, task status/STOP, supported Android app control and Remote PC.

## Apple

iPhone/iPad use PWA/Home Screen + Apple-supported integrations + Remote PC.

macOS uses Device Agent once real platform support is proven.

## Owner/Staff

Primary Owner and granted staff receive privileged consoles based on server-side roles/permissions.

Customers never see privileged UI/data.

## Privacy/security

- no provider identity/keys exposed;
- no saved-password extraction;
- human auth boundaries respected;
- sensitive actions confirmed;
- no final purchase;
- screenshots transient by default;
- scoped files;
- server/RLS authorization;
- audit privileged mutations.

## Quality

No capability is called complete until real evidence exists.

Visual polish, accessibility, performance, recovery and account isolation are product requirements, not optional QA.

Each phase reports commercial-launch readiness percentage.

## Current product requirements — 2026-10-06

OCADE is a web-first conversational work system whose defining behavior is verified completion rather than screen clicking. The user states the outcome. OCADE decides whether the request is informational or executable, identifies the correct device and work context, chooses the fastest legitimate control route, performs deterministic work locally where possible, verifies the actual result and reports truthfully.

Universal application support must come from dynamic capability discovery rather than hard-coded support lists. The required route order is documented/native API, local scripting or CLI/object model, verified direct file/project operation, browser structured control, operating-system semantic/accessibility control and finally live vision with fresh coordinates when no stronger route exists.

The product must minimize setup and visible options. Customers do not choose control engines. Android setup is one guided action. Deep PC control uses a small trusted local broker while the website remains the primary product. The product must stay conversational while work is running and always preserve visible STOP/Take Over.

Commercial readiness requires reproducible real workflows, independent postcondition verification, preserved user work, clear failure states, measured latency and resource use, account isolation, secure updates, accessibility and honest platform boundaries.

## Current execution authority — 2026-10-06

This document governs product requirements, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail, and implementation must keep only the strongest proven path rather than preserving obsolete alternatives for compatibility.
