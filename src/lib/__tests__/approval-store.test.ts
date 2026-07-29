import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listApprovals,
  requestApproval,
  saveApprovalStatus,
  pruneApprovals,
  clearApprovals,
} from "../mobile/approval-store";
import { APPROVAL_TTL_MS } from "../mobile/pairing";
import {
  setNotificationTransport,
  UnavailableNotifications,
  type OcadeNotification,
} from "../mobile/notifications";

const NOW = new Date("2026-07-23T10:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  // Default to no transport so notification side effects never leak between
  // tests; the notification suite installs its own.
  setNotificationTransport(new UnavailableNotifications());
});

describe("raising an approval", () => {
  it("stores a pending request the other surface can read", () => {
    requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const rows = listApprovals(NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].summary).toBe("Open the report");
  });

  it("survives a reload — the desktop is blocked waiting on it", () => {
    requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    // A fresh read is the "after reload" case; nothing is held in memory.
    expect(listApprovals(NOW)).toHaveLength(1);
  });

  it("round-trips dates rather than leaving strings behind", () => {
    requestApproval({ summary: "x", risk: "confirm" }, NOW);
    const [r] = listApprovals(NOW);
    expect(r.requestedAt).toBeInstanceOf(Date);
    expect(r.expiresAt).toBeInstanceOf(Date);
    expect(r.expiresAt.getTime()).toBeGreaterThan(r.requestedAt.getTime());
  });
});

/**
 * Expiry is applied on READ. If it were only applied while a tab was open, a
 * request that lapsed overnight would still show as pending in the morning and
 * could be approved long after the moment had passed.
 */
describe("expiry", () => {
  it("expires a request that lapsed while nothing was watching", () => {
    requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const rows = listApprovals(later(APPROVAL_TTL_MS + 1000));
    expect(rows[0].status).toBe("expired");
  });

  it("persists the expiry so every surface agrees", () => {
    requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    listApprovals(later(APPROVAL_TTL_MS + 1000));
    // Reading again at the ORIGINAL time must not resurrect it as pending.
    expect(listApprovals(NOW)[0].status).toBe("expired");
  });

  it("leaves a request pending before its deadline", () => {
    requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    expect(listApprovals(later(APPROVAL_TTL_MS - 1000))[0].status).toBe("pending");
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
      deliver: async (n) => {
        sent.push(n);
        return true;
      },
    });
    return sent;
  }

  it("alerts the phone when an approval is raised", async () => {
    const sent = capture();
    requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    await Promise.resolve();
    await Promise.resolve();
    expect(sent.some((n) => n.kind === "approval.requested")).toBe(true);
  });

  it("alerts when a pending request expires", async () => {
    requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const sent = capture();
    listApprovals(later(APPROVAL_TTL_MS + 1000));
    await Promise.resolve();
    await Promise.resolve();
    expect(sent.some((n) => n.kind === "approval.expired")).toBe(true);
  });

  it("does not re-alert an already-expired request on every read", async () => {
    requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const t = later(APPROVAL_TTL_MS + 1000);
    listApprovals(t); // first read performs the expiry
    const sent = capture();
    listApprovals(t);
    listApprovals(t);
    await Promise.resolve();
    expect(sent.filter((n) => n.kind === "approval.expired")).toHaveLength(0);
  });

  it("raising an approval still succeeds with no notification transport", () => {
    setNotificationTransport(new UnavailableNotifications());
    expect(() => requestApproval({ summary: "x", risk: "confirm" }, NOW)).not.toThrow();
    expect(listApprovals(NOW)).toHaveLength(1);
  });
});

