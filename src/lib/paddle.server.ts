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

/** `sandbox` is the test environment; `live` takes real money. */
export type PaddleEnv = "sandbox" | "live";

export type VerifiedPaddleEvent = {
  /**
   * The provider's id for this delivery. REQUIRED, because it is the only
   * thing that makes a retry distinguishable from a second purchase.
   *
   * It used to be discarded here. Providers retry by contract, so the same
   * event arrives more than once as a matter of course, and without this a
   * retried completion writes a second entitlement for one payment.
   */
  eventId: string;
  eventType: string;
  /**
   * The provider's own timestamp. Also required, and also previously
   * discarded: delivery order is not guaranteed, so this is the only thing
   * that stops a `subscription.updated` held up in a retry queue from arriving
   * after the cancellation that superseded it and handing back access.
   */
  occurredAt: string;
  data: unknown;
};

const SIGNATURE_TOLERANCE_SECONDS = 5;

/**
 * The largest webhook body OCADE will read.
 *
 * A provider event is a few kilobytes. 64 KiB is generous enough that a schema
 * change cannot break delivery and small enough that a flood of them cannot
 * exhaust an isolate.
 */
const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;
const HEX_SHA256 = /^[a-f0-9]{64}$/i;

export function isPaddleEnv(value: string | null): value is PaddleEnv {
  return value === "sandbox" || value === "live";
}

function getWebhookSecret(env: PaddleEnv): string {
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

  const eventId = typeof record.event_id === "string" ? record.event_id : record.eventId;
  const occurredAt =
    typeof record.occurred_at === "string" ? record.occurred_at : record.occurredAt;

  /*
   * FAIL CLOSED. An event with no id cannot be de-duplicated and an event with
   * no timestamp cannot be ordered, so applying either is precisely the replay
   * and out-of-order risk this endpoint exists to resist. Paddle sends both on
   * every event; anything that does not is not a Paddle event.
   */
  if (typeof eventId !== "string" || eventId.length === 0) {
    throw new Error("Verified Paddle webhook is missing event_id");
  }
  if (typeof occurredAt !== "string" || Number.isNaN(new Date(occurredAt).getTime())) {
    throw new Error("Verified Paddle webhook is missing a usable occurred_at");
  }

  return { eventId, eventType, occurredAt, data: record.data };
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

  /*
   * REFUSE BEFORE READING THE BODY.
   *
   * This endpoint is unauthenticated by necessity — the provider has no OCADE
   * session — so anybody on the internet can post to it. Reading the body first
   * and checking the header afterwards meant an attacker could make the Worker
   * buffer an arbitrary payload by sending no signature at all: free memory
   * pressure, no signature to forge, nothing logged as an attack.
   *
   * The header is a few dozen bytes and settles the question, so it is checked
   * first, and the body is size-capped either way. The provider's events are
   * small; anything past the cap is not one.
   */
  if (!signatureHeader) {
    throw new Error("Missing Paddle signature");
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    throw new Error("Paddle webhook body is too large");
  }

  const body = await req.text();
  if (!body) {
    throw new Error("Missing Paddle body");
  }
  /*
   * Checked again after reading, because `content-length` is a claim by the
   * sender and a chunked request carries none at all.
   */
  if (body.length > MAX_WEBHOOK_BODY_BYTES) {
    throw new Error("Paddle webhook body is too large");
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

/**
 * Direct REST access to the provider API.
 *
 * The provider SDK is not a dependency of this app: the two calls we make are
 * plain authenticated JSON requests, and an SDK would add a large surface for
 * no behavioural gain. Credentials come from the environment, so an
 * unconfigured environment throws "... is not configured" and callers report
 * "payments are not connected" rather than inventing a status.
 */
const API_BASE: Record<PaddleEnv, string> = {
  sandbox: "https://sandbox-api.paddle.com",
  live: "https://api.paddle.com",
};

function getApiKey(env: PaddleEnv): string {
  return env === "sandbox" ? getEnv("PAYMENTS_SANDBOX_API_KEY") : getEnv("PAYMENTS_LIVE_API_KEY");
}

async function gatewayFetch(
  env: PaddleEnv,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const apiKey = getApiKey(env);
  return fetch(`${API_BASE[env]}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
}

async function gatewayJson<T>(env: PaddleEnv, path: string, init?: RequestInit): Promise<T> {
  const response = await gatewayFetch(env, path, init);
  if (!response.ok) {
    throw new Error(`The payment provider returned ${response.status} for ${path}.`);
  }
  const body = (await response.json()) as { data?: T };
  return body.data as T;
}

interface PortalSession {
  urls?: {
    general?: { overview?: string };
    subscriptions?: Array<{ cancelSubscription?: string }>;
  };
}
