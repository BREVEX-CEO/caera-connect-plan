import { AlertTriangle, CheckCircle2, Clock3, Inbox, XCircle } from "lucide-react";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { taskFromAutomationRun, type AutomationRunLike } from "@/lib/tasks/unified-task";

/**
 * THE INBOX, INSIDE TASKS.
 *
 * `PLAN.md` §4: "Automations, monitors, inbox, notifications, and schedules
 * into Tasks." `/ocade/inbox` was a second screen reading the same two tables
 * this one does — automations and their runs — and splitting "what is waiting
 * for you" from "what is running" meant a person had to visit both to know
 * where their work stood, and had to guess which was authoritative when they
 * disagreed.
 *
 * NO QUERY OF ITS OWN, DELIBERATELY. The rows come from the caller, which
 * already fetched them for the run list below it. A second fetch would be a
 * second answer, and two lists of the same runs that can disagree is exactly
 * what made the Stop button on each of them untrustworthy.
 */

/** Statuses that mean somebody has to do something. */
const PENDING = new Set(["PLANNING", "WAITING_PERMISSION", "WAITING_USER"]);
const FAILURE = new Set(["FAILED", "CANCELLED"]);

/** How many finished runs are worth showing before this becomes a log. */
const RECENT_OUTCOMES = 10;

export function NeedsAttentionSection({
  runs,
  nameOf,
}: {
  runs: readonly AutomationRunLike[];
  nameOf: (automationId: string) => string;
}) {
  const tasks = runs.map((run) => taskFromAutomationRun(run, nameOf(run.automation_id)));
  const pending = tasks.filter((task) => PENDING.has(task.status));
  const outcomes = tasks.filter((task) => !PENDING.has(task.status)).slice(0, RECENT_OUTCOMES);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <GlassPanel className="p-5">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
        </div>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing is waiting for you right now.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/40">
            {pending.map((task) => (
              <li key={task.id} className="flex items-start gap-2 py-3">
                {task.status === "WAITING_PERMISSION" ? (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]"
                    aria-hidden
                  />
                ) : (
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.currentStep ?? task.status.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Recent outcomes</h2>
        </div>
        {outcomes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No finished background runs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/40">
            {outcomes.map((task) => (
              <li key={task.id} className="flex items-start gap-2 py-3">
                {FAILURE.has(task.status) ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-success)]"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.status.toLowerCase()} ·{" "}
                    {new Date(task.finishedAt ?? task.updatedAt).toLocaleString()}
                  </p>
                  {task.lastError ? (
                    <p className="mt-1 text-xs text-destructive">{task.lastError}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