describe("decisions", () => {
  it("records who decided it, for the audit trail", () => {
    const r = requestApproval({ summary: "Open the report", risk: "confirm" }, NOW);
    const saved = saveApprovalStatus(r.id, "approved", "device-1", NOW);
    expect(saved?.status).toBe("approved");
    expect(saved?.decidedByDeviceId).toBe("device-1");
    expect(listApprovals(NOW)[0].status).toBe("approved");
  });

  it("returns null for an unknown id instead of inventing a row", () => {
    expect(saveApprovalStatus("nope", "approved")).toBeNull();
  });

  it("cannot approve an expired durable request", () => {
    const request = requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    expect(
      saveApprovalStatus(request.id, "approved", "device-1", later(APPROVAL_TTL_MS + 1)),
    ).toBeNull();
    expect(listApprovals(later(APPROVAL_TTL_MS + 1))[0].status).toBe("expired");
  });

  it("cannot overwrite a decision that was already recorded", () => {
    const request = requestApproval({ summary: "Open the report", risk: "high" }, NOW);
    expect(saveApprovalStatus(request.id, "approved", "device-1", NOW)?.status).toBe("approved");
    expect(saveApprovalStatus(request.id, "denied", "device-2", later(1))).toBeNull();
    expect(listApprovals(later(1))[0]).toMatchObject({
      status: "approved",
      decidedByDeviceId: "device-1",
    });
  });
});

describe("housekeeping", () => {
  it("prunes decided and expired rows but keeps pending ones", () => {
    const a = requestApproval({ summary: "a", risk: "confirm" }, NOW);
    requestApproval({ summary: "b", risk: "confirm" }, NOW);
    saveApprovalStatus(a.id, "denied", "d1", NOW);

    const removed = pruneApprovals(NOW);
    expect(removed).toBe(1);
    const rows = listApprovals(NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("b");
  });

  /** A revoked device must not leave decisions outstanding. */
  it("clears everything on revocation", () => {
    requestApproval({ summary: "a", risk: "high" }, NOW);
    clearApprovals();
    expect(listApprovals(NOW)).toHaveLength(0);
  });

  it("survives corrupt storage rather than throwing", () => {
    localStorage.setItem("caera:approvals:v1", "{not json");
    expect(() => listApprovals(NOW)).not.toThrow();
    expect(listApprovals(NOW)).toEqual([]);
  });

  it("discards malformed rows instead of crashing on them", () => {
    localStorage.setItem("caera:approvals:v1", JSON.stringify([{ nope: true }, 42, null]));
    expect(listApprovals(NOW)).toEqual([]);
  });

  it("discards approvals with invalid dates, status, or risk", () => {
    localStorage.setItem(
      "caera:approvals:v1",
      JSON.stringify([
        {
          id: "bad-date",
          summary: "x",
          risk: "high",
          requestedAt: "not-a-date",
          expiresAt: NOW.toISOString(),
          status: "pending",
        },
        {
          id: "bad-status",
          summary: "x",
          risk: "high",
          requestedAt: NOW.toISOString(),
          expiresAt: later(1000).toISOString(),
          status: "executed",
        },
        {
          id: "bad-risk",
          summary: "x",
          risk: "credential",
          requestedAt: NOW.toISOString(),
          expiresAt: later(1000).toISOString(),
          status: "pending",
        },
      ]),
    );
    expect(listApprovals(NOW)).toEqual([]);
  });

  it("refuses a duplicate durable approval id", () => {
    requestApproval({ id: "same-id", summary: "first", risk: "confirm" }, NOW);
    expect(() =>
      requestApproval({ id: "same-id", summary: "second", risk: "confirm" }, NOW),
    ).toThrow(/already exists/i);
    expect(listApprovals(NOW)).toHaveLength(1);
  });

  it("does not return a decided approval when its durable write fails", () => {
    const created = requestApproval(
      { id: "persist-fail", summary: "Open report", risk: "high" },
      NOW,
    );
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          {
            id: created.id,
            summary: created.summary,
            risk: created.risk,
            requestedAt: created.requestedAt.toISOString(),
            expiresAt: created.expiresAt.toISOString(),
            status: "pending",
          },
        ]),
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    });

    expect(saveApprovalStatus(created.id, "approved", "d1", NOW)).toBeNull();
  });

  it("throws instead of inventing a durable approval when storage rejects the write", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "[]",
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    });
    expect(() =>
      requestApproval({ id: "cannot-save", summary: "Open report", risk: "high" }, NOW),
    ).toThrow(/could not be saved/i);
  });
});
