import { describe, expect, it } from "vitest";
import {
  DELIVERY_ATTEMPTS,
  afterFailedAttempt,
  deliveryReport,
  describeDelivery,
  hasDeadLetter,
  isDeliveryState,
  parseDeliveryReport,
} from "../delivery";
import { resolveChannels } from "../channels";
import type { DeliveryDecision } from "../preferences";

/**
 * WHAT THE PRODUCT IS ALLOWED TO SAY ABOUT A DELIVERY.
 *
 * §D: "Never claim push works because an abstraction exists." The states here
 * are the vocabulary that rule produces, and the distinction these tests exist
 * to protect is `unavailable` against `dead_letter` — one means "we never
 * promised this", the other "we promised and could not". Collapsing them would
 * let a deployment with no email sender report a failed delivery, which blames
 * the wrong thing and sends somebody looking for a fault that is not there.
 */

const CONFIGURED = resolveChannels({ emailSender: "notifications@example.test" });
const BARE = resolveChannels({});

function decision(overrides: Partial<DeliveryDecision> = {}): DeliveryDecision {
  return { channels: ["in_app"], held: false, reason: "", recorded: true, ...overrides };
}

describe("the delivery report", () => {
  it("names every channel the deployment knows about, not only the ones that got it", () => {
    // A map holding only successes cannot answer "why didn't I get an email?",
    // which is the entire question a delivery state exists to answer.
    const report = deliveryReport(decision(), CONFIGURED);
    expect(Object.keys(report).sort()).toEqual(CONFIGURED.map((channel) => channel.id).sort());
  });

  it("calls an unconfigured channel unavailable rather than failed", () => {
    const report = deliveryReport(decision(), BARE);
    expect(report.in_app).toBe("sent");
    expect(report.email).toBe("unavailable");
    expect(report.web_push).toBe("unavailable");
  });

  it("calls a configured channel that was not chosen held", () => {
    const report = deliveryReport(decision({ channels: ["in_app"] }), CONFIGURED);
    expect(report.email).toBe("held");
  });

  it("holds everything when the decision held everything, and still records", () => {
    const report = deliveryReport(
      decision({ channels: [], held: true, reason: "Held until quiet hours end." }),
      CONFIGURED,
    );
    expect(report.in_app).toBe("held");
    expect(report.email).toBe("held");
    // `recorded` is always true — §D requires the record to survive any
    // preference, and the report never says otherwise.
    expect(Object.values(report)).not.toContain("dead_letter");
  });
});

describe("retry and dead-letter", () => {
  it("stays failed while attempts remain, and dies once they are spent", () => {
    expect(afterFailedAttempt(1)).toBe("failed");
    expect(afterFailedAttempt(DELIVERY_ATTEMPTS - 1)).toBe("failed");
    expect(afterFailedAttempt(DELIVERY_ATTEMPTS)).toBe("dead_letter");
    expect(afterFailedAttempt(DELIVERY_ATTEMPTS + 5)).toBe("dead_letter");
  });

  it("is noticed on a report so the screen can say so", () => {
    expect(hasDeadLetter({ in_app: "sent", email: "dead_letter" })).toBe(true);
    expect(hasDeadLetter({ in_app: "sent", email: "unavailable" })).toBe(false);
  });
});

describe("reading a stored report back", () => {
  it("keeps the states it understands", () => {
    expect(parseDeliveryReport({ in_app: "sent", email: "held" })).toEqual({
      in_app: "sent",
      email: "held",
    });
  });

  it("drops anything it does not, rather than showing a word nobody defined", () => {
    // The column is jsonb: a future sender, or a hand-edited row, can put
    // anything there. Rendering it would put an undefined promise on screen.
    expect(parseDeliveryReport({ in_app: "sent", email: "probably" })).toEqual({ in_app: "sent" });
    expect(parseDeliveryReport(null)).toEqual({});
    expect(parseDeliveryReport(["sent"])).toEqual({});
    expect(parseDeliveryReport("sent")).toEqual({});
  });

  it("recognises exactly the five states and nothing else", () => {
    for (const state of ["sent", "held", "unavailable", "failed", "dead_letter"]) {
      expect(isDeliveryState(state)).toBe(true);
    }
    expect(isDeliveryState("delivered")).toBe(false);
    expect(isDeliveryState(undefined)).toBe(false);
  });
});

describe("what a person is told", () => {
  const email = CONFIGURED.find((channel) => channel.id === "email")!;

  it("distinguishes never-promised from promised-and-failed", () => {
    expect(describeDelivery(email, "unavailable")).toMatch(/not configured/i);
    expect(describeDelivery(email, "unavailable")).toMatch(/nothing was promised/i);
    expect(describeDelivery(email, "dead_letter")).toMatch(/stopped trying/i);
    // And says the notification survived, because that is the thing somebody
    // reading "we gave up" needs to know.
    expect(describeDelivery(email, "dead_letter")).toMatch(/still here/i);
  });

  it("says a retry is coming while one is", () => {
    expect(describeDelivery(email, "failed")).toMatch(/try again/i);
  });

  it("has a sentence for every state, so none renders as blank", () => {
    for (const state of ["sent", "held", "unavailable", "failed", "dead_letter"] as const) {
      expect(describeDelivery(email, state).length, state).toBeGreaterThan(10);
    }
  });
});
