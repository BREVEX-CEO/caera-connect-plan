/**
 * UX-30 Zeigarnik Effect: which conversations still hold unfinished JARVIS work, and the one
 * word that says what that work needs. Only the task's own status is used; nothing is guessed.
 */
export type OpenTask = { conversation_id: string; status: string };

const LABELS: Record<string, string> = {
  waiting: "Needs you",
  taken_over: "You have control",
  running: "Working",
};

/** Conversation id to label; a conversation needing the person outranks one still working. */
export function unfinishedByConversation(tasks: OpenTask[]): Map<string, string> {
  const rank = (status: string) => ["waiting", "taken_over", "running"].indexOf(status);
  const best = new Map<string, string>();
  for (const task of tasks) {
    if (!(task.status in LABELS)) continue;
    const current = best.get(task.conversation_id);
    if (current === undefined || rank(task.status) < rank(current)) {
      best.set(task.conversation_id, task.status);
    }
  }
  return new Map([...best].map(([id, status]) => [id, LABELS[status]!]));
}
