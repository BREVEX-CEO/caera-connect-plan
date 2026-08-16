/**
 * How money actually reaches the company's bank account.
 *
 * Selling and getting paid out are two separate things: the checkout can take
 * card and UPI payments in test mode today, but the merchant of record only
 * releases funds once the account is verified and a payout bank account is on
 * file. This panel states the real order of those steps so nobody assumes a
 * successful test checkout means money is on its way.
 */
import { Banknote, CircleCheck, CircleDashed } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";

interface PayoutStep {
  title: string;
  detail: string;
  /** Fields the provider asks for, when the step is a form. */
  fields?: string[];
}

const PAYOUT_STEPS: PayoutStep[] = [
  {
    title: "Publish the site",
    detail:
      "The provider reviews a live, reachable site before approving an account. Publish CAERA CADANE, including the pricing, terms, privacy and refund pages, then start the review.",
  },
  {
    title: "Complete the verification form",
    detail:
      "Business or sole-proprietor details, the country of registration, what you sell and expected volumes. This takes about ten minutes and starts domain, business and identity review.",
    fields: [
      "Legal entity name exactly as registered",
      "Registered address and country (India)",
      "PAN, and GSTIN if registered",
      "Government photo ID for the signing person",
    ],
  },
  {
    title: "Add the Indian bank account for payouts",
    detail:
      "Once verified, open the provider's payout settings from the Payments tab and add the beneficiary account. The name on the account must match the verified legal entity, otherwise the transfer is rejected by the receiving bank.",
    fields: [
      "Beneficiary name (must match the verified entity)",
      "Account number and re-entry",
      "IFSC code (identifies bank and branch)",
      "Bank name, branch and bank address",
      "Account type: current for a company, savings for an individual",
      "Payout currency — INR where offered, otherwise USD converted by your bank",
    ],
  },
  {
    title: "Handle the inbound-remittance paperwork",
    detail:
      "Foreign earnings arriving in India are export-of-service receipts. Your bank will ask for a purpose code and issue FIRC or e-BRC advice per payout; keep those with the invoices, because GST export treatment and income-tax filing both rely on them.",
  },
  {
    title: "Wait for the first payout cycle",
    detail:
      "Payouts run on a schedule after a holding period, not immediately after each sale. Nothing is released until every verification step is green — a passing test checkout does not move real money.",
  },
];

export function PayoutSetupGuide() {
  return (
    <GlassPanel className="p-4">
      <div className="flex items-start gap-2">
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-medium">Getting paid into an Indian bank account</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Card, UPI and PayPal are all collected by one merchant of record, so there is a single
            payout account rather than one per method. These steps are done in the provider's own
            dashboard, reached from the Payments tab — CAERA CADANE never stores your bank details.
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {PAYOUT_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-2.5">
            <span className="mt-0.5 shrink-0" aria-hidden>
              {index === 0 ? (
                <CircleCheck className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
            <div>
              <p className="text-xs font-medium">
                {index + 1}. {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
              {step.fields ? (
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {step.fields.map((field) => (
                    <li key={field} className="flex gap-1.5">
                      <span aria-hidden>·</span>
                      <span>{field}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs text-muted-foreground">
        Tax and remittance rules change and depend on your registration. Treat this as an
        operational checklist, not tax advice — confirm the purpose code and GST export treatment
        with your CA before the first payout.
      </p>
    </GlassPanel>
  );
}
