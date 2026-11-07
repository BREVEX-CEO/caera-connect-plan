# Release notes

## 0.1.0 — unreleased (pre-launch build on `ocade/p00-p22-implementation`)

Not released to customers. Qualification on real consumer computers, the owner's model choice
and the commercial launch gates (plan.md §20) are still open.

**What it does**

- Chat with Online and Offline modes, account, two-step verification and recovery.
- OCADE JARVIS: pair a computer, choose what JARVIS may use, describe a task, and follow it
  step by step with STOP, Take Over and Continue. Every result is checked by an independent
  verifier against fixed checks set before work starts.
- The companion on Windows and macOS: files, Word, Excel and PowerPoint, PDFs, images, video,
  a built-in browser bound to one site per page, desktop apps through UI Automation or
  Accessibility, commands the person confirms, and reviewed software installs.

**Security and privacy in this build**

- Credentials found in anything read on the computer are blanked before they leave it.
- Downloads keep the system's came-from-the-internet mark; the built-in browser connects
  only to addresses it checked.
- Customer content is never readable by staff except under a case or a share the customer
  starts; diagnostics carry no content.

**Known limitations**

- The Windows installer is unsigned; macOS packaging is not notarised.
- Windows script re-runs during verification have only copy-based containment.
- The offline model's licence must be recorded by the owner before distribution
  (`release/third-party-licences.json`).
- A public status page does not exist yet (docs/OPERATIONS.md §3).

**Database migrations to apply (staging first)**

All files in `supabase/migrations/` up to and including
`20261107080533_verifier_checks_ranges_and_image_changes.sql`, in name order. Each has a
rollback in `supabase/rollback/`.
