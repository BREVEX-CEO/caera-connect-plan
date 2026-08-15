import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20260815213627_ocade_billing_support_ledger.sql",
  "utf8",
).toLowerCase();

describe("billing and support migration security", () => {
  const TABLES = [
    "ocade_payment_events",
    "ocade_invoices",
    "ocade_support_tickets",
    "ocade_support_messages",
  ];

  it.each(TABLES)("enables row-level security on %s", (table) => {
    expect(SQL).toContain(`alter table public.${table} enable row level security`);
    expect(SQL).toContain(`revoke all on public.${table} from public, anon`);
  });

  it("keeps money and entitlement writes service-only", () => {
    expect(SQL).toContain("grant select on public.ocade_payment_events to authenticated");
    expect(SQL).toContain("grant select on public.ocade_invoices to authenticated");
    expect(SQL).not.toContain("grant insert on public.ocade_payment_events to authenticated");
    expect(SQL).not.toContain("grant insert on public.ocade_invoices to authenticated");
  });

  it("isolates customer records and reserves queue management for admins", () => {
    expect(SQL).toContain("payment_events_own_read");
    expect(SQL).toContain("invoices_own_read");
    expect(SQL).toContain("support_tickets_own_read");
    expect(SQL).toContain("support_messages_ticket_read");
    expect(SQL).toContain("support_tickets_admin_all");
    expect(SQL).toContain("public.ocade_is_support_admin()");
  });

  it("does not define columns for raw payment credentials or webhook bodies", () => {
    for (const forbidden of ["card_number", "cvv", "upi_pin", "paypal_password", "raw_payload"]) {
      expect(SQL).not.toMatch(new RegExp(`\\b${forbidden}\\s+(?:text|json|jsonb|bytea)`));
    }
  });
});
