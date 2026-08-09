import { useCallback, useMemo, useState } from "react";
import { CreditCard, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import {
  checkoutAllowed,
  verifyWebhook,
  InMemorySeenEvents,
  LIVE_PAYMENTS_ENABLED,
  type PlanCode,
} from "@/lib/payments/provider";
import {
  applyEvent,
  emptyEntitlement,
  describeEntitlement,
  hasAccess,
  type Entitlement,
} from "@/lib/payments/entitlements";
import { PaymentProviderTwin } from "@/lib/payments/twin";
import { PLANS as PRICING_PLANS } from "@/lib/payments/pricing";

/**
 * Production owner for the payment and entitlement system (P17).
 *
 * OCADE had no payment code at all, so there was no surface to own it. This is
 * that surface — and it is deliberately explicit that nothing here can charge
 * money: the provider is the synthetic payment twin, `LIVE_PAYMENTS_ENABLED` is a
 * compile-time `false`, and `checkoutAllowed` refuses any provider claiming not
 * to be simulated.
 *
 * The panel exists to make the ENTITLEMENT RULES visible and checkable, because
 * they are the part users feel and the part that is easy to get quietly wrong:
 * cancelling should not take away time already paid for, a failed payment
 * should not cut someone off mid-sentence, and a refund should stop access at
 * once. Each button below drives the real state machine, not a mock of it.
 */

/**
 * Plan labels come from the pricing configuration, not from a list here.
 *
 * This file used to restate them, which made a third place that had to agree
 * about which plans exist and what they are called. `payments/pricing.ts` owns
 * that now; this panel owns the entitlement state machine.
 */
const PLANS: Array<{ code: PlanCode; label: string }> = PRICING_PLANS.filter(
  (plan) => plan.id !== "demo",
).map((plan) => ({ code: plan.id as PlanCode, label: plan.name }));

export function BillingPanel() {
  const [plan, setPlan] = useState<PlanCode>("month_1m");
  const [entitlement, setEntitlement] = useState<Entitlement>(() => emptyEntitlement("cus_demo"));
  const [log, setLog] = useState<string[]>([]);

  // One twin and one seen-set for the panel's lifetime, so duplicate-delivery
  // and ordering behaviour are observable across several actions.
  const provider = useMemo(() => new PaymentProviderTwin(), []);
  const seen = useMemo(() => new InMemorySeenEvents(), []);

  const say = useCallback((line: string) => setLog((l) => [line, ...l].slice(0, 8)), []);

  /** Deliver an event through the REAL webhook path, signature and all. */
  const deliver = useCallback(
    async (event: Parameters<typeof applyEvent>[1]) => {
      const { header, payload } = await provider.deliver(event);
      const verdict = await verifyWebhook({
        secret: provider.webhookSecret,
        header,
        payload,
        seen,
      });
      if (!verdict.ok) {
        say(`Webhook refused: ${verdict.reason}`);
        return;
      }
      setEntitlement((current) => {
        const result = applyEvent(current, verdict.event);
        say(result.applied ? result.reason : `Not applied: ${result.reason}`);
        return result.entitlement;
      });
    },
    [provider, seen, say],
  );

  const startCheckout = useCallback(async () => {
    const refusal = checkoutAllowed(provider);
    if (refusal && !refusal.ok) {
      say(refusal.reason);
      return;
    }
    const created = await provider.createCheckout({
      customerId: "cus_demo",
      plan,
      idempotencyKey: `demo-${plan}`,
    });
    if (!created.ok) {
      say(created.reason);
      return;
    }
    say(`Checkout ${created.checkoutId} created (simulated — no money moved).`);
    await deliver(provider.completeCheckout("cus_demo", plan));
  }, [provider, plan, deliver, say]);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const access = hasAccess(entitlement, nowSeconds);

  return (
    <GlassPanel className="p-4" data-testid="billing-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="h-4 w-4" aria-hidden />
            Subscription and billing
          </h3>
          <p className="text-xs text-muted-foreground">
            {describeEntitlement(entitlement, nowSeconds)}
          </p>
        </div>
        <span className="shrink-0 rounded bg-[color:var(--state-warning)]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--state-warning)]">
          Simulated
        </span>
      </div>

      <p className="mt-3 flex items-start gap-1.5 rounded border border-border/70 p-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Live payments are switched off in this build and cannot be enabled by configuration.
          Charging real money needs legal identity, bank verification and owner approval, none of
          which exist yet. Everything below runs against a synthetic provider.
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanCode)}
          aria-label="Plan"
        >
          {PLANS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => void startCheckout()}>
          Start checkout
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void deliver(provider.renew("cus_demo", plan))}
        >
          Renew
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void deliver(provider.failPayment("cus_demo", plan))}
        >
          Fail payment
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const r = await provider.cancelSubscription("cus_demo");
            if (!r.ok) {
              say(r.reason ?? "Nothing to cancel.");
              return;
            }
            await deliver(provider.emitted.at(-1)!);
          }}
        >
          Cancel
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Access now</dt>
          <dd>{access ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plan</dt>
          <dd>{entitlement.plan ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Events applied</dt>
          <dd>{entitlement.appliedEvents.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Live payments</dt>
          <dd>{LIVE_PAYMENTS_ENABLED ? "on" : "off"}</dd>
        </div>
      </dl>

      {log.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {log.map((l, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              {l}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
