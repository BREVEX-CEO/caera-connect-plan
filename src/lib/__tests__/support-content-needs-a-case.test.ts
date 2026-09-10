import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Reading a customer's support case, and the four things that must be true
 * before anybody can.
 *
 * `PLAN.md` Phase 15: "Support-content inspection requires time-bound
 * case-scoped read-only grant, recent AAL2, reason/expiry and per-object access
 * events — never unrestricted raw DB browsing."
 *
 * What was there instead was `OR ocade_is_support_admin()` on the messages
 * policy: any admin, any ticket, for ever, no reason, no record. The behaviour
 * is proven against real PostgreSQL by the migration's verification; these hold
 * the shape of the thing, and in particular the mistake that made the first
 * attempt useless.
 */

const MIGRATION = readFileSync(
  "supabase/migrations/20260910160000_support_content_needs_a_case_grant.sql",
  "utf8",
);
const ADMIN = readFileSync("src/routes/_authenticated/admin.support.tsx", "utf8");

describe("the grant is what it claims to be", () => {
  it("is case-scoped, not admin-scoped", () => {
    expect(MIGRATION).toMatch(/ticket_id UUID NOT NULL REFERENCES public\.ocade_support_tickets/);
    expect(MIGRATION).toMatch(/g\.ticket_id = target_ticket/);
  });

  it("expires, and cannot be opened for longer than a day", () => {
    expect(MIGRATION).toMatch(/expires_at TIMESTAMPTZ NOT NULL/);
    expect(MIGRATION).toMatch(/CHECK \(expires_at > granted_at\)/);
    expect(MIGRATION).toMatch(/expires_at <= granted_at \+ INTERVAL '24 hours'/);
  });

  it("needs a reason somebody could read back", () => {
    expect(MIGRATION).toMatch(/reason TEXT NOT NULL CHECK \(length\(btrim\(reason\)\) >= 10\)/);
  });

  it("checks the second factor in the database, not only in the application", () => {
    /*
     * A server function that forgets its middleware is a bug; a policy that
     * trusts the application to have remembered is a design.
     */
    expect(MIGRATION).toMatch(/request\.jwt\.claim\.aal/);
    expect(MIGRATION).toMatch(/IS DISTINCT FROM 'aal2'/);
  });

  it("records one access event per object, in the same statement that returns it", () => {
    const read = MIGRATION.slice(MIGRATION.indexOf("ocade_read_support_case"));
    expect(read).toContain("INSERT INTO public.ocade_support_access_events");
    expect(read).toContain("object_kind");
    // The record is written before the rows are returned, so there is no path
    // that hands over content without leaving a trace of it.
    expect(read.indexOf("INSERT INTO public.ocade_support_access_events")).toBeLessThan(
      read.indexOf("RETURN QUERY"),
    );
  });
});

describe("the policy that actually governs is the one that changed", () => {
  it("rewrites the consolidated policies rather than adding a narrow one beside them", () => {
    /*
     * THE MISTAKE THIS PINS. PostgreSQL ORs permissive policies together, so a
     * narrower policy added beside a broad one changes nothing. The first
     * draft replaced `support_messages_ticket_read` — which an earlier
     * consolidation had already dropped — and the live database went on
     * reading `OR is_support_admin()` from `ocade_consolidated_select`. Any
     * admin still had every message, and the migration looked correct.
     */
    expect(MIGRATION).toContain(
      'DROP POLICY IF EXISTS "ocade_consolidated_select" ON public.ocade_support_messages',
    );
    expect(MIGRATION).toContain(
      'CREATE POLICY "ocade_consolidated_select" ON public.ocade_support_messages',
    );
  });

  it("leaves no SELECT policy on support messages that consults the admin role", () => {
    const selects = MIGRATION.slice(MIGRATION.indexOf("ONE POLICY PER ROLE PER COMMAND"));
    const created = selects.slice(
      selects.indexOf('CREATE POLICY "ocade_consolidated_select"'),
      selects.indexOf('CREATE POLICY "ocade_consolidated_insert"'),
    );
    expect(created).toContain("ocade_support_grant_active");
    expect(created).not.toContain("is_support_admin");
  });

  it("keeps the customer's own access exactly as it was", () => {
    const insert = MIGRATION.slice(MIGRATION.indexOf('CREATE POLICY "ocade_consolidated_insert"'));
    expect(insert).toContain("author_role = 'customer'");
    expect(insert).toContain("ticket.status <> 'closed'");
  });

  it("needs the case open to reply, not just to read", () => {
    const insert = MIGRATION.slice(MIGRATION.indexOf('CREATE POLICY "ocade_consolidated_insert"'));
    const support = insert.slice(insert.indexOf("author_role = 'support'"));
    expect(support).toContain("ocade_support_grant_active");
  });
});

describe("the queue asks for a case rather than reading around it", () => {
  it("reads through the recorded path, not straight from the table", () => {
    expect(ADMIN).toContain('supabase.rpc("ocade_read_support_case"');
    expect(ADMIN).not.toContain('.from("ocade_support_messages")\n        .select');
  });

  it("says why nothing is shown, instead of an empty conversation", () => {
    expect(ADMIN).toContain("Nothing is shown because no case is open.");
  });

  it("offers to open and to close the case, and says what that means", () => {
    expect(ADMIN).toContain('supabase.rpc("ocade_open_support_case"');
    expect(ADMIN).toContain('supabase.rpc("ocade_close_support_case"');
    expect(ADMIN).toMatch(/recorded/i);
  });

  it("refuses a reason too short to mean anything, before asking the database", () => {
    expect(ADMIN).toContain("reason.length < 10");
  });
});
