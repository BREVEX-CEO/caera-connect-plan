/**
 * P22 — simulated-runtime evidence campaign.
 *
 * WHAT "SIMULATED RUNTIME VERIFIED" IS ALLOWED TO MEAN
 * ---------------------------------------------------
 * A deterministic twin executing a real end-to-end lifecycle, driven through
 * the production modules, with real cryptography — not mocked call-assertions.
 * Here every webhook is genuinely HMAC-signed by `signWebhook` and genuinely
 * checked by `verifyWebhook`, and every entitlement transition comes from the
 * production `applyEvent`. Nothing is stubbed.
 *
 * WHAT IT IS NOT ALLOWED TO MEAN
 * -----------------------------
 * That the feature works against a real payment provider. It cannot: the twin
 * cannot move money, and live activation is a hard `false`. The tier stops at
 * 0.7 for exactly that reason.
 *
 * The campaign is deliberately narrow. Most requirements below this tier have
 * NO twin — chat, domain model and design system are pure logic, and inventing
 * a "simulation" for them would manufacture a tier rather than earn one. Only
 * subsystems with a twin that actually executes are eligible.
 *
 * Usage: npx vite-node scripts/p22-simulated-evidence.mts
 */
import { writeFileSync } from "node:fs";
import { platform, arch } from "node:os";
import {
  InMemorySeenEvents,
  checkoutAllowed,
  signWebhook,
  verifyWebhook,
  type PaymentEvent,
  type PaymentProvider,
} from "../src/lib/payments/provider.ts";
import { PaymentProviderTwin } from "../src/lib/payments/twin.ts";
import {
  applyEvent,
  describeEntitlement,
  emptyEntitlement,
  hasAccess,
  type Entitlement,
} from "../src/lib/payments/entitlements.ts";

type Status = "observed" | "skipped" | "failed";
type Step = { id: string; what: string; status: Status; detail: unknown };
const steps: Step[] = [];
function record(id: string, what: string, status: Status, detail: unknown) {
  steps.push({ id, what, status, detail });
  const mark = status === "observed" ? "OK  " : status === "skipped" ? "SKIP" : "FAIL";
  console.log(`  [${mark}] ${id}  ${what}`);
  if (status === "failed") console.log(`         ${JSON.stringify(detail).slice(0, 300)}`);
}

const DAY = 86_400;
let clock = 1_780_000_000;
const twin = new PaymentProviderTwin({ now: () => clock, webhookSecret: "p22-secret" });
const seen = new InMemorySeenEvents();
const CUSTOMER = "cus_p22";

/** Deliver an event exactly as a provider would: signed, over the wire. */
async function deliver(
  event: PaymentEvent,
  entitlement: Entitlement,
  tamper?: (payload: string) => string,
  forge = false,
) {
  const payload = JSON.stringify(event);
  const header = forge
    ? `t=${clock},v1=${"0".repeat(64)}`
    : await signWebhook(twin.webhookSecret, clock, payload);
  const verdict = await verifyWebhook({
    secret: twin.webhookSecret,
    header,
    payload: tamper ? tamper(payload) : payload,
    seen,
    nowSeconds: clock,
  });
  if (!verdict.ok) return { verdict, entitlement };
  const result = applyEvent(entitlement, verdict.event);
  return { verdict, entitlement: result.entitlement, result };
}

console.log("P22 simulated-runtime campaign — payment twin\n");

// S01 — live payments cannot be reached through a non-simulated provider.
const fakeLive = { id: "live", simulated: false, webhookSecret: "x" } as PaymentProvider;
const guard = checkoutAllowed(fakeLive);
record(
  "S01",
  "a provider claiming NOT to be simulated is refused checkout",
  guard !== null && guard.ok === false ? "observed" : "failed",
  { refusal: guard },
);

