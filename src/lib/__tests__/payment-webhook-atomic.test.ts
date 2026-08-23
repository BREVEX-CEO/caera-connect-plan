import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const route = readFileSync("src/routes/api/public/payments/webhook.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260823110000_atomic_payment_webhook_state.sql",
  "utf8",
);
const entitlementMigration = readFileSync(
  "supabase/migrations/20260823111000_payment_entitlement_invoker.sql",
  "utf8",
);

describe("verified payment events apply atomically", () => {
  it("uses one database RPC rather than claim, mutate, then audit calls", () => {
    expect(route).toContain('.rpc("apply_payment_webhook_event"');
    expect(route).not.toContain('.from("payment_webhook_events").insert');
    expect(route).not.toContain('.from("subscriptions").upsert');
  });

  it("claims the provider event and changes entitlement in one PostgreSQL function", () => {
    expect(migration).toContain("insert into public.payment_webhook_events");
    expect(migration).toContain("insert into public.subscriptions");
    expect(migration).toContain("update public.subscriptions");
    expect(migration).toContain("on conflict (event_id) do nothing");
  });

  it("repeats stale, environment and terminal-state guards under the database lock", () => {
    expect(migration).toContain("public.subscriptions.environment = excluded.environment");
    expect(migration).toMatch(/provider_event_at[^\n]*<= excluded\.provider_event_at/);
    expect(migration).toContain("p_allow_terminal_reversal");
    expect(migration).toContain("target_missing_stale_or_terminal");
  });

  it("keeps the writer inaccessible to browser roles", () => {
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/);
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
  });
});

describe("entitlement checks cannot probe another account", () => {
  it("runs as the caller so subscriptions RLS remains authoritative", () => {
    expect(entitlementMigration).toContain("security invoker");
    expect(entitlementMigration).toContain("set search_path = ''");
    expect(entitlementMigration).not.toContain("security definer");
  });

  it("does not treat refunded, disputed, past-due, or canceled rows as active", () => {
    expect(entitlementMigration).toContain("status in ('active', 'trialing')");
    expect(entitlementMigration).not.toMatch(/status in \([^)]*past_due/);
    expect(entitlementMigration).not.toMatch(/status\s*=\s*'canceled'/);
  });
});
