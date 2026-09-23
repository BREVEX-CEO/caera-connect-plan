# OCADE UI Reference Checklist

Use this before declaring a UI change complete.

## Brand

- [ ] Confirm that the product name shown to customers is OCADE.
- [ ] Confirm that company attribution says CARCC where appropriate.
- [ ] Confirm that no current CARCC CADANE or CADANE identity remains.
- [ ] Tagline, where used, is “Command the Next Era.”

## Product scope

- [ ] Current navigation does not advertise Projects, Tasks, Automations, Monitors, Organizations, Code or native apps.
- [ ] Cowork, if present, is only a clean reserved placeholder.
- [ ] Confirm that no Paddle or live-checkout UI is present.

## Chat

- [ ] Chat is primary home.
- [ ] Auto | Online | Offline labels are clear.
- [ ] Thinking/Research controls remain secondary.
- [ ] Send ↔ Stop state is obvious.
- [ ] Edit/Regenerate/Retry/Delete work without duplicate turns.
- [ ] Helpful / Not helpful is discreet.
- [ ] Confirm that sources stay attached to the answer they support.
- [ ] Highlighted text can support Ask OCADE when implemented.
- [ ] Temporary Chat is clearly temporary.

## Offline

- [ ] Confirm that customer UI does not expose provider, model, runtime or storage terminology.
- [ ] Preparing/Downloading/Verifying/Ready/Repair/Removed language is customer-safe.
- [ ] Removed state offers easy Install/Cancel.
- [ ] Selecting Offline while missing offers Install.
- [ ] Cellular warning allows Continue/Cancel.
- [ ] Offline refuses image input clearly.
- [ ] Site update does not cause a visible model redownload for unchanged release.

## Library

- [ ] Uploaded and generated files share one Library concept.
- [ ] Temporary attachments are not silently saved.
- [ ] Confirm that loading, empty, error and Retry states exist where needed.

## Settings

- [ ] Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, Advanced.
- [ ] Phone category selector is compact.
- [ ] Fields/labels stack rather than crush on narrow screens.
- [ ] Confirm that Offline controls live under Data Controls.
- [ ] Billing honestly says paid plans are not open.

## Public pages

- [ ] Confirm that About correctly describes CARCC as the company and OCADE as the product.
- [ ] Confirm that Help links only to real product surfaces.
- [ ] Confirm that Terms and Privacy match the current website-only product.
- [ ] Confirm that non-public and account-only routes use appropriate noindex behavior.
- [ ] Confirm that HTTP and www requests canonicalize to the HTTPS apex origin.

## Responsive

- [ ] Test the interface at 360 px width.
- [ ] Test the interface at 375 px width.
- [ ] Test the interface at a representative tablet width.
- [ ] Test the interface at a representative desktop width.
- [ ] Confirm that no page has horizontal overflow.
- [ ] Confirm that no critical action depends on hover alone.
- [ ] Confirm that touch targets remain usable.

## Accessibility

- [ ] Confirm keyboard navigation and focus behavior.
- [ ] Confirm correct dialog semantics.
- [ ] Confirm that interactive controls have accessible names.
- [ ] Confirm sufficient visual contrast.
- [ ] Confirm reduced-motion behavior.
- [ ] Confirm meaningful live and error status announcements.

## Technical secrecy

- [ ] Confirm that no provider, vendor or model name appears in visible UI.
- [ ] Confirm that OPFS, model file formats, WebGPU, WASM, R2 and Supabase jargon do not appear in normal UI.
- [ ] Confirm that no secret or internal stack error is shown to customers.