// S02 — checkout through the twin.
const checkout = await twin.createCheckout({
  customerId: CUSTOMER,
  plan: "month_1m",
  idempotencyKey: "key-1",
});
record("S02", "the twin creates a checkout", checkout.ok ? "observed" : "failed", checkout);

// S03 — a repeated idempotency key must not create a second subscription.
const repeat = await twin.createCheckout({
  customerId: CUSTOMER,
  plan: "month_1m",
  idempotencyKey: "key-1",
});
record(
  "S03",
  "a repeated idempotency key returns the SAME checkout",
  checkout.ok && repeat.ok && repeat.checkoutId === checkout.checkoutId ? "observed" : "failed",
  { first: checkout.ok && checkout.checkoutId, second: repeat.ok && repeat.checkoutId },
);

// S04 — a genuinely signed webhook grants access.
//
// `createCheckout` only opens the session; the provider emits
// checkout.completed after the user actually pays, via completeCheckout. An
// earlier draft of this harness read twin.emitted straight after checkout,
// found nothing, and carried an undefined event through the next three steps —
// which surfaced as "malformed body" refusals that looked like passes for the
// signature tests. Driving the real completion step is what makes S06 and S07
// test signatures rather than test JSON.
let ent = emptyEntitlement(CUSTOMER);
const completed = twin.completeCheckout(CUSTOMER, "month_1m");
let out = await deliver(completed, ent);
ent = out.entitlement;
record(
  "S04",
  "a correctly signed checkout.completed grants access",
  out.verdict.ok && ent.status === "active" && hasAccess(ent, clock) ? "observed" : "failed",
  { status: ent.status, periodEndsAt: ent.periodEndsAt, access: hasAccess(ent, clock) },
);

// S05 — a forged signature is refused, and the entitlement is untouched.
const before = { ...ent };
out = await deliver({ ...completed, id: "evt_forged" }, ent, undefined, true);
record(
  "S05",
  "a forged signature is refused and changes nothing",
  !out.verdict.ok &&
    out.verdict.refusal === "bad_signature" &&
    out.entitlement.status === before.status
    ? "observed"
    : "failed",
  { verdict: out.verdict },
);

// S06 — a tampered payload fails even though the signature was once valid.
out = await deliver({ ...completed, id: "evt_tampered" }, ent, (p) =>
  p.replace(CUSTOMER, "cus_attacker"),
);
record(
  "S06",
  "a tampered payload is refused",
  !out.verdict.ok && out.verdict.refusal === "bad_signature" ? "observed" : "failed",
  { verdict: out.verdict },
);

// S07 — replaying the same event id is refused.
out = await deliver(completed, ent);
record(
  "S07",
  "a duplicate delivery of the same event is refused",
  !out.verdict.ok && out.verdict.refusal === "duplicate_event" ? "observed" : "failed",
  { verdict: out.verdict },
);

// S08 — renewal extends the paid period.
clock += 30 * DAY;
const renewed = twin.renew(CUSTOMER, "month_1m");
const periodBefore = ent.periodEndsAt;
out = await deliver(renewed, ent);
ent = out.entitlement;
record(
  "S08",
  "a renewal extends the paid period",
  ent.status === "active" && (ent.periodEndsAt ?? 0) > (periodBefore ?? 0) ? "observed" : "failed",
  { before: periodBefore, after: ent.periodEndsAt },
);

// S09 — a failed payment moves to grace WITHOUT ending access.
clock += 30 * DAY;
const failed1 = twin.failPayment(CUSTOMER, "month_1m");
out = await deliver(failed1, ent);
ent = out.entitlement;
const graceFirst = ent.graceEndsAt;
record(
  "S09",
  "a failed renewal enters grace and keeps access",
  ent.status === "grace" && hasAccess(ent, clock) ? "observed" : "failed",
  { status: ent.status, graceEndsAt: ent.graceEndsAt, access: hasAccess(ent, clock) },
);

