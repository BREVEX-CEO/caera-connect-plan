/**
 * Where a journey's time went, from what OCADE itself recorded: each task's wall time, the steps
 * it ran and how they ended, and each step's own duration as the device measured it (`ms`), as
 * p50/p95/p99. The planner here is the scripted stand-in, so its turns are counted, never called
 * model calls.
 */
const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0;

export async function printTimings(supabase) {
  const read = (path) => fetch(`${supabase}${path}`).then((r) => (r.ok ? r.json() : []));
  const [tasks, steps, turns] = await Promise.all([
    read("/rest/v1/jarvis_tasks?select=id,title,status,created_at,updated_at,finished_at"),
    read("/rest/v1/jarvis_activity?select=task_id,status,action,result"),
    read("/__fixture/jarvis-script"),
  ]);
  const ran = steps.filter((step) => step.action);
  if (!ran.length) return;
  console.log("\nTIMING  task | status | seconds | steps | failed/refused | unknown");
  for (const task of tasks) {
    const own = ran.filter((step) => step.task_id === task.id);
    const ended = Date.parse(task.finished_at ?? task.updated_at);
    console.log(
      `TIMING  ${task.title} | ${task.status} | ${((ended - Date.parse(task.created_at)) / 1000).toFixed(1)} | ${own.length} | ${
        own.filter((step) => ["failed", "refused"].includes(step.status)).length
      } | ${own.filter((step) => step.result?.status === "unknown").length}`,
    );
  }
  const byKind = new Map();
  for (const step of ran) {
    const ms = step.result?.detail?.ms;
    if (typeof ms !== "number") continue;
    const kind = step.action.action ?? "?";
    byKind.set(kind, [...(byKind.get(kind) ?? []), ms]);
    byKind.set("all steps", [...(byKind.get("all steps") ?? []), ms]);
  }
  console.log("TIMING  step kind | n | p50 ms | p95 ms | p99 ms");
  for (const [kind, all] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
    const sorted = all.sort((a, b) => a - b);
    console.log(
      `TIMING  ${kind} | ${sorted.length} | ${percentile(sorted, 50)} | ${percentile(sorted, 95)} | ${percentile(sorted, 99)}`,
    );
  }
  console.log(`TIMING  scripted planner turns per task trigger: ${JSON.stringify(turns)}`);
}
