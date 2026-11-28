/**
 * ELITE-08: the full cost of one verified result, and margin per workflow.
 *
 * Every task contributes its whole cost (model, provider, infrastructure,
 * retries, support, verification) whether or not it verified, so a failed task
 * raises the cost of the results that did verify instead of disappearing.
 * Refunds are subtracted from revenue. Amounts are integer minor units.
 */
export interface TaskEconomics {
  workflow: string;
  verified: boolean;
  revenue: number;
  refund: number;
  model: number;
  provider: number;
  infrastructure: number;
  retry: number;
  support: number;
  verification: number;
}

export interface WorkflowMargin {
  workflow: string;
  tasks: number;
  verified: number;
  cost: number;
  revenue: number;
  refunds: number;
  /** Total cost divided by verified results; null when nothing verified. */
  costPerVerified: number | null;
  /** Net revenue minus cost. */
  margin: number;
  /** Margin over net revenue; null when there is no net revenue. */
  marginRatio: number | null;
}

const costOf = (t: TaskEconomics) =>
  t.model + t.provider + t.infrastructure + t.retry + t.support + t.verification;

export function marginByWorkflow(tasks: readonly TaskEconomics[]): WorkflowMargin[] {
  const groups = new Map<string, TaskEconomics[]>();
  for (const task of tasks) {
    for (const [field, value] of Object.entries(task))
      if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0))
        throw new Error(`${task.workflow}: ${field} must be a non-negative whole number`);
    groups.set(task.workflow, [...(groups.get(task.workflow) ?? []), task]);
  }
  return [...groups.entries()]
    .map(([workflow, rows]) => {
      const cost = rows.reduce((sum, t) => sum + costOf(t), 0);
      const revenue = rows.reduce((sum, t) => sum + t.revenue, 0);
      const refunds = rows.reduce((sum, t) => sum + t.refund, 0);
      const verified = rows.filter((t) => t.verified).length;
      const net = revenue - refunds;
      const margin = net - cost;
      return {
        workflow,
        tasks: rows.length,
        verified,
        cost,
        revenue,
        refunds,
        costPerVerified: verified ? Math.round(cost / verified) : null,
        margin,
        marginRatio: net > 0 ? margin / net : null,
      };
    })
    .sort((a, b) => a.workflow.localeCompare(b.workflow));
}
