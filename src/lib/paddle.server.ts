/**
 * Server-side Paddle webhook verification.
 *
 * Free-launch mode does not start new checkouts, but signed historical/provider
 * events may still arrive and must remain auditable. Verification intentionally
 * uses Node core crypto rather than a provider SDK so the security boundary is
 * small, deterministic and present in the lockfile-independent runtime.
 *
 * IMPORTANT: the exact raw request body is authenticated before JSON parsing.
 * Re-serializing JSON before verification would change the signed payload.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export const EventName = {
  SubscriptionCreated: "subscription.created",
  SubscriptionUpdated: "subscription.updated",
  SubscriptionCanceled: "subscription.canceled",
} as const;

/** `sandbox` is the test environment; `live` takes real money. */
export type PaddleEnv = "sandbox" | "live";

export type VerifiedPaddleEvent = {
  eventType: string;
  data: unknown;
};

const SIGNATURE_TOLERANCE_SECONDS = 5;
const HEX_SHA256 = /^[a-f0-9]{64}$/i;

export function isPaddleEnv(value: string | null): value is PaddleEnv {
  return value === "sandbox" || value === "live";
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");
}

function parseSignatureHeader(header: string) {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const rawPart of header.split(";")) {
    const separator = rawPart.indexOf("=");
    if (separator < 1) continue;
    const key = rawPart.slice(0, separator).trim();
    const value = rawPart.slice(separator + 1).trim();
    if (key === "ts" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "h1" && HEX_SHA256.test(value)) signatures.push(value.toLowerCase());
  }

  if (timestamp === null || !Number.isSafeInteger(timestamp) || signatures.length === 0) {
    throw new Error("Malformed Paddle-Signature header");
  }

  return { timestamp, signatures };
}

function constantTimeHexEqual(leftHex: string, rightHex: string) {
  if (!HEX_SHA256.test(leftHex) || !HEX_SHA256.test(rightHex)) return false;
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseVerifiedEvent(body: string): VerifiedPaddleEvent {
  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch {
    throw new Error("Verified Paddle webhook body is not valid JSON");
  }

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Verified Paddle webhook body is not an event object");
  }

  const record = decoded as Record<string, unknown>;
  const eventType =
    typeof record.event_type === "string"
      ? record.event_type
      : typeof record.eventType === "string"
        ? record.eventType
        : null;

  if (!eventType || !("data" in record)) {
    throw new Error("Verified Paddle webhook is missing event_type or data");
  }

  return { eventType, data: record.data };
}

/**
 * Verify a webhook signature before believing a single field of the body.
 *
 * Paddle signs `${timestamp}:${rawBody}` with HMAC-SHA256. Multiple `h1`
 * signatures may be present during secret rotation, so any valid `h1` is
 * accepted. The timestamp must also be within the replay window.
 */
export async function verifyWebhook(
  req: Request,
  env: PaddleEnv,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifiedPaddleEvent> {
  const signatureHeader = req.headers.get("paddle-signature");
  const body = await req.text();

  if (!signatureHeader || !body) {
    throw new Error("Missing Paddle signature or body");
  }

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const ageSeconds = Math.abs(nowSeconds - timestamp);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error("Paddle webhook timestamp is outside the replay window");
  }

  const secret = getWebhookSecret(env);
  const signedPayload = `${timestamp}:${body}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  if (!signatures.some((signature) => constantTimeHexEqual(signature, expected))) {
    throw new Error("Invalid Paddle webhook signature");
  }

  return parseVerifiedEvent(body);
}
