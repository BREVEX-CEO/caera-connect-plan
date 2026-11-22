/** Repeated, verified outcomes of one person (R12-10): at least two, newest wording, top three. */
import { countOutcomeChecks, isActualTask } from "./time-reclaimed.ts";

export function habits(
  tasks: readonly { title: string; mode?: string; checkpoint: unknown; outcome: unknown }[],
): { title: string; times: number }[] {
  const groups = new Map<string, { title: string; times: number }>();
  for (const task of tasks) {
    if (!isActualTask(task)) continue;
    const { checks, passed } = countOutcomeChecks(task.outcome, task.checkpoint);
    // Only work JARVIS proved: every one of its checks passed.
    if (!checks || passed !== checks) continue;
    const key = task.title.toLowerCase().replace(/\s+/g, " ").trim();
    const group = groups.get(key);
    if (group) group.times += 1;
    else groups.set(key, { title: task.title.slice(0, 300), times: 1 });
  }
  return [...groups.values()]
    .filter((group) => group.times >= 2)
    .sort((a, b) => b.times - a.times)
    .slice(0, 3);
}
