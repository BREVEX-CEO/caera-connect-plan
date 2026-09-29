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


## Master Phase 1–49 authority

Implementation order, phase gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting follow the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves working behavior, repairs evidence-backed gaps, and continues through Phase 49.
