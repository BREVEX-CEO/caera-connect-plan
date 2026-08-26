import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { EventName, verifyWebhook } from "@/lib/paddle.server";

const ORIGINAL_SANDBOX_SECRET = process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
const SECRET = "pdl_ntfset_test_secret_for_ocade";
const NOW = 1_786_964_400;

function signedRequest(body: string, timestamp = NOW, signatures?: string[]) {
  const expected = createHmac("sha256", SECRET)
    .update(`${timestamp}:${body}`, "utf8")
    .digest("hex");
  const h1 = signatures ?? [expected];

  return new Request("https://ocade.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paddle-signature": [`ts=${timestamp}`, ...h1.map((value) => `h1=${value}`)].join(";"),
    },
    body,
  });
}

afterEach(() => {
  if (ORIGINAL_SANDBOX_SECRET === undefined) {
    delete process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"];
  } else {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = ORIGINAL_SANDBOX_SECRET;
  }
});

describe("Paddle webhook verification", () => {
  it("authenticates the exact raw body before returning the event", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SECRET;
    const body = JSON.stringify({
      event_type: EventName.SubscriptionUpdated,
      event_id: "evt_fixture",
      occurred_at: "2026-03-01T12:00:00.000Z",
      data: { id: "sub_123", status: "active" },
    });

    await expect(verifyWebhook(signedRequest(body), "sandbox", NOW)).resolves.toEqual({
      eventId: "evt_fixture",
      eventType: EventName.SubscriptionUpdated,
      occurredAt: "2026-03-01T12:00:00.000Z",
      data: { id: "sub_123", status: "active" },
    });
  });

  it("accepts any valid h1 during signature rotation", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SECRET;
    const body = JSON.stringify({
      event_type: EventName.SubscriptionCreated,
      event_id: "evt_fixture",
      occurred_at: "2026-03-01T12:00:00.000Z",
      data: { id: "sub_1" },
    });
    const valid = createHmac("sha256", SECRET).update(`${NOW}:${body}`, "utf8").digest("hex");
    const invalid = "0".repeat(64);

    await expect(
      verifyWebhook(signedRequest(body, NOW, [invalid, valid]), "sandbox", NOW),
    ).resolves.toMatchObject({ eventType: EventName.SubscriptionCreated });
  });

  it("rejects a modified body or incorrect signature", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SECRET;
    const body = JSON.stringify({
      event_type: EventName.SubscriptionCanceled,
      event_id: "evt_fixture",
      occurred_at: "2026-03-01T12:00:00.000Z",
      data: { id: "sub_2" },
    });
    const request = signedRequest(body, NOW, ["f".repeat(64)]);

    await expect(verifyWebhook(request, "sandbox", NOW)).rejects.toThrow(
      /invalid paddle webhook signature/i,
    );
  });

  it("rejects replayed or future-dated signatures outside the tolerance", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SECRET;
    const body = JSON.stringify({
      event_type: EventName.SubscriptionUpdated,
      event_id: "evt_fixture",
      occurred_at: "2026-03-01T12:00:00.000Z",
      data: { id: "sub_3" },
    });

    await expect(verifyWebhook(signedRequest(body, NOW - 6), "sandbox", NOW)).rejects.toThrow(
      /replay window/i,
    );
    await expect(verifyWebhook(signedRequest(body, NOW + 6), "sandbox", NOW)).rejects.toThrow(
      /replay window/i,
    );
  });

  it("rejects malformed headers and parses JSON only after signature verification", async () => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SECRET;
    const malformed = new Request("https://ocade.test/webhook", {
      method: "POST",
      headers: { "paddle-signature": "ts=not-a-number;h1=bad" },
      body: "not-json",
    });

    await expect(verifyWebhook(malformed, "sandbox", NOW)).rejects.toThrow(
      /malformed paddle-signature/i,
    );
  });
});

/**
 * The two fields that make the handler safe, and why verification refuses
 * without them.
 *
 * They were being parsed away: `parseVerifiedEvent` returned only `eventType`
 * and `data`. An event with no id cannot be told apart from its own retry, and
 * an event with no timestamp cannot be ordered against the one that superseded
 * it — so accepting either is the replay and the resurrection this endpoint
 * exists to resist. Paddle sends both on every event.
 */
describe("an event that cannot be de-duplicated or ordered is refused", () => {
  const signedBody = (payload: Record<string, unknown>) => {
    process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SECRET;
    return signedRequest(JSON.stringify(payload));
  };

  it("refuses an event with no event_id", async () => {
    await expect(
      verifyWebhook(
        signedBody({
          event_type: EventName.SubscriptionUpdated,
          occurred_at: "2026-03-01T12:00:00.000Z",
          data: { id: "sub_1" },
        }),
        "sandbox",
        NOW,
      ),
    ).rejects.toThrow(/event_id/);
  });

  it("refuses an event with no occurred_at", async () => {
    await expect(
      verifyWebhook(
        signedBody({
          event_type: EventName.SubscriptionUpdated,
          event_id: "evt_1",
          data: { id: "sub_1" },
        }),
        "sandbox",
        NOW,
      ),
    ).rejects.toThrow(/occurred_at/);
  });

  it("refuses an occurred_at that is not a real time", async () => {
    await expect(
      verifyWebhook(
        signedBody({
          event_type: EventName.SubscriptionUpdated,
          event_id: "evt_1",
          occurred_at: "the day before yesterday",
          data: { id: "sub_1" },
        }),
        "sandbox",
        NOW,
      ),
    ).rejects.toThrow(/occurred_at/);
  });
});

describe("the endpoint refuses cheaply before it works expensively", () => {
  it("rejects a missing signature without reading the body", async () => {
    /*
     * The order matters and is the point of the test. Reading first meant
     * anybody could make the Worker buffer an arbitrary payload by sending no
     * signature at all: free memory pressure, nothing to forge, nothing that
     * looked like an attack. A body that would blow the cap is used here, so a
     * regression that reads first fails on the size rather than passing.
     */
    let bodyRead = false;
    const request = new Request("https://ocade.in/api/public/payments/webhook", {
      method: "POST",
      body: "x",
    });
    const spied = new Proxy(request, {
      get(target, prop, receiver) {
        if (prop === "text") {
          return async () => {
            bodyRead = true;
            return "x";
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await expect(verifyWebhook(spied as Request, "sandbox")).rejects.toThrow(/signature/i);
    expect(bodyRead).toBe(false);
  });

  it("refuses a body far larger than any real event", async () => {
    const request = new Request("https://ocade.in/api/public/payments/webhook", {
      method: "POST",
      headers: {
        "paddle-signature": "ts=1;h1=deadbeef",
        "content-length": String(2 * 1024 * 1024),
      },
      body: "{}",
    });
    await expect(verifyWebhook(request, "sandbox")).rejects.toThrow(/too large/i);
  });

  it("refuses an oversized chunked body, which declares no length at all", async () => {
    const request = new Request("https://ocade.in/api/public/payments/webhook", {
      method: "POST",
      headers: { "paddle-signature": "ts=1;h1=deadbeef" },
      body: "y".repeat(70 * 1024),
    });
    await expect(verifyWebhook(request, "sandbox")).rejects.toThrow(/too large/i);
  });
});
