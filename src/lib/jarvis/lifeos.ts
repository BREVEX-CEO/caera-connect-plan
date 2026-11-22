export type ObligationView = "Today" | "Upcoming" | "Waiting" | "Completed";

export function civilDate(now: Date): string {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

export function obligationView(
  item: { due_on: string | null; snoozed_until: string | null; completed: boolean },
  today: string,
): ObligationView {
  if (item.completed) return "Completed";
  if (!item.due_on || (item.snoozed_until && item.snoozed_until > today)) return "Waiting";
  return item.due_on <= today ? "Today" : "Upcoming";
}

export function obligationSignal(
  item: { source: string; due_on: string | null; snoozed_until: string | null; completed: boolean },
  today: string,
  soon: string,
): string | null {
  if (item.completed || (item.snoozed_until && item.snoozed_until > today)) return null;
  if (!item.due_on) return "No due date recorded.";
  if (item.due_on < today) return "Past the date you entered.";
  if (item.due_on === today) return "Due today.";
  if (item.due_on <= soon) return "Due in the next seven days.";
  if (!item.source.trim()) return "No source recorded.";
  return null;
}
