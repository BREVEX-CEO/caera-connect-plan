import { describe, expect, it, vi } from "vitest";
import {
  attentionCount,
  DELIVERY_WINDOW_MS,
  loadAuditEvents,
  loadNotificationDelivery,
  loadUsageWindows,
  OPERATIONS_LIMITS,
  type DeliveryRow,
} from "../operations";

/**
 * The operations reads, against a client that answers.
 *
 * What is worth pinning here is not that a select happens — it is the shape of
 * each answer, because every one of them has a wrong version that looks right:
 * usage read in the wrong unit, a truncated list presented as complete, an
 * organization name filled in with an identifier, and a delivery state that
 * means "no sender configured" counted as a failure somebody must chase.
 *
 * The module resolves its client through `loadSupabaseClient`, so the mock is
 * on that rather than on a parameter: the production call sites take no client,
 * and adding one purely for tests would put a seam in the product that nothing
 * else uses.
 */

let currentClient: unknown = null;

vi.mock("@/integrations/supabase/on-demand", () => ({
  loadSupabaseClient: async () => currentClient,
}));

type Answer = { data: unknown; error: unknown };

function client(answers: Record<string, Answer>, rpc?: Answer) {
  const captured: { since?: string } = {};
  return {
    captured,
    client: {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          order: () => chain,
          limit: () => Promise.resolve(answers[table] ?? { data: [], error: null }),
        };
        return chain;
      },
      rpc: async (_name: string, args: { p_since: string }) => {
        captured.since = args.p_since;
        return rpc ?? { data: [], error: null };
      },
    },
  };
}

describe("commercial usage windows", () => {
  it("converts the stored hundredths into the unit the screen shows", async () => {
    const built = client({
      ocade_commercial_usage: {
        data: [
          {
            user_id: "u1",
            window_kind: "session",
            window_start: "2026-09-04T00:00:00.000Z",
            used_hundredths: 275,
            updated_at: "2026-09-04T01:00:00.000Z",
          },
        ],
        error: null,
      },
    });
    currentClient = built.client;
    const result = await loadUsageWindows();
    // 2.75, not 275 and not 2. A spent window shown as untouched because the
    // unit was wrong is the failure this exists to prevent.
    expect(result.rows[0]?.used).toEqual(2.75);
    expect(result.rows[0]?.id).toEqual("u1:session:2026-09-04T00:00:00.000Z");
    expect(result.truncated).toBe(false);
  });

  it("says when the read came back at its cap", async () => {
    const rows = Array.from({ length: OPERATIONS_LIMITS.usageWindows }, (_, index) => ({
      user_id: `u${index}`,
      window_kind: "session",
      window_start: "2026-09-04T00:00:00.000Z",
      used_hundredths: 100,
      updated_at: "2026-09-04T00:00:00.000Z",
    }));
    currentClient = client({ ocade_commercial_usage: { data: rows, error: null } }).client;
    const result = await loadUsageWindows();
    expect(result.truncated, "a prefix was presented as the whole list").toBe(true);
  });

  it("throws rather than reporting an empty deployment when the read fails", async () => {
    currentClient = client({
      ocade_commercial_usage: { data: null, error: { message: "denied" } },
    }).client;
    // "No allowance has been spent" and "you cannot read this" are different
    // sentences, and only one of them is true.
    await expect(loadUsageWindows()).rejects.toBeTruthy();
  });
});

describe("the organization audit log", () => {
  it("names the organization, and leaves it absent rather than showing an id", async () => {
    currentClient = client({
      ocade_organization_events: {
        data: [
          {
            id: "e1",
            organization_id: "o1",
            event: "policy.changed",
            actor_id: "u1",
            subject_id: null,
            created_at: "2026-09-04T00:00:00.000Z",
          },
          {
            id: "e2",
            organization_id: "o-unknown",
            event: "member.removed",
            actor_id: "u1",
            subject_id: "u2",
            created_at: "2026-09-03T00:00:00.000Z",
          },
        ],
        error: null,
      },
      ocade_organizations: { data: [{ id: "o1", name: "Northwind" }], error: null },
    }).client;
    const result = await loadAuditEvents();
    expect(result.rows[0]?.organizationName).toEqual("Northwind");
    expect(result.rows[1]?.organizationName).toBeNull();
  });
});

describe("notification delivery", () => {
  it("asks for the seven-day window, not for everything ever sent", async () => {
    const built = client({}, { data: [], error: null });
    currentClient = built.client;
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    await loadNotificationDelivery(now);
    expect(Date.parse(built.captured.since ?? "")).toEqual(now - DELIVERY_WINDOW_MS);
  });

  it("groups by the combination the aggregate returned", async () => {
    currentClient = client(
      {},
      {
        data: [{ category: "security", channel: "email", state: "dead_letter", occurrences: 3 }],
        error: null,
      },
    ).client;
    const result = await loadNotificationDelivery();
    expect(result.rows[0]?.id).toEqual("security:email:dead_letter");
    expect(result.rows[0]?.occurrences).toEqual(3);
  });
});

describe("what needs somebody's attention", () => {
  const rows = (entries: Partial<DeliveryRow>[]): DeliveryRow[] =>
    entries.map((entry, index) => ({
      id: `r${index}`,
      category: "account",
      channel: "email",
      state: "sent",
      occurrences: 1,
      ...entry,
    }));

  it("counts failures and dead letters", () => {
    expect(
      attentionCount(
        rows([
          { state: "failed", occurrences: 2 },
          { state: "dead_letter", occurrences: 5 },
        ]),
      ),
    ).toEqual(7);
  });

  it("does not count a channel the deployment has no sender for", () => {
    /*
     * `unavailable` is a truthful state, not a failure. Counting it would have
     * an operator chasing a provider that was never meant to exist — and on a
     * deployment with no email sender that is every notification ever recorded.
     */
    expect(attentionCount(rows([{ state: "unavailable", occurrences: 900 }]))).toEqual(0);
  });

  it("does not count what was delivered or is still held", () => {
    expect(
      attentionCount(
        rows([
          { state: "sent", occurrences: 40 },
          { state: "held", occurrences: 3 },
        ]),
      ),
    ).toEqual(0);
  });
});
