import { describe, it, expect } from "vitest";
import {
  createTaskScope,
  checkScope,
  expireScopeIfDue,
  recordStep,
  completeScope,
  cancelScope,
  describeScope,
  SCOPE_TTL_MS,
} from "../skills/task-scope";

const NOW = new Date("2026-07-23T10:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

const scope = () =>
  createTaskScope({
    id: "t1",
    summary: "Tidy up the invoices folder",
    capabilities: ["file.open", "window.list", "app.open"],
    apps: ["notes"],
    paths: ["C:/Work/Invoices"],
    now: NOW,
  });

/**
 * One approval per task. Repeated prompts are not extra safety — they train
 * people to click Approve without reading.
 */
describe("acting inside an approved scope", () => {
  it("permits an approved capability without asking again", () => {
    const d = checkScope({ kind: "window.list" }, scope(), NOW);
    expect(d.allow).toBe(true);
  });

  it("permits a file inside an approved folder", () => {
    const d = checkScope({ kind: "file.open", path: "C:/Work/Invoices/march.pdf" }, scope(), NOW);
    expect(d.allow).toBe(true);
  });

  it("matches an approved folder across path separators and case", () => {
    const d = checkScope({ kind: "file.open", path: "c:\\work\\invoices\\a.pdf" }, scope(), NOW);
    expect(d.allow).toBe(true);
  });

  it("counts steps for the receipt", () => {
    expect(recordStep(recordStep(scope())).steps).toBe(2);
  });
});

/**
 * A scope that does not genuinely bound anything is just a blanket permission.
 */
describe("the boundaries of a scope", () => {
  it("ESCALATES a capability that was not approved", () => {
    const d = checkScope({ kind: "clipboard.write", text: "hello" }, scope(), NOW);
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.escalate).toBe(true);
    expect(d.reason).toContain("Tidy up the invoices folder");
  });

  it("escalates an app that was not approved", () => {
    const d = checkScope({ kind: "app.open", appId: "banking" }, scope(), NOW);
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.reason).toContain("banking");
  });

  it("escalates a file outside the approved folders", () => {
    const d = checkScope({ kind: "file.open", path: "C:/Personal/diary.txt" }, scope(), NOW);
    expect(d.allow).toBe(false);
  });

  /** "/workshop" must not be matched by an approval for "/work". */
  it("requires a real folder boundary, not a string prefix", () => {
    const d = checkScope({ kind: "file.open", path: "C:/Work/InvoicesSecret/x.pdf" }, scope(), NOW);
    expect(d.allow).toBe(false);
  });

  /** A traversal-aware check that tries to be clever is one waiting to be bypassed. */
  it("REFUSES a path containing .. rather than resolving it", () => {
    const d = checkScope(
      { kind: "file.open", path: "C:/Work/Invoices/../../Personal/diary.txt" },
      scope(),
      NOW,
    );
    expect(d.allow).toBe(false);
  });

  it("refuses everything when no scope has been approved", () => {
    const d = checkScope({ kind: "window.list" }, null, NOW);
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.escalate).toBe(true);
    expect(d.reason).toMatch(/hasn't been approved/i);
  });
});

/**
 * No approval can cover protected input. This must hold even for a scope that
 * explicitly lists the capability.
 */
describe("protected input is outside every scope", () => {
  it("refuses without escalating — no further approval can help", () => {
    const wide = createTaskScope({
      id: "t2",
      summary: "Anything",
      capabilities: ["text.type"],
      now: NOW,
    });
    const d = checkScope({ kind: "text.type", text: "my password is hunter2" }, wide, NOW);
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.escalate).toBe(false);
    expect(d.reason).toMatch(/enter it yourself/i);
  });

  it("is refused even before the no-scope check", () => {
    const d = checkScope({ kind: "text.type", text: "the OTP is 483920" }, null, NOW);
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.escalate).toBe(false);
  });
});

describe("a scope does not outlive its task", () => {
  it("expires after its window", () => {
    const s = expireScopeIfDue(scope(), later(SCOPE_TTL_MS + 1000));
    expect(s.status).toBe("expired");
  });

  it("refuses once expired, and says how to continue", () => {
    const d = checkScope({ kind: "window.list" }, scope(), later(SCOPE_TTL_MS + 1000));
    expect(d.allow).toBe(false);
    if (d.allow) throw new Error("unreachable");
    expect(d.reason).toMatch(/expired/i);
  });

  it("stays active up to the deadline", () => {
    expect(checkScope({ kind: "window.list" }, scope(), later(SCOPE_TTL_MS - 1000)).allow).toBe(
      true,
    );
  });

  it("refuses after completion or cancellation", () => {
    expect(checkScope({ kind: "window.list" }, completeScope(scope()), NOW).allow).toBe(false);
    expect(checkScope({ kind: "window.list" }, cancelScope(scope()), NOW).allow).toBe(false);
  });

  it("expiring an already-finished scope does not resurrect it", () => {
    expect(expireScopeIfDue(cancelScope(scope()), later(SCOPE_TTL_MS + 1)).status).toBe(
      "cancelled",
    );
  });

  it("rejects invalid or unbounded approval times at creation", () => {
    for (const ttlMs of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(() =>
        createTaskScope({
          id: "bad",
          summary: "Invalid approval",
          capabilities: ["window.list"],
          now: NOW,
          ttlMs,
        }),
      ).toThrow(/approval|expiry|duration/i);
    }
    expect(() =>
      createTaskScope({
        id: "bad-now",
        summary: "Invalid approval",
        capabilities: ["window.list"],
        now: new Date(Number.NaN),
      }),
    ).toThrow(/time/i);
  });

  it("fails closed on a forged scope with invalid dates or counters", () => {
    const forged = {
      ...scope(),
      expiresAt: new Date(Number.NaN),
      steps: Number.NaN,
    };
    const d = checkScope({ kind: "window.list" }, forged, NOW);
    expect(d.allow).toBe(false);
    if (!d.allow) {
      expect(d.escalate).toBe(false);
      expect(d.reason).toMatch(/invalid|malformed/i);
    }
  });
});

describe("what the user is asked to approve", () => {
  it("states the actions, apps, folders and duration", () => {
    const text = describeScope(scope());
    expect(text).toMatch(/3 kinds of action/);
    expect(text).toMatch(/1 app/);
    expect(text).toMatch(/1 folder/);
    expect(text).toMatch(/30 minutes/);
    expect(text).toMatch(/ask again for anything else/i);
  });
});
