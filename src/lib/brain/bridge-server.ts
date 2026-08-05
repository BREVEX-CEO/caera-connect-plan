import {
  authorisePairedRequest,
  pruneNonces,
  type PairingRequest,
  type PairingState,
  type AuthoriseDeps,
} from "./pairing";

/**
 * The desktop side of pairing: the thing a paired browser actually talks to.
 *
 * TRANSPORT-FREE ON PURPOSE. This takes a parsed request and returns a
 * decision plus a response shape; it does not open a socket, and it does not
 * know whether it is being driven by Node's http server, a Tauri command or a
 * test. That is what lets every branch below — including the ones that matter
 * most, the refusals — be exercised without standing up two machines and a
 * certificate.
 *
 * IT NEVER PROXIES BLINDLY. `handleChat` returns a decision; the caller only
 * reaches the engine after `allowed` is true. There is deliberately no code
 * path that forwards a request to the runtime before authorisation, because
 * that is the single mistake that would turn a paired computer into an open
 * inference server.
 */

export interface BridgeRequest {
  path: string;
  method: string;
  headers: Record<string, string | undefined>;
  /** Parsed body, for POSTs. */
  body?: unknown;
}

export interface BridgeResponse {
  status: number;
  /** Serialised by the caller. Never contains the secret or the nonce list. */
  body: unknown;
}

export interface BridgeDeps extends AuthoriseDeps {
  state: PairingState;
  /** What this computer would answer with. Supplied by the desktop shell. */
  describeEngine: () => Promise<{
    label: string;
    modelId: string | null;
    vision: boolean;
    tools: boolean;
  } | null>;
  /** Stream a reply. Only ever called after authorisation succeeds. */
  streamChat: (
    messages: { role: string; content: string; images?: string[] }[],
    handlers: { onToken: (chunk: string) => void; signal?: AbortSignal; think?: boolean },
  ) => Promise<{ ok: boolean; modelId?: string | null; reason?: string }>;
}

/** Pull the four signed headers into the shape the policy expects. */
export function readPairingRequest(
  headers: Record<string, string | undefined>,
  origin: string,
): PairingRequest | null {
  const deviceId = headers["x-ocade-device"];
  const issuedAtRaw = headers["x-ocade-issued-at"];
  const nonce = headers["x-ocade-nonce"];
  const signature = headers["x-ocade-signature"];
  if (!deviceId || !issuedAtRaw || !nonce || !signature) return null;
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return null;
  return { deviceId, origin, issuedAt, nonce, signature };
}

/**
 * Map a denial to an HTTP status.
 *
 * 401 for "prove who you are again", 403 for "you are known and not allowed",
 * 429 for rate limiting. The DISTINCTION MATTERS to the browser adapter: 401
 * and 403 make it tell the user to pair again, while 429 makes it say the
 * computer is busy. Collapsing them into one status would produce the wrong
 * advice for half of the failures.
 */
export function statusForDenial(code: string): number {
  switch (code) {
    case "rate_limited":
      return 429;
    case "unknown_device":
    case "bad_signature":
    case "expired":
    case "clock_skew":
    case "replayed":
      return 401;
    case "revoked":
    case "origin_not_allowed":
      return 403;
    default:
      return 401;
  }
}

/**
 * Authorise one request. Returns null when it may proceed.
 *
 * The refusal body carries a CODE and a sentence, and deliberately nothing
 * else — no hint about which check failed beyond the code itself, no echo of
 * the submitted signature, and never a list of known devices.
 */
export function authoriseBridgeRequest(
  request: BridgeRequest,
  deps: BridgeDeps,
): BridgeResponse | null {
  const origin = request.headers["origin"] ?? "";
  const parsed = readPairingRequest(request.headers, origin);
  if (!parsed) {
    return {
      status: 401,
      body: { error: "unsigned", message: "This request was not signed." },
    };
  }

  // Housekeeping on every request rather than on a timer: it is O(expired) and
  // it means an idle computer never accumulates a nonce set it must later walk.
  pruneNonces(deps.state, deps.now());

  const decision = authorisePairedRequest(deps.state, parsed, deps);
  if (!decision.allowed) {
    return {
      status: statusForDenial(decision.code),
      body: { error: decision.code, message: decision.reason },
    };
  }
  return null;
}

/** `GET /status` — what this computer can do, for a device deciding whether to ask. */
export async function handleStatus(
  request: BridgeRequest,
  deps: BridgeDeps,
): Promise<BridgeResponse> {
  const refusal = authoriseBridgeRequest(request, deps);
  if (refusal) return refusal;

  const engine = await deps.describeEngine();
  if (!engine) {
    return {
      status: 503,
      body: { error: "no_engine", message: "This computer has no engine ready right now." },
    };
  }
  return { status: 200, body: engine };
}

export interface ChatStreamHandle {
  status: number;
  /** Present only when the request was authorised and the engine ran. */
  stream?: (write: (line: string) => void, signal?: AbortSignal) => Promise<void>;
  body?: unknown;
}

/**
 * `POST /chat` — newline-delimited JSON of `{ token }`, optionally `{ modelId }`.
 *
 * Note the ORDER: authorisation, then validation, then the engine. The engine
 * is not touched until both have passed.
 */
export async function handleChat(
  request: BridgeRequest,
  deps: BridgeDeps,
): Promise<ChatStreamHandle> {
  const refusal = authoriseBridgeRequest(request, deps);
  if (refusal) return { status: refusal.status, body: refusal.body };

  const body = request.body as
    | { messages?: { role: string; content: string; images?: string[] }[]; think?: boolean }
    | undefined;
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      status: 400,
      body: { error: "no_messages", message: "That request contained no messages." },
    };
  }
  if (
    messages.some(
      (m) => typeof m?.content !== "string" || !["system", "user", "assistant"].includes(m?.role),
    )
  ) {
    return {
      status: 400,
      body: { error: "bad_messages", message: "That request contained a malformed message." },
    };
  }

  return {
    status: 200,
    stream: async (write, signal) => {
      const result = await deps.streamChat(messages, {
        signal,
        think: body?.think === true,
        onToken: (token) => write(`${JSON.stringify({ token })}\n`),
      });
      if (result.modelId) write(`${JSON.stringify({ modelId: result.modelId })}\n`);
      if (!result.ok && result.reason) {
        // A failure mid-stream is reported IN the stream: the status line has
        // already been sent, so an error code is no longer available.
        write(`${JSON.stringify({ error: result.reason })}\n`);
      }
    },
  };
}

/** Route one request. The only entry point a transport should call. */
export async function handleBridgeRequest(
  request: BridgeRequest,
  deps: BridgeDeps,
): Promise<BridgeResponse | ChatStreamHandle> {
  const path = request.path.replace(/\/+$/, "") || "/";
  if (path === "/status" && request.method.toUpperCase() === "GET") {
    return handleStatus(request, deps);
  }
  if (path === "/chat" && request.method.toUpperCase() === "POST") {
    return handleChat(request, deps);
  }
  return {
    status: 404,
    body: { error: "not_found", message: "No such endpoint." },
  };
}
