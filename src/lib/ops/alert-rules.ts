/**
 * OWN-047: alerts on errors, quota refusals and spending.
 *
 * Pure rules over a window of counters; the caller (a scheduled job or the
 * health route) supplies the numbers and sends what comes back. A rule with
 * too little traffic does not fire on a single failure.
 */
export interface Window {
  /** Window length in minutes. */
  minutes: number;
  requests: number;
  errors: number;
  quotaRefusals: number;
  /** Spend in the window, minor currency units. */
  spend: number;
  /** Spend ceiling for the same window. */
  spendLimit: number;
}

export type Severity = "page" | "warn";
export interface Alert {
  rule: "error_rate" | "quota_refusals" | "spend";
  severity: Severity;
  message: string;
}

export const MIN_REQUESTS = 20;
export const ERROR_RATE_WARN = 0.05;
export const ERROR_RATE_PAGE = 0.2;
export const QUOTA_REFUSAL_WARN = 0.25;
export const SPEND_WARN = 0.8;

export function evaluate(w: Window): Alert[] {
  const alerts: Alert[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (w.requests >= MIN_REQUESTS) {
    const errors = w.errors / w.requests;
    if (errors >= ERROR_RATE_PAGE)
      alerts.push({
        rule: "error_rate",
        severity: "page",
        message: `Errors ${pct(errors)} of ${w.requests} requests in ${w.minutes} min.`,
      });
    else if (errors >= ERROR_RATE_WARN)
      alerts.push({
        rule: "error_rate",
        severity: "warn",
        message: `Errors ${pct(errors)} of ${w.requests} requests in ${w.minutes} min.`,
      });
    const refused = w.quotaRefusals / w.requests;
    if (refused >= QUOTA_REFUSAL_WARN)
      alerts.push({
        rule: "quota_refusals",
        severity: "warn",
        message: `Quota refusals ${pct(refused)} of ${w.requests} requests in ${w.minutes} min.`,
      });
  }
  if (w.spendLimit > 0) {
    const used = w.spend / w.spendLimit;
    if (used >= 1)
      alerts.push({
        rule: "spend",
        severity: "page",
        message: `Spend ${pct(used)} of the ${w.minutes}-minute ceiling.`,
      });
    else if (used >= SPEND_WARN)
      alerts.push({
        rule: "spend",
        severity: "warn",
        message: `Spend ${pct(used)} of the ${w.minutes}-minute ceiling.`,
      });
  }
  return alerts;
}
