import { describe, it, expect, beforeEach, vi } from "vitest";
import { APPROVAL_TTL_MS } from "../mobile/pairing";
import {
  setNotificationTransport,
  UnavailableNotifications,
  type OcadeNotification,
} from "../mobile/notifications";

/**
 * THE APPROVAL QUEUE, WHERE BOTH SIDES OF IT CAN SEE IT.
 *
 * The desktop raises an approval; a phone answers it. Those are two devices, so
 * the queue lived in the wrong place — `localStorage` — and the mobile panel
 * had no producer at all. Most of this file used to be about surviving a
 * reload; the account survives more than a reload, and what is worth proving
 * moved with it:
 *
 *  - a decision is ONE statement, so two phones cannot both decide;
 *  - an expired request cannot be approved, whichever device tries;
 *  - an unreachable account shows nothing rather than a stale list, because a
 *    stale list is how somebody approves what was already answered.
 */

const approvals = vi.hoisted(async () => {
  const { createFakeApprovalStore } = await import("./support/fake-approvals");
  return createFakeApprovalStore();
});

vi.mock("@/integrations/supabase/on-demand", () => ({
  loadSupabaseClient: async () => (await approvals).client,
}));

const store = await approvals;
const { listApprovals, requestApproval, saveApprovalStatus, pruneApprovals, clearApprovals } =
  await import("../mobile/approval-store");

