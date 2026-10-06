# OCADE UI Reference Checklist

Use this checklist for material UI work.

## Global

- calm OCADE visual language;
- black/white/charcoal/silver;
- blue active, green success, red destructive;
- no implementation jargon;
- no fake metrics;
- no unnecessary card walls;
- dark/light;
- reduced motion;
- keyboard/focus;
- 360/375/tablet/desktop;
- no horizontal overflow.

## JARVIS

- real-data orb/graph;
- clean idle state;
- readable conversation state;
- truthful active-task state;
- Stop;
- Take Over;
- Continue;
- voice while working;
- status answers based on current task;
- no fake progress.

## Browser

- customer sees understandable task/control state;
- human auth handoff;
- no customer add-on requirement;
- existing-browser task tested;
- download/upload result states.

## Windows

- no required floating desktop mini-control;
- one tray identity;
- clear status;
- Open OCADE;
- STOP;
- Pause/Resume where meaningful;
- Exit.

## Android

- matching OCADE floating bubble;
- chat;
- voice;
- task status;
- STOP;
- Open full JARVIS;
- Needs permission state;
- safe edge snap/restore.

## Owner/Staff

- Owner Console only for Owner;
- Staff Console only for granted staff;
- customers see neither;
- modules hidden when not permitted;
- search;
- loading/error/empty;
- audit/action confirmations;
- 2FA/recent-auth states.

## Storage/update

- deployment does not visually trigger Offline model reinstall;
- explicit Remove state is clear;
- repair/download progress truthful.

## Verification

For each changed screen capture real screenshots, inspect spacing/clipping/overflow/focus/loading/error and rerun after cleanup.


## Current visual acceptance checklist — 2026-10-06

Every changed screen should prove the simplified design rather than merely matching an old screenshot. Verify that the primary action is obvious, secondary controls are not competing for attention, rounded geometry is consistent, loading does not jump the layout, errors are distinguishable from empty states, and touch/keyboard/reduced-motion behavior remains complete.

For JARVIS, verify conversation, real-data Orb/threads, task status, STOP/Take Over, Conversations and Devices. Verify that Activity is not duplicated unnecessarily and that Allowed Apps is not presented as a major customer surface once contextual permission replacement is active.

For Android, verify the one-button setup path, each return from an Android-owned permission screen, the final Ready state, Wake, STOP, Remove device and the floating bubble in both collapsed and expanded mini-chat states.

For performance-sensitive visuals, verify that hidden or secondary panels do not remain unnecessarily mounted, the Orb does not perform unbounded work, and animation remains optional rather than required to understand state.

## Current execution authority — 2026-10-06

This document governs visual and interaction acceptance, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail.
