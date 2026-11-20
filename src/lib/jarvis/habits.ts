/** Repeated, verified outcomes of one person (R12-10): at least two, newest wording, top three. */
export function habits(
  tasks: readonly { title: string; checkpoint: unknown; outcome: unknown }[],
): { title: string; times: number }[] {
  const groups = new Map<string, { title: string; times: number }>();
  for (const task of tasks) {
    const checks = Array.isArray(task.outcome) ? task.outcome : [];
    const passed = ((task.checkpoint as { verification?: { passed?: unknown } } | null)
      ?.verification?.passed ?? []) as unknown[];
    // Only work JARVIS proved: every one of its checks passed.
    if (!checks.length || !Array.isArray(passed) || passed.length < checks.length) continue;
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