const NOW = new Date("2026-07-23T10:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

/** Move both clocks together: the store's, and the one the caller passes in. */
function at(when: Date) {
  store.setNow(when);
  return when;
}

beforeEach(() => {
  store.reset();
  at(NOW);
  // Default to no transport so notification side effects never leak between
  // tests; the notification suite installs its own.
  setNotificationTransport(new UnavailableNotifications());
});

describe("raising an approval", () => {
  it("stores a pending request the OTHER surface can read", async () => {
    await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const rows = await listApprovals(NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("pending");
    expect(rows[0]!.summary).toBe("Open the report");
  });

  it("round-trips dates rather than leaving strings behind", async () => {
    await requestApproval({ summary: "x", risk: "confirm" }, NOW);
    const [request] = await listApprovals(NOW);
    expect(request!.requestedAt).toBeInstanceOf(Date);
    expect(request!.expiresAt).toBeInstanceOf(Date);
    expect(request!.expiresAt.getTime()).toBeGreaterThan(request!.requestedAt.getTime());
  });

  it("uses the product's own answering window, not a second copy of it", async () => {
    const request = await requestApproval({ summary: "x", risk: "confirm" }, NOW);
    expect(request.expiresAt.getTime() - request.requestedAt.getTime()).toBe(APPROVAL_TTL_MS);
  });

  it("REFUSES rather than pretending, when it could not be stored", async () => {
    /*
     * The caller is about to tell somebody a phone can decide this. Claiming
     * that about a request which does not exist leaves a desktop waiting on an
     * answer nobody will ever be asked for.
     */
    store.failNext();
    await expect(requestApproval({ summary: "x", risk: "high" }, NOW)).rejects.toThrow(
      /could not be saved/i,
    );
  });

  it("refuses when nobody is signed in, because no device could see it", async () => {
    store.signedInAs(null);
    await expect(requestApproval({ summary: "x", risk: "high" }, NOW)).rejects.toThrow(/sign in/i);
  });

  it("refuses a duplicate id instead of raising the same approval twice", async () => {
    await requestApproval({ id: "same", summary: "x", risk: "confirm" }, NOW);
    await expect(
      requestApproval({ id: "same", summary: "x", risk: "confirm" }, NOW),
    ).rejects.toThrow(/already exists/i);
  });
});

/**
 * Expiry is applied on READ, by the server. If it were applied only while a tab
 * was open, a request that lapsed overnight would still show as pending in the
 * morning and could be approved long after the moment had passed.
 */
describe("expiry", () => {
  it("expires a request that lapsed while nothing was watching", async () => {
    await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const rows = await listApprovals(at(later(APPROVAL_TTL_MS + 1000)));
    expect(rows[0]!.status).toBe("expired");
  });

  it("records the expiry, so every surface agrees", async () => {
    await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    await listApprovals(at(later(APPROVAL_TTL_MS + 1000)));
    // Reading again at the ORIGINAL time must not resurrect it as pending.
    expect(store.rows[0]!.status).toBe("expired");
    expect((await listApprovals(NOW))[0]!.status).toBe("expired");
  });

  it("leaves a request pending before its deadline", async () => {
    await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const rows = await listApprovals(at(later(APPROVAL_TTL_MS - 1000)));
    expect(rows[0]!.status).toBe("pending");
  });
});

/**
 * The phone must be told when a decision is needed — and when the chance to
 * decide has passed. Silently expiring leaves the user expecting an outcome
 * that will never arrive.
 */
describe("notifications", () => {
  function capture() {
    const sent: OcadeNotification[] = [];
    setNotificationTransport({
      permission: async () => "granted",
      request: async () => "granted",
      deliver: async (notification) => {
        sent.push(notification);
        return true;
      },
    });
    return sent;
  }

  it("alerts the phone when an approval is raised", async () => {
    const sent = capture();
    await requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    await Promise.resolve();
    await Promise.resolve();
    expect(sent.some((notification) => notification.kind === "approval.requested")).toBe(true);
  });

  it("alerts when a pending request expires", async () => {
    await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const sent = capture();
    await listApprovals(at(later(APPROVAL_TTL_MS + 1000)));
    await Promise.resolve();
    await Promise.resolve();
    expect(sent.some((notification) => notification.kind === "approval.expired")).toBe(true);
  });

  it("does not re-alert an already-expired request on every read", async () => {
    await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const lapsed = at(later(APPROVAL_TTL_MS + 1000));
    await listApprovals(lapsed); // the first read performs the expiry
    const sent = capture();
    await listApprovals(lapsed);
    await listApprovals(lapsed);
    await Promise.resolve();
    expect(sent.filter((notification) => notification.kind === "approval.expired")).toHaveLength(0);
  });

  it("raising an approval still succeeds with no notification transport", async () => {
    setNotificationTransport(new UnavailableNotifications());
    await expect(requestApproval({ summary: "x", risk: "confirm" }, NOW)).resolves.toBeTruthy();
    expect(await listApprovals(NOW)).toHaveLength(1);
  });
});

describe("decisions", () => {
  it("records who decided it, for the audit trail", async () => {
    const request = await requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const saved = await saveApprovalStatus(request.id, "approved", "device-1");
    expect(saved?.status).toBe("approved");
    expect(saved?.decidedByDeviceId).toBe("device-1");
    expect((await listApprovals(NOW))[0]!.status).toBe("approved");
  });

  it("returns null for an unknown id instead of inventing a row", async () => {
    expect(await saveApprovalStatus("nope", "approved")).toBeNull();
  });

  it("cannot approve an EXPIRED request", async () => {
    const request = await requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    at(later(APPROVAL_TTL_MS + 1));
    expect(await saveApprovalStatus(request.id, "approved", "device-1")).toBeNull();
    expect((await listApprovals(later(APPROVAL_TTL_MS + 1)))[0]!.status).toBe("expired");
  });

  it("cannot overwrite a decision that was already recorded", async () => {
    /*
     * THE RACE THIS EXISTS FOR. Two phones answering at the same moment used to
     * both read "pending", both decide, and the second write silently replaced
     * the first — so two people each believed they had decided it, differently.
     * The decision is one conditional statement now: exactly one of them wins
     * and the other is told it was already answered.
     */
    const request = await requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    expect((await saveApprovalStatus(request.id, "approved", "device-1"))?.status).toBe("approved");
    expect(await saveApprovalStatus(request.id, "denied", "device-2")).toBeNull();
    expect((await listApprovals(NOW))[0]).toMatchObject({
      status: "approved",
      decidedByDeviceId: "device-1",
    });
  });

  it("refuses a status the interface never offers", async () => {
    const request = await requestApproval({ summary: "x", risk: "confirm" }, NOW);
    expect(await saveApprovalStatus(request.id, "expired")).toBeNull();
    expect((await listApprovals(NOW))[0]!.status).toBe("pending");
  });
});

describe("housekeeping", () => {
  it("prunes decided and expired rows but keeps pending ones", async () => {
    const first = await requestApproval({ summary: "a", risk: "confirm" }, NOW);
    await requestApproval({ summary: "b", risk: "confirm" }, NOW);
    await saveApprovalStatus(first.id, "denied", "d1");

    expect(await pruneApprovals()).toBe(1);
    const rows = await listApprovals(NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.summary).toBe("b");
  });

  /** A revoked device must not leave decisions outstanding. */
  it("clears everything on revocation", async () => {
    await requestApproval({ summary: "a", risk: "high" }, NOW);
    await clearApprovals();
    expect(await listApprovals(NOW)).toHaveLength(0);
  });
});

describe("an unreachable account is never reported as a decision", () => {
  it("shows NOTHING rather than a stale list", async () => {
    await requestApproval({ summary: "a", risk: "high" }, NOW);
    store.failNext();
    expect(await listApprovals(NOW)).toEqual([]);
  });

  it("does not claim a decision was recorded", async () => {
    const request = await requestApproval({ summary: "a", risk: "high" }, NOW);
    store.failNext();
    expect(await saveApprovalStatus(request.id, "approved", "device-1")).toBeNull();
    // And it is genuinely still waiting, which is what the null says.
    expect((await listApprovals(NOW))[0]!.status).toBe("pending");
  });
});
