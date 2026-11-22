import { PACKAGES } from "./packages.ts";

const OUTCOMES = {
  "invoice-recovery":
    "Reconcile paid, partial, overdue and disputed invoices, and draft reminders.",
  "cashflow-guardian": "Prepare a cashflow workbook, separating confirmed figures and estimates.",
  "micro-ledger": "Prepare a ledger workbook, citing each source and flagging duplicates.",
  "client-onboarding":
    "Prepare a timeline, checklist and welcome message draft from the client brief.",
} as const;

export const businessWorkflows = PACKAGES.flatMap(({ products }) => products).filter((product) =>
  Object.hasOwn(OUTCOMES, product.id),
);

export function businessDraft(workflow: string, business: string, folder: string) {
  const name = business.trim();
  const source = folder.trim();
  if (
    !Object.hasOwn(OUTCOMES, workflow) ||
    !name ||
    !source ||
    name.length > 120 ||
    source.length > 260
  ) {
    return null;
  }
  // Keep user text on one line and prevent either field from naming an additional skill.
  if (/[\p{Cc}\p{Cf}]/u.test(name + source) || /(?:^|\s)\/[a-z0-9]/i.test(name + " " + source)) {
    return null;
  }
  if (
    source.startsWith("/") ||
    source.startsWith("\\") ||
    source.includes(":") ||
    source
      .split(/[\\/]/)
      .some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part))
  ) {
    return null;
  }
  return [
    `/${workflow} ${OUTCOMES[workflow as keyof typeof OUTCOMES]}`,
    `Business: ${JSON.stringify(name)}. Use only records in this folder in my JARVIS workspace: ${JSON.stringify(source)}.`,
    "Cite the underlying records, flag conflicts and stop if the source cannot be verified. Keep results in new drafts. Do not send anything, change source records, or move money.",
  ].join("\n");
}
