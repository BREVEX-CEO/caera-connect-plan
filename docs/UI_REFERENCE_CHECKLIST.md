# UI Reference Checklist

This document records the lightweight production UI details to preserve during the simplified OCADE rebuild. Apply items only where they are useful; do not add controls just to satisfy the checklist.

## Core checklist

- [ ] Dark mode toggle
- [ ] Cookie banner only if optional cookies/tracking require consent
- [ ] Back-to-top control only on long Help/About/Terms/Privacy content
- [ ] Mobile menu / chat-first drawer
- [ ] Keyboard shortcuts
- [ ] Clear hover and focus states
- [ ] Polished, unobtrusive scrollbar
- [ ] Copy buttons where users commonly copy text/code/links
- [ ] Skeleton loaders for real loading states
- [ ] Sticky header/shell only where it improves navigation
- [ ] Skip-to-content accessibility link
- [ ] OpenGraph/social preview metadata
- [ ] Clean empty states
- [ ] Expandable FAQs only on Help/About content where useful
- [ ] Toast notifications for short success/error feedback
- [ ] Password visibility control wherever password fields exist

## OCADE rebuild design rules

- Keep customer-facing UI extremely simple: Chat, Library, Cowork with Jarvis mode, Account/Settings.
- Use the uploaded Grok screenshots as the primary reference for density, spacing, left-sidebar position, compact settings, near-black/grey/white palette, restrained glass morphism, small/medium radii and minimal visible text.
- Use the Stitch Jarvis reference only as a visual/reference source for the Cowork/Jarvis redesign; do not treat its code as product authority.
- Keep OCADE branding and original product assets. References are for structure, spacing and interaction quality, not copied third-party branding/assets.
- Hide technical model/provider/runtime names from normal customers. Offline model details remain internal; customer-facing labels are OCADE / Offline Intelligence only.
- Prefer progressive disclosure: advanced diagnostics, device/runtime details and developer information stay inside Advanced settings.
- Every visible control must work, be intentionally disabled with a short truthful reason, or be removed.
- Prioritize performance: batch independent fetches, maintain required database indexes, cap unbounded reads, optimize images and split oversized bundles/routes where beneficial.
