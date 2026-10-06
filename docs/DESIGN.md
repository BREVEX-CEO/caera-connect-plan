# OCADE Design System

## Goal

OCADE should feel calm, premium, fast and technically powerful without looking like a hacker console or movie prop.

## Palette

Primary: black, white, charcoal, silver.

Blue: active/enabled/listening/selected.
Green: success.
Red: destructive/error/security warning.

Use restrained glass and subtle depth. Keep normal product surfaces clean.

## JARVIS

The 3D orb/graph is the distinctive JARVIS visual anchor.

It grows from real conversations, JARVIS memory, tasks, devices, apps/projects and meaningful relationships. Do not fake stored graph relationships.

During conversation/task content, reduce orb emphasis for readability.

Voice uses the same orb.

## Desktop

Customer product remains web-first.

Windows device execution is represented by one tray identity, not a required floating desktop mini-control.

Active task UI in the web surface shows truthful status, Stop and Take Over.

## Android

The floating JARVIS bubble is a real mobile control surface.

Collapsed: restrained OCADE identity.

Expanded: chat, voice, current task/progress, STOP, Open full JARVIS.

Complex settings/account management stay in the main OCADE UI.

## Owner/Staff

Owner/Staff Console may be denser than customer UI but still uses clean OCADE hierarchy, search and progressive disclosure.

Role-specific account-menu labels:

- Owner Console;
- Staff Console.

Customers see neither.

## States

Every action/button supports coherent:

- idle;
- hover/focus;
- loading;
- disabled;
- success;
- error;
- permission required;
- stopped/cancelled.

Do not display fake percentages or statuses.

## Accessibility

- keyboard navigation;
- visible focus;
- reduced motion;
- semantic graph alternatives;
- sufficient contrast;
- no color-only state;
- touch-friendly mobile controls.

## Responsive

Prove 360/375 phone, tablet and desktop.

No horizontal overflow.

Mobile keyboard must not cover essential controls.

## Implementation language

Do not expose internal terms such as provider names, CDP, Playwright, PyAutoGUI, MCP, Supabase or Cloudflare to normal customers.

Customer errors explain what happened and what the user can do next.


## Current visual direction — 2026-10-06

The interface should be materially simpler than the current control surface. The dominant visual language is calm, premium and conversational, using a small consistent set of soft rounded rectangles, pill or semi-circular compact controls, rounded composers, rounded task cards, rounded mobile sheets and restrained borders or shadows. Do not reproduce another product's exact trade dress; use the same principles of low cognitive load, strong hierarchy and comfortable geometry.

The JARVIS screen should emphasize conversation, the real-data Orb and threads, the current task state and persistent STOP/Take Over. Secondary data should appear progressively rather than occupying permanent panels. Conversations and Devices remain useful destinations, while Activity should fold into task/history where practical and Allowed Apps should disappear as a major navigation concept after contextual permission and automatic discovery safely replace it.

Every asynchronous surface must distinguish loading, ready, empty, error and blocked states. Use skeleton or progressive rendering only when it prevents layout movement or communicates useful progress. Failed server reads must never masquerade as empty data, and animation must never be required to understand task state, permissions or errors.

Mobile design is the reference for simplicity rather than a reduced desktop copy. Touch targets, bottom sheets, keyboard avoidance, safe-area handling, text zoom, reduced motion and no hidden hover-only actions are release requirements.

## Current execution authority — 2026-10-06

This document governs the visual system and responsive product behavior, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail, and implementation must keep only the strongest proven path rather than preserving obsolete alternatives for compatibility.
