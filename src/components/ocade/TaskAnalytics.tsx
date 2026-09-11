import { useState } from "react";
import { taskAnalytics, type TaskAnalyticsRange } from "@/lib/tasks/task-insights";
import type { UnifiedTask } from "@/lib/tasks/unified-task";
import { useFormatters } from "@/lib/locale/use-formatters";

export function TaskAnalytics({ tasks }: { tasks: UnifiedTask[] }) {
  const formatters = useFormatters();
  const [range, setRange] = useState<TaskAnalyticsRange>("30");
  const data = taskAnalytics(tasks, range);
  const max = Math.max(1, ...data.byStatus.map((item) => item.count));
  return (
    <section aria-labelledby="task-analytics-title" className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="task-analytics-title" className="text-sm font-medium">
            Task analytics
          </h3>
          <p className="text-xs text-muted-foreground">Calculated from on-device task records.</p>
        </div>
        <label className="text-xs text-muted-foreground">
          Date range
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as TaskAnalyticsRange)}
            className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>
      {data.total ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Tasks", data.total],
              ["Completed", data.completed],
              ["Completion rate", `${data.completionRate}%`],
              [
                "Period change",
                range === "all" ? "—" : `${data.difference >= 0 ? "+" : ""}${data.difference}`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <figure className="mt-4 rounded-xl border border-border/60 p-4">
            <figcaption className="text-sm font-medium">Tasks by status</figcaption>
            <div
              aria-label="Horizontal axis, task count"
              className="mt-1 flex justify-between text-[10px] text-muted-foreground"
            >
              <span>0 tasks</span>
              <span>{max} tasks</span>
            </div>
            <div className="mt-3 space-y-2">
              {data.byStatus.map((item) => (
                <div
                  key={item.column}
                  className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2 text-xs"
                >
                  <span className="capitalize">{item.column}</span>
                  <div className="h-3 rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${(item.count / max) * 100}%` }}
                    />
                  </div>
                  <span>{item.count}</span>
                </div>
              ))}
            </div>
          </figure>
          <section className="mt-4">
            <h4 className="text-sm font-medium">Segment breakdown</h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {data.bySource.map((item) => (
                <li
                  key={item.source}
                  className="rounded-full border border-border/60 px-3 py-1 text-xs"
                >
                  {item.source}: {item.count}
                </li>
              ))}
            </ul>
          </section>
          <p className="mt-3 text-xs text-muted-foreground">
            Last updated {data.lastUpdated ? formatters.dateTime(data.lastUpdated) : "—"}
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          No task data exists in this date range.
        </p>
      )}
    </section>
  );
}
