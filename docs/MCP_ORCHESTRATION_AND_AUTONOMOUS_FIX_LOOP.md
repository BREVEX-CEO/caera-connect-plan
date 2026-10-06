# OCADE MCP Orchestration and Autonomous Fix Loop

## Purpose

MCP use must increase evidence quality, not create tool chaos.

The development agent is expected to work autonomously: inspect, reproduce, implement, test, observe, repair, retest, attack the fix, regress nearby surfaces, checkpoint progress and continue until the applicable release gate is met or a genuine owner/hardware/platform dependency blocks further proof.

## Surface ownership

Assign exactly one actor at a time.

- Existing Chrome: Playwright/CDP acts; Chrome DevTools observes/diagnoses.
- Clean browser compatibility: the selected Playwright engine acts.
- Windows desktop/native apps: Physical Computer Use acts.
- Android first pass: Appium acts.
- Android second pass: Mobile MCP acts after first pass releases control.
- Files: one filesystem/repo mutation authority at a time.
- Database: one mutation path at a time.
- Deployment: one deployment authority at a time.

Never race controllers.

## Health check

At the start of each wave:

- verify target exists;
- perform a minimal safe read;
- record tool state;
- record exact blocker if unavailable.

A broken tool blocks only its dependent evidence class.

## Required browser setup

For the owner's existing Chrome, prefer CDP channel connection when supported:

`npx -y @playwright/mcp@latest --cdp-endpoint=chrome --console-level warning`

Chrome remote debugging must be enabled in Chrome.

Use Chrome DevTools MCP `--autoConnect` for diagnostics.

No product requirement depends on a customer browser add-on.

## Autonomous bug loop

Every reproduced defect enters:

1. Capture exact reproduction.
2. Classify severity and affected authority.
3. Identify root cause.
4. Add/update deterministic regression.
5. Implement minimal shared-authority fix.
6. Run targeted test.
7. Run nearby integration tests.
8. Run strongest available MCP/real evidence.
9. Attempt adversarial break.
10. Run broader regression.
11. Record evidence and remaining uncertainty.

Do not:

- patch around symptoms indefinitely;
- rerun flaky tests until green;
- hide blocked evidence;
- downgrade a real failure to “test issue” without proof;
- claim success because source looks correct.

## Function/button completeness

A function/button is complete only when its visible state and backend authority agree.

For actionable UI verify:

- loading;
- enabled/disabled;
- auth/role;
- request;
- success;
- failure;
- retry;
- cancel;
- stale state;
- repeated click;
- navigation away/back;
- account switch;
- mobile/desktop layout;
- accessibility where applicable.

## PC-control proof

For each donor-adapted execution family:

- identify donor source;
- prove copied/adapted active implementation;
- test direct method;
- test fallback method where practical;
- test cancellation;
- test user takeover;
- test stale observation;
- test out-of-scope refusal;
- test real result.

Required Windows real-world wave includes Chrome, Excel, files, VS Code and a multi-app workflow.

## Android proof

Appium and Mobile MCP are independent passes.

Do not treat a Playwright mobile viewport as Android OS proof.

## Apple proof

WebKit is compatibility only.

Real Apple hardware/remote-device evidence requires a legitimate environment. Paid allocation needs owner approval.

## Long-run resilience

Before context compaction/rate limit/restart:

- commit or checkpoint durable work;
- update implementation ledger;
- record exact next unfinished item;
- record blockers separately.

On resume, continue from the next unfinished item. Do not restart completed phases.

## Cleanup loop

After functional proof:

1. run Caveman/Ponytail;
2. inspect duplicate/dead authorities;
3. consult ToRemove.md;
4. remove only proven obsolete code;
5. targeted retest;
6. real/MCP retest;
7. broader regression.

Cleanup cannot weaken capability, security, accessibility or evidence.

## Commercial readiness

After every phase give an evidence-based commercial-launch percentage.

The number may decrease if new blockers are found. It is a release-health estimate, not a promise.

100% requires all executable release gates green and only explicitly accepted external/deferred dependencies remaining.


## Current autonomous engineering loop — 2026-10-06

The coding agent should first understand the existing authority and reproduce the problem, then make the smallest root-cause change, test it, deliberately attempt to break it and simplify the resulting code. It should never respond to complexity by adding another permanent controller, another polling loop or another compatibility layer without proving that the existing authority cannot be corrected.

Ponytail-style cleanup is continuous after functionality is proven. The agent should remove as much obsolete or duplicate active implementation as safely possible, including redundant adapters, stale aliases, dead configuration, duplicated state machines, customer-facing tool-selection plumbing and unnecessary UI. There is no percentage target; the goal is the smallest proven system.

The autonomous loop should prefer event-driven completion, direct machine-native work, dynamic capability discovery and local verification. It should treat screenshot-and-click control as a fallback path, not as the normal architecture.

No automated cleanup is complete until the same real workflow, STOP behavior, failure path, security boundary and relevant platform matrix pass on the smaller tree.

## Current execution authority — 2026-10-06

This document governs autonomous implementation, diagnosis and cleanup, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail.
