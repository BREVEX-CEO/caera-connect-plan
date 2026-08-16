/**
 * The internal end-to-end payments checklist, as data.
 *
 * A checklist that only exists in someone's head is a checklist that gets
 * half-run the day before launch. Each step here names what is being proven,
 * how it is proven, and — importantly — whether the proof is automatic or
 * needs a human to make a real test payment. Steps that cannot be automated
 * are marked as such instead of being quietly dropped.
 */

export type ChecklistStepId =
  | "catalogue_inr"
  | "webhook_configured"
  | "webhook_verified_delivery"
  | "upi_checkout"
  | "renewal_autopay";

export type ChecklistOutcome = "pass" | "fail" | "attention" | "manual" | "unknown";

export interface ChecklistStepResult {
  id: ChecklistStepId;
  outcome: ChecklistOutcome;
  /** What was actually observed, in plain words. Never a bare status code. */
  detail: string;
  /** Raw evidence for the operator: ids, counts, timestamps. */
  evidence?: Record<string, string | number | boolean | null>;
}

export interface ChecklistStepDefinition {
  id: ChecklistStepId;
  title: string;
  proves: string;
  /** True when a person must complete a real test payment for this to pass. */
  requiresHuman: boolean;
}

export const CHECKLIST_STEPS: ChecklistStepDefinition[] = [
  {
    id: "catalogue_inr",
    title: "Every plan has a rupee price",
    proves:
      "An Indian buyer is charged in INR, which is the precondition the provider uses to offer UPI at all.",
    requiresHuman: false,
  },
  {
    id: "webhook_configured",
    title: "Webhook destinations and secrets exist",
    proves:
      "The provider has somewhere to send subscription events, and this app holds the signing secret needed to trust them.",
    requiresHuman: false,
  },
  {
    id: "webhook_verified_delivery",
    title: "A signed event was accepted and written",
    proves:
      "Signature verification works end to end: a real delivery produced a subscription row for the signed-in account.",
    requiresHuman: false,
  },
  {
    id: "upi_checkout",
    title: "UPI appears and completes in test checkout",
    proves:
      "The provider genuinely offers UPI to an Indian buyer here. Only a real test checkout can show this — the UPI toggle is not readable through the API.",
    requiresHuman: true,
  },
  {
    id: "renewal_autopay",
    title: "Renewal and AutoPay state changes land",
    proves:
      "Pulling the billing date forward in test mode produces a renewal, and the resulting status change reaches this app's records.",
    requiresHuman: false,
  },
];

export interface ChecklistRun {
  environment: "sandbox" | "live";
  ranAt: string;
  results: ChecklistStepResult[];
}

export function outcomeTone(outcome: ChecklistOutcome): string {
  switch (outcome) {
    case "pass":
      return "text-[color:var(--state-success,theme(colors.emerald.400))]";
    case "fail":
      return "text-destructive";
    case "attention":
      return "text-[color:var(--state-warning)]";
    default:
      return "text-muted-foreground";
  }
}

export function outcomeLabel(outcome: ChecklistOutcome): string {
  switch (outcome) {
    case "pass":
      return "Verified";
    case "fail":
      return "Failed";
    case "attention":
      return "Needs attention";
    case "manual":
      return "Manual step";
    default:
      return "Not run";
  }
}
