/**
 * ADMIN-08: a refused staff or support change is recorded where operators look (the Worker's
 * logs), with who tried and the refusal sentence — never the request's arguments or reason text.
 * The database cannot keep the record itself: the refusal rolls back its own transaction.
 */
export function logRefusedChange(area: "staff" | "support", actor: string, sentence: string): void {
  console.warn(JSON.stringify({ event: "admin_change_refused", area, actor, sentence }));
}
