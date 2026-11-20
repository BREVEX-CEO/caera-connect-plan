import type { Skill } from "./skills.ts";

/**
 * THE FOUR OUTCOME PACKAGES AND EIGHT PRODUCTS (plan 27.3), as the plan scopes them: domain
 * workflow templates on the ONE existing spine (JARVIS planner, permissions, Library, timeline,
 * generated forms), not separate systems, databases or subscriptions.
 *
 * Each product is a built-in, read-only skill named with `/id`: picking one fills the composer
 * with an outcome the person edits, and the planner receives the product's rules as the
 * person-selected procedure. The rules only ever narrow what JARVIS does (no payment, no
 * auto-submission, no invented facts); every step is still permission-checked and confirmed as
 * usual, and the result is still verified by its own checks. A product whose data lives in an
 * account OCADE cannot connect yet works from files the person keeps in the JARVIS folder.
 */
export interface Product {
  id: string;
  name: string;
  /** What the person starts from: an editable outcome, never sent without them. */
  starter: string;
  rules: string;
}
export interface Package {
  id: string;
  name: string;
  products: Product[];
}

const MONEY =
  "Never move money: do not pay, transfer, purchase, schedule a payment or authorise a charge; prepare drafts and calculations only. Use exact currencies and dates from the sources, keep every figure traceable to its source file, and mark anything estimated or missing as such.";

export const PACKAGES: readonly Package[] = [
  {
    id: "money",
    name: "Business Money Assistant",
    products: [
      {
        id: "invoice-recovery",
        name: "Invoice Recovery",
        starter:
          "/invoice-recovery Find my unpaid and overdue invoices in the Invoices folder, list them in a workbook with customer, amount, due date and status, and draft a polite reminder for each overdue one.",
        rules: `${MONEY} Classify each invoice as paid, partly paid, unpaid, overdue or disputed only from real evidence; never treat a disputed invoice as collectible, never threaten or state legal rights, and never send anything: reminders are drafts for the person, one per customer, with no duplicates.`,
      },
      {
        id: "cashflow-guardian",
        name: "Cashflow Guardian",
        starter:
          "/cashflow-guardian From the statements, invoices and bills in my JARVIS folder, build a 90-day cash-in and cash-out calendar in a workbook with conservative, base and optimistic scenarios, and flag any week that may run short.",
        rules: `${MONEY} Keep confirmed transactions, expected payments and assumptions in separate columns; compute totals with workbook formulas so they can be rechecked; never present a guess as a balance or a forecast as certain.`,
      },
    ],
  },
  {
    id: "forms",
    name: "Universal Forms & Claims Assistant",
    products: [
      {
        id: "deadline-guardian",
        name: "Deadline Guardian",
        starter:
          "/deadline-guardian Read the letters and documents in my Paperwork folder, list every deadline with its date, time zone, what is needed and the source document, and make a checklist of what is still missing.",
        rules:
          "Never invent an official date: every deadline cites its source and says how sure it is; a date you cannot find is listed as unknown. Handle time zones and business days explicitly. Reminders and calendar entries are drafts unless the person asks for them; never submit an application or claim.",
      },
      {
        id: "refund-assistant",
        name: "Refund Assistant",
        starter:
          "/refund-assistant Using the order and receipt in my Refunds folder, check the seller's return policy, tell me whether a refund looks possible and by when, and prepare the claim text and evidence list.",
        rules:
          "Use only real evidence; never falsify or embellish it. Name the official site or address you found the policy on and any fees or uncertainty; never promise approval. Prepare the claim; sending it, or any personal or payment details, is the person's own confirmed step.",
      },
      {
        id: "job-applications",
        name: "Job Application Assistant",
        starter:
          "/job-applications Using my CV in the Career folder and the vacancy I paste here, write a truthful tailored CV and cover letter, and list the application's requirements I meet and the ones I do not.",
        rules:
          "Never invent qualifications, employers, dates, certificates or answers: use only what the person's own documents say and mark gaps honestly. Fill an application only with the person's approved details and never submit it; submission is always the person's own confirmed step.",
      },
    ],
  },
  {
    id: "family",
    name: "Personal & Family Assistant",
    products: [
      {
        id: "micro-ledger",
        name: "Micro-Business Ledger",
        starter:
          "/micro-ledger Turn the receipts and invoices in my Receipts folder into a ledger workbook with date, supplier, category, amount, currency and a link to each source file, with totals per month and category.",
        rules:
          "Each receipt appears once (spot duplicates by date, amount and supplier and list them for the person); totals use workbook formulas; uncertain categories or tax treatment are marked, never guessed silently. You are not an accountant: never file taxes, pay, or change official records.",
      },
      {
        id: "family-admin",
        name: "Family Administration",
        starter:
          "/family-admin From the household papers in my Family folder, list upcoming appointments, renewals and bills with dates, and make a checklist of what each needs.",
        rules:
          "Use only documents in the folders this task may read; another person's records are not yours to read because they are family. Keep children's and medical details out of anything you write except where the person asked; never send or share documents.",
      },
    ],
  },
  {
    id: "launch",
    name: "Business Launch Assistant",
    products: [
      {
        id: "client-onboarding",
        name: "Client Onboarding Autopilot",
        starter:
          "/client-onboarding From the new client's brief in my Clients folder, create a project folder with a task plan, milestone dates, a deliverables checklist and a welcome email draft, and list anything the brief leaves unclear.",
        rules:
          "Work only with this client's files; nothing from another client may appear. Create the folder, documents and drafts; never invite anyone, share access, send the welcome email, buy a service or accept a contract — those are the person's own confirmed steps. List missing or conflicting terms instead of assuming them.",
      },
    ],
  },
];

const PRODUCTS = new Map(PACKAGES.flatMap((pack) => pack.products).map((p) => [p.id, p]));

/** The built-in products a request names, as read-only skills (version 0: OCADE's own). */
export function builtInSkills(names: readonly string[]): Skill[] {
  return names.flatMap((name) => {
    const product = PRODUCTS.get(name);
    return product
      ? [{ name: product.id, title: product.name, body: product.rules, version: 0 }]
      : [];
  });
}