// S10 — grace must NOT be extended by each retry, or it never ends.
clock += 2 * DAY;
const failed2 = twin.failPayment(CUSTOMER, "month_1m");
out = await deliver(failed2, ent);
ent = out.entitlement;
record(
  "S10",
  "a second failure does NOT extend the grace window",
  ent.graceEndsAt === graceFirst ? "observed" : "failed",
  { firstGraceEnd: graceFirst, afterRetry: ent.graceEndsAt },
);

// S11 — grace eventually lapses.
const afterGrace = (ent.graceEndsAt ?? clock) + DAY;
record(
  "S11",
  "access lapses once grace expires",
  hasAccess(ent, afterGrace) === false ? "observed" : "failed",
  { graceEndsAt: ent.graceEndsAt, checkedAt: afterGrace, access: hasAccess(ent, afterGrace) },
);

// S12 — an out-of-order event cannot resurrect newer state.
const stale: PaymentEvent = { ...completed, id: "evt_stale", sequence: 1 };
const beforeStale = ent.status;
const staleResult = applyEvent(ent, stale);
record(
  "S12",
  "an out-of-order event is ignored",
  staleResult.applied === false && staleResult.entitlement.status === beforeStale
    ? "observed"
    : "failed",
  { applied: staleResult.applied, reason: staleResult.reason },
);

// S13 — refunding an id the provider never issued must fail loudly.
const bogusRefund = await twin.refund(CUSTOMER, "evt_does_not_exist");
record(
  "S13",
  "refunding a non-existent payment is refused",
  bogusRefund.ok === false ? "observed" : "failed",
  bogusRefund,
);

// S14 — refund revokes immediately, with no grace.
clock += DAY;
const refundOk = await twin.refund(CUSTOMER, completed.id);
const refundEvent = twin.emitted.find((e) => e.kind === "payment.refunded");
if (!refundEvent) {
  record("S14", "a refund revokes access immediately, with no grace", "failed", {
    refund: refundOk,
    reason: "the twin emitted no payment.refunded event",
  });
} else {
  out = await deliver(refundEvent, ent);
  ent = out.entitlement;
  record(
    "S14",
    "a refund revokes access immediately, with no grace",
    refundOk.ok && ent.status === "refunded" && !hasAccess(ent, clock) ? "observed" : "failed",
    {
      refund: refundOk,
      status: ent.status,
      graceEndsAt: ent.graceEndsAt,
      access: hasAccess(ent, clock),
    },
  );
}

// S15 — the message shown to a user is plain language, not a status code.
const description = describeEntitlement(ent, clock);
record(
  "S15",
  "entitlement state is explained in plain language",
  typeof description === "string" && description.length > 0 && !/^[a-z_]+$/.test(description)
    ? "observed"
    : "failed",
  { description },
);

const observed = steps.filter((s) => s.status === "observed").length;
const failed = steps.filter((s) => s.status === "failed").length;

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  phase: "P22 - simulated runtime evidence campaign",
  tier: failed === 0 ? "SIMULATED RUNTIME VERIFIED" : "PARTIAL",
  twin: { id: twin.id, simulated: twin.simulated },
  caveat:
    "Driven against a deterministic twin, with real HMAC signing and real entitlement transitions but NO real payment provider. The twin cannot move money and live payments are a hard false. This is not evidence that billing works against a real provider, and must never be reported as such.",
  scopeNote:
    "Only subsystems with a twin that actually executes are eligible for this tier. Requirements whose areas have no twin were deliberately left at their earned tier rather than given a manufactured simulation.",
  host: { platform: platform(), arch: arch(), node: process.version },
  summary: { observed, failed, total: steps.length },
  steps,
};

writeFileSync("release/OCADE_P22_SIMULATED_EVIDENCE.json", JSON.stringify(evidence, null, 2));
console.log(`\n${observed} observed, ${failed} failed of ${steps.length}.`);
console.log("Wrote release/OCADE_P22_SIMULATED_EVIDENCE.json");
if (failed > 0) process.exitCode = 1;
