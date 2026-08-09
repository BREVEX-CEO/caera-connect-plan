import { useMemo, useState } from "react";
import { Check, Infinity as InfinityIcon, Cloud, Monitor, AlertTriangle } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PLANS,
  CLOUD_ALLOWANCE,
  CLOUD_WINDOW_MS,
  describePrice,
  priceFor,
  currencyForRegion,
  detectRegion,
  missingProductIds,
  type CurrencyCode,
  type PlanId,
} from "@/lib/payments/pricing";

/**
 * What OCADE costs, from the one configuration that owns the numbers.
 *
 * THREE PLAN LISTS USED TO EXIST — one in `ocade-allowance` with durations and
 * device limits, one in `BillingPanel` with labels, and none with prices. They
 * agreed by coincidence. `payments/pricing.ts` is now the single source and
 * both of the others derive from it, so a plan cannot have one duration here
 * and another where it is charged.
 *
 * THE PRICES ARE VALIDATED AT RENDER. `describePrice` throws on an amount that
 * breaks the pricing rule rather than falling back to showing it, so an invalid
 * price fails loudly in development instead of quietly in front of a customer.
 *
 * WHAT THIS DOES NOT DO: take money. Checkout needs product ids and provider
 * credentials that live in the environment, and when they are absent the panel
 * says so plainly instead of offering a button that would fail.
 */
export function PlanComparison({
  currentPlan,
  onChoose,
}: {
  /** The plan the account is on, if any. */
  currentPlan?: PlanId | null;
  /** Begin checkout. Omitted when checkout is not configured. */
  onChoose?: (plan: PlanId) => void;
}) {
  const [currency, setCurrency] = useState<CurrencyCode>(() => currencyForRegion(detectRegion()));

  /*
   * Read from `import.meta.env` so a deployment that HAS configured checkout
   * shows working buttons and one that has not says why. Reported rather than
   * thrown: missing configuration is a deployment fact, not a code defect, and
   * the comparison table is still worth reading without it.
   */
  const missing = useMemo(
    () => missingProductIds(import.meta.env as unknown as Record<string, string | undefined>),
    [],
  );
  const checkoutConfigured = missing.length === 0 && typeof onChoose === "function";

  const paid = PLANS.filter((plan) => plan.id !== "demo");
  const windowHours = Math.round(CLOUD_WINDOW_MS / 3_600_000);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Plans</h2>
          <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">
            On-device processing is unlimited on every plan, including after one expires — your own
            hardware is not something OCADE meters. Plans differ by how long they last and by access
            to OCADE Cloud.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span>Currency</span>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="INR">INR</option>
          </select>
        </label>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {paid.map((plan) => {
          const price = priceFor(plan, currency);
          const isCurrent = currentPlan === plan.id;
          return (
            <GlassPanel
              key={plan.id}
              className={cn(
                "flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5",
                isCurrent && "ring-1 ring-primary/50",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">{plan.name}</h3>
                {isCurrent ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Current
                  </span>
                ) : null}
              </div>

              <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                {describePrice(price)}
              </p>

              <p className="min-h-[2.5rem] text-[12.5px] leading-relaxed text-muted-foreground">
                {plan.summary}
              </p>

              <ul className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                <Feature icon={InfinityIcon}>Unlimited on-device processing</Feature>
                <Feature icon={Cloud}>
                  {plan.cloudAllowance} cloud requests every {windowHours} hours
                </Feature>
                <Feature icon={Monitor}>
                  {plan.desktopDevices} computers · {plan.mobileDevices} phones
                </Feature>
              </ul>

              {checkoutConfigured ? (
                <Button
                  variant={isCurrent ? "outline" : "default"}
                  className="mt-auto w-full"
                  disabled={isCurrent}
                  onClick={() => onChoose?.(plan.id)}
                >
                  {isCurrent ? "Your plan" : `Choose ${plan.name}`}
                </Button>
              ) : (
                <p
                  className="mt-auto rounded-md border border-border/60 bg-secondary/30 px-2.5 py-2 text-[11.5px] text-muted-foreground"
                  title={`Missing: ${missing.join(", ")}`}
                >
                  Checkout is not configured on this deployment.
                </p>
              )}
            </GlassPanel>
          );
        })}
      </div>

      {!checkoutConfigured && missing.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 px-3 py-2 text-[12px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {/*
              Named exactly, because the person who can fix it needs the variable
              name and not a general apology. The ids themselves are never in
              source: they differ per environment, and committing them makes a
              test purchase indistinguishable from a real one.
            */}
            Payment product ids are missing from this deployment&apos;s environment:{" "}
            <code className="font-mono text-[11px]">{missing.join(", ")}</code>. Plans are shown for
            comparison; nothing can be purchased until they are set.
          </span>
        </p>
      ) : null}

      <p className="text-[12px] text-muted-foreground">
        The {CLOUD_ALLOWANCE}-request allowance applies only to OCADE Cloud. Work that runs on your
        device never counts against it, and never stops when a plan ends.
      </p>
    </section>
  );
}

function Feature({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
