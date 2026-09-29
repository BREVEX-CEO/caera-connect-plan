# OCADE Billing and Global Commerce — Deferred Implementation Authority

## Current status

Payment-provider implementation is deliberately deferred from the active JARVIS/device/admin coding mission.

Do not block current engineering work on selecting or integrating a provider.

Do not show fake live billing operations in Owner/Staff Console. Payment-specific modules remain hidden until a real provider is selected and connected.

## Preserved business rules

When payment work resumes:

- one OCADE subscription may cover Chat and JARVIS according to plan allowances;
- Chat and JARVIS may retain separate server-side usage ledgers;
- provider-hosted/tokenized payment entry is required;
- OCADE never stores raw card numbers or CVV/CVC;
- refunds/reversals append history rather than rewriting it;
- invoices/receipts and webhook-driven state are provider-backed;
- tax/local-currency behavior follows current verified provider/legal requirements;
- local methods such as UPI are added only when the chosen provider supports the required lifecycle safely.

## Current owner/admin behavior

Until payment work resumes:

- hide payment-specific dashboard modules/actions that have no real backend;
- do not seed fake revenue/payment metrics;
- entitlement/usage/customer operations that already have real OCADE authority may continue independently.

## Deferred owner decisions

Later:

- payment provider/Merchant of Record;
- tax/accounting treatment;
- refund policy details;
- local payment methods;
- pricing-country rules;
- public paid checkout launch.

These are not current coding blockers.

## JARVIS payment boundary

JARVIS may research products and prepare non-sensitive information but never completes final purchase/payment.

## Testing

When payment work resumes, add provider sandbox/webhook/refund/dunning/dispute tests plus real Owner/Staff permission and audit tests before exposing modules.

Commercial-launch readiness reporting must state payment scope truthfully rather than pretending deferred work is complete.

## Master Phase 1–49 authority

Implementation order, phase entry/exit gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting are governed by the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves current working behavior, repairs gaps proven by current evidence, and continues sequentially through Phase 49. This document supplies domain-specific requirements and does not replace a phase gate.
