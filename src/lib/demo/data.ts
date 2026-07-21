/**
 * Sample data for CAERA CADANE Demo Mode.
 * Every field is labelled sample data via UI badges. No real user or company
 * exists behind these records.
 */

export const DEMO_COMPANY = {
  id: "demo-co-1",
  name: "Meridian Foods (Sample)",
  country: "IN",
  currency: "INR",
  entity: "Private Limited",
  gstin: "29ABCDE1234F1Z5 (sample)",
  fyStart: "April",
} as const;

export const DEMO_OCADE_MESSAGES = [
  {
    role: "assistant" as const,
    content:
      "Hi, I'm OCADE by CAERA CADANE. In Demo Mode I can show you how a real conversation looks — but I won't call any model. Try switching themes or open FICIA to see a sample company workspace.",
  },
  {
    role: "user" as const,
    content: "Show me last month's invoices.",
  },
  {
    role: "assistant" as const,
    content:
      "Sample data: Meridian Foods issued 4 invoices totalling ₹6,42,000 last month. Two are unpaid past 15 days. Open FICIA → Invoices in Demo to see the list.",
  },
] as const;

export const DEMO_TIMESHEET = [
  { id: "t1", date: "2026-07-15", person: "Aarav Shah", hours: 7.5, project: "Retail rollout" },
  { id: "t2", date: "2026-07-15", person: "Priya Menon", hours: 8.0, project: "Payroll cleanup" },
  { id: "t3", date: "2026-07-16", person: "Aarav Shah", hours: 6.0, project: "Retail rollout" },
  { id: "t4", date: "2026-07-16", person: "Rahul Iyer", hours: 8.0, project: "Bank recon" },
];

export const DEMO_INVOICES = [
  { id: "inv-2041", customer: "Sunburst Grocers", amount: 187_400, status: "Paid", due: "2026-07-01" },
  { id: "inv-2042", customer: "GreenBowl Cafés", amount: 142_800, status: "Overdue", due: "2026-07-05" },
  { id: "inv-2043", customer: "Kestrel Foods", amount: 214_000, status: "Sent", due: "2026-07-22" },
  { id: "inv-2044", customer: "Northgate Kitchens", amount: 98_100, status: "Overdue", due: "2026-06-30" },
];

export const DEMO_REPORTS = [
  { id: "r1", title: "Cash position (30d)", value: "₹18,42,300", trend: "+4.2%" },
  { id: "r2", title: "AR ageing >15d", value: "₹2,40,900", trend: "+₹1.1L" },
  { id: "r3", title: "Payroll (July prep)", value: "₹5,80,000", trend: "on track" },
  { id: "r4", title: "GST liability (est.)", value: "₹96,400", trend: "sample" },
];

export const DEMO_FILES = [
  { id: "f1", name: "July payroll worksheet.xlsx", size: "184 KB", updated: "2 days ago" },
  { id: "f2", name: "Bank statement — June 2026.pdf", size: "612 KB", updated: "1 week ago" },
  { id: "f3", name: "Sunburst Grocers PO-8814.pdf", size: "88 KB", updated: "3 days ago" },
  { id: "f4", name: "Resume — Priya Menon.pdf", size: "42 KB", updated: "5 days ago" },
];

export const DEMO_TASKS = [
  { id: "k1", title: "Reconcile HDFC current account", status: "In review", owner: "Rahul Iyer" },
  { id: "k2", title: "Chase overdue invoices (2)", status: "Todo", owner: "Aarav Shah" },
  { id: "k3", title: "Prepare July payroll batch", status: "In progress", owner: "Priya Menon" },
  { id: "k4", title: "Upload June GST evidence", status: "Todo", owner: "Priya Menon" },
];

export const DEMO_COMPANY_CHAT = [
  { id: "c1", author: "Priya Menon", ts: "09:12", body: "Uploaded June bank statement, ready for recon." },
  { id: "c2", author: "Rahul Iyer", ts: "09:15", body: "Thanks — I'll start recon after standup." },
  { id: "c3", author: "OCADE", ts: "09:16", body: "I noticed two invoices are overdue. Draft reminder emails? (Demo — not sent.)" },
];

export const DEMO_RESUME = {
  name: "Priya Menon",
  headline: "Payroll & Compliance Lead",
  summary:
    "Nine years running payroll and GST compliance for growing retail and F&B businesses in India. Comfortable with 200+ employee cycles.",
  experience: [
    { role: "Payroll Lead", company: "Meridian Foods", period: "2022 — present" },
    { role: "Senior Accountant", company: "Kestrel Ventures", period: "2019 — 2022" },
    { role: "Accountant", company: "Northgate Kitchens", period: "2016 — 2019" },
  ],
  skills: ["Payroll", "GST filings", "AR/AP", "Bank reconciliation", "Audit prep"],
};
