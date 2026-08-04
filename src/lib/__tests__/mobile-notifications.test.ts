import { describe, it, expect, beforeEach } from "vitest";
import {
  safeBody,
  approvalNotification,
  expiredNotification,
  stoppedNotification,
  revokedNotification,
  inQuietHours,
  notify,
  setNotificationTransport,
  UnavailableNotifications,
  NOTIFICATIONS_UNAVAILABLE,
  SAFE_BODY,
  type OcadeNotification,
  type PermissionState,
} from "../mobile/notifications";
import { createApprovalRequest } from "../mobile/pairing";

const NOW = new Date("2026-07-23T10:00:00Z");

let seq = 0;
function request(summary: string, risk: "confirm" | "high" | "low" = "confirm") {
  return createApprovalRequest({ id: `req-${++seq}`, summary, risk, now: NOW });
}

/** Transport that records what it was asked to deliver. */
function fake(permission: PermissionState = "granted", ok = true) {
  const sent: OcadeNotification[] = [];
  setNotificationTransport({
    permission: async () => permission,
    request: async () => permission,
    deliver: async (n) => {
      sent.push(n);
      return ok;
    },
  });
  return sent;
}

beforeEach(() => setNotificationTransport(new UnavailableNotifications()));

/**
 * A notification is shown on the lock screen, readable by anyone holding the
 * phone. These are the strictest content rules in the product.
 */
describe("what may appear on a lock screen", () => {
  it.each([
    "your password is hunter2",
    "the OTP is 483920",
    "card number 4111111111111111",
    "recovery code alpha-bravo",
  ])("replaces the WHOLE body when it contains protected content: %s", (text) => {
    const body = safeBody(text);
    expect(body).toBe(SAFE_BODY);
  });

  it("does not merely mask in place — length and context must not leak", () => {
    const body = safeBody("your password is hunter2 for the bank account");
    expect(body).not.toContain("bank");
    expect(body).not.toContain("hunter2");
    expect(body).toBe(SAFE_BODY);
  });

  it("keeps an ordinary summary readable", () => {
    expect(safeBody("Open the quarterly report")).toBe("Open the quarterly report");
  });

  it("falls back to a safe body when there is nothing to say", () => {
    expect(safeBody("")).toBe(SAFE_BODY);
    expect(safeBody("   ")).toBe(SAFE_BODY);
  });

  it("truncates a long body rather than letting the OS cut it mid-word", () => {
    const body = safeBody("x".repeat(400));
    expect(body.length).toBeLessThanOrEqual(120);
    expect(body.endsWith("…")).toBe(true);
  });

  it("never carries an authorisation token — only a correlation id", () => {
    const n = approvalNotification(request("Open the report"));
    expect(n.referenceId).toBeTruthy();
    expect(JSON.stringify(n)).not.toMatch(/token|secret|key|mac|nonce/i);
  });

  it("sanitises a protected approval summary before it is ever sent", () => {
    const n = approvalNotification(request("type the password hunter2"));
    expect(n.body).toBe(SAFE_BODY);
  });
});

describe("notification kinds", () => {
  it("marks a risky approval urgent so it breaks through", () => {
    expect(approvalNotification(request("Open a file", "high")).urgent).toBe(true);
    expect(approvalNotification(request("Look at a window", "low")).urgent).toBe(false);
  });

  it("says plainly that an expired request did NOT run", () => {
    expect(expiredNotification(request("Open a file")).body).toMatch(/did not run/i);
  });

  it("treats emergency stop and revocation as urgent", () => {
    expect(stoppedNotification("Pixel").urgent).toBe(true);
    expect(revokedNotification("Pixel").urgent).toBe(true);
  });

  it("sanitises a device label too — it is user-supplied text", () => {
    expect(revokedNotification("my password is hunter2").body).toContain(SAFE_BODY);
  });
});

describe("quiet hours", () => {
  it("is inactive with no window configured", () => {
    expect(inQuietHours(null, NOW)).toBe(false);
  });

  it("handles a window that wraps past midnight", () => {
    const quiet = { fromHour: 22, toHour: 7 };
    expect(inQuietHours(quiet, new Date("2026-07-23T23:30:00"))).toBe(true);
    expect(inQuietHours(quiet, new Date("2026-07-23T03:00:00"))).toBe(true);
    expect(inQuietHours(quiet, new Date("2026-07-23T12:00:00"))).toBe(false);
  });

  it("handles a same-day window", () => {
    const quiet = { fromHour: 9, toHour: 17 };
    expect(inQuietHours(quiet, new Date("2026-07-23T10:00:00"))).toBe(true);
    expect(inQuietHours(quiet, new Date("2026-07-23T18:00:00"))).toBe(false);
  });

  it("an empty window silences nothing", () => {
    expect(inQuietHours({ fromHour: 5, toHour: 5 }, new Date("2026-07-23T05:30:00"))).toBe(false);
  });
});

describe("delivery", () => {
  it("reports honestly when there is no mobile app rather than faking delivery", async () => {
    const r = await notify(approvalNotification(request("Open a file")));
    expect(r.delivered).toBe(false);
    expect(r.reason).toBe(NOTIFICATIONS_UNAVAILABLE);
  });

  it("refuses when the user has turned notifications off", async () => {
    fake("denied");
    const r = await notify(approvalNotification(request("Open a file")));
    expect(r.delivered).toBe(false);
    expect(r.reason).toMatch(/turned off/i);
  });

  it("delivers a permitted notification", async () => {
    const sent = fake("granted");
    const r = await notify(approvalNotification(request("Open a file")));
    expect(r.delivered).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("holds a routine notification during quiet hours", async () => {
    const sent = fake("granted");
    const r = await notify(approvalNotification(request("Look at a window", "low")), {
      quietHours: { fromHour: 22, toHour: 7 },
      now: new Date("2026-07-23T23:30:00"),
    });
    expect(r.delivered).toBe(false);
    expect(sent).toHaveLength(0);
  });

  /**
   * Silencing "everything stopped" would hide exactly the event the user most
   * needs to see. Quiet hours must never suppress it.
   */
  it("NEVER suppresses an emergency stop for quiet hours", async () => {
    const sent = fake("granted");
    const r = await notify(stoppedNotification("Pixel"), {
      quietHours: { fromHour: 22, toHour: 7 },
      now: new Date("2026-07-23T23:30:00"),
    });
    expect(r.delivered).toBe(true);
    expect(sent[0].kind).toBe("emergency.stopped");
  });

  it("reports a transport failure instead of claiming success", async () => {
    fake("granted", false);
    const r = await notify(stoppedNotification("Pixel"));
    expect(r.delivered).toBe(false);
    expect(r.reason).toMatch(/could not be sent/i);
  });
});
