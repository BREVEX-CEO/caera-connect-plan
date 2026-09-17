import { Link } from "@tanstack/react-router";
import { ALLOWANCES } from "@/lib/commercial/usage-policy";
import { useCommercialUsage } from "@/lib/commercial/use-commercial-usage";
import { Pending, Row } from "./rows";

/**
 * BILLING: WHAT THIS ACCOUNT IS ON, AND WHAT THE OTHER PLANS WOULD GIVE.
 *
 * It used to be the usage breakdown under a different name, which left the
 * product with six settings categories where `PLAN.md` names seven and no
 * screen that answered "what would upgrading get me". Usage & Limits is its own
 * category now and this is about plans.
 *
 * NOTHING HERE PRETENDS A CHECKOUT EXISTS. Payment-provider onboarding is an
 * owner task that has not happened, so the cards say so plainly and the account
 * stays on Free. `PLAN.md`: "it must say so honestly rather than pretending a
 * checkout succeeded" — a disabled Upgrade button with no explanation is the
 * same lie told more quietly.
 */
const TIERS = ["free", "pro", "max"] as const;

const SUMMARY: Record<(typeof TIERS)[number], string> = {
  free: "Everything OCADE does, with the smallest allowance.",
  pro: "More questions in each window, and a weekly pool.",
  max: "The largest allowance, for people who work in OCADE all day.",
};

export function BillingSection() {
  const usage = useCommercialUsage();

  if (usage.isPending || usage.isError || !usage.data) {
    return (
      <Pending
        query={usage}
        loading="Reading your plan…"
        problem="Your plan could not be read just now."
      />
    );
  }

  const current = usage.data.tier;

  return (
    <div>
      {TIERS.map((tier) => {
        const allowance = ALLOWANCES[tier];
        return (
          <Row
            key={tier}
            label={tier === "free" ? "Free" : tier === "pro" ? "Pro" : "Max"}
            description={
              <>
                {SUMMARY[tier]} {allowance.session.toLocaleString("en-US")} questions every 6 hours
                28 minutes
                {allowance.week === null
                  ? ", with no weekly limit."
                  : `, and ${allowance.week.toLocaleString("en-US")} a week.`}
              </>
            }
          >
            {tier === current ? (
              <span className="text-sm text-foreground">Your plan</span>
            ) : (
              <span className="text-[13px] text-muted-foreground">Not open yet</span>
            )}
          </Row>
        );
      })}

      <Row
        label="Upgrading"
        description="Paid plans are not open yet. Your account stays on Free until they are, and nothing will be charged in the meantime."
      >
        <Link to="/pricing" className="text-sm text-foreground underline underline-offset-2">
          See plans
        </Link>
      </Row>
    </div>
  );
}
