# OCADE Billing, Plans, Payments, and Global Commerce

## Plan model

- OCADE plans should grant access to both Chat and JARVIS rather than forcing customers to purchase two unrelated subscriptions.
- Chat and JARVIS may still maintain distinct server-side allowances because their resource profiles differ.
- The free plan preserves the owner-approved 28-use model for the relevant account-wide allowance.
- Paid plan presentation should be clean: show the plan name, a useful percentage/bar, and reset/limit information only where it matters.

## Pricing principles

- Pricing should be understandable in the customer's market and currency.
- The owner's preference for prices ending in 28 may be used where it remains sensible and does not create confusing converted prices.
- Converted/local prices may be rounded to commercially clean values instead of performing awkward exact FX conversion at every checkout.
- Purchasing-power or local-market pricing may be introduced later only with abuse prevention and stable country/billing rules.

## Country and anti-abuse behavior

- IP/geolocation may suggest a country, but it is not sufficient authority for billing or entitlement decisions.
- The customer confirms billing country where required.
- Verified billing/payment-country information, account history, processor signals, and reasonable anti-abuse checks should prevent VPN-only manipulation of local prices or entitlements.
- A VPN should not automatically move an existing subscription to a different country or price.
- Country changes that materially affect tax, payment method, or price should be deliberate and auditable.

## Payment architecture

- OCADE must not collect or store raw payment-card numbers directly.
- Card entry should use payment-provider hosted/tokenized secure components.
- OCADE stores only provider references and permitted metadata needed for support/operations.
- Customers can maintain one primary payment method initially for simplicity.
- Customers can update their payment method through a provider-backed secure flow.
- Receipts and invoices should be delivered automatically and remain downloadable where supported.

## Taxes

- OCADE should support automated tax handling through the payment provider or Merchant of Record where practical.
- The application must show whether tax is included or added before payment when required.
- Business customers may provide tax/VAT/GST identifiers when relevant and supported.
- India GST or any other jurisdictional tax rule must follow current verified legal/accounting requirements. The software must not encode an owner's unverified revenue threshold as a permanent legal rule.
- Tax functionality can remain disabled until required, but the architecture should not block later compliant activation.

## Subscription lifecycle

- Paid subscriptions should normally remain active through the end of the paid period after cancellation unless a different legally compliant plan rule is clearly disclosed.
- Cancellation must be straightforward, with clear warnings and access-end date.
- Failed payments use provider-backed retry/dunning behavior and a defined grace period rather than immediately deleting the account.
- Price changes require advance notice according to applicable rules and product terms.
- Annual plans may offer a discount.
- Lifetime plans are not part of the initial strategy.
- Student, referral, local payment, and promotional programs may be added later when abuse and accounting are controlled.

## Refunds and disputes

- Owner/authorized Billing staff may issue provider-backed full or partial refunds where supported.
- Refunds and disputes automatically reconcile entitlement according to policy without deleting financial history.
- Chargebacks/disputes surface in the owner dashboard.
- High-risk entitlement may be restricted during an active dispute according to a documented fraud policy.
- Customers may request review of an AI/JARVIS usage charge through support.
- Failed or no-result AI/JARVIS work should reconcile usage automatically where the usage authority defines it as non-chargeable.

## Local payment methods

- OCADE may support UPI and other local payment methods when the selected provider can support the required payment/subscription lifecycle correctly.
- Local payment methods should not be added merely for marketing if they create inconsistent subscription recovery, refund, or fraud behavior.
- EU VAT, US sales tax, GST, and other obligations should use provider/tax-service support where appropriate rather than ad-hoc manual calculations.

## Reporting

- Owner dashboard displays original transaction currency and a base reporting currency.
- Financial exports should support CSV and later accounting integrations where useful.
- Invoice numbering and finalized financial event history are immutable. Corrections use credit/refund/adjustment events.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
