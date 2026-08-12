# ADR 0001 — Ship OCADE only; FICIA, MADEE and CANIA become placeholders

## Status

Accepted, 2026-08-06. Supersedes the four-product framing in the landing copy.

## Context

The repository shipped four products behind one shell: OCADE (AI assistant), FICIA
(workforce, timesheets, messenger), MADEE (resume builder) and CANIA (market
intelligence). Only OCADE was close to working.

What the other three actually cost:

- **34 routes** of dashboards populated with placeholder figures. A page showing an
  invoice total reads as working software whether or not the number means anything.
- **196 of 231 lint warnings**, almost all `any` over employee and timesheet data —
  untyped personal records in a multi-tenant schema.
- A **privacy settings screen** offering storage controls for four data classes
  (`resumes`, `company`, `timesheets`, `accounting`) that nothing could write. A switch
  with no wire behind it is worse than a missing switch: it invites someone to believe
  they have configured where their company records are stored.
- **DB-01**, a high-severity defect: a migration commenting on `ficia_time_entries`,
  a table no migration creates, so the schema could not rebuild from zero.
- Demo-mode copy directing visitors to "open FICIA to see a sample company workspace".

Three options were considered.

1. **Finish all four.** Not achievable, and would have meant shipping employee data
   handling that was never designed to a standard anyone would accept.
2. **Delete the routes.** Breaks every existing link and bookmark, and frees the names
   to be taken by something else later.
3. **Keep the route, remove the product, say so.**

## Decision

Option 3. Each of the three keeps exactly one route rendering a shared `ComingLater`
screen that says **"Coming later — not an AI model."** Their sub-routes, components,
server functions, registry entries, navigation and demo tiles are removed.

The sentence is specific for a reason. Someone arriving from OCADE reasonably assumes
every tile in this product is another assistant. These were a workforce tool, a document
tool and a market-data tool — saying "not an AI model" is the part that stops a person
waiting for a reply that will never come.

Database migrations are **kept**. The tables exist in the hosted project and dropping
them would destroy data that is not ours to destroy.

## Consequences

**Good**

- Lint warnings fell from 231 to 0; the remaining `any` over personal data went with the
  code that held it.
- ~13,000 lines removed.
- DB-01 became fixable in a way it had not been: the orphan table belongs to a product
  that no longer ships, so the comment could be made conditional rather than the table
  reconstructed without its RLS policies. Fixing it then exposed DB-02, which had been
  hidden behind it because the migration twin stops at the first failure.
- The privacy screen now lists only data classes that can exist.

**Costs and risks**

- The three names are reserved but unbuilt. If they are never built the placeholders are
  permanent furniture, and a placeholder that never resolves eventually reads as neglect.
- Restoring one means rebuilding from the placeholder outward. The deleted screens are in
  git history, but they were not good enough to restore verbatim — that is why they were
  removed.
- The migrations remain for tables no code reads, so the schema is larger than the
  product. Accepted deliberately: an unused table is harmless, and deleting a user's data
  to tidy a schema is not.
