/**
 * WHAT OCADE COSTS, ON A PAGE ANYBODY CAN READ.
 *
 * Public: no account, no session bootstrap, no workspace shell. Somebody
 * deciding whether to pay has not signed in yet, and a pricing page that
 * requires an account to read is a pricing page nobody reads.
 *
 * THE PRICES COME FROM THE CATALOGUE, NOT FROM THIS FILE. `payments/pricing.ts`
 * holds every amount and refuses to format one that breaks the numeric
 * signature, so a wrong price cannot reach a screen through this component. The
 * allowance lines come from `commercial/usage-policy.ts` for the same reason:
 * the page that sells the allowance and the gate that enforces it read the same
 * number.
 *
 * CHECKOUT IS NOT PRETENDED. OCADE has no payment provider configured — that
 * needs credentials only the owner can obtain — so the paid cards say so in one
 * line. There is deliberately no button that refuses: a control whose only
 * answer is no is worse than the sentence, because somebody has to press it to
 * find out. When the provider exists, the button replaces the sentence.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PublicPage } from "@/components/shell/PublicPage";
import { useSession } from "@/lib/session";
import { useCommercialUsage } from "@/lib/commercial/use-commercial-usage";
import { ALLOWANCES } from "@/lib/commercial/usage-policy";
import {
  PLANS,
  currencyForRegion,
  describePrice,
  detectRegion,
  priceFor,
  type CurrencyCode,
  type PlanCadence,
  type PlanTier,
} from "@/lib/payments/pricing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — OCADE" },
      {
        name: "description",
        content:
          "OCADE plans: Free, Pro and Max. One question counts as one use, shared across every device you sign in on.",
      },
      { property: "og:title", content: "Pricing — OCADE" },
      {
        property: "og:description",
        content: "Free, Pro and Max. Weekly or monthly, in your own currency.",
      },
    ],
  }),
  component: PricingPage,
});

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "INR", label: "INR" },
];

const TIER_ORDER: PlanTier[] = ["free", "pro", "max"];

function PricingPage() {
  const [cadence, setCadence] = useState<PlanCadence>("monthly");
  /*
   * USD UNTIL THE BROWSER SAYS OTHERWISE. The region is read from the browser's
   * own locale, which the server does not have, so reading it during render
   * would make the server and the first client paint disagree about the price.
   * It is read after mount instead, and a manual choice overrides it for good.
   */
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    if (!chosen) setCurrency(currencyForRegion(detectRegion()));
  }, [chosen]);

  const { user } = useSession();
  const usage = useCommercialUsage(Boolean(user));

  return (
    <PublicPage
      wide
      title="Pricing"
      intro="One question you ask counts as one use, however much work it takes OCADE to answer. Your allowance is shared across every device you sign in on."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="glass inline-flex rounded-lg p-0.5"
          role="group"
          aria-label="Billing period"
        >
          {(["weekly", "monthly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCadence(value)}
              aria-pressed={cadence === value}
              className={cn(
                "h-8 rounded-md px-4 text-[13px] capitalize transition-colors",
                cadence === value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Currency
          <select
            value={currency}
            onChange={(event) => {
              setChosen(true);
              setCurrency(event.target.value as CurrencyCode);
            }}
            className="glass h-8 rounded-md px-2 text-[13px] text-foreground outline-none"
          >
            {CURRENCIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {TIER_ORDER.map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            cadence={cadence}
            currency={currency}
            currentTier={usage.data?.tier}
            signedIn={Boolean(user)}
          />
        ))}
      </div>

      <p className="mt-6 text-[13px] leading-5 text-muted-foreground">
        Paying needs a connection. OCADE never takes a payment, or queues one, while you are
        offline. Everything else — reading, your Library, your settings — keeps working.
      </p>
    </PublicPage>
  );
}

function PlanCard({
  tier,
  cadence,
  currency,
  currentTier,
  signedIn,
}: {
  tier: PlanTier;
  cadence: PlanCadence;
  currency: CurrencyCode;
  currentTier: PlanTier | undefined;
  signedIn: boolean;
}) {
  // Free has no cadence, so the toggle leaves it alone rather than hiding it.
  const plan = PLANS.find(
    (entry) => entry.tier === tier && (entry.cadence ?? cadence) === cadence,
  )!;
  const allowance = ALLOWANCES[tier];
  const current = currentTier === tier;

  return (
    <section
      className={cn(
        "glass flex flex-col rounded-xl p-5",
        current ? "ring-1 ring-foreground/25" : null,
      )}
      aria-labelledby={`plan-${tier}`}
    >
      <h2 id={`plan-${tier}`} className="text-sm font-semibold capitalize text-foreground">
        {tier}
      </h2>

      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold tracking-tight text-foreground">
          {describePrice(priceFor(plan, currency))}
        </span>
        {plan.cadence ? (
          <span className="text-[13px] text-muted-foreground">
            / {plan.cadence === "weekly" ? "week" : "month"}
          </span>
        ) : null}
      </p>

      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{plan.summary}</p>

      <ul className="mt-4 flex-1 space-y-2 text-[13px] text-muted-foreground">
        <Benefit>
          {allowance.session.toLocaleString("en-US")} questions every 6 hours 28 minutes
          {allowance.week === null ? ", with no weekly limit" : ""}
        </Benefit>
        {allowance.week === null ? null : (
          <Benefit>{allowance.week.toLocaleString("en-US")} questions a week</Benefit>
        )}
        <Benefit>Shared across every device you sign in on</Benefit>
        <Benefit>Offline Intelligence on your own device</Benefit>
      </ul>

      <div className="mt-5">
        <Action tier={tier} current={current} signedIn={signedIn} />
      </div>
    </section>
  );
}

/** One state per card, and every one of them true. */
function Action({
  tier,
  current,
  signedIn,
}: {
  tier: PlanTier;
  current: boolean;
  signedIn: boolean;
}) {
  if (current) {
    return <p className="text-[13px] font-medium text-foreground">Your plan</p>;
  }
  if (!signedIn) {
    return (
      <Link
        to="/auth"
        search={{ next: "/pricing" }}
        className="flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {tier === "free" ? "Start free" : "Create an account"}
      </Link>
    );
  }
  if (tier === "free") {
    return <p className="text-[13px] text-muted-foreground">Included with every account.</p>;
  }
  return (
    <p className="text-[13px] text-muted-foreground">
      Paid plans are not open yet. Your account stays on Free until they are.
    </p>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
