import { describe, expect, it, vi } from "vitest";

/** F-097: a failed read in a customer's detail must fail, never look like an unused account. */

vi.mock("@tanstack/react-start", () => {
  const builder = {
    middleware: () => builder,
    validator: () => builder,
    handler: (fn: unknown) => fn,
  };
  return { createServerFn: () => builder };
});
vi.mock("@/lib/security/session-middleware", () => ({ requireSession: {} }));
vi.mock("@/lib/security/assurance-middleware", () => ({
  HIGH_RISK: {},
  requireAssurance: () => ({}),
}));
vi.mock("../access.functions", () => ({ assertStaff: async () => undefined }));
vi.mock("@/lib/commercial/entitlement-resolver", () => ({ unlimitedFor: async () => null }));

const down = vi.hoisted(() => ({ table: "" }));
const result = (name: string, data: unknown) =>
  Promise.resolve(
    down.table === name ? { data: null, error: { message: "unavailable" } } : { data, error: null },
  );
const query = (name: string) => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => result(name, []),
  };
  return chain;
};
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (name: string) => result(name, []),
    from: query,
    auth: {
      admin: {
        getUserById: () => result("user", { user: { last_sign_in_at: null } }),
        mfa: { listFactors: () => result("factors", { factors: [] }) },
      },
    },
  },
}));

const { readCustomer } = await import("../staff.functions");
const handler = readCustomer as unknown as (input: {
  data: { userId: string };
  context: unknown;
}) => Promise<unknown>;
const context = { supabase: { rpc: async () => ({ data: true, error: null }) } };
const read = () => handler({ data: { userId: "0e0e0e0e-5555-4eee-8eee-eeeeeeeeeeee" }, context });

describe("customer detail", () => {
  it("reads an empty account as empty", async () => {
    down.table = "";
    await expect(read()).resolves.toMatchObject({ usage: [], tasks: [] });
  });

  it.each([
    "ocade_read_commercial_usage",
    "ocade_generation_permits",
    "jarvis_tasks",
    "user",
    "factors",
    "ocade_list_account_sessions",
  ])("fails when %s cannot be read", async (table) => {
    down.table = table;
    await expect(read()).rejects.toThrow(/could not be read/);
  });
});
